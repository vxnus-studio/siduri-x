import express, { Express } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { createCorsOptions } from './cors';
import { SiduriRuntime, dispatchCompanionChat } from './runtime';
import { SelfPackageParser, SqliteSelfRepository, scanDirective, compilePersonaDocument } from '@sidurijs/self';
import { FixtureObservationOrgan } from '@sidurijs/observation';
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
  app.get('/body/health', (req, res) => {
    const hasBody = Array.from(runtimes.values()).some((r) => Boolean(r.body));
    res.json({ provider: "siduri-body", configured: hasBody });
  });
  app.get('/body/snapshot', (req, res) => {
    const id = (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime || !runtime.body) {
      return res.status(404).json({ error: "Body organ not configured for companion" });
    }
    const snapshot = typeof (runtime.body as any).getSnapshot === 'function'
      ? (runtime.body as any).getSnapshot()
      : null;
    res.json({ snapshot });
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
  app.get('/teach/detected-self', attachIdentity, async (req, res) => {
    try {
      const companionId = (req.query.companionId as string) || Array.from(runtimes.keys())[0] || 'default';
      const runtime = runtimes.get(companionId);

      const explicitPath = (req.query.path as string) || undefined;
      const envPath = process.env.SIDURI_SELF_PATH || process.env.SELF_PATH;
      const configPath = (runtime?.config as any)?.organs?.behavior?.selfPath ||
                         (runtime?.config as any)?.behavior?.selfPath;

      const candidates: string[] = [];
      if (explicitPath) candidates.push(path.resolve(process.cwd(), explicitPath));
      if (envPath) candidates.push(path.resolve(process.cwd(), envPath));
      if (configPath) candidates.push(path.resolve(process.cwd(), configPath));

      candidates.push(path.resolve(process.cwd(), 'assets', 'self', `${companionId}.self`));
      candidates.push(path.resolve(process.cwd(), `${companionId}.self`));

      const searchDirs = [
        path.resolve(process.cwd(), 'assets', 'self'),
        path.resolve(process.cwd(), 'assets'),
        path.resolve(process.cwd()),
        path.resolve(process.cwd(), '..', '..', 'assets', 'self'),
        path.resolve(process.cwd(), '..', '..'),
      ];

      let matchedFilePath: string | undefined;

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            const stat = fs.statSync(candidate);
            if (stat.isFile()) {
              matchedFilePath = candidate;
              break;
            }
          } catch {}
        }
      }

      if (!matchedFilePath) {
        for (const dir of searchDirs) {
          if (fs.existsSync(dir)) {
            try {
              const entries = fs.readdirSync(dir);
              const selfFiles = entries.filter((f) => f.endsWith('.self'));
              if (selfFiles.length > 0) {
                const companionSelf = selfFiles.find((f) => f === `${companionId}.self`);
                matchedFilePath = path.join(dir, companionSelf || selfFiles[0]);
                break;
              }
            } catch {}
          }
        }
      }

      if (!matchedFilePath) {
        return res.json({ detected: false });
      }

      const content = await fs.promises.readFile(matchedFilePath, 'utf8');
      const parsed = await compilePersonaDocument(content, {
        brain: runtime?.brain,
        companionId,
        fallbackToParser: false,
      });

      if (!parsed.isValid) {
        return res.json({
          detected: true,
          filename: path.basename(matchedFilePath),
          path: matchedFilePath,
          content,
          parsed,
          error: parsed.errors?.[0] || 'Brain compilation failed',
          alreadyInstalled: false,
        });
      }

      let alreadyInstalled = false;
      const repo = new SqliteSelfRepository({ dbPath: process.env.STORAGE_PATH || process.env.SQLITE_DB_PATH || 'siduri.sqlite' });
      try {
        const existingIdentity = await repo.getIdentity(companionId);
        const existingDirectives = await repo.getActiveDirectives(companionId);
        if (
          existingIdentity &&
          parsed.manifest?.identity?.name &&
          existingIdentity.name.toLowerCase() === parsed.manifest.identity.name.toLowerCase() &&
          existingDirectives.length > 0
        ) {
          alreadyInstalled = true;
        }
      } catch {} finally {
        repo.close();
      }

      res.json({
        detected: true,
        filename: path.basename(matchedFilePath),
        path: matchedFilePath,
        content,
        parsed,
        alreadyInstalled,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/teach/upload-self', requireAuth, async (req, res) => {
    try {
      const { content, companionId } = req.body;
      if (!content) return res.status(400).json({ error: "Missing content" });
      const targetId = companionId || Array.from(runtimes.keys())[0] || 'default';
      const runtime = runtimes.get(targetId);
      const parsed = await compilePersonaDocument(content, {
        brain: runtime?.brain,
        companionId: targetId,
        fallbackToParser: false,
      });
      if (!parsed.isValid) {
        return res.status(200).json({
          error: parsed.errors?.[0] || 'Brain compilation failed',
          ...parsed,
        });
      }
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
          origin: manifest.identity.origin,
          ethos: manifest.identity.ethos,
          version: manifest.version || '1.0.0',
          updatedAt: new Date().toISOString(),
        });

        if (manifest.personality) {
          await repo.setPersonality(companionId, manifest.personality);
        }

        if (Array.isArray(manifest.relationships)) {
          for (const rel of manifest.relationships) {
            if (rel && rel.entityId) {
              await repo.updateRelationship(companionId, {
                companionId,
                entityId: rel.entityId,
                entityType: 'human',
                role: rel.role || 'user',
                stance: rel.stance || 'neutral',
                interactionConventions: rel.conventions || [],
              });
            }
          }
        }

        if (Array.isArray(manifest.dialogueExamples) && repo.setExemplars) {
          await repo.setExemplars(companionId, manifest.dialogueExamples);
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

  app.get('/teach/identity', attachIdentity, async (req, res) => {
    try {
      const companionId = (req.query.companionId as string) || Array.from(runtimes.keys())[0] || 'default';
      const runtime = runtimes.get(companionId);
      let identity: any = null;

      if (runtime?.self && typeof (runtime.self as any).getIdentity === 'function') {
        try {
          identity = await (runtime.self as any).getIdentity(companionId);
        } catch {}
      }

      if (!identity) {
        const repo = new SqliteSelfRepository({ dbPath: process.env.STORAGE_PATH || process.env.SQLITE_DB_PATH || 'siduri.sqlite' });
        try {
          identity = await repo.getIdentity(companionId);
        } catch {} finally {
          repo.close();
        }
      }

      const configuredName = runtime?.config?.name || 'Siduri';
      res.json({
        companionId,
        name: identity?.name || configuredName,
        archetype: identity?.archetype || identity?.role,
        origin: identity?.origin,
        ethos: identity?.ethos,
        version: identity?.version,
      });
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
        subtitleLanguage: req.body?.subtitleLanguage || req.body?.subtitle_language,
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
      if (!res.writableEnded) {
        abortController.abort('client_disconnect');
        if (runtime.mouth && typeof runtime.mouth.interrupt === 'function') {
          runtime.mouth.interrupt('client_disconnect');
        }
      }
    };
    res.on('close', onClose);

    try {
      const response = await dispatchCompanionChat(runtime, {
        id: companionId,
        companionId,
        message,
        context: mappingResult.context,
        history,
        medium: 'web',
        signal: abortController.signal,
        subtitleLanguage: req.body?.subtitleLanguage || req.body?.subtitle_language,
      });

      res.write(`event: staged\ndata: ${JSON.stringify({ response_id: response.response_id, correlation_id: response.correlation_id, status: response.status, mode: response.metadata?.mode })}\n\n`);

      const avatarEvent = response.metadata?.events?.find(
        (e: any) => (e.kind === 'avatar' || e.kind === 'body') && (e.approval?.toLowerCase() === 'approved' || e.approval === 'APPROVED' || !e.approval)
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
      res.removeListener('close', onClose);
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

  // SELF DIRECTIVES & PROPOSALS (RFC VX-26-13: Primitive 1)
  app.get('/self/directives', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    try {
      if (runtime.self && typeof (runtime.self as any).getActiveDirectives === 'function') {
        const directives = typeof (runtime.self as any).getAllDirectives === 'function'
          ? await (runtime.self as any).getAllDirectives(id)
          : await (runtime.self as any).getActiveDirectives(id);
        return res.json({ directives });
      }
      res.json({ directives: [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/self/proposals', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    try {
      if (runtime.self && typeof (runtime.self as any).getPendingDirectives === 'function') {
        const proposals = await (runtime.self as any).getPendingDirectives(id);
        return res.json({ proposals });
      }
      res.json({ proposals: [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PROPOSALS GETTERS (RFC VX-26-13: routed through self, legacy compatibility aliases)
  app.get('/memory/proposals', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    try {
      if (runtime.self && typeof (runtime.self as any).getPendingDirectives === 'function') {
        const proposals = await (runtime.self as any).getPendingDirectives(id);
        return res.json({ proposals });
      }
      res.json({ proposals: [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/memory', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    try {
      if (runtime.self && typeof (runtime.self as any).getAllDirectives === 'function') {
        const items = await (runtime.self as any).getAllDirectives(id);
        return res.json({ items });
      }
      res.json({ items: [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/memory/claims', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    try {
      if (runtime.self && typeof (runtime.self as any).getAllDirectives === 'function') {
        const claims = await (runtime.self as any).getAllDirectives(id);
        return res.json({ claims });
      }
      res.json({ claims: [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/memory/behavioral', requireAuth, async (req, res) => {
    const id = req.query.id as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    try {
      if (runtime.self && typeof (runtime.self as any).getActiveDirectives === 'function') {
        const directives = typeof (runtime.self as any).getAllDirectives === 'function'
          ? await (runtime.self as any).getAllDirectives(id)
          : await (runtime.self as any).getActiveDirectives(id);
        return res.json({ directives });
      }
      res.json({ directives: [] });
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

  app.get('/knowledge/entities', requireAuth, async (req, res) => {
    const id = (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    const entityType = req.query.type as string | undefined;
    const domain = req.query.domain as string | undefined;
    if (!runtime.knowledge || !(runtime.knowledge as any).entities) {
      return res.json({ entities: [] });
    }
    try {
      const entities = await (runtime.knowledge as any).entities.getEntities(id, entityType, domain);
      res.json({ entities });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/knowledge/events', requireAuth, async (req, res) => {
    const id = (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    const stream = req.query.stream as string | undefined;
    const limit = Number(req.query.limit || 50);
    if (!runtime.knowledge || !(runtime.knowledge as any).events) {
      return res.json({ events: [] });
    }
    try {
      const events = await (runtime.knowledge as any).events.getEvents(id, stream, limit);
      res.json({ events });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/knowledge/tasks', requireAuth, async (req, res) => {
    const id = (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    const status = req.query.status as string | undefined;
    if (!runtime.knowledge || !(runtime.knowledge as any).tasks) {
      return res.json({ tasks: [] });
    }
    try {
      const tasks = await (runtime.knowledge as any).tasks.getTasks(id, status);
      res.json({ tasks });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/knowledge/proposals/approve', requireAuth, async (req, res) => {
    const id = (req.body.companionId as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    try {
      if (typeof (runtime as any).approveProposal === 'function') {
        const result = await (runtime as any).approveProposal(req.body.id, { companionId: id });
        res.json({ approved: true, target: result?.target || 'knowledge', status: 'approved' });
      } else {
        res.status(400).json({ error: 'Runtime does not support proposal approval' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/knowledge/entities', requireAuth, async (req, res) => {
    const id = (req.body.companionId as string) || (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    if (!runtime.knowledge || !(runtime.knowledge as any).entities) {
      return res.status(400).json({ error: 'Knowledge organ does not support entities' });
    }
    try {
      const entity = {
        id: req.body.id || `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        companionId: id,
        name: req.body.name,
        entityType: req.body.entityType || req.body.type || 'entity',
        domain: req.body.domain || 'general',
        properties: req.body.properties || {},
      };
      await (runtime.knowledge as any).entities.saveEntity(entity);
      res.json({ saved: true, entity });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/knowledge/entities/delete', requireAuth, async (req, res) => {
    const id = (req.body.companionId as string) || (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    if (!runtime.knowledge || !(runtime.knowledge as any).entities) {
      return res.status(400).json({ error: 'Knowledge organ does not support entities' });
    }
    try {
      const success = await (runtime.knowledge as any).entities.deleteEntity(req.body.id);
      res.json({ deleted: success, id: req.body.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/knowledge/tasks', requireAuth, async (req, res) => {
    const id = (req.body.companionId as string) || (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    if (!runtime.knowledge || !(runtime.knowledge as any).tasks) {
      return res.status(400).json({ error: 'Knowledge organ does not support tasks' });
    }
    try {
      const task = {
        id: req.body.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        companionId: id,
        title: req.body.title,
        status: req.body.status || 'todo',
        priority: req.body.priority !== undefined ? Number(req.body.priority) : 1,
        targetDate: req.body.targetDate || null,
        metadata: req.body.metadata || {},
      };
      await (runtime.knowledge as any).tasks.saveTask(task);
      res.json({ saved: true, task });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/knowledge/tasks/delete', requireAuth, async (req, res) => {
    const id = (req.body.companionId as string) || (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    if (!runtime.knowledge || !(runtime.knowledge as any).tasks) {
      return res.status(400).json({ error: 'Knowledge organ does not support tasks' });
    }
    try {
      const success = await (runtime.knowledge as any).tasks.deleteTask(req.body.id);
      res.json({ deleted: success, id: req.body.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/knowledge/events', requireAuth, async (req, res) => {
    const id = (req.body.companionId as string) || (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    if (!runtime.knowledge || !(runtime.knowledge as any).events) {
      return res.status(400).json({ error: 'Knowledge organ does not support events' });
    }
    try {
      const event = {
        id: req.body.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        companionId: id,
        stream: req.body.stream || 'default',
        timestamp: req.body.timestamp || new Date().toISOString(),
        metricValue: req.body.metricValue !== undefined && req.body.metricValue !== null ? Number(req.body.metricValue) : undefined,
        metadata: req.body.metadata || {},
      };
      await (runtime.knowledge as any).events.addEvent(event);
      res.json({ saved: true, event });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/knowledge/schedule', requireAuth, async (req, res) => {
    const id = (req.body.companionId as string) || (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    if (!runtime.knowledge || !(runtime.knowledge as any).schedule) {
      return res.status(400).json({ error: 'Knowledge organ does not support schedule' });
    }
    try {
      const item = {
        id: req.body.id || `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        companionId: id,
        title: req.body.title,
        startTime: req.body.startTime,
        endTime: req.body.endTime || null,
        isRecurring: Boolean(req.body.isRecurring),
        status: req.body.status || 'active',
      };
      await (runtime.knowledge as any).schedule.saveItem(item);
      res.json({ saved: true, item });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/knowledge/schedule/delete', requireAuth, async (req, res) => {
    const id = (req.body.companionId as string) || (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: 'Companion not found' });
    if (!runtime.knowledge || !(runtime.knowledge as any).schedule) {
      return res.status(400).json({ error: 'Knowledge organ does not support schedule' });
    }
    try {
      const success = typeof (runtime.knowledge as any).schedule.deleteItem === 'function'
        ? await (runtime.knowledge as any).schedule.deleteItem(req.body.id)
        : false;
      res.json({ deleted: success, id: req.body.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PROPOSAL MUTATIONS (RFC VX-26-13: routed through self)
  app.post('/memory/proposals/update', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    return res.status(400).json({ error: "Claim update not supported. Use directive approval/rejection via self." });
  });

  app.post('/memory/proposals/approve', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.self) return res.status(400).json({ error: "Self organ not configured" });
    try {
      let name: string | undefined;
      if (typeof (runtime as any).approveProposal === 'function') {
        const pRes = await (runtime as any).approveProposal(req.body.id, { companionId: id });
        name = pRes?.name;
      }
      if (!name && runtime.self && typeof (runtime.self as any).getIdentity === 'function') {
        try {
          const ident = await (runtime.self as any).getIdentity(id);
          name = ident?.name;
        } catch {}
      }
      res.json({ approved: true, status: 'approved', name });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/memory/proposals/reject', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.self) return res.status(400).json({ error: "Self organ not configured" });
    try {
      if (typeof (runtime as any).rejectProposal === 'function') {
        await (runtime as any).rejectProposal(req.body.id, { companionId: id });
      }
      res.json({ rejected: true, status: 'rejected' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // SELF DIRECTIVE MUTATIONS (RFC VX-26-13: Primitive 1)
  app.post('/self/directives/approve', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.self) return res.status(400).json({ error: "Self organ not configured" });
    try {
      let name: string | undefined;
      if (typeof (runtime as any).approveDirective === 'function') {
        const bRes = await (runtime as any).approveDirective(req.body.id, { companionId: id });
        name = bRes?.name;
      } else if (runtime.self && typeof (runtime.self as any).approveDirective === 'function') {
        await (runtime.self as any).approveDirective(req.body.id, id);
      }
      if (!name && runtime.self && typeof (runtime.self as any).getIdentity === 'function') {
        try {
          const ident = await (runtime.self as any).getIdentity(id);
          name = ident?.name;
        } catch {}
      }
      res.json({ approved: true, status: 'active', name });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/self/directives/reject', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.self) return res.status(400).json({ error: "Self organ not configured" });
    try {
      if (typeof (runtime as any).rejectDirective === 'function') {
        await (runtime as any).rejectDirective(req.body.id, { companionId: id });
      } else if (runtime.self && typeof (runtime.self as any).rejectDirective === 'function') {
        await (runtime.self as any).rejectDirective(req.body.id, id);
      }
      res.json({ rejected: true, status: 'rejected' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/self/directives/revoke', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.self) return res.status(400).json({ error: "Self organ not configured" });
    try {
      if (typeof (runtime as any).revokeDirective === 'function') {
        await (runtime as any).revokeDirective(req.body.id, { companionId: id });
      } else if (runtime.self && typeof (runtime.self as any).revokeDirective === 'function') {
        await (runtime.self as any).revokeDirective(req.body.id, id);
      }
      res.json({ revoked: true, status: 'revoked' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/self/directives/disable', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.self) return res.status(400).json({ error: "Self organ not configured" });
    try {
      if (runtime.self && typeof (runtime.self as any).disableDirective === 'function') {
        await (runtime.self as any).disableDirective(req.body.id, id);
      }
      res.json({ disabled: true, status: 'disabled' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // BEHAVIORAL DIRECTIVE MUTATIONS (RFC VX-26-13: Sovereign Directives via Self, compatibility aliases)
  app.post('/memory/behavioral/approve', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.self) return res.status(400).json({ error: "Self organ not configured" });
    try {
      let name: string | undefined;
      if (typeof (runtime as any).approveDirective === 'function') {
        const bRes = await (runtime as any).approveDirective(req.body.id, { companionId: id });
        name = bRes?.name;
      } else if (runtime.self && typeof (runtime.self as any).approveDirective === 'function') {
        await (runtime.self as any).approveDirective(req.body.id, id);
      }
      if (!name && runtime.self && typeof (runtime.self as any).getIdentity === 'function') {
        try {
          const ident = await (runtime.self as any).getIdentity(id);
          name = ident?.name;
        } catch {}
      }
      res.json({ approved: true, status: 'active', name });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/memory/behavioral/reject', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.self) return res.status(400).json({ error: "Self organ not configured" });
    try {
      if (typeof (runtime as any).rejectDirective === 'function') {
        await (runtime as any).rejectDirective(req.body.id, { companionId: id });
      } else if (runtime.self && typeof (runtime.self as any).rejectDirective === 'function') {
        await (runtime.self as any).rejectDirective(req.body.id, id);
      }
      res.json({ rejected: true, status: 'rejected' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/memory/behavioral/revoke', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.self) return res.status(400).json({ error: "Self organ not configured" });
    try {
      if (typeof (runtime as any).revokeDirective === 'function') {
        await (runtime as any).revokeDirective(req.body.id, { companionId: id });
      } else if (runtime.self && typeof (runtime.self as any).revokeDirective === 'function') {
        await (runtime.self as any).revokeDirective(req.body.id, id);
      }
      res.json({ revoked: true, status: 'revoked' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/memory/behavioral/disable', requireAuth, async (req, res) => {
    const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    if (!runtime.self) return res.status(400).json({ error: "Self organ not configured" });
    try {
      if (runtime.self && typeof (runtime.self as any).disableDirective === 'function') {
        await (runtime.self as any).disableDirective(req.body.id, id);
      }
      res.json({ disabled: true, status: 'disabled' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ARCHIVE AUDIT ENDPOINTS (RFC VX-26-13: Primitive 5)
  app.get('/archive/events', requireAuth, async (req, res) => {
    const id = (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      if (runtime.archive && typeof runtime.archive.getRecentEvents === 'function') {
        const events = await runtime.archive.getRecentEvents(id, limit);
        return res.json({ events });
      }
      if (runtime.db && typeof (runtime.db as any).getRecentArchiveEvents === 'function') {
        const events = (runtime.db as any).getRecentArchiveEvents(id, limit);
        return res.json({ events });
      }
      res.json({ events: [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/archive/search', requireAuth, async (req, res) => {
    const id = (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    const query = (req.query.q as string) || '';
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      if (runtime.archive && typeof runtime.archive.searchEvents === 'function') {
        const results = await runtime.archive.searchEvents(id, query, limit);
        return res.json({ results });
      }
      if (runtime.db && typeof (runtime.db as any).searchArchiveEvents === 'function') {
        const results = (runtime.db as any).searchArchiveEvents(id, query, limit);
        return res.json({ results });
      }
      res.json({ results: [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // SYSTEM LOGS
  app.get('/system/logs', requireAuth, async (req, res) => {
    const id = (req.query.id as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    const level = req.query.level as string | undefined;
    const subsystem = req.query.subsystem as string | undefined;
    const q = req.query.q as string | undefined;
    const limit = parseInt((req.query.limit as string) || '100', 10);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    try {
      const logs = typeof runtime.queryLogs === 'function'
        ? runtime.queryLogs({ companionId: id, level, subsystem, q, limit, offset })
        : [];
      res.json({ logs });
    } catch (e: any) {
      res.status(500).json({ error: e.message, logs: [] });
    }
  });

  app.post('/system/logs/clear', requireAuth, async (req, res) => {
    const id = (req.body.companionId as string) || Array.from(runtimes.keys())[0];
    const runtime = runtimes.get(id);
    if (!runtime) return res.status(404).json({ error: "Companion not found" });
    try {
      if (typeof runtime.clearLogs === 'function') {
        runtime.clearLogs(id);
      }
      res.json({ cleared: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const isDevMode = process.env.NODE_ENV !== 'production' || process.env.SIDURI_DEV_MODE === 'true';
  if (isDevMode) {
    app.post(['/dev/memory/reset', '/dev/directives/reset', '/dev/archive/reset'], requireAuth, async (req, res) => {
      const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
      const runtime = runtimes.get(id);
      if (!runtime) return res.status(404).json({ error: "Companion not found" });
      try {
        if (runtime.db && typeof (runtime.db as any).resetArchive === 'function') {
          (runtime.db as any).resetArchive();
        }
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
