import { OrganManifest } from './manifest';
import { generateInstanceFiles } from './generator';

describe('Instance Generator Composition Invariants (Phase 3)', () => {
  const MOCK_MANIFESTS: Record<string, OrganManifest> = {
    brain: {
      name: '@siduri-y/brain',
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
      name: '@siduri-y/hands',
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
      name: '@siduri-y/memory',
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
      name: '@siduri-y/body',
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
      name: '@siduri-y/voice',
      organType: 'voice',
      version: '1.0.0',
      displayName: 'Voice (VOICEVOX Speech Synthesis)',
      entrypoint: './dist/index.js',
      factory: 'VoicevoxAdapter',
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
    expect(pkg.dependencies['@siduri-y/core']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/brain']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/memory']).toBeUndefined();
    expect(pkg.dependencies['@siduri-y/hands']).toBeUndefined();
    expect(pkg.dependencies['@siduri-y/voice']).toBeUndefined();
    expect(pkg.dependencies['@siduri-y/body']).toBeUndefined();

    // src/index.js
    expect(files['src/index.js']).toContain("import { OpenRouterBrain } from '@siduri-y/brain'");
    expect(files['src/index.js']).not.toContain('@siduri-y/hands');
    expect(files['src/index.js']).not.toContain('@siduri-y/memory');
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
    expect(pkg.dependencies['@siduri-y/core']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/brain']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/hands']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/memory']).toBeUndefined();

    // src/index.js
    expect(files['src/index.js']).toContain("import { OpenRouterBrain } from '@siduri-y/brain'");
    expect(files['src/index.js']).toContain("import { DefaultHandsOrgan } from '@siduri-y/hands'");
    expect(files['src/index.js']).not.toContain('@siduri-y/memory');

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
    expect(pkg.dependencies['@siduri-y/core']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/brain']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/memory']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/hands']).toBeUndefined();

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
    expect(pkg.dependencies['@siduri-y/core']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/brain']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/memory']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/hands']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/body']).toBeDefined();
    expect(pkg.dependencies['@siduri-y/voice']).toBeDefined();

    // Body asset directory requested
    expect(files.createAssetsBodyDir).toBe(true);

    // README mentions Live2D model assets
    expect(files['README.md']).toContain('assets/body/model');
  });
});
