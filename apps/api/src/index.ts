import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Express } from 'express';
import { createApp, AppInstance } from './app';
import { SiduriRuntime } from './runtime';
import { OpenAICompatibleBrain, OpenRouterBrain } from '@siduri-x/brain';
import { PostgresMemoryOrgan } from '@siduri-x/memory';
import { VoiceAdapter } from '@siduri-x/voice';
import { EKnowledgeAdapter } from '@siduri-x/knowledge';
import { OpenRouterVisionAdapter } from '@siduri-x/vision';
import { ActiveSelfCompiler } from '@siduri-x/behavior';
import { Live2DAdapter } from '@siduri-x/body';
import { FixtureObservationOrgan } from '@siduri-x/observation';

export { createApp, AppInstance };
export * from './context-mapper';

const runtimes = new Map<string, SiduriRuntime>();
const instance: AppInstance = createApp(runtimes);
export const app: Express = instance.app;
export default app;

function createBrain(config: any) {
  const provider = config.provider || 'openrouter';
  const defaultKeyEnv = provider === 'openai-compatible' ? 'OPENAI_COMPATIBLE_API_KEY' : 'OPENROUTER_API_KEY';
  const apiKey = config.apiKey || process.env[config.apiKeyEnv || defaultKeyEnv] || '';
  if (provider === 'openai-compatible') {
    return new OpenAICompatibleBrain({
      apiKey,
      model: config.model || 'local-model',
      baseUrl: config.baseUrl || 'http://127.0.0.1:1234/v1',
    });
  }
  return new OpenRouterBrain({ apiKey, model: config.model || 'gpt-4o-mini' });
}

function isDisabled(config: any): boolean {
  return !config || config.provider === 'none';
}

function createVoice(config: any) {
  return isDisabled(config)
    ? undefined
    : new VoiceAdapter({ provider: config.provider || 'voicevox', baseUrl: process.env.VOICEVOX_URL || 'http://localhost:50021', speakerId: config.speakerId || 1 });
}

function createKnowledge(config: any) {
  if (isDisabled(config)) return undefined;
  if (!config?.packPath && !config?.registryUrl && !config?.baseUrl && !config?.hubUrl) {
    return undefined;
  }
  return new EKnowledgeAdapter(config);
}

function createVision(config: any) {
  return isDisabled(config)
    ? undefined
    : new OpenRouterVisionAdapter({ apiKey: process.env.OPENROUTER_API_KEY || '', model: config.model || 'gpt-4-vision' });
}

function createBehavior(config: any) {
  return isDisabled(config) ? undefined : new ActiveSelfCompiler();
}

function createBody(config: any) {
  return isDisabled(config)
    ? undefined
    : new Live2DAdapter(config);
}

const PORT = process.env.PORT || 3001;

const defaultCompanionConfig = {
  id: 'default',
  name: 'Siduri',
  brain: { provider: 'openrouter', model: 'gpt-4o-mini' },
  voice: { provider: 'voicevox', speakerId: 1 },
  memory: { provider: 'postgres' },
  knowledge: {
    provider: (process.env.SIDURI_KNOWLEDGE_PROVIDER as 'e-knowledge' | 'e-remote' | 'e-hub') || 'e-knowledge',
    packPath: process.env.SIDURI_KNOWLEDGE_PACK || '',
    registryUrl: process.env.SIDURI_KNOWLEDGE_REGISTRY_URL || '',
    packId: process.env.SIDURI_KNOWLEDGE_PACK_ID || '',
    timeoutMs: Number(process.env.SIDURI_KNOWLEDGE_TIMEOUT_MS || 5000),
    preferredMode: (process.env.SIDURI_KNOWLEDGE_MODE as 'lexical' | 'semantic' | 'hybrid') || 'lexical',
  },
  behavior: { provider: 'active_self' },
  body: {
    provider: 'live2d',
  },
  vision: { provider: 'openrouter', model: 'gpt-4-vision' }
};

async function loadCompanionConfig() {
  const configPath = process.env.SIDURI_CONFIG || path.resolve(process.cwd(), 'siduri.config.json');
  let fileConfig: Record<string, any> = {};
  try {
    fileConfig = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, any>;
    console.log(`Loaded companion configuration from ${configPath}`);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw new Error(`Unable to read ${configPath}: ${error.message}`);
    console.log(`No ${configPath} found; using environment/default configuration.`);
  }

  const config: any = {
    ...defaultCompanionConfig,
    ...fileConfig,
    id: fileConfig.id || defaultCompanionConfig.id,
    brain: { ...defaultCompanionConfig.brain, ...fileConfig.brain },
    voice: { ...defaultCompanionConfig.voice, ...fileConfig.voice },
    memory: { ...defaultCompanionConfig.memory, ...fileConfig.memory },
    knowledge: { ...defaultCompanionConfig.knowledge, ...fileConfig.knowledge },
    behavior: { ...defaultCompanionConfig.behavior, ...fileConfig.behavior },
    body: { ...defaultCompanionConfig.body, ...fileConfig.body },
    vision: { ...defaultCompanionConfig.vision, ...fileConfig.vision },
  };

  if (process.env.SIDURI_KNOWLEDGE_PROVIDER) config.knowledge.provider = process.env.SIDURI_KNOWLEDGE_PROVIDER;
  if (process.env.SIDURI_KNOWLEDGE_PACK) config.knowledge.packPath = process.env.SIDURI_KNOWLEDGE_PACK;
  if (process.env.SIDURI_KNOWLEDGE_REGISTRY_URL) config.knowledge.registryUrl = process.env.SIDURI_KNOWLEDGE_REGISTRY_URL;
  if (process.env.SIDURI_KNOWLEDGE_PACK_ID) config.knowledge.packId = process.env.SIDURI_KNOWLEDGE_PACK_ID;
  if (process.env.SIDURI_KNOWLEDGE_MODE) config.knowledge.preferredMode = process.env.SIDURI_KNOWLEDGE_MODE;
  return config;
}

async function bootDefaultCompanion() {
  if (runtimes.has('default')) return;
  console.log("Booting default companion...");
  const config: any = await loadCompanionConfig();
  
  const brain = createBrain(config.brain);
  const memory = new PostgresMemoryOrgan({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/siduri' });
  const voice = createVoice(config.voice);
  const knowledge = createKnowledge(config.knowledge);
  const vision = createVision(config.vision);
  const observation = new FixtureObservationOrgan(
    vision ?? { analyze: async () => JSON.stringify({ readings: [] }) },
  );
  instance.setObservationOrgan(observation);
  const behavior = createBehavior(config.behavior);
  const body = createBody(config.body);

  await memory.runMigrations().catch(e => console.warn("Migrations warning:", e.message));

  const runtime = new SiduriRuntime('default', config as any, { brain, memory, voice, knowledge, vision, behavior, body });
  await runtime.initialize();

  runtimes.set('default', runtime);
  console.log("Default companion booted successfully.");
}

if (process.env.NODE_ENV !== 'test') {
  bootDefaultCompanion().then(() => {
    app.listen(Number(PORT), '127.0.0.1', () => {
      console.log(`Siduri-X API running on port ${PORT} (127.0.0.1)`);
    });
  }).catch(e => {
    console.error("Failed to boot default companion:", e);
    process.exit(1);
  });
}
