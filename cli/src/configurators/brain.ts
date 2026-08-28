import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';
import {
  promptOpenRouterModelSelection,
  ModelProvider,
  OpenRouterModelProvider,
} from '../providers/openrouter';

export interface BrainConfiguratorOptions {
  modelProvider?: ModelProvider;
}

export async function configureBrain(
  _context: OrganConfiguratorContext,
  options: BrainConfiguratorOptions = {}
): Promise<OrganConfigurationResult> {
  const modelProvider = options.modelProvider || new OpenRouterModelProvider();

  while (true) {
    const { provider } = await inquirer.prompt<{ provider: string }>({
      type: 'list',
      name: 'provider',
      message: 'Brain provider?',
      choices: [
        { name: 'OpenRouter (Managed Routing & Broad Model Access)', value: 'openrouter' },
        { name: 'OpenAI-compatible / Custom endpoint (Ollama, vLLM, Azure, OpenAI)', value: 'openai-compatible' },
      ],
    });

    if (provider === 'openrouter') {
      const selection = await promptOpenRouterModelSelection(modelProvider);

      if (selection.type === 'switch_provider') {
        continue;
      }

      if (selection.type === 'cancel') {
        throw new Error('Brain configuration cancelled.');
      }

      const modelId = selection.modelId;

      return {
        config: {
          provider: 'openrouter',
          model: modelId,
          apiKeyEnv: 'OPENROUTER_API_KEY',
        },
        summary: {
          Provider: 'OpenRouter',
          Model: modelId,
        },
      };
    }

    if (provider === 'openai-compatible') {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'baseUrl',
          message: 'Endpoint Base URL:',
          default: 'https://api.openai.com/v1',
          validate: (v: string) => v.trim().length > 0 || 'Base URL is required.',
        },
        {
          type: 'input',
          name: 'model',
          message: 'Model ID (e.g. gpt-4o, llama3, mistral):',
          default: 'gpt-4o',
          validate: (v: string) => v.trim().length > 0 || 'Model ID is required.',
        },
        {
          type: 'input',
          name: 'apiKeyEnv',
          message: 'API Key environment variable name:',
          default: 'OPENAI_COMPATIBLE_API_KEY',
        },
      ]);

      return {
        config: {
          provider: 'openai-compatible',
          model: answers.model.trim(),
          baseUrl: answers.baseUrl.trim(),
          apiKeyEnv: answers.apiKeyEnv.trim() || 'OPENAI_COMPATIBLE_API_KEY',
        },
        summary: {
          Provider: 'OpenAI-compatible',
          Model: answers.model.trim(),
          'Base URL': answers.baseUrl.trim(),
        },
      };
    }
  }
}
