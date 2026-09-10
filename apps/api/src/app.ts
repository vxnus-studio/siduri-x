import express, { Express } from 'express';
import cors from 'cors';
import { createCorsOptions } from './cors';
import { SiduriRuntime, dispatchCompanionChat } from './runtime';
import { OpenAICompatibleBrain, OpenRouterBrain } from '@siduri-x/brain';
import { PostgresMemoryOrgan } from '@siduri-x/memory';
import { VoiceAdapter, VoiceConfig } from '@siduri-x/voice';
import { EKnowledgeAdapter, EKnowledgeConfig } from '@siduri-x/knowledge';
import { OpenRouterVisionAdapter, OpenRouterVisionConfig } from '@siduri-x/vision';
import { ActiveSelfCompiler } from '@siduri-x/behavior';
import { Live2DAdapter, Live2DAdapterConfig } from '@siduri-x/body';
import { FixtureObservationOrgan } from '@siduri-x/observation';
import { DefaultHandsOrgan, DefaultHandsOrganConfig } from '@siduri-x/hands';
import { DefaultEarOrgan, EarOrganConfig } from '@siduri-x/ear';
import { DefaultMouthOrgan, DefaultMouthOrganConfig } from '@siduri-x/mouth';
import { attachIdentity, requireAuth, Identity } from './auth';
import { mapRequestContext } from './context-mapper';

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
  brain?: AppBrainConfig;
  voice?: VoiceConfig;
  knowledge?: EKnowledgeConfig;
  vision?: OpenRouterVisionConfig;
  behavior?: AppBehaviorConfig;
  body?: Live2DAdapterConfig;
  hands?: DefaultHandsOrganConfig;
  ear?: EarOrganConfig;
  mouth?: DefaultMouthOrganConfig;
  [key: string]: unknown;
}

export interface AppInstance {
  app: Express;
  runtimes: Map<string, SiduriRuntime>;
  setObservationOrgan: (org: FixtureObservationOrgan) => void;
}

