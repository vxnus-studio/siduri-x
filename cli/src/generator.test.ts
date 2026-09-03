import { OrganManifest } from './manifest';
import { generateInstanceFiles } from './generator';

describe('Instance Generator Composition Invariants (Phase 3)', () => {
  const MOCK_MANIFESTS: Record<string, OrganManifest> = {
    brain: {
      name: '@siduri-x/brain',
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
      name: '@siduri-x/hands',
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
    memory: {
      name: '@siduri-x/memory',
      organType: 'memory',
      version: '1.0.0',
      displayName: 'Memory (PostgreSQL FTS Claims)',
      entrypoint: './dist/index.js',
      factory: 'PostgresMemoryOrgan',
      configKey: 'memory',
      configSchema: { type: 'object', properties: { provider: { type: 'string' } } },
      environment: [{ name: 'DATABASE_URL', required: true, secret: true }],
      services: [{ name: 'PostgreSQL', kind: 'database' }],
      database: { engine: 'postgres', migrationsDir: './migrations' },
    },
    body: {
      name: '@siduri-x/body',
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
      name: '@siduri-x/voice',
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
  };

  test('Composition A: Brain only', () => {
    const files = generateInstanceFiles({
      name: 'brain-only-agent',
      selectedManifests: [MOCK_MANIFESTS.brain],
    });

    const pkg = JSON.parse(files['package.json']);
    expect(pkg.dependencies['@siduri-x/core']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/brain']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/memory']).toBeUndefined();
    expect(pkg.dependencies['@siduri-x/hands']).toBeUndefined();
    expect(pkg.dependencies['@siduri-x/voice']).toBeUndefined();
    expect(pkg.dependencies['@siduri-x/body']).toBeUndefined();

    // src/index.js
    expect(files['src/index.js']).toContain("import { OpenRouterBrain } from '@siduri-x/brain'");
    expect(files['src/index.js']).not.toContain('@siduri-x/hands');
    expect(files['src/index.js']).not.toContain('@siduri-x/memory');
    expect(files['src/index.js']).not.toContain('siduri-runtime.js');

    // siduri.config.json
    const config = JSON.parse(files['siduri.config.json']);
    expect(config.organs.brain).toBeDefined();
    expect(config.organs.hands).toBeUndefined();
    expect(config.organs.memory).toBeUndefined();

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
    expect(pkg.dependencies['@siduri-x/core']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/brain']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/hands']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/memory']).toBeUndefined();

    // src/index.js
    expect(files['src/index.js']).toContain("import { OpenRouterBrain } from '@siduri-x/brain'");
    expect(files['src/index.js']).toContain("import { DefaultHandsOrgan } from '@siduri-x/hands'");
    expect(files['src/index.js']).not.toContain('@siduri-x/memory');

    // .env.example
    expect(files['.env.example']).toContain('OPENROUTER_API_KEY');
    expect(files['.env.example']).toContain('ACTION_POLICY_SECRET');
    expect(files['.env.example']).not.toContain('DATABASE_URL');

    expect(files.createAssetsBodyDir).toBe(false);
  });

  test('Composition C: Brain + Memory', () => {
    const files = generateInstanceFiles({
      name: 'memory-agent',
      selectedManifests: [MOCK_MANIFESTS.brain, MOCK_MANIFESTS.memory],
    });

    const pkg = JSON.parse(files['package.json']);
    expect(pkg.dependencies['@siduri-x/core']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/brain']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/memory']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/hands']).toBeUndefined();

    // .env.example
    expect(files['.env.example']).toContain('OPENROUTER_API_KEY');
    expect(files['.env.example']).toContain('DATABASE_URL');
    expect(files['.env.example']).not.toContain('ACTION_POLICY_SECRET');

    // README mentions database
    expect(files['README.md']).toContain('DATABASE_URL');
    expect(files['README.md']).toContain('npx @vxnus/siduri db push');
  });

  test('Composition D: Full with Body', () => {
    const files = generateInstanceFiles({
      name: 'companion-full',
      selectedManifests: [
        MOCK_MANIFESTS.brain,
        MOCK_MANIFESTS.memory,
        MOCK_MANIFESTS.hands,
        MOCK_MANIFESTS.body,
        MOCK_MANIFESTS.voice,
      ],
    });

    const pkg = JSON.parse(files['package.json']);
    expect(pkg.dependencies['@siduri-x/core']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/brain']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/memory']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/hands']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/body']).toBeDefined();
    expect(pkg.dependencies['@siduri-x/voice']).toBeDefined();

    // Body & voice asset directories requested
    expect(files.createAssetsBodyDir).toBe(true);
    expect(files.createAssetsDirs).toContain('assets/body/companion-full');
    expect(files.createAssetsDirs).toContain('assets/voice/companion-full');

    // README mentions Live2D model assets & prerequisites
    expect(files['README.md']).toContain('assets/body/companion-full');
    expect(files['README.md']).toContain('assets/voice/companion-full');
    expect(files['README.md']).toContain('Prerequisites');

    // Docker compose generated for memory & voice
    expect(files['docker-compose.yml']).toBeDefined();
    expect(files['docker-compose.yml']).toContain('postgres:15');
    expect(files['docker-compose.yml']).toContain('voicevox/voicevox_engine');
    expect(pkg.scripts['services:up']).toBe('docker compose up -d');
    expect(pkg.scripts['services:down']).toBe('docker compose down');
  });

  test('Composition E: Brain only has no docker-compose.yml', () => {
    const files = generateInstanceFiles({
      name: 'brain-solo',
      selectedManifests: [MOCK_MANIFESTS.brain],
    });

    expect(files['docker-compose.yml']).toBeUndefined();
    const pkg = JSON.parse(files['package.json']);
    expect(pkg.scripts['services:up']).toBeUndefined();
    expect(files['public/index.html']).toBeDefined();
    expect(files['public/index.html']).toContain('Memory Console');
    expect(files['public/index.html']).toContain('Companion Chat');
  });

  test('Generated runtime server template enforces loopback binding, safe health, and path containment', () => {
    const files = generateInstanceFiles({
      name: 'secure-companion',
      selectedManifests: [MOCK_MANIFESTS.brain, MOCK_MANIFESTS.memory],
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
  });
});


