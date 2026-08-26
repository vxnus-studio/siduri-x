import express, { Express } from 'express';
import cors from 'cors';
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
import { mapRequestContext } from './context-mapper';

export interface AppInstance {
  app: Express;
  runtimes: Map<string, SiduriRuntime>;
  setObservationOrgan: (org: FixtureObservationOrgan) => void;
}

export function createApp(runtimes: Map<string, SiduriRuntime> = new Map()): AppInstance {
  const app: Express = express();
  app.use(cors());
  app.use(express.json());

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

  // CHAT (API context boundary validation)
  app.post('/chat', attachIdentity, async (req, res) => {
    const { id, message, history } = req.body;
    const identity = (req as any).identity as Identity;

    // Call context mapper at the API boundary
    const mappingResult = mapRequestContext(
      {
        ...req.body,
        id: id || req.body.companionId,
        role: req.body.role || identity?.role,
        generateCorrelationId: true,
      },
      {
        endpointPolicy: 'public',
        defaultPublicAudience: 'audience-public',
      }
    );

    if (!mappingResult.accepted) {
      return res.status(400).json({
        accepted: false,
        error: mappingResult.error,
      });
    }

    const companionId = mappingResult.context!.companionId;
    const runtime = runtimes.get(companionId);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });

    try {
      // Map authorization role to legacy memory scope for backwards-compatible runtime call
      const legacyScope =
        mappingResult.context!.actor.authorizationRole === 'administrator'
          ? 'OWNER'
          : mappingResult.context!.actor.authorizationRole === 'operator'
          ? 'OPERATOR'
          : 'VIEWER';

      const response = await runtime.handleUserMessage(message, legacyScope, history);
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

  return { app, runtimes, setObservationOrgan: (org: FixtureObservationOrgan) => { observationOrgan = org; } };
}
