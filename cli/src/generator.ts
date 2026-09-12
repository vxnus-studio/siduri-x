import { OrganManifest } from './manifest';
import { generateWebHtml } from './web-template';

export interface GeneratedInstanceFiles {
  'package.json': string;
  'siduri.config.json': string;
  'siduri.schema.json': string;
  '.env.example': string;
  'README.md': string;
  'src/index.js': string;
  'public/index.html': string;
  createAssetsBodyDir?: boolean;
  createAssetsDirs?: string[];
}

export interface InstanceGeneratorOptions {
  name: string;
  id?: string;
  selectedManifests: OrganManifest[];
  organConfigs?: Record<string, any>;
  coreVersion?: string;
}

function getDefaultConfigForManifest(manifest: OrganManifest): Record<string, any> {
  const schema = manifest.configSchema || {};
  const props = schema.properties || {};
  const config: Record<string, any> = {};

  for (const [key, val] of Object.entries(props) as [string, any][]) {
    if (val.default !== undefined) {
      config[key] = val.default;
    } else if (val.enum && val.enum.length > 0) {
      config[key] = val.enum[0];
    } else if (val.type === 'string') {
      config[key] = '';
    } else if (val.type === 'number') {
      config[key] = 0;
    } else if (val.type === 'boolean') {
      config[key] = false;
    } else if (val.type === 'array') {
      config[key] = [];
    } else if (val.type === 'object') {
      config[key] = {};
    }
  }

  // Provide sensible defaults for known common keys if missing
  if (manifest.organType === 'brain') {
    config.provider = config.provider || 'openrouter';
    config.model = config.model || 'anthropic/claude-3.5-sonnet';
    config.apiKeyEnv = 'OPENROUTER_API_KEY';
  } else if (manifest.organType === 'memory') {
    config.provider = config.provider || 'sqlite';
  } else if (manifest.organType === 'voice') {
    config.provider = config.provider || 'voicevox';
    config.speakerId = config.speakerId || 1;
    config.baseUrl = config.baseUrl || 'http://localhost:50021';
  } else if (manifest.organType === 'body') {
    config.provider = config.provider || 'live2d';
    config.initialExpression = config.initialExpression || 'neutral';
    config.modelPath = config.modelPath || './assets/body/default/model.model3.json';
    config.modelUrl = config.modelUrl || '/assets/body/default/model.model3.json';
  } else if (manifest.organType === 'hands') {
    config.defaultTimeoutMs = config.defaultTimeoutMs || 10000;
    config.providers = config.providers || [];
  } else if (manifest.organType === 'knowledge') {
    config.provider = config.provider || 'none';
  } else if (manifest.organType === 'behavior') {
    config.provider = config.provider || 'active_self';
  } else if (manifest.organType === 'vision') {
    config.provider = config.provider || 'openrouter';
    config.model = config.model || 'gpt-4-vision';
  } else if (manifest.organType === 'mouth') {
    config.defaultMedium = 'web';
    config.maxTextLength = config.maxTextLength || 8000;
  }

  return config;
}

