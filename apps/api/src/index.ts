import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SiduriRuntime } from './runtime';
import { OpenAICompatibleBrain, OpenRouterBrain } from '@siduri-y/brain';
import { PostgresMemoryOrgan } from '@siduri-y/memory';
import { VoicevoxAdapter } from '@siduri-y/voice';
import { EKnowledgeAdapter } from '@siduri-y/knowledge';
import { OpenRouterVisionAdapter } from '@siduri-y/vision';
import { ActiveSelfCompiler } from '@siduri-y/behavior';
import { Live2DAdapter } from '@siduri-y/body';
import { FixtureObservationOrgan } from '@siduri-y/observation';
import { attachIdentity, requireRole, Identity } from './auth';

const app = express();
app.use(cors());
app.use(express.json());

const runtimes = new Map<string, SiduriRuntime>();
let observationOrgan: FixtureObservationOrgan | undefined;

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
    : new VoicevoxAdapter({ baseUrl: process.env.VOICEVOX_URL || 'http://localhost:50021', speakerId: config.speakerId || 1 });
}

function createKnowledge(config: any) {
  return isDisabled(config) ? undefined : new EKnowledgeAdapter(config);
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
    : new Live2DAdapter({ port: 8089, vtsUrl: config.vtsUrl || process.env.VTS_URL, vtsAuthToken: config.vtsAuthToken || process.env.VTS_AUTH_TOKEN });
}

