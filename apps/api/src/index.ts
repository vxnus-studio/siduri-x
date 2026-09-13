import dotenv from 'dotenv';
dotenv.config();

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Express } from 'express';
import { createApp, AppInstance } from './app';
import { SiduriRuntime } from './runtime';
import { bootCompanion, createVision, createObservation } from './boot';

export { createApp, AppInstance };
export * from './context-mapper';
export * from './boot';

const runtimes = new Map<string, SiduriRuntime>();
const instance: AppInstance = createApp(runtimes);
export const app: Express = instance.app;
export default app;

const PORT = process.env.PORT || 3001;

const defaultCompanionConfig = {
  id: 'default',
  name: 'Siduri',
  brain: { provider: 'openrouter', model: 'gpt-4o-mini' },
  voice: { provider: 'voicevox', speakerId: 1 },
  memory: { provider: 'sqlite' },
  knowledge: {
    provider: (process.env.SIDURI_KNOWLEDGE_PROVIDER as any) || 'unified',
    lifeDatabase: true,
    dbPath: process.env.STORAGE_PATH || process.env.SQLITE_DB_PATH || 'siduri.sqlite',
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
  if (process.env.SIDURI_KNOWLEDGE_DB_PATH) config.knowledge.dbPath = process.env.SIDURI_KNOWLEDGE_DB_PATH;
  return config;
}

async function bootDefaultCompanion() {
  if (runtimes.has('default')) return;
  console.log("Booting default companion...");
  const config: any = await loadCompanionConfig();

  const vision = createVision(config.vision);
  const observation = createObservation(vision);
  instance.setObservationOrgan(observation);

  const runtime = await bootCompanion('default', config, { observationOrgan: observation });
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