export function generateInstanceFiles(options: InstanceGeneratorOptions): GeneratedInstanceFiles {
  const instanceName = options.name || 'my-siduri';
  const instanceId = options.id || 'default';
  const coreVersion = options.coreVersion || '^2.0.0';
  const manifests = options.selectedManifests;

  const hasMemory = manifests.some((m) => m.organType === 'memory');
  const hasVoice = manifests.some((m) => m.organType === 'voice');
  const hasBody = manifests.some((m) => m.organType === 'body');
  const hasMouth = manifests.some((m) => m.organType === 'mouth');

  const voiceConfig = options.organConfigs?.voice || options.organConfigs?.['@siduri-x/voice'];
  const isVoicevox = hasVoice && (!voiceConfig || voiceConfig.provider === 'voicevox');

  // 1. package.json
  const dependencies: Record<string, string> = {
    '@siduri-x/core': coreVersion,
  };
  for (const m of manifests) {
    dependencies[m.name] = `^${m.version || '2.0.0'}`;
  }

  const scripts: Record<string, string> = {
    start: 'node src/index.js',
    dev: 'node --watch src/index.js',
    doctor: 'siduri doctor',
    db: 'siduri db',
  };

  const devDependencies: Record<string, string> = {
    '@vxnus/siduri': coreVersion,
  };

  const packageJsonObj = {
    name: instanceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-siduri',
    private: true,
    type: 'module',
    engines: {
      node: '>=22.16.0',
    },
    scripts,
    dependencies,
    devDependencies,
  };
  const packageJson = JSON.stringify(packageJsonObj, null, 2) + '\n';

  // 3. siduri.config.json
  const organsConfig: Record<string, any> = {};
  for (const m of manifests) {
    const customConfig = options.organConfigs?.[m.configKey] || options.organConfigs?.[m.organType];
    organsConfig[m.configKey] = customConfig || getDefaultConfigForManifest(m);
  }

  const configObj = {
    $schema: './siduri.schema.json',
    id: instanceId,
    name: instanceName,
    organs: organsConfig,
  };
  const siduriConfigJson = JSON.stringify(configObj, null, 2) + '\n';

  // 4. siduri.schema.json
  const organPropertiesSchema: Record<string, any> = {};
  for (const m of manifests) {
    organPropertiesSchema[m.configKey] = m.configSchema || { type: 'object' };
  }

  const schemaObj = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: `Siduri Configuration Schema (${instanceName})`,
    type: 'object',
    required: ['id', 'name', 'organs'],
    additionalProperties: false,
    properties: {
      $schema: { type: 'string' },
      id: { type: 'string', description: 'Unique companion isolation ID' },
      name: { type: 'string', description: 'Display name of the companion' },
      organs: {
        type: 'object',
        additionalProperties: false,
        properties: organPropertiesSchema,
      },
    },
  };
  const siduriSchemaJson = JSON.stringify(schemaObj, null, 2) + '\n';

  // 5. .env.example
  const envLines: string[] = [];
  for (const m of manifests) {
    if (m.environment && m.environment.length > 0) {
      envLines.push(`# ${m.displayName || m.name}`);
      for (const envVar of m.environment) {
        if (envVar.description) {
          envLines.push(`# ${envVar.description}${envVar.required ? ' (required)' : ' (optional)'}`);
        }
        const defaultVal = envVar.default || '';
        envLines.push(`${envVar.name}=${defaultVal}`);
      }
      envLines.push('');
    }
  }
  const envExample = envLines.length > 0 ? envLines.join('\n') : '# No external environment variables required\n';

  // 6. src/index.js
  const importLines: string[] = [
    `import { createServer } from 'node:http';`,
    `import { readFile, stat, readdir } from 'node:fs/promises';`,
    `import path from 'node:path';`,
    `import { fileURLToPath } from 'node:url';`,
    `import { SiduriRuntime, dispatchCompanionChat, validateCompanionConfig } from '@siduri-x/core';`,
  ];
  for (const m of manifests) {
    importLines.push(`import { ${m.factory} } from '${m.name}';`);
  }

  const instantiationLines: string[] = [];
  const organMapEntries: string[] = [];

  for (const m of manifests) {
    const varName = m.configKey;
    instantiationLines.push(`const ${varName} = new ${m.factory}(config.organs.${m.configKey});`);
    organMapEntries.push(`  ${varName},`);
  }

  if (hasMouth && hasVoice) {
    instantiationLines.push(`if (typeof mouth?.setVoiceOrgan === 'function') mouth.setVoiceOrgan(voice);`);
  }

  const selectedDisplayNames = manifests.map((m) => m.displayName.split(' ')[0] || m.organType).join(', ');

  const srcIndexJs = [
    ...importLines,
    '',
    `const __filename = fileURLToPath(import.meta.url);`,
    `const __dirname = path.dirname(__filename);`,
    `const rootDir = path.resolve(__dirname, '..');`,
    '',
    `const config = JSON.parse(`,
    `  await readFile(path.join(rootDir, 'siduri.config.json'), 'utf8')`,
    `);`,
    `const schemaPath = path.join(rootDir, 'siduri.schema.json');`,
    `try {`,
    `  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));`,
    `  validateCompanionConfig(config, schema);`,
    `} catch (err) {`,
    `  if (err?.code !== 'ENOENT') {`,
    `    console.error('Config validation failed:', err.message);`,
    `    throw err;`,
    `  }`,
    `}`,
    '',
    ...instantiationLines,
    '',
    `const runtime = new SiduriRuntime(config.id, config, {`,
    ...organMapEntries,
    `});`,
    '',
    `await runtime.initialize();`,
    '',
    `const audioCache = new Map();`,
    '',
    `const server = createServer(async (req, res) => {`,
    `  const parsedUrl = new URL(req.url, \`http://\${req.headers.host || 'localhost'}\`);`,
    `  const pathname = parsedUrl.pathname;`,
    '',
    `  // API: Status & Health Probes (minimal safe operational state, no secrets/credentials/config.organs)`,
    `  if ((pathname === '/health' || pathname === '/api/status') && req.method === 'GET') {`,
    `    res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `    res.end(JSON.stringify({`,
    `      status: 'ok',`,
    `      uptime: process.uptime(),`,
    `    }));`,
    `    return;`,
    `  }`,
    '',
    `  // API: Audio buffer retrieval for voice playback`,
    `  if (pathname.startsWith('/api/audio/') && req.method === 'GET') {`,
    `    const audioId = pathname.slice('/api/audio/'.length);`,
    `    const buffer = audioCache.get(audioId);`,
    `    if (buffer) {`,
    `      res.writeHead(200, { 'Content-Type': 'audio/wav' });`,
    `      res.end(Buffer.from(buffer));`,
    `      return;`,
    `    }`,
    `    res.writeHead(404, { 'Content-Type': 'application/json' });`,
    `    res.end(JSON.stringify({ error: 'Audio not found' }));`,
    `    return;`,
    `  }`,
    '',
    `  // API: Memory Claims & Items`,
    `  if ((pathname === '/memory' || pathname === '/memory/claims' || pathname === '/api/memory/claims') && req.method === 'GET') {`,
    `    res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `    try {`,
    `      const claims = typeof memory?.getAllClaims === 'function' ? await memory.getAllClaims() : (typeof memory?.getClaims === 'function' ? await memory.getClaims() : []);`,
    `      res.end(JSON.stringify({ claims, items: claims }));`,
    `    } catch (e) {`,
    `      res.end(JSON.stringify({ claims: [], items: [] }));`,
    `    }`,
    `    return;`,
    `  }`,
    '',
    `  // API: Memory Proposals`,
    `  if (pathname === '/memory/proposals' && req.method === 'GET') {`,
    `    res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `    try {`,
    `      const proposals = typeof memory?.getPendingClaims === 'function' ? await memory.getPendingClaims() : [];`,
    `      res.end(JSON.stringify({ proposals }));`,
    `    } catch (e) {`,
    `      res.end(JSON.stringify({ proposals: [] }));`,
    `    }`,
    `    return;`,
    `  }`,
    '',
    `  // API: Memory Directives`,
    `  if ((pathname === '/memory/behavioral' || pathname === '/api/memory/directives') && req.method === 'GET') {`,
    `    res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `    try {`,
    `      const directives = typeof memory?.getDirectives === 'function' ? await memory.getDirectives() : [`,
    `        { domain: 'personality', name: 'Active Self Tone', content: 'Warm, empathetic, and thoughtful conversational style.' },`,
    `        { domain: 'cognition', name: 'Authoritative Memory', content: 'Ground responses in verified claims and personal history.' }`,
    `      ];`,
    `      res.end(JSON.stringify({ directives }));`,
    `    } catch (e) {`,
    `      res.end(JSON.stringify({ directives: [] }));`,
    `    }`,
    `    return;`,
    `  }`,
    '',
    `  // API: Memory Proposal Approval / Rejection`,
    `  if ((pathname === '/memory/proposals/approve' || pathname === '/memory/proposals/reject') && req.method === 'POST') {`,
    `    let body = '';`,
    `    req.on('data', (chunk) => { body += chunk; });`,
    `    req.on('end', async () => {`,
    `      try {`,
    `        const payload = JSON.parse(body || '{}');`,
    `        const claimId = payload.id || payload.claimId;`,
    `        if (!claimId) {`,
    `          res.writeHead(400, { 'Content-Type': 'application/json' });`,
    `          res.end(JSON.stringify({ error: 'Missing required claim id' }));`,
    `          return;`,
    `        }`,
    `        if (pathname.endsWith('approve')) {`,
    `          if (typeof memory?.approveClaim === 'function') {`,
    `            await memory.approveClaim(claimId);`,
    `          }`,
    `          res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `          res.end(JSON.stringify({ approved: true, id: claimId }));`,
    `        } else {`,
    `          if (typeof memory?.rejectClaim === 'function') {`,
    `            await memory.rejectClaim(claimId);`,
    `          }`,
    `          res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `          res.end(JSON.stringify({ rejected: true, id: claimId }));`,
    `        }`,
    `      } catch (err) {`,
    `        res.writeHead(500, { 'Content-Type': 'application/json' });`,
    `        res.end(JSON.stringify({ error: err.message }));`,
    `      }`,
    `    });`,
    `    return;`,
    `  }`,
    '',
    `  // API: Evidence packs`,
    `  if (pathname === '/evidence/packs' && req.method === 'GET') {`,
    `    res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `    res.end(JSON.stringify({ packs: [] }));`,
    `    return;`,
    `  }`,
    '',
    `  // API: Chat interaction (routed through canonical dispatchCompanionChat from @siduri-x/core)`,
    `  if ((pathname === '/chat' || pathname === '/api/chat') && req.method === 'POST') {`,
    `    let body = '';`,
    `    req.on('data', (chunk) => { body += chunk; });`,
    `    req.on('end', async () => {`,
    `      try {`,
    `        const payload = JSON.parse(body || '{}');`,
    `        const response = await dispatchCompanionChat(runtime, {`,
    `          id: config.id,`,
    `          companionId: config.id,`,
    `          message: payload.message || payload.text || '',`,
    `          context: payload.context,`,
    `          history: Array.isArray(payload.history) ? payload.history : [],`,
    `        });`,
    '',
    `        res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `        res.end(JSON.stringify(response));`,
    `      } catch (err) {`,
    `        res.writeHead(500, { 'Content-Type': 'application/json' });`,
    `        res.end(JSON.stringify({ error: err.message }));`,
    `      }`,
    `    });`,
    `    return;`,
    `  }`,
    '',
    `  // API: Real-time SSE streaming (Mouth transport)`,
    `  if ((pathname === '/chat/stream' || pathname === '/api/chat/stream') && req.method === 'POST') {`,
    `    let body = '';`,
    `    req.on('data', (chunk) => { body += chunk; });`,
    `    req.on('end', async () => {`,
    `      res.writeHead(200, {`,
    `        'Content-Type': 'text/event-stream',`,
    `        'Cache-Control': 'no-cache, no-transform',`,
    `        'Connection': 'keep-alive',`,
    `      });`,
    `      const abortController = new AbortController();`,
    `      const onClose = () => {`,
    `        abortController.abort('client_disconnect');`,
    `        if (typeof runtime.interruptMouth === 'function') {`,
    `          runtime.interruptMouth('client_disconnect');`,
    `        }`,
    `      };`,
    `      req.on('close', onClose);`,
    '',
    `      try {`,
    `        const payload = JSON.parse(body || '{}');`,
    `        const response = await dispatchCompanionChat(runtime, {`,
    `          id: config.id,`,
    `          companionId: config.id,`,
    `          message: payload.message || payload.text || '',`,
    `          context: payload.context,`,
    `          history: Array.isArray(payload.history) ? payload.history : [],`,
    `          medium: 'web',`,
    `          signal: abortController.signal,`,
    `        });`,
    '',
    `        res.write(\`event: staged\\ndata: \${JSON.stringify({ response_id: response.response_id, correlation_id: response.correlation_id, status: response.status })}\\n\\n\`);`,
    '',
    `        const avatarEvent = response.metadata?.events?.find(`,
    `          (e) => (e.kind === 'avatar' || e.kind === 'body') && (e.approval === 'APPROVED' || !e.approval)`,
    `        );`,
    `        if (avatarEvent) {`,
    `          res.write(\`event: avatar\\ndata: \${JSON.stringify(avatarEvent)}\\n\\n\`);`,
    `        }`,
    '',
    `        const speechText = response.delivery?.text || response.response?.subtitle_en || response.response?.spoken_ja || '';`,
    `        const utterance = {`,
    `          utteranceId: response.response_id || 'utt-stream',`,
    `          companionId: config.id,`,
    `          responseId: response.response_id,`,
    `          correlationId: response.correlation_id,`,
    `          text: speechText,`,
    `          medium: 'web',`,
    `          expression: avatarEvent?.expression,`,
    `          action: avatarEvent?.action,`,
    `          signal: abortController.signal,`,
    `        };`,
    '',
    `        if (runtime.mouth && typeof runtime.mouth.stream === 'function') {`,
    `          for await (const chunk of runtime.mouth.stream(utterance)) {`,
    `            if (abortController.signal.aborted) {`,
    `              res.write(\`event: chunk\\ndata: \${JSON.stringify({ ...chunk, interrupted: true })}\\n\\n\`);`,
    `              break;`,
    `            }`,
    `            res.write(\`event: chunk\\ndata: \${JSON.stringify(chunk)}\\n\\n\`);`,
    `          }`,
    `        } else {`,
    `          res.write(\`event: chunk\\ndata: \${JSON.stringify({ utteranceId: utterance.utteranceId, index: 1, deltaText: speechText, isComplete: true, medium: 'web' })}\\n\\n\`);`,
    `        }`,
    '',
    `        res.write(\`event: done\\ndata: \${JSON.stringify(response)}\\n\\n\`);`,
    `        res.end();`,
    `      } catch (err) {`,
    `        if (abortController.signal.aborted) {`,
    `          res.write(\`event: interrupted\\ndata: \${JSON.stringify({ reason: abortController.signal.reason })}\\n\\n\`);`,
    `        } else {`,
    `          res.write(\`event: error\\ndata: \${JSON.stringify({ error: err.message })}\\n\\n\`);`,
    `        }`,
    `        res.end();`,
    `      } finally {`,
    `        req.removeListener('close', onClose);`,
    `      }`,
    `    });`,
    `    return;`,
    `  }`,
    '',
    `  // API: Barge-in interruption`,
    `  if ((pathname === '/chat/interrupt' || pathname === '/mouth/interrupt' || pathname === '/api/chat/interrupt') && req.method === 'POST') {`,
    `    let body = '';`,
    `    req.on('data', (chunk) => { body += chunk; });`,
    `    req.on('end', () => {`,
    `      try {`,
    `        const payload = JSON.parse(body || '{}');`,
    `        const reason = payload.reason || 'user_barge_in';`,
    `        if (typeof runtime.interruptMouth === 'function') {`,
    `          runtime.interruptMouth(reason);`,
    `        }`,
    `        res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `        res.end(JSON.stringify({ success: true, interrupted: true, reason }));`,
    `      } catch (e) {`,
    `        res.writeHead(500, { 'Content-Type': 'application/json' });`,
    `        res.end(JSON.stringify({ error: e.message }));`,
    `      }`,
    `    });`,
    `    return;`,
    `  }`,
    '',
    `  // API: Mouth channels & health`,
    `  if ((pathname === '/mouth/health' || pathname === '/api/mouth/health') && req.method === 'GET') {`,
    `    res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `    res.end(JSON.stringify({ provider: 'siduri-mouth', configured: Boolean(runtime.mouth) }));`,
    `    return;`,
    `  }`,
    '',
    `  if ((pathname === '/mouth/channels' || pathname === '/api/mouth/channels') && req.method === 'GET') {`,
    `    res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `    const channels = typeof runtime.mouth?.getRegisteredChannels === 'function' ? runtime.mouth.getRegisteredChannels() : [];`,
    `    res.end(JSON.stringify({ channels }));`,
    `    return;`,
    `  }`,
    '',
    `  // API: Model Catalog Discovery (Body & Voice)`,
    `  if (pathname === '/api/models/body' && req.method === 'GET') {`,
    `    res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `    try {`,
    `      const bodyDir = path.join(rootDir, 'assets', 'body');`,
    `      const entries = await readdir(bodyDir, { withFileTypes: true }).catch(() => []);`,
    `      const models = entries.filter((e) => e.isDirectory()).map((e) => e.name);`,
    `      res.end(JSON.stringify({ models: models.length ? models : ['default'] }));`,
    `    } catch {`,
    `      res.end(JSON.stringify({ models: ['default'] }));`,
    `    }`,
    `    return;`,
    `  }`,
    '',
    `  if (pathname === '/api/models/voice' && req.method === 'GET') {`,
    `    res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `    try {`,
    `      const voiceDir = path.join(rootDir, 'assets', 'voice');`,
    `      const entries = await readdir(voiceDir, { withFileTypes: true }).catch(() => []);`,
    `      const models = entries.filter((e) => e.isDirectory()).map((e) => e.name);`,
    `      res.end(JSON.stringify({ models: models.length ? models : ['default'] }));`,
    `    } catch {`,
    `      res.end(JSON.stringify({ models: ['default'] }));`,
    `    }`,
    `    return;`,
    `  }`,
    '',
    `  // Static files & Next.js apps/web export routing with strict boundary verification`,
    `  let decodedPathname = pathname;`,
    `  try {`,
    `    while (decodedPathname.includes('%')) {`,
    `      const next = decodeURIComponent(decodedPathname);`,
    `      if (next === decodedPathname) break;`,
    `      decodedPathname = next;`,
    `    }`,
    `  } catch {`,
    `    res.writeHead(400, { 'Content-Type': 'text/plain' });`,
    `    res.end('Bad Request');`,
    `    return;`,
    `  }`,
    `  const normalizedPath = path.normalize(decodedPathname).replace(/^[/\\\\]+/, '');`,
    `  const canonicalPublicRoot = path.resolve(rootDir, 'public');`,
    `  const canonicalAssetsRoot = path.resolve(rootDir, 'assets');`,
    `  const candidatePairs = [`,
    `    { root: canonicalPublicRoot, target: path.resolve(canonicalPublicRoot, normalizedPath, 'index.html') },`,
    `    { root: canonicalPublicRoot, target: path.resolve(canonicalPublicRoot, normalizedPath + '.html') },`,
    `    { root: canonicalPublicRoot, target: path.resolve(canonicalPublicRoot, normalizedPath) },`,
    `  ];`,
    '',
    `  if (!normalizedPath || normalizedPath === '.' || normalizedPath === './') {`,
    `    candidatePairs.unshift({ root: canonicalPublicRoot, target: path.resolve(canonicalPublicRoot, 'index.html') });`,
    `  }`,
    '',
    `  // Compatibility fallback for legacy /live2d/<modelName>/... -> ./assets/body/<modelName>/...`,
    `  if (decodedPathname.startsWith('/live2d/')) {`,
    `    const relativeAssetPath = path.normalize(decodedPathname.slice('/live2d/'.length)).replace(/^[/\\\\]+/, '');`,
    `    candidatePairs.unshift({ root: canonicalAssetsRoot, target: path.resolve(canonicalAssetsRoot, 'body', relativeAssetPath) });`,
    `    candidatePairs.unshift({ root: canonicalAssetsRoot, target: path.resolve(canonicalAssetsRoot, 'body', 'model', relativeAssetPath) });`,
    `  }`,
    '',
    `  for (const { root, target } of candidatePairs) {`,
    `    try {`,
    `      // Strict path containment check: target must reside within configured root directory`,
    `      const relative = path.relative(root, target);`,
    `      if (relative.startsWith('..') || path.isAbsolute(relative)) {`,
    `        continue;`,
    `      }`,
    `      const fileStat = await stat(target);`,
    `      if (fileStat.isFile()) {`,
    `        const ext = path.extname(target).toLowerCase();`,
    `        const mimeTypes = {`,
    `          '.html': 'text/html; charset=utf-8',`,
    `          '.js': 'application/javascript; charset=utf-8',`,
    `          '.css': 'text/css; charset=utf-8',`,
    `          '.json': 'application/json',`,
    `          '.png': 'image/png',`,
    `          '.jpg': 'image/jpeg',`,
    `          '.svg': 'image/svg+xml',`,
    `          '.wav': 'audio/wav',`,
    `          '.ico': 'image/x-icon',`,
    `          '.txt': 'text/plain; charset=utf-8',`,
    `          '.moc3': 'application/octet-stream',`,
    `        };`,
    `        const contentType = mimeTypes[ext] || 'application/octet-stream';`,
    `        const content = await readFile(target);`,
    `        res.writeHead(200, { 'Content-Type': contentType });`,
    `        res.end(content);`,
    `        return;`,
    `      }`,
    `    } catch (e) {}`,
    `  }`,
    '',
    `  res.writeHead(404, { 'Content-Type': 'text/plain' });`,
    `  res.end('Not Found');`,
    `});`,
    '',
    `const PORT = process.env.PORT || 3000;`,
    `server.listen(Number(PORT), '127.0.0.1', () => {`,
    `  console.log(\`✓ Siduri [\${config.name}] initialized with [${selectedDisplayNames}].\`);`,
    `  console.log(\`➜ Web Companion & Memory Console running at: http://127.0.0.1:\${PORT}\`);`,
    `  if (process.env.PORT === '0') {`,
    `    server.close();`,
    `  }`,
    `});`,
    '',
  ].join('\n');

  // 7. README.md
  const readmeLines: string[] = [
    `# ${instanceName}`,
    '',
    `Standalone Siduri AI companion instance generated with explicitly composed organs:`,
    '',
    ...manifests.map((m) => `- **${m.displayName}** (\`${m.name}\`)`),
    '',
    '## Prerequisites',
    '',
    '- **Node.js**: `v22.0.0` or higher',
    '- **Environment**: Valid `.env` file (configured from `.env.example`)',
  ];

  if (hasMemory) {
    readmeLines.push(
      '- **Database**: Embedded SQLite (`siduri.sqlite`). Automatically initialized with WAL mode and FTS5 full-text indexing with zero external setup.',
    );
  }

  if (isVoicevox) {
    readmeLines.push('- **VOICEVOX**: Note: The Voicevox engine executable will be securely auto-downloaded at runtime by Siduri if no local URL is provided.');
  }

  readmeLines.push(
    '',
    '## Getting Started',
    '',
    '### 1. Install Dependencies',
    '```bash',
    'npm install',
    '```',
    '',
    '### 2. Configure Environment',
    '```bash',
    'cp .env.example .env',
    '```',
    'Fill in your LLM API key (e.g. `OPENROUTER_API_KEY`) and any other service credentials in `.env`.'
  );

  readmeLines.push(
    '',
    '### 3. Diagnostics & Health Probe',
    'Verify all environment variables, schema conformance, services, and organ connections:',
    '```bash',
    'npm run doctor',
    '```',
    '',
    '### 4. Start Companion & Web Console',
    'Launch your companion runtime and Web UI / Memory Control Panel:',
    '```bash',
    'npm start',
    '```',
    'Then open `http://localhost:3000` in your browser.'
  );

  const companionSlug = instanceName.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default';
  const createAssetsDirs: string[] = [];

  if (hasBody) {
    createAssetsDirs.push(`assets/body/${companionSlug}`);
    readmeLines.push(
      '',
      '### Body & Avatar Models',
      `Place your Live2D Cubism model assets into \`./assets/body/${companionSlug}/\`:`,
      '- `model.model3.json`',
      '- `model.moc3`',
      '- textures directory'
    );
  }

  if (hasVoice) {
    createAssetsDirs.push(`assets/voice/${companionSlug}`);
    readmeLines.push(
      '',
      '### Voice & RVC Models',
      `Place your character RVC voice models into \`./assets/voice/${companionSlug}/\`:`,
      `- \`${companionSlug}.pth\` (Target voice weights)`,
      `- \`${companionSlug}.index\` (Feature index file)`
    );
  }

  readmeLines.push('');
  const readmeMd = readmeLines.join('\n');

  const webHtml = generateWebHtml(instanceName, manifests);

  const result: GeneratedInstanceFiles = {
    'package.json': packageJson,
    'siduri.config.json': siduriConfigJson,
    'siduri.schema.json': siduriSchemaJson,
    '.env.example': envExample,
    'README.md': readmeMd,
    'src/index.js': srcIndexJs,
    'public/index.html': webHtml,
    createAssetsBodyDir: hasBody,
    createAssetsDirs,
  };

  return result;
}
