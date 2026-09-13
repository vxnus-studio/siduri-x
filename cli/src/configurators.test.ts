import inquirer from 'inquirer';
import { OrganRegistry } from './discovery';
import { generateInstanceFiles } from './generator';
import { formatReviewSummary } from './index';
import {
  OpenRouterModelProvider,
  CURATED_OPENROUTER_MODELS,
  ModelOption,
} from './providers/openrouter';
import {
  KnowledgeHubClient,
  validateKnowledgeManifest,
  extractCapabilitiesList,
  KNOWN_KNOWLEDGE_PACKS,
} from './providers/knowledge-hub';
import { configureBrain } from './configurators/brain';
import { configureKnowledge } from './configurators/knowledge';
import { configureMemory } from './configurators/memory';
import { configureVoice } from './configurators/voice';
import { configureBody } from './configurators/body';
import { configureHands } from './configurators/hands';
import { configureBehavior } from './configurators/behavior';
import { configureVision } from './configurators/vision';
import { configureOrgan } from './configurators';

// Mock inquirer.prompt
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
  Separator: jest.fn((label) => ({ type: 'separator', line: label })),
}));

describe('Guided Manifest-Driven Configuration UX Specification Tests', () => {
  const registry = OrganRegistry.discover();
  const brainManifest = registry.get('brain')!;
  const knowledgeManifest = registry.get('knowledge')!;
  const memoryManifest = registry.get('memory')!;
  const voiceManifest = registry.get('voice')!;
  const bodyManifest = registry.get('body')!;
  const handsManifest = registry.get('hands')!;
  const behaviorManifest = registry.get('behavior')!;
  const visionManifest = registry.get('vision')!;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Discrepancy #1: OpenRouter Model Discovery & Brain Configurator', () => {
    test('OpenRouter model provider parses model catalog correctly', async () => {
      const mockModels = [
        { id: 'openai/gpt-4o-mini', name: 'OpenAI: GPT-4o Mini', description: 'Fast model', context_length: 128000 },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic: Claude 3.5 Sonnet', context_length: 200000 },
      ];

      const globalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockModels }),
      } as any);

      const provider = new OpenRouterModelProvider('https://mock-api.com/models');
      const models = await provider.listModels();

      expect(models.length).toBe(2);
      expect(models[0].id).toBe('openai/gpt-4o-mini');
      expect(models[0].name).toBe('OpenAI: GPT-4o Mini');
      expect(models[1].id).toBe('anthropic/claude-3.5-sonnet');

      global.fetch = globalFetch;
    });

    test('Brain configurator selects OpenRouter model and retains canonical model ID', async () => {
      const mockProvider = {
        listModels: jest.fn().mockResolvedValue([
          { id: 'openai/gpt-4o-mini', name: 'OpenAI: GPT-4o Mini' },
          { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic: Claude 3.5 Sonnet' },
        ]),
      };

      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'openrouter' }) // Brain provider
        .mockResolvedValueOnce({ selectedValue: 'openai/gpt-4o-mini' }); // Select model

      const result = await configureBrain(
        { companionName: 'Sparkle', manifest: brainManifest },
        { modelProvider: mockProvider }
      );

      expect(result.config.provider).toBe('openrouter');
      expect(result.config.model).toBe('openai/gpt-4o-mini');
      expect(result.summary?.Model).toBe('openai/gpt-4o-mini');
      expect(result.summary?.Provider).toBe('OpenRouter');
    });

    test('Brain configurator handles discovery failure with curated fallback models', async () => {
      const failingProvider = {
        listModels: jest.fn().mockRejectedValue(new Error('Network request failed')),
      };

      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'openrouter' }) // Brain provider
        .mockResolvedValueOnce({ failureAction: 'curated' }) // Pick curated fallback
        .mockResolvedValueOnce({ selectedValue: 'anthropic/claude-3.5-sonnet' }); // Select model

      const result = await configureBrain(
        { companionName: 'Sparkle', manifest: brainManifest },
        { modelProvider: failingProvider }
      );

      expect(result.config.provider).toBe('openrouter');
      expect(result.config.model).toBe('anthropic/claude-3.5-sonnet');
    });

    test('Brain configurator handles discovery failure with manual fallback entry', async () => {
      const failingProvider = {
        listModels: jest.fn().mockRejectedValue(new Error('Network request failed')),
      };

      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'openrouter' })
        .mockResolvedValueOnce({ failureAction: 'manual' })
        .mockResolvedValueOnce({ manualId: 'mistralai/mistral-large' });

      const result = await configureBrain(
        { companionName: 'Sparkle', manifest: brainManifest },
        { modelProvider: failingProvider }
      );

      expect(result.config.provider).toBe('openrouter');
      expect(result.config.model).toBe('mistralai/mistral-large');
    });

    test('Brain configurator supports OpenAI-compatible / Custom endpoint', async () => {
      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'openai-compatible' })
        .mockResolvedValueOnce({
          baseUrl: 'http://localhost:11434/v1',
          model: 'llama3:latest',
          apiKeyEnv: 'OLLAMA_API_KEY',
        });

      const result = await configureBrain(
        { companionName: 'Sparkle', manifest: brainManifest }
      );

      expect(result.config.provider).toBe('openai-compatible');
      expect(result.config.model).toBe('llama3:latest');
      expect(result.config.baseUrl).toBe('http://localhost:11434/v1');
      expect(result.config.apiKeyEnv).toBe('OLLAMA_API_KEY');
    });
  });

  describe('Discrepancy #2 & #3: Knowledge Choices & Manifest Metadata Confirmation', () => {
    test('Declining external pack uses sovereign Life Database by default and skips discovery', async () => {
      (inquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({ useExternalPack: false });

      const result = await configureKnowledge({
        companionName: 'Sparkle',
        manifest: knowledgeManifest,
      });

      expect(result.config.provider).toBe('unified');
      expect(result.config.lifeDatabase).toBe(true);
      expect(result.summary?.['Life Database']).toBe('Enabled (siduri.sqlite)');
      expect(result.summary?.['E-Pack']).toBe('None');
    });

    test('Attaching E Knowledge Hub pack discovers manifest and configures remote provider automatically', async () => {
      const mockClient = {
        resolveProvider: jest.fn().mockResolvedValue({
          name: 'e-teyvat',
          displayName: 'E Teyvat',
          package: '@vxnus/e-teyvat',
          version: '1.2.0',
          description: 'Teyvat knowledge provider for Siduri.',
          capabilities: ['Search', 'Retrieval', 'Context injection'],
          distributionType: 'remote',
          distribution: {
            kind: 'provider',
            url: 'https://teyvat.e.vxnus.xyz',
          },
          source: 'E Knowledge Hub',
        }),
      } as unknown as KnowledgeHubClient;

      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ useExternalPack: true }) // Attach external pack
        .mockResolvedValueOnce({ packId: '@vxnus/e-teyvat' }); // Package ID

      const result = await configureKnowledge(
        { companionName: 'Sparkle', manifest: knowledgeManifest },
        { client: mockClient }
      );

      expect(result.config.provider).toBe('e-hub');
      expect(result.config.packId).toBe('@vxnus/e-teyvat');
      expect(result.summary?.Source).toBe('E Knowledge Hub');
      expect(result.summary?.Provider).toBe('E Teyvat');
      expect(result.summary?.Package).toBe('@vxnus/e-teyvat');
      expect(result.summary?.Version).toBe('1.2.0');
      expect(result.summary?.['E-Pack']).toContain('Remote');
    });

    test('Attaching hybrid pack allows choosing between remote and local with automated path', async () => {
      const mockClient = {
        resolveProvider: jest.fn().mockResolvedValue({
          name: 'e-teyvat',
          displayName: 'E Teyvat',
          package: '@vxnus/e-teyvat',
          version: '1.2.0',
          description: 'Teyvat knowledge provider for Siduri.',
          capabilities: ['Search', 'Retrieval', 'Context injection'],
          distributionType: 'both',
          distribution: {
            kind: 'archive',
            url: 'https://knowledge.e.vxnus.xyz/archives/teyvat.tar.gz',
          },
          source: 'E Knowledge Hub',
        }),
      } as unknown as KnowledgeHubClient;

      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ useExternalPack: true })
        .mockResolvedValueOnce({ packId: '@vxnus/e-teyvat' })
        .mockResolvedValueOnce({ selectedMode: 'local' });

      const result = await configureKnowledge(
        { companionName: 'Sparkle', manifest: knowledgeManifest },
        { client: mockClient }
      );

      expect(result.config.provider).toBe('e-knowledge');
      expect(result.config.packPath).toBe('./assets/knowledge/vxnus-e-teyvat');
      expect(result.summary?.['E-Pack']).toContain('Local @ ./assets/knowledge/vxnus-e-teyvat');
    });

    test('Knowledge manifest validation enforces name and version', () => {
      expect(() => validateKnowledgeManifest({})).toThrow('Invalid knowledge manifest');
      expect(() => validateKnowledgeManifest({ name: 'test' })).toThrow('missing \'version\'');

      const valid = validateKnowledgeManifest({
        name: 'e-teyvat',
        displayName: 'E Teyvat',
        version: '1.0.0',
        description: 'Teyvat lore',
      }, '@vxnus/e-teyvat');

      expect(valid.name).toBe('e-teyvat');
      expect(valid.package).toBe('@vxnus/e-teyvat');
      expect(valid.version).toBe('1.0.0');
    });

    test('extractCapabilitiesList formats object and array capabilities correctly', () => {
      const arrayCaps = extractCapabilitiesList(['Search', 'Retrieval', 'Custom Tool']);
      expect(arrayCaps).toEqual(['Search', 'Retrieval', 'Custom Tool']);

      const objCaps = extractCapabilitiesList({
        search: true,
        retrieval: true,
        contextInjection: true,
        semanticSearch: true,
      });
      expect(objCaps).toContain('Search');
      expect(objCaps).toContain('Retrieval');
      expect(objCaps).toContain('Context injection');
      expect(objCaps).toContain('Semantic search');
    });

    test('Knowledge Hub client fallback returns known pack for @vxnus/e-teyvat', async () => {
      const client = new KnowledgeHubClient('https://invalid-non-existent-url.local/api');
      const manifest = await client.resolveProvider('@vxnus/e-teyvat');
      expect(manifest.package).toBe('@vxnus/e-teyvat');
      expect(manifest.displayName).toBe('E Teyvat');
      expect(manifest.version).toBe('1.2.0');
    });
  });

  describe('Other Organ Configurators & Generic Router', () => {
    test('Memory configurator configures SQLite with WAL and FTS5', async () => {
      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'sqlite' });

      const result = await configureMemory({ companionName: 'Sparkle', manifest: memoryManifest });
      expect(result.config.provider).toBe('sqlite');
      expect(result.summary?.Database).toBe('SQLite (WAL + FTS5)');
      expect(result.summary?.Storage).toBe('siduri.sqlite');
    });

    test('Voice configurator configures VOICEVOX engine and speaker ID', async () => {
      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'voicevox' })
        .mockResolvedValueOnce({ baseUrl: 'http://localhost:50021' })
        .mockResolvedValueOnce({ speaker: { id: 2, label: '四国めたん (Shikoku Metan) - ノーマル (Normal) (ID: 2)' } });

      const result = await configureVoice({ companionName: 'Sparkle', manifest: voiceManifest });
      expect(result.config.provider).toBe('voicevox');
      expect(result.config.speakerId).toBe(2);
      expect(result.summary?.['Speaker ID']).toBe(2);
    });

    test('Voice configurator configures RVC with Base TTS Engine', async () => {
      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'rvc' })
        .mockResolvedValueOnce({
          modelPath: './assets/voice/sparkle/sparkle.pth',
          indexPath: './assets/voice/sparkle/sparkle.index',
          pitchShift: '12',
          f0Method: 'rmvpe',
          baseTts: 'edge-tts',
          serviceUrl: 'http://localhost:50055',
        });

      const result = await configureVoice({ companionName: 'Sparkle', manifest: voiceManifest });
      expect(result.config.provider).toBe('edge-tts');
      expect((result.config as any).rvc.enabled).toBe(true);
      expect((result.config as any).rvc.pitchShift).toBe(12);
      expect(result.summary?.['Base TTS']).toBe('edge-tts');
    });

    test('Voice configurator disables voice when none is selected', async () => {
      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'none' });

      const result = await configureVoice({ companionName: 'Sparkle', manifest: voiceManifest });
      expect(result.config.provider).toBe('none');
      expect(result.summary?.Provider).toBe('None (Voice disabled)');
    });

    test('Voice configurator configures RVC with Kokoro as Base TTS Engine', async () => {
      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'rvc' })
        .mockResolvedValueOnce({
          modelPath: './assets/voice/sparkle/sparkle.pth',
          indexPath: './assets/voice/sparkle/sparkle.index',
          pitchShift: '0',
          f0Method: 'pm',
          baseTts: 'kokoro',
          serviceUrl: 'http://localhost:50055',
        });

      const result = await configureVoice({ companionName: 'Sparkle', manifest: voiceManifest });
      expect(result.config.provider).toBe('kokoro');
      expect((result.config as any).rvc.enabled).toBe(true);
      expect(result.summary?.['Base TTS']).toBe('kokoro');
    });

    test('Voice configurator configures RVC with Piper as Base TTS Engine', async () => {
      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'rvc' })
        .mockResolvedValueOnce({
          modelPath: './assets/voice/sparkle/sparkle.pth',
          indexPath: '',
          pitchShift: '-6',
          f0Method: 'harvest',
          baseTts: 'piper',
          serviceUrl: 'http://localhost:50055',
        });

      const result = await configureVoice({ companionName: 'Sparkle', manifest: voiceManifest });
      expect(result.config.provider).toBe('piper');
      expect((result.config as any).rvc.enabled).toBe(true);
      expect((result.config as any).rvc.pitchShift).toBe(-6);
      expect(result.summary?.['Base TTS']).toBe('piper');
    });

    test('Body configurator configures Live2D, custom model path, and expression', async () => {
      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'live2d' })
        .mockResolvedValueOnce({
          modelSource: './assets/body/sparkle/model.model3.json',
          initialExpression: 'happy',
        });

      const result = await configureBody({ companionName: 'Sparkle', manifest: bodyManifest });
      expect(result.config.provider).toBe('live2d');
      expect(result.config.modelPath).toBe('./assets/body/sparkle/model.model3.json');
      expect(result.config.modelUrl).toBe('/assets/body/sparkle/model.model3.json');
      expect(result.config.initialExpression).toBe('happy');
      expect(result.summary?.['Model Path']).toBe('./assets/body/sparkle/model.model3.json');
    });

    test('Hands configurator configures MCP tool execution timeout', async () => {
      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ provider: 'mcp' })
        .mockResolvedValueOnce({ timeoutSeconds: '15' });

      const result = await configureHands({ companionName: 'Sparkle', manifest: handsManifest });
      expect(result.config.defaultTimeoutMs).toBe(15000);
      expect(result.summary?.Provider).toBeUndefined();
    });

    test('Hands configurator disables tool execution when none is selected', async () => {
      (inquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({ provider: 'none' });

      const result = await configureHands({ companionName: 'Sparkle', manifest: handsManifest });
      expect(result.config.provider).toBe('none');
      expect(result.summary?.Provider).toBe('None (Hands disabled)');
    });

    test('Behavior configurator configures active self personality preset', async () => {
      (inquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({ preset: 'cheerful' });

      const result = await configureBehavior({ companionName: 'Sparkle', manifest: behaviorManifest });
      expect(result.config.provider).toBe('active_self');
      expect(result.config.preset).toBe('cheerful');
    });

    test('Vision configurator configures OpenRouter vision model', async () => {
      (inquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({ model: 'gpt-4-vision' });

      const result = await configureVision({ companionName: 'Sparkle', manifest: visionManifest });
      expect(result.config.provider).toBe('openrouter');
      expect(result.config.model).toBe('gpt-4-vision');
    });

    test('Vision configurator disables vision when none is selected', async () => {
      (inquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({ model: 'none' });

      const result = await configureVision({ companionName: 'Sparkle', manifest: visionManifest });
      expect(result.config.provider).toBe('none');
      expect(result.summary?.Provider).toBe('None (Vision disabled)');
    });
  });

  describe('Review Summary Formatting & Generator Integration', () => {
    test('formatReviewSummary displays actual configuration values and metadata', () => {
      const summaryOutput = formatReviewSummary(
        'Sparkle',
        [brainManifest, memoryManifest, knowledgeManifest, voiceManifest],
        {
          brain: { Provider: 'OpenRouter', Model: 'openai/gpt-4o-mini' },
          memory: { Database: 'SQLite (WAL + FTS5)', Storage: 'siduri.sqlite' },
          knowledge: { Source: 'E Knowledge Hub', Provider: 'E Teyvat', Package: '@vxnus/e-teyvat', Version: '1.2.0' },
          voice: { Provider: 'VOICEVOX', 'Speaker ID': 1 },
        }
      );

      expect(summaryOutput).toContain('Sparkle');
      expect(summaryOutput).toContain('Brain');
      expect(summaryOutput).toContain('OpenRouter');
      expect(summaryOutput).toContain('openai/gpt-4o-mini');
      expect(summaryOutput).toContain('Memory');
      expect(summaryOutput).toContain('SQLite');
      expect(summaryOutput).toContain('siduri.sqlite');
      expect(summaryOutput).toContain('Knowledge');
      expect(summaryOutput).toContain('E Knowledge Hub');
      expect(summaryOutput).toContain('E Teyvat');
      expect(summaryOutput).toContain('@vxnus/e-teyvat');
      expect(summaryOutput).toContain('Voice');
      expect(summaryOutput).toContain('VOICEVOX');
    });

    test('generateInstanceFiles accurately embeds configured organ values in siduri.config.json', () => {
      const organConfigs = {
        brain: { provider: 'openrouter', model: 'openai/gpt-4o-mini', apiKeyEnv: 'OPENROUTER_API_KEY' },
        memory: { provider: 'sqlite' },
        knowledge: { provider: 'e-hub', registryUrl: 'https://e.vxnus.xyz/api/v1/knowledge', packId: '@vxnus/e-teyvat' },
        voice: { provider: 'voicevox', speakerId: 2, baseUrl: 'http://localhost:50021' },
      };

      const files = generateInstanceFiles({
        name: 'Sparkle',
        selectedManifests: [brainManifest, memoryManifest, knowledgeManifest, voiceManifest],
        organConfigs,
      });

      const config = JSON.parse(files['siduri.config.json']);
      expect(config.name).toBe('Sparkle');
      expect(config.organs.brain.provider).toBe('openrouter');
      expect(config.organs.brain.model).toBe('openai/gpt-4o-mini');
      expect(config.organs.memory.provider).toBe('sqlite');
      expect(config.organs.knowledge.provider).toBe('e-hub');
      expect(config.organs.knowledge.packId).toBe('@vxnus/e-teyvat');
      expect(config.organs.voice.speakerId).toBe(2);

      // Verify explicit imports in src/index.js
      expect(files['src/index.js']).toContain("import { OpenRouterBrain } from '@siduri-x/brain'");
      expect(files['src/index.js']).toContain("import { SqliteMemoryStore } from '@siduri-x/memory'");
      expect(files['src/index.js']).toContain("import { UnifiedKnowledgeOrgan } from '@siduri-x/knowledge'");
      expect(files['src/index.js']).toContain("import { VoiceAdapter } from '@siduri-x/voice'");
    });
  });
});
