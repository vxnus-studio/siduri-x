#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Direct monorepo dist imports
import { SiduriRuntime, dispatchCompanionChat } from '../packages/core/dist/index.js';
import { OpenAICompatibleBrain, OpenRouterBrain } from '../packages/organs/brain/dist/index.js';
import { SqliteArchiveLedger } from '../packages/archive/dist/index.js';
import { UnifiedKnowledgeOrgan } from '../packages/knowledge/dist/index.js';
import { ActiveSelfCompiler, SqliteSelfRepository, SelfPackageParser } from '../packages/self/dist/index.js';
import { DefaultEarOrgan } from '../packages/organs/ear/dist/index.js';
import { DefaultHandsOrgan } from '../packages/organs/hands/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Load root .env into process.env if present
try {
  const envPath = path.join(rootDir, '.env');
  const envContent = await readFile(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val) {
        process.env[key] = val;
      }
    }
  }
} catch (err) {
  if (err?.code !== 'ENOENT') {
    console.error('Failed to load .env file:', err.message);
  }
}

// 2. Load siduri.config.json
let config;
try {
  config = JSON.parse(await readFile(path.join(rootDir, 'siduri.config.json'), 'utf8'));
} catch (err) {
  console.error('Could not load siduri.config.json:', err.message);
  process.exit(1);
}

// 3. Initialize organs
const brain = config.organs?.brain?.provider === 'openai-compatible'
  ? new OpenAICompatibleBrain(config.organs.brain)
  : new OpenRouterBrain(config.organs.brain);
const archive = new SqliteArchiveLedger({ ...config.organs?.archive, dbPath: path.resolve(rootDir, config.organs?.archive?.dbPath || config.organs?.memory?.dbPath || 'siduri.sqlite') });
const knowledge = new UnifiedKnowledgeOrgan({ ...config.organs.knowledge, dbPath: path.resolve(rootDir, config.organs.knowledge?.dbPath || 'siduri.sqlite') });
const self = new SqliteSelfRepository({ dbPath: path.resolve(rootDir, 'siduri.sqlite') });
const behavior = new ActiveSelfCompiler(config.organs.behavior);
const ear = new DefaultEarOrgan(config.organs.ear);
const hands = new DefaultHandsOrgan({ knowledge: knowledge.lifeDb || knowledge });

const runtime = new SiduriRuntime(config.id, config, {
  brain,
  archive,
  knowledge,
  behavior,
  self,
  ear,
  hands,
});

await runtime.initialize();

const audioCache = new Map();

// Determine public web directory (Next.js static export)
const webDistCandidates = [
  path.resolve(rootDir, 'apps/web/out'),
  path.resolve(rootDir, 'cli/dist/web-dist'),
  path.resolve(rootDir, 'public'),
];
const canonicalPublicRoot = webDistCandidates.find((p) => fs.existsSync(p)) || path.resolve(rootDir, 'public');
const canonicalAssetsRoot = path.resolve(rootDir, 'assets');

