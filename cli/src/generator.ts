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
  'docker-compose.yml'?: string;
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
    config.provider = config.provider || 'postgres';
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
  }

  return config;
}

export function generateInstanceFiles(options: InstanceGeneratorOptions): GeneratedInstanceFiles {
  const instanceName = options.name || 'my-siduri';
  const instanceId = options.id || 'default';
  const coreVersion = options.coreVersion || '^1.0.2';
  const manifests = options.selectedManifests;

  const hasMemory = manifests.some((m) => m.organType === 'memory');
  const hasVoice = manifests.some((m) => m.organType === 'voice');
  const hasBody = manifests.some((m) => m.organType === 'body');

  const voiceConfig = options.organConfigs?.voice || options.organConfigs?.['@siduri-x/voice'];
  const isVoicevox = hasVoice && (!voiceConfig || voiceConfig.provider === 'voicevox');

  const memoryConfig = options.organConfigs?.memory || options.organConfigs?.['@siduri-x/memory'];
  const isPostgresLocal = hasMemory && (!memoryConfig || memoryConfig.deployment === 'local' || memoryConfig.provider === 'postgres');

  // 1. Optional docker-compose.yml
  let dockerComposeYaml: string | undefined;
  const dockerServices: string[] = [];
  const dockerVolumes: string[] = [];

  if (hasMemory && isPostgresLocal) {
    dockerServices.push([
      '  db:',
      '    image: postgres:15',
      '    environment:',
      '      POSTGRES_USER: postgres',
      '      POSTGRES_PASSWORD: password',
      '      POSTGRES_DB: siduri',
      '    ports:',
      '      - "5432:5432"',
      '    volumes:',
      '      - postgres_data:/var/lib/postgresql/data',
      '    healthcheck:',
      '      test: ["CMD-SHELL", "pg_isready -U postgres"]',
      '      interval: 2s',
      '      timeout: 5s',
      '      retries: 5',
    ].join('\n'));
    dockerVolumes.push('  postgres_data:');
  }

  if (isVoicevox) {
    dockerServices.push([
      '  voicevox:',
      '    image: voicevox/voicevox_engine:cpu-latest',
      '    ports:',
      '      - "50021:50021"',
    ].join('\n'));
  }

  if (hasVoice && voiceConfig?.rvc?.enabled) {
    dockerServices.push([
      '  rvc:',
      '    image: ghcr.io/vxnus-studio/rvc-headless:latest',
      '    ports:',
      '      - "50055:50055"',
      '    volumes:',
      '      - ./assets/voice:/app/models',
      '    environment:',
      '      - RVC_MODELS_DIR=/app/models',
    ].join('\n'));
  }

  if (dockerServices.length > 0) {
    const composeLines = [
      'version: "3.8"',
      '',
      'services:',
      ...dockerServices,
    ];
    if (dockerVolumes.length > 0) {
      composeLines.push('', 'volumes:', ...dockerVolumes);
    }
    composeLines.push('');
    dockerComposeYaml = composeLines.join('\n');
  }

  // 2. package.json
  const dependencies: Record<string, string> = {
    '@siduri-x/core': coreVersion,
  };
  for (const m of manifests) {
    dependencies[m.name] = `^${m.version || '1.0.1'}`;
  }

  const scripts: Record<string, string> = {
    start: 'node src/index.js',
    dev: 'node --watch src/index.js',
    doctor: 'siduri doctor',
    db: 'siduri db',
  };

  if (dockerComposeYaml) {
    scripts['services:up'] = 'docker compose up -d';
    scripts['services:down'] = 'docker compose down';
    scripts['services:logs'] = 'docker compose logs -f';
  }

  const packageJsonObj = {
    name: instanceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-siduri',
    private: true,
    type: 'module',
    scripts,
    dependencies,
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
    `import { SiduriRuntime } from '@siduri-x/core';`,
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
    `  // API: Chat interaction (routed through canonical SiduriRuntime)`,
    `  if ((pathname === '/chat' || pathname === '/api/chat') && req.method === 'POST') {`,
    `    let body = '';`,
    `    req.on('data', (chunk) => { body += chunk; });`,
    `    req.on('end', async () => {`,
    `      try {`,
    `        const payload = JSON.parse(body || '{}');`,
    `        const userMessage = payload.message || payload.text || '';`,
    `        const role = payload.role || 'OWNER';`,
    `        const history = Array.isArray(payload.history) ? payload.history : [];`,
    '',
    `        const runtimeResult = await runtime.handleUserMessage(userMessage, role, history);`,
    `        const reply = runtimeResult?.response?.subtitle_ja || runtimeResult?.response?.subtitle_en || '';`,
    `        const audioUrl = runtimeResult?.response?.audio_url || undefined;`,
    `        let expression = 'neutral';`,
    `        const events = runtimeResult?.metadata?.events || [];`,
    `        const avatarEvent = events.find((e) => e.kind === 'avatar' || e.kind === 'body');`,
    `        if (avatarEvent && avatarEvent.expression) {`,
    `          expression = avatarEvent.expression;`,
    `        }`,
    '',
    `        res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `        res.end(JSON.stringify({`,
    `          reply,`,
    `          text: reply,`,
    `          expression,`,
    `          audioUrl,`,
    `          status: runtimeResult?.status || 'ok',`,
    `          runtimeResult,`,
    `        }));`,
    `      } catch (err) {`,
    `        res.writeHead(500, { 'Content-Type': 'application/json' });`,
    `        res.end(JSON.stringify({ error: err.message }));`,
    `      }`,
    `    });`,
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
    '- **Node.js**: `v20.0.0` or higher',
    '- **Environment**: Valid `.env` file (configured from `.env.example`)',
  ];

  if (hasMemory || isVoicevox) {
    readmeLines.push(
      '- **Local Services (Optional)**: Docker (or standalone alternatives):',
    );
    if (hasMemory) {
      readmeLines.push('  - **PostgreSQL**: Required for memory claims & durable state (or use cloud Supabase/Neon)');
    }
    if (isVoicevox) {
      readmeLines.push('  - **VOICEVOX**: Required for voice synthesis (or run the official desktop app from [voicevox.hiroshiba.jp](https://voicevox.hiroshiba.jp/))');
    }
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

  if (dockerComposeYaml) {
    readmeLines.push(
      '',
      '### 3. Start Local Services (Docker)',
      '```bash',
      'npm run services:up',
      '```',
      '*(To stop services later, run `npm run services:down`)*'
    );
  }

  if (hasMemory) {
    readmeLines.push(
      '',
      `### ${dockerComposeYaml ? '4' : '3'}. Database Migrations`,
      'Ensure `DATABASE_URL` in `.env` is reachable, then push the memory organ PostgreSQL schema:',
      '```bash',
      'npx @vxnus/siduri db push',
      '```'
    );
  }

  readmeLines.push(
    '',
    `### ${hasMemory ? (dockerComposeYaml ? '5' : '4') : (dockerComposeYaml ? '4' : '3')}. Diagnostics & Health Probe`,
    'Verify all environment variables, services, and organ connections:',
    '```bash',
    'npm run doctor',
    '```',
    '',
    `### ${hasMemory ? (dockerComposeYaml ? '6' : '5') : (dockerComposeYaml ? '5' : '4')}. Start Companion & Web Console`,
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

  if (dockerComposeYaml) {
    result['docker-compose.yml'] = dockerComposeYaml;
  }

  return result;
}
