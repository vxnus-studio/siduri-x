import { OpenAICompatibleBrain, OpenRouterBrain } from '@siduri-x/brain';
import { SqliteMemoryStore } from '@siduri-x/memory';
import { VoiceAdapter, VoiceConfig } from '@siduri-x/voice';
import { UnifiedKnowledgeOrgan, UnifiedKnowledgeConfig } from '@siduri-x/knowledge';
import { OpenRouterVisionAdapter, OpenRouterVisionConfig } from '@siduri-x/vision';
import { ActiveSelfCompiler, SqliteSelfRepository } from '@siduri-x/self';
import { Live2DAdapter, Live2DAdapterConfig } from '@siduri-x/body';
import { FixtureObservationOrgan } from '@siduri-x/observation';
import { DefaultHandsOrgan, DefaultHandsOrganConfig } from '@siduri-x/hands';
import { DefaultEarOrgan, EarOrganConfig } from '@siduri-x/ear';
import { DefaultMouthOrgan, DefaultMouthOrganConfig } from '@siduri-x/mouth';
import { SiduriRuntime } from './runtime';

export interface AppBrainConfig {
  provider?: 'openrouter' | 'openai-compatible' | string;
  model?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  baseUrl?: string;
  timeoutMs?: number;
  [key: string]: unknown;
}

export interface AppBehaviorConfig {
  provider?: 'active_self' | 'none' | string;
  preset?: string;
  [key: string]: unknown;
}

export interface AppBootCompanionConfig {
  name: string;
  id?: string;
  brain?: AppBrainConfig;
  voice?: VoiceConfig;
  memory?: { provider?: string; connectionString?: string; maxConnections?: number; dbPath?: string; [key: string]: unknown };
  knowledge?: UnifiedKnowledgeConfig;
  vision?: OpenRouterVisionConfig;
  behavior?: AppBehaviorConfig;
  body?: Live2DAdapterConfig;
  hands?: DefaultHandsOrganConfig;
  ear?: EarOrganConfig;
  mouth?: DefaultMouthOrganConfig;
  self?: { dbPath?: string; [key: string]: unknown };
  organs?: Record<string, any>;
  [key: string]: unknown;
}

export interface BootCompanionOptions {
  observationOrgan?: FixtureObservationOrgan;
}

export function isDisabled(config?: { provider?: string }): boolean {
  return !config || config.provider === 'none';
}

export function createBrain(config?: AppBrainConfig) {
  const provider = config?.provider || 'openrouter';
  const defaultKeyEnv = provider === 'openai-compatible' ? 'OPENAI_COMPATIBLE_API_KEY' : 'OPENROUTER_API_KEY';
  const apiKey = config?.apiKey || process.env[config?.apiKeyEnv || defaultKeyEnv] || '';
  if (provider === 'openai-compatible') {
    return new OpenAICompatibleBrain({
      apiKey,
      model: config?.model || 'local-model',
      baseUrl: config?.baseUrl || 'http://127.0.0.1:1234/v1',
    });
  }
  return new OpenRouterBrain({ apiKey, model: config?.model || 'gpt-4o-mini' });
}

export function createVoice(config?: VoiceConfig) {
  return isDisabled(config)
    ? undefined
    : new VoiceAdapter({
        provider: (config?.provider as any) || 'voicevox',
        baseUrl: config?.baseUrl || process.env.VOICEVOX_URL || 'http://localhost:50021',
        speakerId: config?.speakerId || 1,
        ...config,
      });
}

export function createKnowledge(config?: UnifiedKnowledgeConfig) {
  if (isDisabled(config)) return undefined;
  const dbPath = (config?.dbPath as string) || process.env.STORAGE_PATH || process.env.SQLITE_DB_PATH || 'siduri.sqlite';
  return new UnifiedKnowledgeOrgan({
    ...config,
    dbPath,
    lifeDatabase: config?.lifeDatabase ?? true,
  });
}

export function createVision(config?: OpenRouterVisionConfig & { provider?: string }) {
  return isDisabled(config)
    ? undefined
    : new OpenRouterVisionAdapter({
        apiKey: config?.apiKey || process.env.OPENROUTER_API_KEY || '',
        model: config?.model || 'gpt-4-vision',
        ...config,
      });
}

export function createBehavior(config?: AppBehaviorConfig) {
  return isDisabled(config) ? undefined : new ActiveSelfCompiler();
}

export function createBody(config?: Live2DAdapterConfig & { provider?: string }) {
  return isDisabled(config)
    ? undefined
    : new Live2DAdapter(config);
}

export function createHands(config?: DefaultHandsOrganConfig & { provider?: string }) {
  return isDisabled(config)
    ? new DefaultHandsOrgan()
    : new DefaultHandsOrgan(config);
}

export function createEar(config?: EarOrganConfig & { provider?: string }) {
  return isDisabled(config)
    ? new DefaultEarOrgan()
    : new DefaultEarOrgan(config);
}

export function createMouth(config?: DefaultMouthOrganConfig & { provider?: string }, voice?: any) {
  return isDisabled(config)
    ? new DefaultMouthOrgan({ voice })
    : new DefaultMouthOrgan({ ...config, voice });
}

export function createMemory(config?: { provider?: string; connectionString?: string; maxConnections?: number; dbPath?: string }) {
  if (isDisabled(config)) return undefined;
  return new SqliteMemoryStore({ dbPath: config?.dbPath || process.env.STORAGE_PATH || process.env.SQLITE_DB_PATH || 'siduri.sqlite' });
}

export function createSelf(config?: { dbPath?: string }) {
  return new SqliteSelfRepository({ dbPath: config?.dbPath || process.env.STORAGE_PATH || process.env.SQLITE_DB_PATH || 'siduri.sqlite' });
}

export function createObservation(vision?: any): FixtureObservationOrgan {
  return new FixtureObservationOrgan(
    vision ?? { analyze: async () => JSON.stringify({ readings: [] }) }
  );
}

/**
 * Canonical companion bootstrapper.
 * Wires all 10 organs, runs memory migrations, and initializes the SiduriRuntime.
 */
export async function bootCompanion(
  id: string,
  config: AppBootCompanionConfig,
  options?: BootCompanionOptions
): Promise<SiduriRuntime> {
  const organs = (config as any)?.organs || {};

  const brain = createBrain(organs.brain || config?.brain);
  const memory = createMemory(organs.memory || (config as any)?.memory);
  const selfRepo = createSelf(organs.self || (config as any)?.self);
  const voice = createVoice(organs.voice || config?.voice);
  const knowledge = createKnowledge(organs.knowledge || config?.knowledge);
  const vision = createVision(organs.vision || config?.vision);
  const behavior = createBehavior(organs.behavior || config?.behavior);
  const body = createBody(organs.body || config?.body);
  const hands = createHands(organs.hands || config?.hands);
  const ear = createEar(organs.ear || config?.ear);
  const mouth = createMouth(organs.mouth || config?.mouth, voice);
  const observation = options?.observationOrgan;

  if (memory && typeof (memory as any).runMigrations === 'function') {
    await (memory as any).runMigrations().catch((e: any) => console.warn("Migrations warning:", e.message));
  }

  const runtime = new SiduriRuntime(id, config as any, {
    brain,
    memory,
    voice,
    knowledge,
    vision,
    behavior,
    body,
    hands,
    ear,
    mouth,
    observation,
    self: selfRepo,
    externalKnowledge: (knowledge as any)?.eAdapter ?? knowledge,
  });

  await runtime.initialize();
  return runtime;
}
