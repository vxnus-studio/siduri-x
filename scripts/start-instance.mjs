#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Direct monorepo dist imports
import { SiduriRuntime, dispatchCompanionChat } from '../packages/core/dist/index.js';
import { OpenRouterBrain } from '../packages/organs/brain/dist/index.js';
import { SqliteMemoryStore } from '../packages/memory/dist/index.js';
import { UnifiedKnowledgeOrgan } from '../packages/knowledge/dist/index.js';
import { ActiveSelfCompiler, SqliteSelfRepository, SelfPackageParser } from '../packages/self/dist/index.js';
import { DefaultEarOrgan } from '../packages/organs/ear/dist/index.js';

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
const brain = new OpenRouterBrain(config.organs.brain);
const memory = new SqliteMemoryStore({ ...config.organs.memory, dbPath: path.resolve(rootDir, config.organs.memory?.dbPath || 'siduri.sqlite') });
const knowledge = new UnifiedKnowledgeOrgan({ ...config.organs.knowledge, dbPath: path.resolve(rootDir, config.organs.knowledge?.dbPath || 'siduri.sqlite') });
const self = new SqliteSelfRepository({ dbPath: path.resolve(rootDir, 'siduri.sqlite') });
const behavior = new ActiveSelfCompiler(config.organs.behavior);
const ear = new DefaultEarOrgan(config.organs.ear);

const runtime = new SiduriRuntime(config.id, config, {
  brain,
  memory,
  knowledge,
  behavior,
  self,
  ear,
});

await runtime.initialize();

const audioCache = new Map();

// Determine public web directory (Next.js static export)
const webDistCandidates = [
  path.resolve(rootDir, 'cli/dist/web-dist'),
  path.resolve(rootDir, 'apps/web/out'),
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
  if (pathname === '/me' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: config.id,
      name: config.name,
      organs: Object.keys(config.organs || {}),
    }));
    return;
  }

  // API: Memory Claims & Items
  if ((pathname === '/memory' || pathname === '/memory/claims' || pathname === '/api/memory/claims') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      const claims = typeof memory?.getAllClaims === 'function' ? await memory.getAllClaims() : (typeof memory?.getClaims === 'function' ? await memory.getClaims() : []);
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
      const proposals = typeof memory?.getPendingClaims === 'function' ? await memory.getPendingClaims() : [];
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
      const directives = typeof memory?.getDirectives === 'function' ? await memory.getDirectives() : [
        { domain: 'personality', name: 'Active Self Tone', content: 'Warm, empathetic, and thoughtful conversational style.' },
        { domain: 'cognition', name: 'Authoritative Memory', content: 'Ground responses in verified claims and personal history.' }
      ];
      res.end(JSON.stringify({ directives }));
    } catch (e) {
      res.end(JSON.stringify({ directives: [] }));
    }
    return;
  }

  // API: Memory Proposals / Behavioral Approval & Rejection
  if ((pathname === '/memory/proposals/approve' || pathname === '/memory/proposals/reject' || pathname === '/memory/behavioral/approve' || pathname === '/memory/behavioral/reject') && req.method === 'POST') {
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
          if (pathname.includes('behavioral') && typeof self?.approveDirective === 'function') {
            await self.approveDirective(claimId);
          } else if (typeof memory?.approveClaim === 'function') {
            await memory.approveClaim(claimId);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ approved: true, id: claimId, status: 'approved' }));
        } else {
          if (pathname.includes('behavioral') && typeof self?.rejectDirective === 'function') {
            await self.rejectDirective(claimId);
          } else if (typeof memory?.rejectClaim === 'function') {
            await memory.rejectClaim(claimId);
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

  // API: Memory & State Reset (Return to blank slate)
  if ((pathname === '/api/reset' || pathname === '/memory/reset' || pathname === '/dev/memory/reset') && req.method === 'POST') {
    try {
      const { DatabaseSync } = await import('node:sqlite');
      const dbPath = path.resolve(rootDir, config.organs.memory?.dbPath || 'siduri.sqlite');
      if (fs.existsSync(dbPath)) {
        const db = new DatabaseSync(dbPath);
        try {
          db.prepare('DELETE FROM memory_claims').run();
          db.prepare('DELETE FROM memory_events').run();
          db.prepare('DELETE FROM self_directives').run();
          db.prepare('DELETE FROM self_relationships').run();
          db.prepare('DELETE FROM self_identity').run();
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

        const response = await dispatchCompanionChat(runtime, {
          id: config.id,
          companionId: config.id,
          message: payload.message || payload.text || '',
          context: chatContext,
          history: Array.isArray(payload.history) ? payload.history : [],
          subtitleLanguage: payload.subtitleLanguage || payload.subtitle_language,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err) {
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
          message: payload.message || payload.text || '',
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
        res.end();
      } catch (err) {
        if (abortController.signal.aborted) {
          res.write(`event: interrupted\ndata: ${JSON.stringify({ reason: abortController.signal.reason })}\n\n`);
        } else {
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