const server = createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // API: Status & Health Probes
  if ((pathname === '/health' || pathname === '/api/status') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  // API: Ready probe
  if (pathname === '/ready' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ready', companionId: config.id }));
    return;
  }

  // API: Version info
  if (pathname === '/version' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ version: '2.0.26-dev', name: config.name, id: config.id }));
    return;
  }

  // API: Identity info
  if ((pathname === '/me' || pathname === '/teach/identity') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    let identity = null;
    try {
      identity = typeof self?.getIdentity === 'function' ? await self.getIdentity(config.id) : null;
    } catch {}
    res.end(JSON.stringify({
      id: config.id,
      companionId: config.id,
      name: identity?.name || config.name || 'Siduri',
      archetype: identity?.archetype || identity?.role,
      origin: identity?.origin,
      ethos: identity?.ethos,
      version: identity?.version || '1.0.0',
      organs: Object.keys(config.organs || {}),
    }));
    return;
  }

  // API: Memory Claims & Items
  if ((pathname === '/memory' || pathname === '/memory/claims' || pathname === '/api/memory/claims') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      // Memory organ removed (RFC VX-26-13). Claims now route through self directives.
      const claims = typeof self?.getAllDirectives === 'function' ? await self.getAllDirectives(config.id) : [];
      res.end(JSON.stringify({ claims, items: claims }));
    } catch (e) {
      res.end(JSON.stringify({ claims: [], items: [] }));
    }
    return;
  }

  // API: Memory Proposals
  if (pathname === '/memory/proposals' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      // Memory organ removed (RFC VX-26-13). Proposals now route through self directives.
      const proposals = typeof self?.getPendingDirectives === 'function' ? await self.getPendingDirectives(config.id) : [];
      res.end(JSON.stringify({ proposals }));
    } catch (e) {
      res.end(JSON.stringify({ proposals: [] }));
    }
    return;
  }

  // API: Memory Directives
  if ((pathname === '/memory/behavioral' || pathname === '/api/memory/directives') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      // Memory organ removed (RFC VX-26-13). Directives now route through self.
      const directives = typeof self?.getActiveDirectives === 'function'
        ? await self.getActiveDirectives(config.id)
        : (typeof self?.getAllDirectives === 'function' ? await self.getAllDirectives(config.id) : []);
      res.end(JSON.stringify({ directives }));
    } catch (e) {
      res.end(JSON.stringify({ directives: [] }));
    }
    return;
  }

  // API: Memory Proposals / Behavioral Approval & Rejection
  if ((pathname === '/memory/proposals/approve' || pathname === '/knowledge/proposals/approve' || pathname === '/memory/proposals/reject' || pathname === '/memory/behavioral/approve' || pathname === '/memory/behavioral/reject') && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const claimId = payload.id || payload.claimId || payload.directiveId;
        if (!claimId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required id' }));
          return;
        }
        if (pathname.endsWith('approve')) {
          let target = 'self';
          let status = 'approved';
          let name = null;
          if (pathname.includes('behavioral')) {
            if (typeof runtime?.approveDirective === 'function') {
              const bRes = await runtime.approveDirective(claimId, { companionId: config.id });
              target = 'runtime';
              name = bRes?.name;
            } else if (typeof self?.approveDirective === 'function') {
              await self.approveDirective(claimId, config.id);
              target = 'self';
            }
            status = 'active';
          } else if (typeof runtime?.approveProposal === 'function') {
            const resData = await runtime.approveProposal(claimId, { companionId: config.id });
            target = resData?.target || 'self';
            name = resData?.name;
          }
          if (!name && typeof self?.getIdentity === 'function') {
            try {
              const ident = await self.getIdentity(config.id);
              name = ident?.name;
            } catch {}
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ approved: true, id: claimId, target, status, name: name || undefined }));
        } else {
          if (pathname.includes('behavioral')) {
            if (typeof runtime?.rejectDirective === 'function') {
              await runtime.rejectDirective(claimId, { companionId: config.id });
            } else if (typeof self?.rejectDirective === 'function') {
              await self.rejectDirective(claimId, config.id);
            }
          } else if (typeof runtime?.rejectProposal === 'function') {
            await runtime.rejectProposal(claimId, { companionId: config.id });
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ rejected: true, id: claimId, status: 'rejected' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Knowledge & Life Database routes
  if (pathname === '/knowledge/life' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      const q = parsedUrl.searchParams.get('q') || '';
      const result = typeof knowledge?.queryLifeContext === 'function'
        ? await knowledge.queryLifeContext(config.id, q)
        : { matchedInventory: [], recentFinances: [], upcomingSchedule: [], preferences: [], formattedContext: '' };
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/knowledge/entities' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      const type = parsedUrl.searchParams.get('type') || undefined;
      const domain = parsedUrl.searchParams.get('domain') || undefined;
      const entities = typeof knowledge?.entities?.getEntities === 'function'
        ? await knowledge.entities.getEntities(config.id, type, domain)
        : [];
      res.end(JSON.stringify({ entities }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/knowledge/events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      const stream = parsedUrl.searchParams.get('stream') || undefined;
      const limit = Number(parsedUrl.searchParams.get('limit') || 50);
      const events = typeof knowledge?.events?.getEvents === 'function'
        ? await knowledge.events.getEvents(config.id, stream, limit)
        : [];
      res.end(JSON.stringify({ events }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/knowledge/tasks' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      const status = parsedUrl.searchParams.get('status') || undefined;
      const tasks = typeof knowledge?.tasks?.getTasks === 'function'
        ? await knowledge.tasks.getTasks(config.id, status)
        : [];
      res.end(JSON.stringify({ tasks }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/knowledge/schedule' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      const items = typeof knowledge?.schedule?.getUpcoming === 'function'
        ? await knowledge.schedule.getUpcoming(config.id)
        : [];
      res.end(JSON.stringify({ items }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/knowledge/entities' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const entity = {
          id: payload.id || `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          companionId: config.id,
          name: payload.name,
          entityType: payload.entityType || payload.type || 'entity',
          domain: payload.domain || 'general',
          properties: payload.properties || {},
        };
        await knowledge?.entities?.saveEntity(entity);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ saved: true, entity }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/knowledge/entities/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const success = await knowledge?.entities?.deleteEntity(payload.id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ deleted: success, id: payload.id }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/knowledge/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const task = {
          id: payload.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          companionId: config.id,
          title: payload.title,
          status: payload.status || 'todo',
          priority: payload.priority !== undefined ? Number(payload.priority) : 1,
          targetDate: payload.targetDate || null,
          metadata: payload.metadata || {},
        };
        await knowledge?.tasks?.saveTask(task);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ saved: true, task }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/knowledge/tasks/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const success = await knowledge?.tasks?.deleteTask(payload.id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ deleted: success, id: payload.id }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/knowledge/events' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const event = {
          id: payload.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          companionId: config.id,
          stream: payload.stream || 'default',
          timestamp: payload.timestamp || new Date().toISOString(),
          metricValue: payload.metricValue !== undefined && payload.metricValue !== null ? Number(payload.metricValue) : undefined,
          metadata: payload.metadata || {},
        };
        await knowledge?.events?.addEvent(event);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ saved: true, event }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/knowledge/schedule' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const item = {
          id: payload.id || `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          companionId: config.id,
          title: payload.title,
          startTime: payload.startTime,
          endTime: payload.endTime || null,
          isRecurring: Boolean(payload.isRecurring),
          status: payload.status || 'active',
        };
        await knowledge?.schedule?.saveItem(item);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ saved: true, item }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/knowledge/schedule/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const success = typeof knowledge?.schedule?.deleteItem === 'function'
          ? await knowledge.schedule.deleteItem(payload.id)
          : false;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ deleted: success, id: payload.id }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: System Logs
  if ((pathname === '/system/logs' || pathname === '/api/system/logs') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      const level = parsedUrl.searchParams.get('level') || undefined;
      const subsystem = parsedUrl.searchParams.get('subsystem') || undefined;
      const q = parsedUrl.searchParams.get('q') || undefined;
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '100', 10);
      const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);
      const logs = typeof runtime?.queryLogs === 'function'
        ? runtime.queryLogs({ companionId: config.id, level, subsystem, q, limit, offset })
        : (typeof self?.db?.queryLogs === 'function' ? self.db.queryLogs({ companionId: config.id, level, subsystem, q, limit, offset }) : []);
      res.end(JSON.stringify({ logs }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message, logs: [] }));
    }
    return;
  }

  if ((pathname === '/system/logs/clear' || pathname === '/api/system/logs/clear' || (pathname === '/system/logs' && req.method === 'DELETE')) && (req.method === 'POST' || req.method === 'DELETE')) {
    try {
      if (typeof runtime?.clearLogs === 'function') {
        runtime.clearLogs(config.id);
      } else if (typeof self?.db?.clearLogs === 'function') {
        self.db.clearLogs(config.id);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cleared: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: State Reset (Return to blank slate)
  if ((pathname === '/api/reset' || pathname === '/memory/reset' || pathname === '/dev/memory/reset') && req.method === 'POST') {
    try {
      const { DatabaseSync } = await import('node:sqlite');
      const dbPath = path.resolve(rootDir, config.organs?.archive?.dbPath || 'siduri.sqlite');
      if (fs.existsSync(dbPath)) {
        const db = new DatabaseSync(dbPath);
        try {
          const tables = [
            'archive_events',
            'self_directives',
            'self_relationships',
            'self_identity',
            'self_personality',
            'self_exemplars',
            'life_entities',
            'life_events',
            'life_finance',
            'life_inventory',
            'life_preferences',
            'life_schedule',
            'life_tasks',
            'system_logs',
          ];
          for (const table of tables) {
            try { db.prepare(`DELETE FROM ${table}`).run(); } catch {}
          }
          try { db.exec('VACUUM'); } catch {}
        } finally {
          db.close();
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reset: true, companionId: config.id, status: 'blank_slate' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: Chat interaction
  if ((pathname === '/chat' || pathname === '/api/chat') && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const chatContext = {
          companionId: config.id,
          actor: {
            actorId: 'owner-user',
            sessionId: `sess-${config.id}`,
            authorizationRole: 'administrator',
            capabilities: ['chat', 'memory:approve', 'action:execute'],
            authenticated: true,
          },
          conversation: {
            channel: 'direct',
            correlationId: `corr-${Date.now()}`,
          },
          source: 'local',
          ...(payload.context || {}),
          ...(payload.mode ? { mode: payload.mode } : {}),
        };

        const userMsg = payload.message || payload.text || '';
        runtime.log('info', 'perception', `User message: "${userMsg.slice(0, 120)}"`, { message: userMsg, mode: payload.mode });

        const response = await dispatchCompanionChat(runtime, {
          id: config.id,
          companionId: config.id,
          message: userMsg,
          context: chatContext,
          history: Array.isArray(payload.history) ? payload.history : [],
          subtitleLanguage: payload.subtitleLanguage || payload.subtitle_language,
        });

        runtime.log('info', 'perception', `Response generated successfully`, {
          speech: response.delivery?.text || response.response?.subtitle_en || response.response?.spoken_ja,
          proposalsCount: (response.metadata?.memory_proposals?.length || 0) + (response.metadata?.behavioral_proposals?.length || 0),
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err) {
        runtime.log('error', 'brain', `Chat generation error: ${err.message}`, { error: err.message, stack: err.stack });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Real-time SSE streaming (Mouth transport)
  if ((pathname === '/chat/stream' || pathname === '/api/chat/stream') && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });
      const abortController = new AbortController();
      const onClose = () => {
        if (!res.writableEnded) {
          abortController.abort('client_disconnect');
        }
      };
      res.on('close', onClose);

      try {
        const payload = JSON.parse(body || '{}');
        const userMsg = payload.message || payload.text || '';
        runtime.log('info', 'perception', `Stream turn started: "${userMsg.slice(0, 120)}"`, { message: userMsg, mode: payload.mode });

        const chatContext = {
          companionId: config.id,
          actor: {
            actorId: 'owner-user',
            sessionId: `sess-${config.id}`,
            authorizationRole: 'administrator',
            capabilities: ['chat', 'memory:approve', 'action:execute'],
            authenticated: true,
          },
          conversation: {
            channel: 'direct',
            correlationId: `corr-${Date.now()}`,
          },
          source: 'local',
          ...(payload.context || {}),
          ...(payload.mode ? { mode: payload.mode } : {}),
        };
        const response = await dispatchCompanionChat(runtime, {
          id: config.id,
          companionId: config.id,
          message: userMsg,
          context: chatContext,
          history: Array.isArray(payload.history) ? payload.history : [],
          medium: 'web',
          signal: abortController.signal,
          subtitleLanguage: payload.subtitleLanguage || payload.subtitle_language,
        });

        res.write(`event: staged\ndata: ${JSON.stringify({ response_id: response.response_id, correlation_id: response.correlation_id, status: response.status })}\n\n`);

        const avatarEvent = response.metadata?.events?.find(
          (e) => (e.kind === 'avatar' || e.kind === 'body') && (e.approval?.toLowerCase() === 'approved' || !e.approval)
        );
        if (avatarEvent) {
          res.write(`event: avatar\ndata: ${JSON.stringify(avatarEvent)}\n\n`);
        }

        const speechText = response.delivery?.text || response.response?.subtitle_en || response.response?.spoken_ja || '';
        res.write(`event: chunk\ndata: ${JSON.stringify({ utteranceId: response.response_id || 'utt-stream', index: 1, deltaText: speechText, isComplete: true, medium: 'web' })}\n\n`);
        res.write(`event: done\ndata: ${JSON.stringify(response)}\n\n`);

        runtime.log('info', 'perception', `Stream turn completed`, {
          responseId: response.response_id,
          speech: speechText,
        });

        res.end();
      } catch (err) {
        if (abortController.signal.aborted) {
          runtime.log('info', 'perception', `Stream interrupted: ${abortController.signal.reason}`);
          res.write(`event: interrupted\ndata: ${JSON.stringify({ reason: abortController.signal.reason })}\n\n`);
        } else {
          runtime.log('error', 'brain', `Stream generation error: ${err.message}`, { error: err.message, stack: err.stack });
          res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
        }
        res.end();
      } finally {
        res.removeListener('close', onClose);
      }
    });
    return;
  }

  // Static files & Next.js web export routing
  let decodedPathname = pathname;
  try {
    while (decodedPathname.includes('%')) {
      const next = decodeURIComponent(decodedPathname);
      if (next === decodedPathname) break;
      decodedPathname = next;
    }
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }
  const normalizedPath = path.normalize(decodedPathname).replace(/^[/\\\\]+/, '');
  const candidatePairs = [
    { root: canonicalPublicRoot, target: path.resolve(canonicalPublicRoot, normalizedPath, 'index.html') },
    { root: canonicalPublicRoot, target: path.resolve(canonicalPublicRoot, normalizedPath + '.html') },
    { root: canonicalPublicRoot, target: path.resolve(canonicalPublicRoot, normalizedPath) },
  ];

  if (!normalizedPath || normalizedPath === '.' || normalizedPath === './') {
    candidatePairs.unshift({ root: canonicalPublicRoot, target: path.resolve(canonicalPublicRoot, 'index.html') });
  }

  // Asset serving for companion assets (e.g. /assets/body/<name>/model.model3.json)
  if (decodedPathname.startsWith('/assets/')) {
    const relativeAssetPath = path.normalize(decodedPathname.slice('/assets/'.length)).replace(/^[/\\\\]+/, '');
    candidatePairs.unshift({ root: canonicalAssetsRoot, target: path.resolve(canonicalAssetsRoot, relativeAssetPath) });
  }

  // Compatibility for live2d assets
  if (decodedPathname.startsWith('/live2d/')) {
    const relativeAssetPath = path.normalize(decodedPathname.slice('/live2d/'.length)).replace(/^[/\\\\]+/, '');
    candidatePairs.unshift({ root: canonicalAssetsRoot, target: path.resolve(canonicalAssetsRoot, 'body', relativeAssetPath) });
    candidatePairs.unshift({ root: path.resolve(rootDir, 'apps/web/public'), target: path.resolve(rootDir, 'apps/web/public/live2d', relativeAssetPath) });
  }

  for (const { root, target } of candidatePairs) {
    try {
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        continue;
      }
      const fileStat = await stat(target);
      if (fileStat.isFile()) {
        const ext = path.extname(target).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.wav': 'audio/wav',
          '.ico': 'image/x-icon',
          '.txt': 'text/plain; charset=utf-8',
          '.moc3': 'application/octet-stream',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const content = await readFile(target);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return;
      }
    } catch (e) {}
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = process.env.PORT || 3000;
server.listen(Number(PORT), '127.0.0.1', () => {
  console.log(`✓ Siduri [${config.name}] initialized directly from siduri-x monorepo.`);
  console.log(`➜ Web Companion & Memory Console running at: http://127.0.0.1:${PORT}`);
  if (process.env.PORT === '0') {
    server.close();
  }
});