app.post('/boot', requireRole(['OWNER']), async (req, res) => {
  try {
    const { id, config } = req.body;
    if (runtimes.has(id)) {
      return res.status(400).json({ error: "Already booted" });
    }

    const brain = createBrain(config.brain);
    const memory = new PostgresMemoryOrgan({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/siduri' });
    const voice = createVoice(config.voice);
    const knowledge = createKnowledge(config.knowledge);
    const vision = createVision(config.vision);
    const behavior = createBehavior(config.behavior);
    const body = createBody(config.body);

    const runtime = new SiduriRuntime(id, config, { brain, memory, voice, knowledge, vision, behavior, body });
    await runtime.initialize();

    runtimes.set(id, runtime);
    res.json({ success: true, id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// STATUS / HEALTH ENDPOINTS
app.get('/health', (req, res) => res.json({ status: "ok" }));
app.get('/version', (req, res) => res.json({ name: "siduri-y-api", version: "0.2.0-y" }));
app.get('/ready', (req, res) => res.json({ status: "ready", dependencies: {} }));
app.get('/voice/health', (req, res) => res.json({ provider: "voicevox", healthy: true }));
app.get('/obs/health', (req, res) => res.json({ connected: true }));
app.get('/platforms/status', (req, res) => res.json({ platforms: {} }));
app.get('/me', attachIdentity, (req, res) => {
  const identity = (req as any).identity as Identity;
  res.json({ name: "Primary User", role: identity.role });
});
app.put('/me', requireRole(['OWNER']), (req, res) => res.json({ success: true }));

// CHAT
app.post('/chat', attachIdentity, async (req, res) => {
  const { id, message, history } = req.body;
  const identity = (req as any).identity as Identity;
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });

  try {
    // `/chat` is Siduri's private chat surface. Viewer/platform traffic will
    // use a separate event path once platform parity is migrated.
    const response = await runtime.handleUserMessage(message, 'OWNER', history);
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// MEMORY GETTERS
app.get('/memory/proposals', requireRole(['OWNER', 'OPERATOR']), async (req, res) => {
  const id = req.query.id as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    const proposals = await runtime.memory.getPendingClaims();
    res.json({ proposals });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/memory', requireRole(['OWNER', 'OPERATOR']), async (req, res) => {
  const id = req.query.id as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    const items = await runtime.memory.getClaims();
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/memory/claims', requireRole(['OWNER', 'OPERATOR']), async (req, res) => {
  const id = req.query.id as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    const claims = await runtime.memory.getClaims();
    res.json({ claims });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/memory/behavioral', requireRole(['OWNER', 'OPERATOR']), async (req, res) => {
  const id = req.query.id as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    const directives = await runtime.memory.getDirectives();
    res.json({ directives });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// MEMORY MUTATIONS - PROPOSALS
app.post('/memory/proposals/update', requireRole(['OWNER', 'OPERATOR']), async (req, res) => res.json({ success: true }));

app.post('/memory/proposals/approve', requireRole(['OWNER', 'OPERATOR']), async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.approveClaim(req.body.id);
    res.json({ approved: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/proposals/reject', requireRole(['OWNER', 'OPERATOR']), async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.rejectClaim(req.body.id);
    res.json({ rejected: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// MEMORY MUTATIONS - BEHAVIORAL
app.post('/memory/behavioral/approve', requireRole(['OWNER']), async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.approveDirective(req.body.id);
    res.json({ approved: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/behavioral/reject', requireRole(['OWNER']), async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.rejectDirective(req.body.id);
    res.json({ rejected: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/behavioral/revoke', requireRole(['OWNER']), async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.revokeDirective(req.body.id);
    res.json({ revoked: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/behavioral/disable', requireRole(['OWNER']), async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.disableDirective(req.body.id);
    res.json({ disabled: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/dev/memory/reset', requireRole(['OWNER']), async (req, res) => res.json({ reset: true }));

// MOCKS / DEV / EVIDENCE / PLATFORMS
app.get('/platforms/events', (req, res) => res.json({ events: [] }));
app.get('/platforms/actions', (req, res) => res.json({ actions: [] }));
app.get('/evidence', (req, res) => res.json({ results: [] }));
app.get('/observations', (req, res) => res.json({ observations: observationOrgan?.current() ?? [] }));

app.post('/dev/mock-response', (req, res) => res.json({ accepted: true }));
app.post('/dev/observe-and-respond', (req, res) => res.json({ accepted: true }));
app.post('/dev/approve-response', (req, res) => res.json({ approved: true }));
app.post('/dev/mock-observation', async (req, res) => {
  if (!observationOrgan) return res.status(503).json({ accepted: false, reason: 'observation_unavailable' });
  const result = await observationOrgan.ingest(
    new Uint8Array([115, 121, 110, 116, 104, 101, 116, 105, 99]),
    'fixture-genshin',
    'configured-vision',
  );
  if (!result.observation) return res.status(result.duplicate ? 200 : 409).json({ accepted: false, ...result });
  res.status(202).json({ accepted: true, observation: result.observation });
});

app.post('/platforms/actions/suggest', (req, res) => res.json({ suggested: true }));
app.post('/platforms/actions/approve', (req, res) => res.json({ approved: true }));
app.post('/platforms/actions/reject', (req, res) => res.json({ rejected: true }));
app.post('/platforms/actions/send', (req, res) => res.json({ sent: true }));


const PORT = process.env.PORT || 3001;

const defaultCompanionConfig = {
  id: 'default',
  name: 'Siduri',
  brain: { provider: 'openrouter', model: 'gpt-4o-mini' },
  voice: { provider: 'voicevox', speakerId: 1 },
  memory: { provider: 'postgres' },
  knowledge: {
    // Knowledge must be installed or explicitly configured; Siduri does not
    // assume ownership of a particular Hub project.
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
    vtsUrl: process.env.VTS_URL || 'ws://127.0.0.1:8001',
    vtsAuthToken: process.env.VTS_AUTH_TOKEN || '',
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
  if (process.env.VTS_URL) config.body.vtsUrl = process.env.VTS_URL;
  if (process.env.VTS_AUTH_TOKEN) config.body.vtsAuthToken = process.env.VTS_AUTH_TOKEN;
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
  observationOrgan = new FixtureObservationOrgan(
    vision ?? { analyze: async () => JSON.stringify({ readings: [] }) },
  );
  const behavior = createBehavior(config.behavior);
  const body = createBody(config.body);

  await memory.runMigrations().catch(e => console.warn("Migrations warning:", e.message));

  const runtime = new SiduriRuntime('default', config as any, { brain, memory, voice, knowledge, vision, behavior, body });
  await runtime.initialize();

  runtimes.set('default', runtime);
  console.log("Default companion booted successfully.");
}

bootDefaultCompanion().then(() => {
  app.listen(PORT, () => {
    console.log(`Siduri-Y API running on port ${PORT}`);
  });
}).catch(e => {
  console.error("Failed to boot default companion:", e);
  process.exit(1);
});
