import { OrganManifest } from './manifest';

export interface GeneratedInstanceFiles {
  'package.json': string;
  'siduri.config.json': string;
  'siduri.schema.json': string;
  '.env.example': string;
  'README.md': string;
  'src/index.js': string;
  createAssetsBodyDir?: boolean;
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
  const coreVersion = options.coreVersion || '^1.0.0';
  const manifests = options.selectedManifests;

  // 1. package.json
  const dependencies: Record<string, string> = {
    '@siduri-x/core': coreVersion,
  };
  for (const m of manifests) {
    dependencies[m.name] = `^${m.version || '1.0.0'}`;
  }

  const packageJsonObj = {
    name: instanceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-siduri',
    private: true,
    type: 'module',
    scripts: {
      start: 'node src/index.js',
      dev: 'node --watch src/index.js',
      doctor: 'siduri doctor',
      db: 'siduri db',
    },
    dependencies,
  };
  const packageJson = JSON.stringify(packageJsonObj, null, 2) + '\n';

  // 2. siduri.config.json
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

  // 3. siduri.schema.json
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

  // 4. .env.example
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

  // 5. src/index.js
  const importLines: string[] = [
    `import { readFile } from 'node:fs/promises';`,
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
    `const config = JSON.parse(`,
    `  await readFile(new URL('../siduri.config.json', import.meta.url), 'utf8')`,
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
    `console.log(\`✓ Siduri [\${config.name}] initialized with [${selectedDisplayNames}].\`);`,
    '',
  ].join('\n');

  // 6. README.md
  const readmeLines: string[] = [
    `# ${instanceName}`,
    '',
    `Standalone Siduri instance generated with explicitly composed organs:`,
    '',
    ...manifests.map((m) => `- **${m.displayName}** (\`${m.name}\`)`),
    '',
    '## Getting Started',
    '',
    '1. Install dependencies:',
    '```bash',
    'npm install',
    '```',
    '',
    '2. Configure environment:',
    '```bash',
    'cp .env.example .env',
    '```',
  ];

  const hasMemory = manifests.some((m) => m.organType === 'memory');
  if (hasMemory) {
    readmeLines.push(
      '',
      '### Database Setup',
      'This instance uses PostgreSQL Memory for durable claims and directives.',
      'Ensure `DATABASE_URL` in `.env` is reachable, then run migrations:',
      '```bash',
      'npx @vxnus/siduri db push',
      '```'
    );
  }

  const hasBody = manifests.some((m) => m.organType === 'body');
  if (hasBody) {
    readmeLines.push(
      '',
      '### Avatar Assets',
      'Place your Live2D Cubism model assets into `./assets/body/model/`:',
      '- `model.model3.json`',
      '- `model.moc3`',
      '- textures directory'
    );
  }

  readmeLines.push(
    '',
    '## Running the Instance',
    '',
    'Start the companion:',
    '```bash',
    'npm start',
    '```',
    '',
    'Run diagnostics:',
    '```bash',
    'npm run doctor',
    '```',
    ''
  );

  const readmeMd = readmeLines.join('\n');

  return {
    'package.json': packageJson,
    'siduri.config.json': siduriConfigJson,
    'siduri.schema.json': siduriSchemaJson,
    '.env.example': envExample,
    'README.md': readmeMd,
    'src/index.js': srcIndexJs,
    createAssetsBodyDir: hasBody,
  };
}
