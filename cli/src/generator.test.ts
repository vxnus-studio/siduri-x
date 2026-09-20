import { OrganManifest } from './manifest';
import { generateInstanceFiles } from './generator';

describe('Instance Generator Composition Invariants (Phase 3)', () => {
  const MOCK_MANIFESTS: Record<string, OrganManifest> = {
    brain: {
      name: '@sidurijs/brain',
      organType: 'brain',
      version: '1.0.0',
      displayName: 'Brain (Cognition & Planning)',
      entrypoint: './dist/index.js',
      factory: 'OpenRouterBrain',
      configKey: 'brain',
      configSchema: { type: 'object', properties: { provider: { type: 'string' }, model: { type: 'string' } } },
      environment: [{ name: 'OPENROUTER_API_KEY', required: true, secret: true }],
      services: [{ name: 'LLM Inference', kind: 'http_service' }],
    },
    hands: {
      name: '@sidurijs/hands',
      organType: 'hands',
      version: '1.0.0',
      displayName: 'Hands (MCP Tool Execution)',
      entrypoint: './dist/index.js',
      factory: 'DefaultHandsOrgan',
      configKey: 'hands',
      configSchema: { type: 'object', properties: { defaultTimeoutMs: { type: 'number' } } },
      environment: [{ name: 'ACTION_POLICY_SECRET', required: true, secret: true }],
      services: [],
    },
    archive: {
      name: '@sidurijs/archive',
      organType: 'archive',
      version: '1.0.0',
      displayName: 'Archive (Interaction Audit Ledger)',
      entrypoint: './dist/index.js',
      factory: 'SqliteArchiveLedger',
      configKey: 'archive',
      configSchema: { type: 'object', properties: { provider: { type: 'string' } } },
      environment: [],
      services: [],
      database: { engine: 'sqlite' },
    },
    body: {
      name: '@sidurijs/body',
      organType: 'body',
      version: '1.0.0',
      displayName: 'Body (Live2D & Avatar State)',
      entrypoint: './dist/index.js',
      factory: 'NeutralBodyOrgan',
      configKey: 'body',
      configSchema: { type: 'object', properties: { provider: { type: 'string' } } },
      environment: [],
      services: [],
    },
    voice: {
      name: '@sidurijs/voice',
      organType: 'voice',
      version: '1.0.0',
      displayName: 'Voice (VOICEVOX Speech Synthesis)',
      entrypoint: './dist/index.js',
      factory: 'VoiceAdapter',
      configKey: 'voice',
      configSchema: { type: 'object', properties: { provider: { type: 'string' } } },
      environment: [{ name: 'VOICEVOX_URL', default: 'http://localhost:50021' }],
      services: [{ name: 'VOICEVOX', kind: 'http_service' }],
    },
    self: {
      name: '@sidurijs/self',
      organType: 'behavior',
      version: '1.0.0',
      displayName: 'Self (Active Persona & Directives)',
      entrypoint: './dist/index.js',
      factory: 'ActiveSelfCompiler',
      configKey: 'behavior',
      configSchema: { type: 'object', properties: { provider: { type: 'string' } } },
      environment: [],
      services: [],
    },
  };

  test('Composition A: Brain only', () => {
    const files = generateInstanceFiles({
      name: 'brain-only-agent',
      selectedManifests: [MOCK_MANIFESTS.brain],
    });

    const pkg = JSON.parse(files['package.json']);
    expect(pkg.dependencies['@sidurijs/core']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/brain']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/archive']).toBeUndefined();
    expect(pkg.dependencies['@sidurijs/hands']).toBeUndefined();
    expect(pkg.dependencies['@sidurijs/voice']).toBeUndefined();
    expect(pkg.dependencies['@sidurijs/body']).toBeUndefined();
    expect(pkg.devDependencies['siduri']).toBeDefined();

    // src/index.js
    expect(files['src/index.js']).toContain("import { OpenRouterBrain } from '@sidurijs/brain'");
    expect(files['src/index.js']).not.toContain('@sidurijs/hands');
    expect(files['src/index.js']).not.toContain('@sidurijs/archive');
    expect(files['src/index.js']).not.toContain('siduri-runtime.js');

    // siduri.config.json
    const config = JSON.parse(files['siduri.config.json']);
    expect(config.organs.brain).toBeDefined();
    expect(config.organs.hands).toBeUndefined();
    expect(config.organs.archive).toBeUndefined();

    // .env.example
    expect(files['.env.example']).toContain('OPENROUTER_API_KEY');
    expect(files['.env.example']).not.toContain('DATABASE_URL');
    expect(files['.env.example']).not.toContain('ACTION_POLICY_SECRET');

    // No body asset scaffold
    expect(files.createAssetsBodyDir).toBe(false);
  });

  test('Composition B: Brain + Hands', () => {
    const files = generateInstanceFiles({
      name: 'coding-agent',
      selectedManifests: [MOCK_MANIFESTS.brain, MOCK_MANIFESTS.hands],
    });

    const pkg = JSON.parse(files['package.json']);
    expect(pkg.dependencies['@sidurijs/core']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/brain']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/hands']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/archive']).toBeUndefined();

    // src/index.js
    expect(files['src/index.js']).toContain("import { OpenRouterBrain } from '@sidurijs/brain'");
    expect(files['src/index.js']).toContain("import { DefaultHandsOrgan } from '@sidurijs/hands'");
    expect(files['src/index.js']).not.toContain('@sidurijs/archive');

    // .env.example
    expect(files['.env.example']).toContain('OPENROUTER_API_KEY');
    expect(files['.env.example']).toContain('ACTION_POLICY_SECRET');
    expect(files['.env.example']).not.toContain('DATABASE_URL');

    expect(files.createAssetsBodyDir).toBe(false);
  });

  test('Composition C: Brain + Archive', () => {
    const files = generateInstanceFiles({
      name: 'archive-agent',
      selectedManifests: [MOCK_MANIFESTS.brain, MOCK_MANIFESTS.archive],
    });

    const pkg = JSON.parse(files['package.json']);
    expect(pkg.dependencies['@sidurijs/core']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/brain']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/archive']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/hands']).toBeUndefined();

    // .env.example
    expect(files['.env.example']).toContain('OPENROUTER_API_KEY');
    expect(files['.env.example']).not.toContain('DATABASE_URL');
    expect(files['.env.example']).not.toContain('ACTION_POLICY_SECRET');

    // README mentions database
    expect(files['README.md']).toContain('siduri.sqlite');
    expect(files['README.md']).not.toContain('PostgreSQL');
    expect(files['README.md']).not.toContain('npx @vxnus/siduri db push');
  });

  test('Composition D: Full with Body', () => {
    const files = generateInstanceFiles({
      name: 'companion-full',
      selectedManifests: [
        MOCK_MANIFESTS.brain,
        MOCK_MANIFESTS.archive,
        MOCK_MANIFESTS.hands,
        MOCK_MANIFESTS.body,
        MOCK_MANIFESTS.voice,
      ],
    });

    const pkg = JSON.parse(files['package.json']);
    expect(pkg.dependencies['@sidurijs/core']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/brain']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/archive']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/hands']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/body']).toBeDefined();
    expect(pkg.dependencies['@sidurijs/voice']).toBeDefined();

    // Body & voice asset directories requested
    expect(files.createAssetsBodyDir).toBe(true);
    expect(files.createAssetsDirs).toContain('assets/body/default');
    expect(files.createAssetsDirs).toContain('assets/voice/default');

    // README mentions Live2D model assets & prerequisites
    expect(files['README.md']).toContain('assets/body/default');
    expect(files['README.md']).toContain('assets/voice/default');
    expect(files['README.md']).toContain('Prerequisites');

    // No docker compose generated (Docker completely removed, host-native runtime)
    expect((files as any)['docker-compose.yml']).toBeUndefined();
    expect(files['README.md']).toContain('Voicevox engine executable will be securely auto-downloaded');
    expect(pkg.scripts['services:up']).toBeUndefined();
    expect(pkg.scripts['services:down']).toBeUndefined();
  });

  test('Composition E: Standalone companion never generates docker-compose.yml and validates config', () => {
    const files = generateInstanceFiles({
      name: 'brain-solo',
      selectedManifests: [MOCK_MANIFESTS.brain],
    });

    expect((files as any)['docker-compose.yml']).toBeUndefined();
    const pkg = JSON.parse(files['package.json']);
    expect(pkg.scripts['services:up']).toBeUndefined();
    expect(files['src/index.js']).toContain('validateCompanionConfig');
    expect(files['public/index.html']).toBeDefined();
    expect(files['public/index.html']).toContain('Memory Console');
    expect(files['public/index.html']).toContain('Companion Chat');
  });

  test('Generated runtime server template enforces loopback binding, safe health, and path containment', () => {
    const files = generateInstanceFiles({
      name: 'secure-companion',
      selectedManifests: [MOCK_MANIFESTS.brain, MOCK_MANIFESTS.archive],
    });

    const srcIndexJs = files['src/index.js'];

    // 1. Explicit loopback binding 127.0.0.1
    expect(srcIndexJs).toContain("server.listen(Number(PORT), '127.0.0.1'");
    expect(srcIndexJs).toContain("http://127.0.0.1:");

    // 2. Minimal /health endpoint without config.organs or secrets
    expect(srcIndexJs).toContain("pathname === '/health'");
    expect(srcIndexJs).not.toContain('organs: config.organs');

    // 3. Strict path traversal containment
    expect(srcIndexJs).toContain('relative.startsWith(\'..\')');
    expect(srcIndexJs).toContain('path.isAbsolute(relative)');
    expect(srcIndexJs).toContain('decodeURIComponent');

    // 4. Chat endpoints define payload before accessing payload.context
    const chatEndpointIndex = srcIndexJs.indexOf("pathname === '/chat'");
    const chatStreamEndpointIndex = srcIndexJs.indexOf("pathname === '/chat/stream'");
    expect(chatEndpointIndex).toBeGreaterThan(-1);
    expect(chatStreamEndpointIndex).toBeGreaterThan(-1);

    const chatSlice = srcIndexJs.slice(chatEndpointIndex, chatStreamEndpointIndex);
    const chatStreamSlice = srcIndexJs.slice(chatStreamEndpointIndex, chatStreamEndpointIndex + 1500);
    expect(chatSlice).toContain("const payload = JSON.parse(body || '{}');");
    expect(chatStreamSlice).toContain("const payload = JSON.parse(body || '{}');");
    expect(chatSlice).toContain("channel: 'direct'");
    expect(chatStreamSlice).toContain("channel: 'direct'");
  });

  test('Composition F: Brain + Self persona manifest & Teach Mode endpoints', () => {
    const files = generateInstanceFiles({
      name: 'ResearchPartner',
      selectedManifests: [MOCK_MANIFESTS.brain, MOCK_MANIFESTS.self],
      organConfigs: {
        behavior: {
          provider: 'active_self',
          mode: 'custom',
          archetype: 'Technical Research Specialist',
          ethos: 'analytical, thoughtful, concise',
          directive: 'Prioritize empirical evidence and speak concisely',
          selfPath: './assets/self/default.self',
        },
      },
    });

    // 1. Assets directory and .self file created in memory
    expect(files.createAssetsDirs).toContain('assets/self');
    expect(files['assets/self/default.self']).toBeDefined();
    expect(files['assets/self/default.self']).toContain('archetype: "Technical Research Specialist"');
    expect(files['assets/self/default.self']).toContain('ethos: "analytical, thoughtful, concise"');
    expect(files['assets/self/default.self']).toContain('Prioritize empirical evidence and speak concisely');
    expect(files['assets/self/default.self']).toContain('name: "ResearchPartner"');

    // 2. src/index.js imports scanDirective and compilePersonaDocument
    const srcIndexJs = files['src/index.js'];
    expect(srcIndexJs).toContain("import { ActiveSelfCompiler, SqliteSelfRepository, SelfPackageParser, scanDirective, compilePersonaDocument } from '@sidurijs/self';");

    // 3. Teach Mode endpoints are generated
    expect(srcIndexJs).toContain("pathname === '/teach/detected-self'");
    expect(srcIndexJs).toContain("pathname === '/teach/upload-self'");
    expect(srcIndexJs).toContain("pathname === '/teach/install-self'");
  });
});


