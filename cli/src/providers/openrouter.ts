import inquirer from 'inquirer';

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
}

export interface ModelProvider {
  listModels(): Promise<ModelOption[]>;
}

export const CURATED_OPENROUTER_MODELS: ModelOption[] = [
  { id: 'openai/gpt-4o-mini', name: 'OpenAI: GPT-4o Mini', description: 'Fast, lightweight intelligence' },
  { id: 'openai/gpt-4o', name: 'OpenAI: GPT-4o', description: 'Flagship multimodal intelligence' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic: Claude 3.5 Sonnet', description: 'State-of-the-art reasoning and coding' },
  { id: 'anthropic/claude-3-haiku', name: 'Anthropic: Claude 3 Haiku', description: 'Fast and compact' },
  { id: 'google/gemini-2.0-flash-001', name: 'Google: Gemini 2.0 Flash', description: 'Next-gen speed and multimodal capabilities' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Meta: Llama 3.3 70B Instruct', description: 'High capability open weights model' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek: DeepSeek V3', description: 'Advanced conversational and coding model' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek: DeepSeek R1', description: 'Advanced reasoning model' },
  { id: 'mistralai/mistral-large', name: 'Mistral: Mistral Large', description: 'Top-tier reasoning and multilingual model' },
];

export class OpenRouterModelProvider implements ModelProvider {
  private apiUrl: string;
  private timeoutMs: number;

  constructor(apiUrl = 'https://openrouter.ai/api/v1/models', timeoutMs = 6000) {
    this.apiUrl = apiUrl;
    this.timeoutMs = timeoutMs;
  }

  async listModels(): Promise<ModelOption[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Siduri-CLI/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const body = (await response.json()) as {
        data?: Array<{ id: string; name?: string; description?: string; context_length?: number }>;
      };

      if (!body.data || !Array.isArray(body.data) || body.data.length === 0) {
        throw new Error('Received empty or invalid model list from OpenRouter API.');
      }

      return body.data.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        description: m.description,
        contextLength: m.context_length,
      }));
    } finally {
      clearTimeout(timer);
    }
  }
}

export type ModelSelectionResult =
  | { type: 'selected'; modelId: string; modelName: string }
  | { type: 'manual'; modelId: string }
  | { type: 'switch_provider' }
  | { type: 'cancel' };

/**
 * Interactive model selector with search, pagination, and robust error recovery.
 */
