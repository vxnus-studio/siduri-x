import express, { Express } from 'express';
import cors from 'cors';
import { createCorsOptions } from './cors';
import { SiduriRuntime, dispatchCompanionChat } from './runtime';
import { SelfPackageParser, SqliteSelfRepository, scanDirective } from '@siduri-x/self';
import { FixtureObservationOrgan } from '@siduri-x/observation';
import { attachIdentity, requireAuth, Identity, isLocalRequest } from './auth';
import { mapRequestContext } from './context-mapper';
import {
  bootCompanion,
  AppBrainConfig,
  AppBehaviorConfig,
  AppBootCompanionConfig,
  BootCompanionOptions,
} from './boot';

export {
  AppBrainConfig,
  AppBehaviorConfig,
  AppBootCompanionConfig,
  BootCompanionOptions,
  bootCompanion,
};

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

  app.post('/boot', requireAuth, async (req, res) => {
    try {
      const { id, config } = req.body;
      if (runtimes.has(id)) {
        return res.status(400).json({ error: "Already booted" });
      }

      const runtime = await bootCompanion(id, config, { observationOrgan });
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

  // TEACH MODE ENDPOINTS
  app.post('/teach/upload-self', requireAuth, async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: "Missing content" });
      const parsed = SelfPackageParser.parse(content);
      res.json(parsed);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/teach/install-self', requireAuth, async (req, res) => {
    try {
      const { companionId, manifest, approvedDirectiveIds } = req.body;
      if (!companionId || !manifest || !Array.isArray(approvedDirectiveIds)) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!manifest.identity || !manifest.identity.name) {
        return res.status(400).json({ error: "Invalid manifest: missing identity.name" });
      }

      const directivesToCommit = manifest.directives?.filter((d: any) => approvedDirectiveIds.includes(d.id)) || [];
      for (const d of directivesToCommit) {
        if (!d || typeof d.directive !== 'string') {
          return res.status(400).json({ error: "Invalid directive entry: missing directive string" });
        }
        const scan = scanDirective(d.directive);
        if (!scan.safe) {
          return res.status(400).json({
            error: `Safety check failed for directive: ${scan.reason}`,
            directiveId: d.id,
            reason: scan.reason,
          });
        }
      }

      const repo = new SqliteSelfRepository({ dbPath: process.env.STORAGE_PATH || process.env.SQLITE_DB_PATH || 'siduri.sqlite' });

      try {
        await repo.setIdentity({
          companionId,
          name: manifest.identity.name,
          archetype: manifest.identity.archetype,
          version: manifest.version || '1.0.0',
          updatedAt: new Date().toISOString(),
        });

        if (manifest.personality) {
          await repo.setPersonality(companionId, manifest.personality);
        }

        if (directivesToCommit.length > 0) {
          await repo.commitDirectives(companionId, directivesToCommit);
        }
      } finally {
        repo.close();
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // CHAT (API context boundary validation)
  app.post('/chat', attachIdentity, async (req, res) => {
    const { id, message, history } = req.body;
    const identity = (req as any).identity as Identity;
    const local = isLocalRequest(req);
    const hasConfiguredToken = Boolean(process.env.AUTH_TOKEN || process.env.OPERATOR_TOKEN || process.env.OWNER_TOKEN);
    const isLocalDirectOwner = local && !hasConfiguredToken;

    const authenticated = identity?.authenticated || isLocalDirectOwner;
    const serverRole = identity?.authenticated ? identity.role : (isLocalDirectOwner ? 'OWNER' : 'VIEWER');

    // Single-owner companion model: map request context directly with server identity enforcement
    const mappingResult = mapRequestContext({
      ...req.body,
      id: id || req.body.companionId,
      authenticated,
      serverRole,
      source: identity?.source ?? (local ? 'local' : 'external'),
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
    const local = isLocalRequest(req);
    const hasConfiguredToken = Boolean(process.env.AUTH_TOKEN || process.env.OPERATOR_TOKEN || process.env.OWNER_TOKEN);
    const isLocalDirectOwner = local && !hasConfiguredToken;

    const authenticated = identity?.authenticated || isLocalDirectOwner;
    const serverRole = identity?.authenticated ? identity.role : (isLocalDirectOwner ? 'OWNER' : 'VIEWER');

    const mappingResult = mapRequestContext({
      ...req.body,
      id: id || req.body.companionId,
      authenticated,
      serverRole,
      source: identity?.source ?? (local ? 'local' : 'external'),
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
      if (runtime.mouth && typeof runtime.mouth.interrupt === 'function') {
        runtime.mouth.interrupt('client_disconnect');
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

      const maxStreamLen = Number(process.env.SIDURI_MAX_RESPONSE_CHARS || 8000);
      const rawSpeechText = response.delivery?.text || response.response?.subtitle_en || response.response?.spoken_ja || '';
      const speechText = rawSpeechText.slice(0, maxStreamLen);
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
      if (runtime.mouth && typeof runtime.mouth.interrupt === 'function') {
        runtime.mouth.interrupt(reason);
      }
      return res.json({ success: true, interrupted: true, companionId, reason });
    }

    for (const r of runtimes.values()) {
      if (r.mouth && typeof r.mouth.interrupt === 'function') {
        r.mouth.interrupt(reason);
      }
    }
    return res.json({ success: true, interrupted: true, reason });
  });

  app.post('/mouth/interrupt', attachIdentity, (req, res) => {
    const companionId = req.body?.companionId || req.body?.id || Array.from(runtimes.keys())[0];
    const runtime = companionId ? runtimes.get(companionId) : undefined;
    const reason = req.body?.reason || 'user_barge_in';

    if (runtime) {
      if (runtime.mouth && typeof runtime.mouth.interrupt === 'function') {
        runtime.mouth.interrupt(reason);
      }
      return res.json({ success: true, interrupted: true, companionId, reason });
    }

    for (const r of runtimes.values()) {
      if (r.mouth && typeof r.mouth.interrupt === 'function') {
        r.mouth.interrupt(reason);
      }
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
      const proposals = await runtime.memory.getPendingClaims();
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
      const items = await runtime.memory.getClaims();
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
      const claims = await runtime.memory.getClaims();
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
      const directives = await runtime.memory.getDirectives();
      res.json({ directives });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // KNOWLEDGE / LIFE DB GETTERS
  app.get('/knowledge/life', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    const query = (req.query.q as string) || '';
    if (!runtime.knowledge || typeof (runtime.knowledge as any).queryLifeContext !== 'function') {
      return res.json({ matchedInventory: [], recentFinances: [], upcomingSchedule: [], preferences: [], formattedContext: '' });
    }
    try {
      const result = await (runtime.knowledge as any).queryLifeContext(id, query);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/knowledge/inventory', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    const domain = req.query.domain as string | undefined;
    if (!runtime.knowledge || !(runtime.knowledge as any).inventory) {
      return res.json({ items: [] });
    }
    try {
      const items = await (runtime.knowledge as any).inventory.getItems(id, domain);
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/knowledge/finance', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.knowledge || !(runtime.knowledge as any).finance) {
      return res.json({ summary: null, entries: [] });
    }
    try {
      const limit = Number(req.query.limit || 20);
      const [summary, entries] = await Promise.all([
        (runtime.knowledge as any).finance.getSummary(id),
        (runtime.knowledge as any).finance.getEntries(id, limit),
      ]);
      res.json({ summary, entries });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/knowledge/schedule', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.knowledge || !(runtime.knowledge as any).schedule) {
      return res.json({ items: [] });
    }
    try {
      const items = await (runtime.knowledge as any).schedule.getUpcoming(id);
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/knowledge/preferences', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    const category = req.query.category as string | undefined;
    if (!runtime.knowledge || !(runtime.knowledge as any).preferences) {
      return res.json({ preferences: [] });
    }
    try {
      const preferences = await (runtime.knowledge as any).preferences.getPreferences(id, category);
      res.json({ preferences });
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
      const updated = await runtime.memory.updateClaim(claimId, req.body.updates || req.body);
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
      await runtime.memory.approveClaim(req.body.id);
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
      await runtime.memory.rejectClaim(req.body.id);
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
      await runtime.memory.approveDirective(req.body.id);
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
      await runtime.memory.rejectDirective(req.body.id);
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
      await runtime.memory.revokeDirective(req.body.id);
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
      await runtime.memory.disableDirective(req.body.id);
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
        await runtime.memory.resetMemory();
        res.json({ reset: true });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    app.post('/dev/mock-response', async (req, res) => {
      const companionId = req.body?.companionId || Array.from(runtimes.keys())[0] || 'default';
      const runtime = runtimes.get(companionId);
      if (!runtime) return res.status(404).json({ accepted: false, error: 'Companion not found' });
      const staged = runtime.gating.stageResponse({
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
        const found = runtime.gating.findStagedPlanByCorrelation(companionId, correlationId);
        if (found) {
          responseId = found.responseId;
        }
      } else if (responseId && !correlationId) {
        const found = runtime.gating.getStagedPlan(responseId);
        if (found) {
          correlationId = found.correlationId;
        }
      }

      if (!responseId) {
        return res.status(400).json({ approved: false, error: 'UNKNOWN_APPROVAL_ID' });
      }

      const result = runtime.gating.approveResponse({
        responseId,
        companionId,
        correlationId: correlationId || '',
      });

      if (!result.success) {
        return res.status(400).json({ approved: false, error: result.reason });
      }

      // Now evaluated as approved
      const evaluation = runtime.gating.evaluateGate(result.plan!);
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
        const found = runtime.gating.findStagedPlanByCorrelation(companionId, correlationId);
        if (found) {
          responseId = found.responseId;
        }
      } else if (responseId && !correlationId) {
        const found = runtime.gating.getStagedPlan(responseId);
        if (found) {
          correlationId = found.correlationId;
        }
      }

      if (!responseId) {
        return res.status(400).json({ rejected: false, error: 'UNKNOWN_APPROVAL_ID' });
      }

      const result = runtime.gating.rejectResponse({
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
