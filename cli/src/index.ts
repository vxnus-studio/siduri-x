#!/usr/bin/env node
import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import inquirer from 'inquirer';
import { OrganRegistry } from './discovery';
import { generateInstanceFiles } from './generator';
import { OrganManifest } from './manifest';
import { runDoctor, DoctorCheckResult } from './doctor';
import { runDbPush } from './db';
import { configureOrgan, OrganConfigurationResult } from './configurators';

const execFile = promisify(execFileCallback);
export const CLI_VERSION = '1.0.1';

import { colors } from './colors';
export { colors };

export function printHeader(): void {
  console.log(`\n${colors.cyan}◈ SIDURI${colors.reset} ${colors.dim}companion setup (manifest-driven)${colors.reset}`);
  console.log(`${colors.yellow}Version ${CLI_VERSION}${colors.reset} · composable standalone architecture\n`);
}

export function printSection(title: string): void {
  console.log(`\n${colors.cyan}── ${title} ${'─'.repeat(Math.max(2, 42 - title.length))}${colors.reset}\n`);
}

export function printSuccess(message: string): void {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

export function projectDirectoryName(value: string): string {
  return (value || '').trim() || 'Companion';
}

export function validateProjectDirectory(value: string): true | string {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return 'Please enter a project directory.';
  }
  if (/^\d+$/.test(trimmed) || !isNaN(Number(trimmed))) {
    return 'Project directory cannot be a number.';
  }
  const resolved = path.resolve(process.cwd(), trimmed);
  if (fs.existsSync(resolved)) {
    return `Directory "${trimmed}" already exists in the current directory.`;
  }
  return true;
}

export function formatReviewSummary(
  projectDirName: string,
  selectedManifests: OrganManifest[],
  organSummaries: Record<string, Record<string, unknown>>
): string {
  const lines: string[] = [];

  lines.push(`\n${colors.cyan}── Review ${projectDirName} ${'─'.repeat(Math.max(2, 42 - (projectDirName.length + 9)))}${colors.reset}\n`);
  lines.push(`  ${colors.bold}Project${colors.reset}`);
  lines.push(`    ${colors.dim}Directory:${colors.reset} ${projectDirName}\n`);

  for (const m of selectedManifests) {
    const isRequired = m.organType === 'brain';
    const tag = isRequired ? ` ${colors.dim}· required${colors.reset}` : '';
    lines.push(`  ${colors.bold}${m.displayName.split(' ')[0] || m.organType}${colors.reset}${tag}`);

    const summary = organSummaries[m.configKey] || organSummaries[m.organType] || {};
    const entries = Object.entries(summary);

    if (entries.length === 0) {
      lines.push(`    ${colors.dim}Provider:${colors.reset} ${m.displayName}`);
    } else {
      for (const [key, val] of entries) {
        const valStr = String(val);
        lines.push(`    ${colors.dim}${key}:${colors.reset}${' '.repeat(Math.max(1, 10 - key.length))}${valStr}`);
      }
    }
    lines.push('');
  }

  lines.push(`${colors.cyan}${'─'.repeat(46)}${colors.reset}\n`);
  return lines.join('\n');
}