export async function promptOpenRouterModelSelection(
  provider: ModelProvider = new OpenRouterModelProvider()
): Promise<ModelSelectionResult> {
  let models: ModelOption[] = [];
  let fetchFailed = false;
  let fetchError = '';

  // 1. Fetch models dynamically
  try {
    process.stdout.write('\u001b[2mFetching OpenRouter models...\u001b[0m');
    models = await provider.listModels();
    process.stdout.write('\r\u001b[32m✓\u001b[0m Fetched OpenRouter models catalog\n');
  } catch (err: any) {
    fetchFailed = true;
    fetchError = err.message || String(err);
    process.stdout.write('\r\u001b[33m!\u001b[0m Unable to fetch OpenRouter models.\n');
  }

  // 2. Handle failure if API is unreachable
  if (fetchFailed || models.length === 0) {
    console.log(`\u001b[33mReason:\u001b[0m ${fetchError || 'No models returned.'}\n`);
    const { failureAction } = await inquirer.prompt<{ failureAction: string }>({
      type: 'list',
      name: 'failureAction',
      message: 'What would you like to do?',
      choices: [
        { name: 'Retry fetching models', value: 'retry' },
        { name: 'Use curated standard models', value: 'curated' },
        { name: 'Enter model ID manually', value: 'manual' },
        { name: 'Choose another Brain provider', value: 'switch_provider' },
        { name: 'Cancel', value: 'cancel' },
      ],
    });

    if (failureAction === 'retry') {
      return promptOpenRouterModelSelection(provider);
    }
    if (failureAction === 'curated') {
      models = CURATED_OPENROUTER_MODELS;
    } else if (failureAction === 'manual') {
      const { manualId } = await inquirer.prompt<{ manualId: string }>({
        type: 'input',
        name: 'manualId',
        message: 'Model ID (e.g. openai/gpt-4o-mini):',
        default: 'openai/gpt-4o-mini',
        validate: (val) => val.trim().length > 0 || 'Please enter a model ID.',
      });
      return { type: 'manual', modelId: manualId.trim() };
    } else if (failureAction === 'switch_provider') {
      return { type: 'switch_provider' };
    } else {
      return { type: 'cancel' };
    }
  }

  // 3. Selection flow with filtering
  let currentSearch = '';
  while (true) {
    let filtered = models;
    if (currentSearch.trim()) {
      const q = currentSearch.toLowerCase();
      filtered = models.filter(
        (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
      );
    }

    const choices: Array<{ name: string; value: string } | inquirer.Separator> = [];

    // Search action at top
    if (currentSearch) {
      choices.push({
        name: `\u001b[36m⌕ Clear filter (currently: "${currentSearch}") [${filtered.length} matches]\u001b[0m`,
        value: '__CLEAR_FILTER__',
      });
    } else {
      choices.push({
        name: `\u001b[36m⌕ Search / Filter models by keyword...\u001b[0m`,
        value: '__FILTER__',
      });
    }

    choices.push(new inquirer.Separator('── Models ──'));

    if (filtered.length === 0) {
      choices.push({
        name: `\u001b[33mNo models matched "${currentSearch}". Search again or enter manually.\u001b[0m`,
        value: '__FILTER__',
      });
    } else {
      // Limit to max 40 items displayed per page to prevent UI overload
      const displayList = filtered.slice(0, 40);
      for (const m of displayList) {
        const idLabel = m.name !== m.id ? ` \u001b[2m(${m.id})\u001b[0m` : '';
        choices.push({
          name: `${m.name}${idLabel}`,
          value: m.id,
        });
      }
      if (filtered.length > 40) {
        choices.push(new inquirer.Separator(`... and ${filtered.length - 40} more (use search to refine)`));
      }
    }

    choices.push(new inquirer.Separator('── Other Options ──'));
    choices.push({ name: 'Enter model ID manually', value: '__MANUAL__' });
    choices.push({ name: 'Choose another Brain provider', value: '__SWITCH__' });

    const { selectedValue } = await inquirer.prompt<{ selectedValue: string }>({
      type: 'list',
      name: 'selectedValue',
      message: currentSearch ? `Select model (filtered by "${currentSearch}"):` : 'Select model:',
      pageSize: 15,
      choices,
    });

    if (selectedValue === '__FILTER__') {
      const { query } = await inquirer.prompt<{ query: string }>({
        type: 'input',
        name: 'query',
        message: 'Search models (e.g. claude, gpt, gemini, llama):',
      });
      currentSearch = query.trim();
      continue;
    }

    if (selectedValue === '__CLEAR_FILTER__') {
      currentSearch = '';
      continue;
    }

    if (selectedValue === '__MANUAL__') {
      const { manualId } = await inquirer.prompt<{ manualId: string }>({
        type: 'input',
        name: 'manualId',
        message: 'Model ID (e.g. openai/gpt-4o-mini):',
        default: 'openai/gpt-4o-mini',
        validate: (val) => val.trim().length > 0 || 'Please enter a model ID.',
      });
      return { type: 'manual', modelId: manualId.trim() };
    }

    if (selectedValue === '__SWITCH__') {
      return { type: 'switch_provider' };
    }

    const matchedModel = models.find((m) => m.id === selectedValue);
    return {
      type: 'selected',
      modelId: selectedValue,
      modelName: matchedModel?.name || selectedValue,
    };
  }
}
