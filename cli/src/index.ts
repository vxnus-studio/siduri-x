#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import inquirer from 'inquirer';
import { createRemoteProvider, loadPack } from '@vxnus/e-knowledge';

const execFile = promisify(execFileCallback);
const DEFAULT_REGISTRY_URL = 'https://e.vxnus.xyz/api/packs';
const CLI_VERSION = '0.0.3';
const RUNTIME_DEPENDENCIES = {
  '@vxnus/e': '^0.1.3',
  '@vxnus/e-knowledge': '^0.1.2',
  cors: '^2.8.5',
  express: '^4.18.2',
  pg: '^8.23.0',
  ws: '^8.21.3',
  zod: '^4.4.3',
};

const colors = {
  cyan: '\u001b[36m',
  dim: '\u001b[2m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  reset: '\u001b[0m',
};

function printHeader(): void {
  console.log(`\n${colors.cyan}◈ SIDURI${colors.reset} ${colors.dim}companion setup${colors.reset}`);
  console.log(`${colors.yellow}Experimental release 0.0.3${colors.reset} · configuration may change\n`);
}

function printSection(title: string): void {
  console.log(`\n${colors.cyan}── ${title} ${'─'.repeat(Math.max(2, 42 - title.length))}${colors.reset}`);
}

function printSuccess(message: string): void {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function runtimePath(): string {
  const projectRuntime = path.join(process.cwd(), 'siduri-runtime.js');
  return path.resolve(pathExists(projectRuntime) ? projectRuntime : path.join(__dirname, 'runtime.js'));
}

function pathExists(filePath: string): boolean {
  try {
    require('node:fs').accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

async function startRuntime(): Promise<void> {
  const filePath = runtimePath();
  if (!pathExists(filePath)) {
    throw new Error('Siduri runtime bundle is missing. Reinstall the CLI or rebuild the package.');
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [filePath], { stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) process.exitCode = 1;
      else if (code !== null) process.exitCode = code;
      resolve();
    });
  });
}

async function withTask<T>(label: string, task: () => Promise<T>): Promise<T> {
  process.stdout.write(`${colors.dim}${label}${colors.reset}`);
  const frames = ['·', '•', '●', '•'];
  let index = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r${colors.dim}${label} ${frames[index++ % frames.length]}${colors.reset}`);
  }, 120);
  try {
    const result = await task();
    clearInterval(timer);
    process.stdout.write(`\r${colors.green}✓${colors.reset} ${label}\n`);
    return result;
  } catch (error) {
    clearInterval(timer);
    process.stdout.write(`\r${colors.yellow}!${colors.reset} ${label}\n`);
    throw error;
  }
}

function nonEmpty(value: string): true | string {
  return value.trim().length > 0 || 'Please enter a value.';
}

function urlValue(value: string): true | string {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) || 'Use an HTTP(S) URL.';
  } catch {
    return 'Use a valid HTTP(S) URL.';
  }
}

type RegistryPack = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  distribution: { kind: 'archive' | 'provider'; url: string; checksum?: string };
};

type KnowledgeConfig = {
  provider: 'e-knowledge' | 'e-remote' | 'e-hub' | 'none';
  packPath?: string;
  baseUrl?: string;
  registryUrl?: string;
  packId?: string;
  timeoutMs?: number;
};

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function projectDirectoryName(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'siduri';
}

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function findManifest(root: string): Promise<string> {
  try {
    await readFile(path.join(root, 'manifest.json'), 'utf8');
    return root;
  } catch {
    // Archives may contain one top-level directory.
  }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      await readFile(path.join(root, entry.name, 'manifest.json'), 'utf8');
      return path.join(root, entry.name);
    } catch {
      // Continue searching immediate children.
    }
  }
  throw new Error('Downloaded archive does not contain a manifest.json at its root');
}

async function installArchive(pack: RegistryPack): Promise<string> {
  const response = await fetch(pack.distribution.url);
  if (!response.ok) throw new Error(`Pack archive returned HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  if (pack.distribution.checksum) {
    const checksum = createHash('sha256').update(archive).digest('hex');
    if (checksum !== pack.distribution.checksum) {
      throw new Error(`Pack archive checksum mismatch for ${pack.id}@${pack.version}`);
    }
  }

  const work = await mkdtemp(path.join(tmpdir(), 'siduri-pack-'));
  try {
    const archivePath = path.join(work, 'pack.tar.gz');
    const extractedPath = path.join(work, 'extracted');
    await writeFile(archivePath, archive);
    await mkdir(extractedPath);
    const { stdout: listing } = await execFile('tar', ['-tzf', archivePath]);
    if (listing.split('\n').some((entry) => entry.startsWith('/') || entry.split('/').includes('..'))) {
      throw new Error('Pack archive contains an unsafe path');
    }
    await execFile('tar', ['-xzf', archivePath, '-C', extractedPath, '--no-same-owner', '--no-same-permissions', '--no-absolute-names']);
    const sourcePath = await findManifest(extractedPath);
    const destination = path.join(homedir(), '.siduri', 'knowledge', safePart(pack.publisher), safePart(pack.name), safePart(pack.version));
    await mkdir(path.dirname(destination), { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await cp(sourcePath, destination, { recursive: true });
    return destination;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function chooseHubPack(registryUrl: string): Promise<RegistryPack> {
  const { query } = await inquirer.prompt<{ query: string }>({
    type: 'input',
    name: 'query',
    message: 'Search the Knowledge Hub or enter a package ID:',
  });
  const normalized = query.trim().replace(/^@/, '');
  const [publisher, name] = normalized.split('/');
  const result: RegistryPack | { packs: RegistryPack[] } = publisher && name && !query.includes(' ')
    ? await withTask('Searching Knowledge Hub', () => getJson<RegistryPack>(`${registryUrl}/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}`))
    : await withTask('Searching Knowledge Hub', () => getJson<{ packs: RegistryPack[] }>(`${registryUrl}?q=${encodeURIComponent(query)}&limit=20`));
  const packs: RegistryPack[] = 'packs' in result ? result.packs : [result];
  if (packs.length === 0) throw new Error(`No knowledge packs found for '${query}'`);
  if (packs.length === 1) return packs[0];
  const { selected } = await inquirer.prompt<{ selected: string }>({
    type: 'list',
    name: 'selected',
    message: 'Select a knowledge pack:',
    choices: packs.map((pack) => ({ name: `${pack.id} v${pack.version}`, value: pack.id })),
  });
  return packs.find((pack) => pack.id === selected)!;
}

async function configureKnowledge(): Promise<KnowledgeConfig> {
  const { mode } = await inquirer.prompt<{ mode: 'hub' | 'local' | 'remote' | 'none' }>({
    type: 'list',
    name: 'mode',
    message: 'Knowledge source?',
    choices: [
      { name: 'Knowledge Hub', value: 'hub' },
      { name: 'Installed local pack', value: 'local' },
      { name: 'Hosted provider URL', value: 'remote' },
      { name: 'Do not use knowledge', value: 'none' },
    ],
  });

  if (mode === 'none') return { provider: 'none' };

  if (mode === 'local') {
    const { packPath } = await inquirer.prompt<{ packPath: string }>({
      type: 'input',
      name: 'packPath',
      message: 'Path to the installed E knowledge pack:',
      default: './knowledge-pack',
    });
    const resolved = path.resolve(packPath);
    const loaded = await withTask('Validating local knowledge pack', () => loadPack(resolved));
    printSuccess(`Knowledge ready · ${loaded.manifest.id} · revision ${loaded.revision.id}`);
    return { provider: 'e-knowledge', packPath: resolved };
  }

  if (mode === 'remote') {
    const { baseUrl } = await inquirer.prompt<{ baseUrl: string }>({
      type: 'input',
      name: 'baseUrl',
      message: 'Remote knowledge provider URL:',
    });
    const provider = createRemoteProvider({ baseUrl, timeoutMs: 5000 });
    const manifest = await withTask('Checking provider manifest', async () => provider.manifest());
    printSuccess(`Provider ready · ${manifest.id}`);
    return { provider: 'e-remote', baseUrl: baseUrl.replace(/\/+$/, ''), timeoutMs: 5000 };
  }

  const { registryUrl: enteredRegistryUrl } = await inquirer.prompt<{ registryUrl: string }>({
    type: 'input',
    name: 'registryUrl',
    message: 'Knowledge Hub registry URL:',
    default: process.env.SIDURI_KNOWLEDGE_REGISTRY_URL || DEFAULT_REGISTRY_URL,
    validate: urlValue,
  });
  const registryUrl = enteredRegistryUrl.replace(/\/+$/, '');
  const pack = await chooseHubPack(registryUrl);
  if (pack.distribution.kind === 'archive') {
    const { install } = await inquirer.prompt<{ install: boolean }>({
      type: 'confirm',
      name: 'install',
      message: `Install ${pack.id} v${pack.version} locally?`,
      default: true,
    });
    if (install) {
      const packPath = await withTask(`Installing ${pack.id}@${pack.version}`, () => installArchive(pack));
      const loaded = await withTask('Validating installed knowledge pack', () => loadPack(packPath));
      printSuccess(`Knowledge ready · ${loaded.manifest.id} · revision ${loaded.revision.id}`);
      return { provider: 'e-knowledge', packPath };
    }
  }
  if (pack.distribution.kind !== 'provider') {
    throw new Error('Archive installation was declined and no hosted provider is available');
  }
  const provider = createRemoteProvider({ baseUrl: pack.distribution.url, timeoutMs: 5000 });
  await withTask('Checking provider manifest', async () => provider.manifest());
  printSuccess(`Provider ready · ${pack.id}`);
  return { provider: 'e-hub', registryUrl, packId: pack.id, timeoutMs: 5000 };
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === '--version' || command === '-v') {
    console.log(CLI_VERSION);
    return;
  }
  if (command === 'start') {
    await startRuntime();
    return;
  }
  if (command !== 'create') {
    printHeader();
    console.log('Usage: npx @vxnus/siduri create');
    console.log('       npx @vxnus/siduri start');
    console.log('       npx @vxnus/siduri --version');
    return;
  }

  printHeader();
  printSection('Companion');
  const answers = await inquirer.prompt([
    { type: 'input', name: 'name', message: 'Companion name:', default: 'Siduri', validate: nonEmpty },
    {
      type: 'list',
      name: 'memoryEngine',
      message: 'Memory database?',
      choices: [
        { name: 'PostgreSQL', value: 'postgres' },
        { name: 'SQLite (future)', value: 'sqlite', disabled: 'Coming soon' },
      ],
    },
  ]);
  const { memoryDeployment } = await inquirer.prompt<{ memoryDeployment: 'local' | 'neon' | 'supabase' | 'other' }>({
    type: 'list',
    name: 'memoryDeployment',
    message: 'PostgreSQL deployment?',
    choices: [
      { name: 'Local PostgreSQL', value: 'local' },
      { name: 'Neon', value: 'neon' },
      { name: 'Supabase', value: 'supabase' },
      { name: 'Other PostgreSQL provider', value: 'other' },
    ],
  });
  const projectPath = path.resolve(process.cwd(), projectDirectoryName(answers.name));
  await mkdir(projectPath, { recursive: true });
  printSuccess(`${answers.name} · PostgreSQL / ${memoryDeployment} · ${projectPath}`);

  printSection('Brain · required');
  const { brainProvider } = await inquirer.prompt<{ brainProvider: 'openrouter' | 'openai-compatible' }>({
    type: 'list',
    name: 'brainProvider',
    message: 'Brain provider?',
    choices: [
      { name: 'OpenRouter (managed model routing)', value: 'openrouter' },
      { name: 'OpenAI-compatible API (custom endpoint)', value: 'openai-compatible' },
    ],
  });
  const brain = brainProvider === 'openrouter'
    ? {
        provider: 'openrouter',
        model: (await inquirer.prompt<{ model: string }>({ type: 'input', name: 'model', message: 'Model ID:', default: 'openai/gpt-4o-mini', validate: nonEmpty })).model,
        apiKeyEnv: 'OPENROUTER_API_KEY',
      }
    : await (async () => {
        const values = await inquirer.prompt<{ baseUrl: string; model: string; apiKeyEnv: string }>([
          { type: 'input', name: 'baseUrl', message: 'OpenAI-compatible API base URL:', default: 'http://127.0.0.1:1234/v1', validate: urlValue },
          { type: 'input', name: 'model', message: 'Model ID:', default: 'local-model', validate: nonEmpty },
          { type: 'input', name: 'apiKeyEnv', message: 'API key environment variable:', default: 'OPENAI_COMPATIBLE_API_KEY', validate: nonEmpty },
        ]);
        return { provider: 'openai-compatible', ...values };
      })();
  printSuccess(`${brain.provider} · ${brain.model}`);

  printSection('Optional organs');
  const { voice } = await inquirer.prompt<{ voice: 'voicevox' | 'none' }>({
    type: 'list',
    name: 'voice',
    message: 'Voice provider?',
    choices: [
      { name: 'VOICEVOX', value: 'voicevox' },
      { name: 'Do not use voice', value: 'none' },
    ],
  });
  const knowledge = await configureKnowledge();
  const remaining = await inquirer.prompt([
    { type: 'list', name: 'behavior', message: 'Behavior preset?', choices: [{ name: 'Calm', value: 'Calm' }, { name: 'Cheerful, Encouraging', value: 'Cheerful, Encouraging' }, { name: 'Do not use custom behavior', value: 'none' }] },
    { type: 'list', name: 'body', message: 'Body provider?', choices: [{ name: 'VTube Studio / Live2D', value: 'live2d' }, { name: 'Do not use body', value: 'none' }] },
    { type: 'list', name: 'vision', message: 'Vision provider?', choices: [{ name: 'OpenRouter vision', value: 'openrouter' }, { name: 'Do not use vision', value: 'none' }] },
  ]);

  const config = {
    id: 'default',
    name: answers.name,
    brain,
    voice: { provider: voice, speakerId: 1 },
    memory: { provider: answers.memoryEngine, deployment: memoryDeployment },
    knowledge,
    behavior: { provider: remaining.behavior === 'none' ? 'none' : 'active_self', preset: remaining.behavior },
    body: { provider: remaining.body, vtsUrl: process.env.VTS_URL || 'ws://127.0.0.1:8001' },
    vision: { provider: remaining.vision, model: 'gpt-4-vision' },
  };
  const configPath = path.join(projectPath, 'siduri.config.json');
  try {
    await readFile(configPath, 'utf8');
    const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>({
      type: 'confirm',
      name: 'overwrite',
      message: `${path.basename(configPath)} already exists. Replace it?`,
      default: false,
    });
    if (!overwrite) {
      console.log('Configuration left unchanged.');
      return;
    }
  } catch {
    // New configuration.
  }

  printSection('Review');
  console.log(`  ${colors.dim}companion${colors.reset}  ${config.name}`);
  console.log(`  ${colors.dim}brain${colors.reset}      ${config.brain.provider} · ${config.brain.model}`);
  console.log(`  ${colors.dim}memory${colors.reset}     ${config.memory.provider}`);
  console.log(`  ${colors.dim}voice${colors.reset}      ${config.voice.provider}`);
  console.log(`  ${colors.dim}knowledge${colors.reset}  ${config.knowledge.provider}`);
  console.log(`  ${colors.dim}behavior${colors.reset}   ${config.behavior.provider}`);
  console.log(`  ${colors.dim}body${colors.reset}       ${config.body.provider}`);
  console.log(`  ${colors.dim}vision${colors.reset}     ${config.vision.provider}`);
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>({
    type: 'confirm',
    name: 'confirm',
    message: 'Write this Siduri configuration?',
    default: true,
  });
  if (!confirm) {
    console.log('Configuration cancelled.');
    return;
  }
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  printSuccess(`Configuration written · ${configPath}`);
  await cp(path.join(__dirname, 'runtime.js'), path.join(projectPath, 'siduri-runtime.js'));
  await writeFile(path.join(projectPath, 'package.json'), JSON.stringify({
    name: projectDirectoryName(answers.name),
    private: true,
    version: '0.0.0',
    scripts: { start: 'node siduri-runtime.js', dev: 'node siduri-runtime.js' },
    dependencies: RUNTIME_DEPENDENCIES,
  }, null, 2) + '\n', { mode: 0o600 });
  const keyEnv = config.brain.apiKeyEnv || 'OPENROUTER_API_KEY';
  await writeFile(path.join(projectPath, '.env.example'), [
    `${keyEnv}=`,
    'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siduri',
    'VTS_URL=ws://127.0.0.1:8001',
    'VTS_AUTH_TOKEN=',
    '',
  ].join('\n'), { mode: 0o600 });
  await withTask('Installing Siduri runtime dependencies', () => execFile('npm', ['install', '--no-audit', '--no-fund'], { cwd: projectPath }).then(() => undefined));
  printSuccess(`Siduri instance ready · ${projectPath}`);
  console.log(`${colors.dim}Next: cd ${projectDirectoryName(answers.name)} && npm run start${colors.reset}\n`);
}

main().catch((error: unknown) => {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'ExitPromptError') {
    console.log('\nConfiguration cancelled.');
    return;
  }
  console.error(`\n${colors.yellow}!${colors.reset} ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