export async function withTask<T>(label: string, task: () => Promise<T>): Promise<T> {
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

export async function runCreateWizard(targetDir?: string, options?: { localPath?: string }): Promise<void> {
  printHeader();

  // 1. Discover manifests from installed or monorepo packages
  const registry = OrganRegistry.discover();
  const availableManifests = registry.getAll();

  if (availableManifests.length === 0) {
    throw new Error('No @sidurijs/* organ packages found. Please ensure organs are installed or in workspace.');
  }

  printSection('Project Details');

  let projectDirName: string;
  if (targetDir) {
    const check = validateProjectDirectory(targetDir);
    if (check !== true) {
      console.warn(`${colors.yellow}!${colors.reset} Provided directory "${targetDir}" is invalid: ${check}\n`);
      const dirAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'directory',
          message: 'Project directory:',
          default: 'Companion',
          validate: validateProjectDirectory,
        },
      ]);
      projectDirName = dirAnswers.directory.trim();
    } else {
      projectDirName = targetDir.trim();
    }
  } else {
    const dirAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'directory',
        message: 'Project directory:',
        default: 'Companion',
        validate: validateProjectDirectory,
      },
    ]);
    projectDirName = dirAnswers.directory.trim();
  }

  const projectDir = path.resolve(process.cwd(), projectDirName);

  printSection('Organ Configuration');
  console.log(`${colors.dim}Configuring capability organs for ${projectDirName} sequentially from cognition to physical embodiment.${colors.reset}\n`);

  // Canonical organ presentation order: Cognition -> Archive/State -> Knowledge -> Self/Identity -> Embodiment & Peripheral
  const canonicalOrder = ['brain', 'archive', 'memory', 'knowledge', 'self', 'behavior', 'voice', 'body', 'mouth', 'hands', 'vision', 'ear', 'observation'];
  const orderedManifests = [...availableManifests].sort((a, b) => {
    const idxA = canonicalOrder.indexOf(a.organType);
    const idxB = canonicalOrder.indexOf(b.organType);
    const valA = idxA === -1 ? 99 : idxA;
    const valB = idxB === -1 ? 99 : idxB;
    return valA - valB;
  });

  const selectedManifests: OrganManifest[] = [];
  const organConfigs: Record<string, any> = {};
  const organSummaries: Record<string, Record<string, unknown>> = {};

  for (const m of orderedManifests) {
    const isRequired = m.organType === 'brain';
    const sectionTitle = isRequired ? `${m.displayName.split(' ')[0] || m.organType} · required` : m.displayName.split(' ')[0] || m.organType;
    printSection(sectionTitle);

    const res: OrganConfigurationResult = await configureOrgan(m, {
      companionName: projectDirName,
      existingConfig: organConfigs[m.configKey],
    });

    if (res.config?.provider === 'none') {
      continue;
    }

    selectedManifests.push(m);
    organConfigs[m.configKey] = res.config;
    organSummaries[m.configKey] = res.summary || {};
  }

  // 2. Final Review and Edit Loop
  while (true) {
    console.log(formatReviewSummary(projectDirName, selectedManifests, organSummaries));

    const { reviewAction } = await inquirer.prompt<{ reviewAction: string }>({
      type: 'list',
      name: 'reviewAction',
      message: `Create ${projectDirName} with this configuration?`,
      choices: [
        { name: 'Yes, create', value: 'create' },
        { name: 'Go back and edit', value: 'edit' },
        { name: 'Cancel', value: 'cancel' },
      ],
    });

    if (reviewAction === 'cancel') {
      console.log('Instance creation cancelled.');
      return;
    }

    if (reviewAction === 'create') {
      break;
    }

    if (reviewAction === 'edit') {
      const editChoices = orderedManifests.map((m) => {
        const isSelected = selectedManifests.some((sm) => sm.organType === m.organType);
        return {
          name: `${m.displayName} (${isSelected ? 'Enabled' : 'Disabled / Skipped'})`,
          value: m.configKey,
        };
      });
      editChoices.push({ name: 'Edit all organs in sequence', value: '__ALL__' });
      editChoices.push({ name: 'Back to review', value: '__BACK__' });

      const { organToEdit } = await inquirer.prompt<{ organToEdit: string }>({
        type: 'list',
        name: 'organToEdit',
        message: 'Which organ would you like to edit?',
        choices: editChoices,
      });

      if (organToEdit === '__BACK__') {
        continue;
      }

      const organsToReconfigure = organToEdit === '__ALL__'
        ? orderedManifests
        : orderedManifests.filter((m) => m.configKey === organToEdit);

      for (const m of organsToReconfigure) {
        const isRequired = m.organType === 'brain';
        const sectionTitle = isRequired ? `${m.displayName.split(' ')[0] || m.organType} · required` : m.displayName.split(' ')[0] || m.organType;
        printSection(sectionTitle);

        const res = await configureOrgan(m, {
          companionName: projectDirName,
          existingConfig: organConfigs[m.configKey],
        });

        if (res.config?.provider === 'none') {
          const idx = selectedManifests.findIndex((sm) => sm.organType === m.organType);
          if (idx !== -1) selectedManifests.splice(idx, 1);
          delete organConfigs[m.configKey];
          delete organSummaries[m.configKey];
        } else {
          if (!selectedManifests.some((sm) => sm.organType === m.organType)) {
            selectedManifests.push(m);
            selectedManifests.sort((a, b) => {
              const idxA = canonicalOrder.indexOf(a.organType);
              const idxB = canonicalOrder.indexOf(b.organType);
              return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
            });
          }
          organConfigs[m.configKey] = res.config;
          organSummaries[m.configKey] = res.summary || {};
        }
      }
    }
  }

  // 4. Generate Instance Files
  const files = generateInstanceFiles({
    name: projectDirName,
    selectedManifests,
    organConfigs,
    localPath: options?.localPath,
  });

  await mkdir(projectDir, { recursive: true });
  await mkdir(path.join(projectDir, 'src'), { recursive: true });
  const publicDir = path.join(projectDir, 'public');
  await mkdir(publicDir, { recursive: true });

  await writeFile(path.join(projectDir, 'package.json'), files['package.json'], 'utf8');
  await writeFile(path.join(projectDir, 'siduri.config.json'), files['siduri.config.json'], 'utf8');
  await writeFile(path.join(projectDir, 'siduri.schema.json'), files['siduri.schema.json'], 'utf8');
  await writeFile(path.join(projectDir, '.env.example'), files['.env.example'], 'utf8');
  await writeFile(path.join(projectDir, 'README.md'), files['README.md'], 'utf8');
  await writeFile(path.join(projectDir, 'src/index.js'), files['src/index.js'], 'utf8');

  // Copy full Next.js apps/web production build if present
  const webDistCandidates = [
    path.resolve(__dirname, 'web-dist'),
    path.resolve(__dirname, '../dist/web-dist'),
    path.resolve(__dirname, '../../apps/web/out'),
    path.resolve(process.cwd(), 'apps/web/out'),
  ];
  const foundWebDist = webDistCandidates.find((p) => fs.existsSync(p));

  if (foundWebDist) {
    fs.cpSync(foundWebDist, publicDir, { recursive: true });
  } else {
    await writeFile(path.join(publicDir, 'index.html'), files['public/index.html'], 'utf8');
  }

  if (files.createAssetsDirs && files.createAssetsDirs.length > 0) {
    for (const dir of files.createAssetsDirs) {
      await mkdir(path.join(projectDir, dir), { recursive: true });
    }
  } else if (files.createAssetsBodyDir) {
    await mkdir(path.join(projectDir, 'assets/body'), { recursive: true });
  }

  // Write all additional generated files (such as assets/self/default.self or other assets)
  const handledKeys = new Set([
    'package.json',
    'siduri.config.json',
    'siduri.schema.json',
    '.env.example',
    'README.md',
    'src/index.js',
    'public/index.html',
    'createAssetsDirs',
    'createAssetsBodyDir',
  ]);

  for (const [relPath, content] of Object.entries(files)) {
    if (handledKeys.has(relPath) || typeof content !== 'string') continue;
    const destPath = path.join(projectDir, relPath);
    await mkdir(path.dirname(destPath), { recursive: true });
    await writeFile(destPath, content, 'utf8');
  }

  // If local knowledge archive is configured with a download URL, automatically fetch and unpack it
  const knowledgeConfig = organConfigs.knowledge || organConfigs['@sidurijs/knowledge'];
  if (knowledgeConfig?.pack?.mode === 'local' && knowledgeConfig?.pack?.archiveUrl) {
    const packRelDir = (knowledgeConfig.packPath || 'assets/knowledge/pack').replace(/^\.\//, '');
    const packDest = path.join(projectDir, packRelDir);
    try {
      await withTask(`Downloading knowledge archive (${knowledgeConfig.pack.packId || 'pack'})`, async () => {
        const res = await fetch(knowledgeConfig.pack.archiveUrl);
        if (res.ok) {
          const tarPath = path.join(packDest, 'pack.tar.gz');
          const buffer = Buffer.from(await res.arrayBuffer());
          await writeFile(tarPath, buffer);
          await execFile('tar', ['-xzf', tarPath, '-C', packDest]);
          await fs.promises.unlink(tarPath).catch(() => {});
        }
      });
    } catch (err: any) {
      console.warn(`${colors.yellow}!${colors.reset} Notice: Could not download or unpack knowledge archive: ${err.message}`);
    }
  }

  printSuccess(`Generated standalone files at ${projectDir}`);

  // 5. Install dependencies from registry
  try {
    await withTask('Installing dependencies (npm install)', async () => {
      await execFile('npm', ['install', '--no-audit', '--no-fund'], { cwd: projectDir });
    });
    printSuccess('Dependencies installed successfully.');
  } catch (err: any) {
    console.warn(`\n${colors.yellow}! Notice: npm install failed:${colors.reset} ${err.stderr || err.message}`);
    console.warn(`${colors.dim}Run "npm install" manually inside ${projectDir} to complete installation.${colors.reset}\n`);
  }

  printSection('Instance Ready');
  console.log(`Your Siduri companion is ready! Next steps:\n`);
  console.log(`  cd ${path.relative(process.cwd(), projectDir) || '.'}`);
  console.log(`  cp .env.example .env          ${colors.dim}# Fill in required API keys/credentials${colors.reset}`);
  console.log(`  npm run doctor                ${colors.dim}# Run diagnostic health probes${colors.reset}`);
  console.log(`  npm start                     ${colors.dim}# Start Web Companion & Memory Console at http://localhost:3000${colors.reset}\n`);

  const voiceConfig = organConfigs.voice || organConfigs['@sidurijs/voice'];
  if (voiceConfig?.provider === 'voicevox') {
    console.log(`  ${colors.cyan}ℹ Voice Runtime:${colors.reset} ${colors.dim}VOICEVOX engine (~1.5GB) will auto-download to ~/.voicevox/engine/ and launch on port 50021 on first 'npm start' (if not already running).${colors.reset}\n`);
  } else if (voiceConfig?.rvc?.enabled) {
    console.log(`  ${colors.cyan}ℹ Voice Model:${colors.reset} ${colors.dim}Place your RVC weights (.pth) in ${voiceConfig.rvc.modelPath} before starting voice synthesis.${colors.reset}\n`);
  }
}