export function createApp(runtimes: Map<string, SiduriRuntime> = new Map()): AppInstance {
  const app: Express = express();
  app.use(cors(createCorsOptions()));
  app.use(express.json());

  let observationOrgan: FixtureObservationOrgan | undefined;

  function createBrain(config?: AppBrainConfig) {
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

  function isDisabled(config?: { provider?: string }): boolean {
    return !config || config.provider === 'none';
  }

  function createVoice(config?: VoiceConfig) {
    return isDisabled(config)
      ? undefined
      : new VoiceAdapter({
          provider: (config?.provider as any) || 'voicevox',
          baseUrl: config?.baseUrl || process.env.VOICEVOX_URL || 'http://localhost:50021',
          speakerId: config?.speakerId || 1,
          ...config,
        });
  }

  function createKnowledge(config?: EKnowledgeConfig) {
    return isDisabled(config) ? undefined : new EKnowledgeAdapter(config || {});
  }

  function createVision(config?: OpenRouterVisionConfig & { provider?: string }) {
    return isDisabled(config)
      ? undefined
      : new OpenRouterVisionAdapter({
          apiKey: config?.apiKey || process.env.OPENROUTER_API_KEY || '',
          model: config?.model || 'gpt-4-vision',
          ...config,
        });
  }

  function createBehavior(config?: AppBehaviorConfig) {
    return isDisabled(config) ? undefined : new ActiveSelfCompiler();
  }

  function createBody(config?: Live2DAdapterConfig & { provider?: string }) {
    return isDisabled(config)
      ? undefined
      : new Live2DAdapter(config);
  }

  function createHands(config?: DefaultHandsOrganConfig & { provider?: string }) {
    return isDisabled(config)
      ? new DefaultHandsOrgan()
      : new DefaultHandsOrgan(config);
  }

  function createEar(config?: EarOrganConfig & { provider?: string }) {
    return isDisabled(config)
      ? new DefaultEarOrgan()
      : new DefaultEarOrgan(config);
  }

  function createMouth(config?: DefaultMouthOrganConfig & { provider?: string }, voice?: any) {
    return isDisabled(config)
      ? new DefaultMouthOrgan({ voice })
      : new DefaultMouthOrgan({ ...config, voice });
  }

  app.post('/boot', requireAuth, async (req, res) => {
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
      const hands = createHands(config.hands);
      const ear = createEar(config.ear);
      const mouth = createMouth(config.mouth, voice);

      const runtime = new SiduriRuntime(id, config, {
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
        observation: observationOrgan,
      });
      await runtime.initialize();

      runtimes.set(id, runtime);

      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // STATUS / HEALTH ENDPOINTS
  app.get('/health', (req, res) => res.json({ status: "ok" }));
  app.get('/version', (req, res) => res.json({ name: "siduri-x-api", version: "0.2.0-x" }));
  app.get('/ready', (req, res) => {
    const isReady = runtimes.size > 0;
    res.status(isReady ? 200 : 503).json({
      status: isReady ? "ready" : "not_ready",
      companionCount: runtimes.size,
    });
  });
  app.get('/voice/health', (req, res) => {
    const hasVoice = Array.from(runtimes.values()).some((r) => Boolean(r.voice));
    res.json({ provider: "siduri-voice", configured: hasVoice });
  });
  app.get('/obs/health', (req, res) => {
    const connected = Boolean(observationOrgan) || Array.from(runtimes.values()).some((r) => Boolean(r.observation));
    res.json({ connected });
  });
  app.get('/mouth/health', (req, res) => {
    const hasMouth = Array.from(runtimes.values()).some((r) => Boolean(r.mouth));
    res.json({ provider: "siduri-mouth", configured: hasMouth });
  });
  app.get('/mouth/channels', (req, res) => {
    const id = (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime || !runtime.mouth || typeof runtime.mouth.getRegisteredChannels !== 'function') {
      return res.json({ channels: [] });
    }
    res.json({ channels: runtime.mouth.getRegisteredChannels() });
  });
  app.get('/me', attachIdentity, (req, res) => {
    const identity = (req as any).identity as Identity;
    res.json({
      actorId: identity.actorId || (identity.authenticated ? 'owner-user' : 'anonymous-session'),
      role: identity.role || (identity.authenticated ? 'OWNER' : 'VIEWER'),
      authenticated: Boolean(identity.authenticated),
    });
  });
  app.put('/me', requireAuth, (req, res) => res.json({ success: true }));

  // CHAT (API context boundary validation)
  app.post('/chat', attachIdentity, async (req, res) => {
    const { id, message, history } = req.body;
    const identity = (req as any).identity as Identity;

    // Single-owner companion model: map request context directly
    const mappingResult = mapRequestContext({
      ...req.body,
      id: id || req.body.companionId,
      authenticated: identity?.authenticated ?? true,
      source: identity?.source ?? 'local',
      generateCorrelationId: true,
    });

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
      const response = await dispatchCompanionChat(runtime, {
        id: companionId,
        companionId,
        message,
        context: mappingResult.context,
        history,
        ...(req.body?.medium ? { medium: req.body.medium } : {}),
      });
      res.json(response);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // REAL-TIME SSE STREAMING (Mouth transport)
  app.post('/chat/stream', attachIdentity, async (req, res) => {
    const { id, message, history } = req.body;
    const identity = (req as any).identity as Identity;

    const mappingResult = mapRequestContext({
      ...req.body,
      id: id || req.body.companionId,
      authenticated: identity?.authenticated ?? true,
      source: identity?.source ?? 'local',
      generateCorrelationId: true,
    });

    if (!mappingResult.accepted) {
      return res.status(400).json({
        accepted: false,
        error: mappingResult.error,
      });
    }

    const companionId = mappingResult.context!.companionId;
    const runtime = runtimes.get(companionId);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const abortController = new AbortController();
    const onClose = () => {
      abortController.abort('client_disconnect');
      if (typeof runtime.interruptMouth === 'function') {
        runtime.interruptMouth('client_disconnect');
      }
    };
    req.on('close', onClose);

    try {
      const response = await dispatchCompanionChat(runtime, {
        id: companionId,
        companionId,
        message,
        context: mappingResult.context,
        history,
        medium: 'web',
        signal: abortController.signal,
      });

      res.write(`event: staged\ndata: ${JSON.stringify({ response_id: response.response_id, correlation_id: response.correlation_id, status: response.status })}\n\n`);

      const avatarEvent = response.metadata?.events?.find(
        (e: any) => (e.kind === 'avatar' || e.kind === 'body') && (e.approval === 'APPROVED' || !e.approval)
      );
      if (avatarEvent) {
        res.write(`event: avatar\ndata: ${JSON.stringify(avatarEvent)}\n\n`);
      }

      const speechText = response.delivery?.text || response.response?.subtitle_en || response.response?.spoken_ja || '';
      const utterance = {
        utteranceId: response.response_id || 'utt-stream',
        companionId,
        responseId: response.response_id,
        correlationId: response.correlation_id,
        text: speechText,
        medium: 'web' as const,
        expression: avatarEvent?.expression,
        action: avatarEvent?.action,
        signal: abortController.signal,
      };

      if (runtime.mouth && typeof runtime.mouth.stream === 'function') {
        for await (const chunk of runtime.mouth.stream(utterance)) {
          if (abortController.signal.aborted) {
            res.write(`event: chunk\ndata: ${JSON.stringify({ ...chunk, interrupted: true })}\n\n`);
            break;
          }
          res.write(`event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`);
        }
      } else {
        res.write(`event: chunk\ndata: ${JSON.stringify({ utteranceId: utterance.utteranceId, index: 1, deltaText: speechText, isComplete: true, medium: 'web' })}\n\n`);
      }

      res.write(`event: done\ndata: ${JSON.stringify(response)}\n\n`);
      res.end();
    } catch (e: any) {
      if (abortController.signal.aborted) {
        res.write(`event: interrupted\ndata: ${JSON.stringify({ reason: abortController.signal.reason })}\n\n`);
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ error: e.message })}\n\n`);
      }
      res.end();
    } finally {
      req.removeListener('close', onClose);
    }
  });

  // INTERRUPTION / BARGE-IN
  app.post('/chat/interrupt', attachIdentity, (req, res) => {
    const companionId = req.body?.companionId || req.body?.id || Array.from(runtimes.keys())[0];
    const runtime = companionId ? runtimes.get(companionId) : undefined;
    const reason = req.body?.reason || 'user_barge_in';

    if (runtime) {
      runtime.interruptMouth(reason);
      return res.json({ success: true, interrupted: true, companionId, reason });
    }

    for (const r of runtimes.values()) {
      r.interruptMouth(reason);
    }
    return res.json({ success: true, interrupted: true, reason });
  });

  app.post('/mouth/interrupt', attachIdentity, (req, res) => {
    const companionId = req.body?.companionId || req.body?.id || Array.from(runtimes.keys())[0];
    const runtime = companionId ? runtimes.get(companionId) : undefined;
    const reason = req.body?.reason || 'user_barge_in';

    if (runtime) {
      runtime.interruptMouth(reason);
      return res.json({ success: true, interrupted: true, companionId, reason });
    }

    for (const r of runtimes.values()) {
      r.interruptMouth(reason);
    }
    return res.json({ success: true, interrupted: true, reason });
  });

  // MEMORY GETTERS
  app.get('/memory/proposals', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory) return res.json({ proposals: [] });
    try {
      const proposals = await runtime.getPendingClaims();
      res.json({ proposals });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/memory', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory) return res.json({ items: [] });
    try {
      const items = await runtime.getClaims();
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/memory/claims', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory) return res.json({ claims: [] });
    try {
      const claims = await runtime.getClaims();
      res.json({ claims });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/memory/behavioral', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory) return res.json({ directives: [] });
    try {
      const directives = await runtime.getDirectives();
      res.json({ directives });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // MEMORY MUTATIONS - PROPOSALS
  app.post('/memory/proposals/update', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory || typeof runtime.memory.updateClaim !== 'function') {
      return res.status(400).json({ error: "Memory organ does not support updating claims" });
    }
    try {
      const claimId = req.body.id || req.body.claimId;
      if (!claimId) {
        return res.status(400).json({ error: "Missing required claim id" });
      }
      const updated = await runtime.updateClaim(claimId, req.body.updates || req.body);
      res.json({ success: true, claim: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/memory/proposals/approve', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory) return res.status(400).json({ error: "Memory organ not configured" });
    try {
      await runtime.approveClaim(req.body.id);
      res.json({ approved: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/memory/proposals/reject', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory) return res.status(400).json({ error: "Memory organ not configured" });
    try {
      await runtime.rejectClaim(req.body.id);
      res.json({ rejected: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // MEMORY MUTATIONS - BEHAVIORAL
  app.post('/memory/behavioral/approve', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory) return res.status(400).json({ error: "Memory organ not configured" });
    try {
      await runtime.approveDirective(req.body.id);
      res.json({ approved: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/memory/behavioral/reject', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory) return res.status(400).json({ error: "Memory organ not configured" });
    try {
      await runtime.rejectDirective(req.body.id);
      res.json({ rejected: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/memory/behavioral/revoke', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory) return res.status(400).json({ error: "Memory organ not configured" });
    try {
      await runtime.revokeDirective(req.body.id);
      res.json({ revoked: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/memory/behavioral/disable', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.memory) return res.status(400).json({ error: "Memory organ not configured" });
    try {
      await runtime.disableDirective(req.body.id);
      res.json({ disabled: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const isDevMode = process.env.NODE_ENV !== 'production' || process.env.SIDURI_DEV_MODE === 'true';
  if (isDevMode) {
    app.post('/dev/memory/reset', requireAuth, async (req, res) => {
      const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
      const runtime = runtimes.get(id);
      if (!runtime) return res.status(404).json({ error: "Companion not found" });
      if (!runtime.memory || typeof runtime.memory.resetMemory !== 'function') {
        return res.status(400).json({ error: "Memory organ does not support reset" });
      }
      try {
        await runtime.resetMemory();
        res.json({ reset: true });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    app.post('/dev/mock-response', async (req, res) => {
      const companionId = req.body?.companionId || Array.from(runtimes.keys())[0] || 'default';
      const runtime = runtimes.get(companionId);
      if (!runtime) return res.status(404).json({ accepted: false, error: 'Companion not found' });
      const staged = runtime.stageResponse({
        requestContext: {
          companionId,
          actor: {
            actorId: 'local-user',
            sessionId: 'sess-local',
            capabilities: ['chat', 'memory:approve'],
            authenticated: true,
          },
          conversation: {
            correlationId: req.body?.correlation_id || `corr-${Date.now()}`,
          },
        },
        candidateSpeech: req.body?.speech || 'Mocked staged response for review',
        candidateLanguage: req.body?.language || 'en',
        requiresApproval: req.body?.requiresApproval ?? true,
      });
      res.json({
        accepted: true,
        staged: true,
        status: staged.status,
        response_id: staged.responseId,
        correlation_id: staged.correlationId,
        speech: staged.speech,
      });
    });

    app.post('/dev/approve-response', async (req, res) => {
      const companionId = req.body?.companionId || Array.from(runtimes.keys())[0] || 'default';
      const runtime = runtimes.get(companionId);
      if (!runtime) return res.status(404).json({ approved: false, error: 'Companion not found' });

      let responseId = req.body?.responseId;
      let correlationId = req.body?.correlation_id;

      if (!responseId && correlationId) {
        const found = runtime.findStagedPlanByCorrelation(companionId, correlationId);
        if (found) {
          responseId = found.responseId;
        }
      } else if (responseId && !correlationId) {
        const found = runtime.getStagedPlan(responseId);
        if (found) {
          correlationId = found.correlationId;
        }
      }

      if (!responseId) {
        return res.status(400).json({ approved: false, error: 'UNKNOWN_APPROVAL_ID' });
      }

      const result = runtime.approveResponse({
        responseId,
        companionId,
        correlationId: correlationId || '',
      });

      if (!result.success) {
        return res.status(400).json({ approved: false, error: result.reason });
      }

      // Now evaluated as approved
      const evaluation = runtime.evaluateGate(result.plan!);
      res.json({
        approved: true,
        status: evaluation.disposition,
        response_id: result.plan!.responseId,
        speech: result.plan!.speech,
        language: result.plan!.language,
      });
    });

    app.post('/dev/reject-response', async (req, res) => {
      const companionId = req.body?.companionId || Array.from(runtimes.keys())[0] || 'default';
      const runtime = runtimes.get(companionId);
      if (!runtime) return res.status(404).json({ rejected: false, error: 'Companion not found' });

      let responseId = req.body?.responseId;
      let correlationId = req.body?.correlation_id;

      if (!responseId && correlationId) {
        const found = runtime.findStagedPlanByCorrelation(companionId, correlationId);
        if (found) {
          responseId = found.responseId;
        }
      } else if (responseId && !correlationId) {
        const found = runtime.getStagedPlan(responseId);
        if (found) {
          correlationId = found.correlationId;
        }
      }

      if (!responseId) {
        return res.status(400).json({ rejected: false, error: 'UNKNOWN_APPROVAL_ID' });
      }

      const result = runtime.rejectResponse({
        responseId,
        companionId,
        correlationId: correlationId || '',
        reason: req.body?.reason,
      });

      if (!result.success) {
        return res.status(400).json({ rejected: false, error: result.reason });
      }

      res.json({
        rejected: true,
        status: result.plan!.status,
        response_id: result.plan!.responseId,
      });
    });

    app.post('/dev/mock-observation', async (req, res) => {
      const activeRuntime = Array.from(runtimes.values())[0];
      const targetObs = activeRuntime?.observation || observationOrgan;
      if (!targetObs) return res.status(503).json({ accepted: false, reason: 'observation_unavailable' });
      const result = await targetObs.ingest(
        new Uint8Array([115, 121, 110, 116, 104, 101, 116, 105, 99]),
        'fixture-observation',
        'configured-vision',
      );
      if (!result.observation) return res.status(result.duplicate ? 200 : 409).json({ accepted: false, ...result });
      res.status(202).json({ accepted: true, observation: result.observation });
    });
  }

  return {
    app,
    runtimes,
    setObservationOrgan: (org: FixtureObservationOrgan) => {
      observationOrgan = org;
      for (const r of runtimes.values()) {
        r.observation = org;
      }
    },
  };
}