export async function runCliDoctor(targetDir?: string): Promise<void> {
  printHeader();
  const dir = targetDir ? path.resolve(process.cwd(), targetDir) : process.cwd();
  console.log(`${colors.cyan}Siduri Doctor${colors.reset}`);
  console.log(`${colors.dim}─────────────${colors.reset}\n`);

  try {
    const report = await runDoctor({ projectDir: dir });
    console.log(`${colors.dim}Instance:${colors.reset} ${report.instanceName}`);
    console.log(`${colors.dim}Organs:${colors.reset}   ${report.configuredOrgans.join(', ')}\n`);

    const categories = ['Environment', 'Services', 'Database', 'Health Probe'] as const;
    for (const cat of categories) {
      const items = report.results.filter((r: DoctorCheckResult) => r.category === cat);
      if (items.length > 0) {
        console.log(`${colors.cyan}${cat}${colors.reset}`);
        for (const item of items) {
          if (item.status === 'PASS') {
            console.log(`  ${colors.green}✓${colors.reset} ${item.name} ${colors.dim}(${item.message || 'OK'})${colors.reset}`);
          } else if (item.status === 'OPTIONAL_MISSING') {
            console.log(`  ${colors.dim}○${colors.reset} ${item.name} ${colors.dim}(Optional, not set)${colors.reset}`);
          } else if (item.status === 'SKIPPED') {
            console.log(`  ${colors.dim}— ${item.name} (${item.message})${colors.reset}`);
          } else {
            console.log(`  ${colors.yellow}✗${colors.reset} ${item.name}`);
            if (item.organName) {
              console.log(`    ${colors.dim}Required by:${colors.reset} ${item.organName}`);
            }
            if (item.message) {
              console.log(`    ${colors.yellow}${item.message}${colors.reset}`);
            }
            if (item.remediation) {
              console.log(`    ${colors.dim}Remediation:${colors.reset} ${item.remediation}`);
            }
          }
        }
        console.log();
      }
    }

    if (report.passed) {
      console.log(`${colors.green}Result: PASS${colors.reset}\n`);
      process.exitCode = 0;
    } else {
      console.log(`${colors.yellow}Result: FAIL${colors.reset}\n`);
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error(`\n${colors.yellow}Doctor Error:${colors.reset} ${err.message}\n`);
    process.exitCode = 2;
  }
}

export async function runCliReset(targetDir?: string): Promise<void> {
  printHeader();
  const dir = targetDir ? path.resolve(process.cwd(), targetDir) : process.cwd();
  console.log(`${colors.cyan}Siduri State Reset${colors.reset}`);
  console.log(`${colors.dim}──────────────────${colors.reset}\n`);

  try {
    let dbPath = 'siduri.sqlite';
    let companionId = 'default';
    const configPath = path.join(dir, 'siduri.config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.id) companionId = config.id;
        if (config.organs?.archive?.dbPath) dbPath = config.organs.archive.dbPath;
        else if (config.organs?.memory?.dbPath) dbPath = config.organs.memory.dbPath;
      } catch {}
    }

    const fullDbPath = path.resolve(dir, dbPath);
    if (!fs.existsSync(fullDbPath)) {
      console.log(`${colors.dim}No database file found at ${fullDbPath}. Already at clean slate.${colors.reset}\n`);
      process.exitCode = 0;
      return;
    }

    const tables = [
      'archive_events',
      'memory_claims',
      'memory_events',
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

    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(fullDbPath);
    try {
      for (const table of tables) {
        try {
          db.prepare(`DELETE FROM ${table} WHERE companion_id = ?`).run(companionId);
        } catch {
          try { db.prepare(`DELETE FROM ${table}`).run(); } catch {}
        }
        if (companionId !== 'default') {
          try {
            db.prepare(`DELETE FROM ${table} WHERE companion_id = "default"`).run();
          } catch {}
        }
      }
      try { db.exec('VACUUM'); } catch {}
    } finally {
      db.close();
    }

    printSuccess(`Companion state reset to blank slate:`);
    console.log(`  ${colors.dim}• Interaction archive events cleared${colors.reset}`);
    console.log(`  ${colors.dim}• Self directives, identity, and relationships cleared${colors.reset}`);
    console.log(`  ${colors.dim}• Life DB (entities, tasks, schedule, events) cleared${colors.reset}`);
    console.log(`  ${colors.dim}• System logs cleared${colors.reset}`);
    console.log(`\nInstance is now in a clean blank slate state for testing.\n`);
    process.exitCode = 0;
  } catch (err: any) {
    console.error(`\n${colors.yellow}Reset Error:${colors.reset} ${err.message}\n`);
    process.exitCode = 1;
  }
}

export async function runCliDb(subcommand?: string, targetDir?: string): Promise<void> {
  printHeader();
  if (subcommand === 'reset') {
    await runCliReset(targetDir);
    return;
  }

  if (subcommand !== 'push') {
    console.log('Usage: siduri db push | siduri db reset');
    process.exitCode = 2;
    return;
  }

  const dir = targetDir ? path.resolve(process.cwd(), targetDir) : process.cwd();
  console.log(`${colors.cyan}Siduri Database Migrations${colors.reset}`);
  console.log(`${colors.dim}──────────────────────────${colors.reset}\n`);

  try {
    const res = await runDbPush({ projectDir: dir });
    if (res.status === 'NOOP') {
      console.log(`${colors.dim}— ${res.message}${colors.reset}\n`);
    } else {
      printSuccess(res.message);
      if (res.appliedMigrations.length > 0) {
        console.log(`${colors.dim}Applied:${colors.reset} ${res.appliedMigrations.join(', ')}`);
      }
      console.log();
    }
    process.exitCode = 0;
  } catch (err: any) {
    console.error(`\n${colors.yellow}Database Migration Error:${colors.reset} ${err.message}\n`);
    process.exitCode = 3;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === '--version' || command === '-v') {
    console.log(CLI_VERSION);
    return;
  }

  if (command === 'create') {
    const isLocal = args.includes('--local') || args.includes('--dev') || process.env.SIDURI_LOCAL_DEV === 'true';
    const nonFlags = args.slice(1).filter((a) => !a.startsWith('--'));
    const targetDir = nonFlags[0];
    const localRepo = isLocal ? path.resolve(__dirname, '../..') : undefined;
    await runCreateWizard(targetDir, { localPath: localRepo });
    return;
  }

  if (command === 'reset') {
    const targetDir = args[1];
    await runCliReset(targetDir);
    return;
  }

  if (command === 'doctor') {
    const targetDir = args[1];
    await runCliDoctor(targetDir);
    return;
  }

  if (command === 'db') {
    const subcommand = args[1];
    const targetDir = args[2];
    await runCliDb(subcommand, targetDir);
    return;
  }

  printHeader();
  console.log('Usage: npx siduri create [directory] [--local]');
  console.log('       npx siduri reset [directory]');
  console.log('       npx siduri doctor [directory]');
  console.log('       npx siduri db push [directory]');
  console.log('       npx siduri db reset [directory]');
  console.log('       npx siduri --version\n');
}

if (require.main === module) {
  main().catch((error: unknown) => {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ExitPromptError') {
      console.log('\nOperation cancelled.');
      return;
    }
    console.error(`\n${colors.yellow}!${colors.reset} ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
