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
export const CLI_VERSION = '0.1.5';

export const colors = {
  cyan: '\u001b[36m',
  dim: '\u001b[2m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  bold: '\u001b[1m',
  reset: '\u001b[0m',
};

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
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'siduri';
}

export function formatReviewSummary(
  companionName: string,
  selectedManifests: OrganManifest[],
  organSummaries: Record<string, Record<string, unknown>>
): string {
  const lines: string[] = [];

  lines.push(`\n${colors.cyan}── Review ${companionName} ${'─'.repeat(Math.max(2, 42 - (companionName.length + 9)))}${colors.reset}\n`);
  lines.push(`  ${colors.bold}Companion${colors.reset}`);
  lines.push(`    ${colors.dim}Name:${colors.reset}     ${companionName}\n`);

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

export async function runCreateWizard(targetDir?: string): Promise<void> {
  printHeader();

  // 1. Discover manifests from installed or monorepo packages
  const registry = OrganRegistry.discover();
  const availableManifests = registry.getAll();

  if (availableManifests.length === 0) {
    throw new Error('No @siduri-x/* organ packages found. Please ensure organs are installed or in workspace.');
  }

  printSection('Companion Details');
  const basicAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Companion name:',
      default: 'Siduri',
      validate: nonEmpty,
    },
  ]);

  const companionName = basicAnswers.name;
  const projectDir = targetDir ? path.resolve(process.cwd(), targetDir) : path.resolve(process.cwd(), projectDirectoryName(companionName));

  printSection('Organ Selection');
  console.log(`${colors.dim}Select any combination of organs to compose into your standalone instance.${colors.reset}\n`);

  // Brain is required by architecture contract for cognition
  const brainManifest = registry.get('brain');
  const nonBrainManifests = availableManifests.filter((m) => m.organType !== 'brain');

  const organChoices = nonBrainManifests.map((m) => ({
    name: `${m.displayName} (${m.name})`,
    value: m.organType,
    checked: m.organType === 'memory', // default memory checked
  }));

  const { selectedOrganTypes } = await inquirer.prompt<{ selectedOrganTypes: string[] }>({
    type: 'checkbox',
    name: 'selectedOrganTypes',
    message: 'Select organs to install:',
    choices: organChoices,
  });

  const selectedManifests: OrganManifest[] = [];
  if (brainManifest) {
    selectedManifests.push(brainManifest);
  }
  for (const organType of selectedOrganTypes) {
    const m = registry.get(organType);
    if (m) selectedManifests.push(m);
  }

  // 2. Interactive Organ Configuration Stage
  const organConfigs: Record<string, any> = {};
  const organSummaries: Record<string, Record<string, unknown>> = {};

  for (const m of selectedManifests) {
    const isRequired = m.organType === 'brain';
    const sectionTitle = isRequired ? `${m.displayName.split(' ')[0] || m.organType} · required` : m.displayName.split(' ')[0] || m.organType;
    printSection(sectionTitle);

    const res: OrganConfigurationResult = await configureOrgan(m, {
      companionName,
      existingConfig: organConfigs[m.configKey],
    });

    organConfigs[m.configKey] = res.config;
    organSummaries[m.configKey] = res.summary || {};
  }

  // 3. Final Review and Edit Loop
  while (true) {
    console.log(formatReviewSummary(companionName, selectedManifests, organSummaries));

    const { reviewAction } = await inquirer.prompt<{ reviewAction: string }>({
      type: 'list',
      name: 'reviewAction',
      message: `Create ${companionName} with this configuration?`,
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
      const editChoices = selectedManifests.map((m) => ({
        name: `Edit ${m.displayName}`,
        value: m.configKey,
      }));
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
        ? selectedManifests
        : selectedManifests.filter((m) => m.configKey === organToEdit);

      for (const m of organsToReconfigure) {
        const isRequired = m.organType === 'brain';
        const sectionTitle = isRequired ? `${m.displayName.split(' ')[0] || m.organType} · required` : m.displayName.split(' ')[0] || m.organType;
        printSection(sectionTitle);

        const res = await configureOrgan(m, {
          companionName,
          existingConfig: organConfigs[m.configKey],
        });

        organConfigs[m.configKey] = res.config;
        organSummaries[m.configKey] = res.summary || {};
      }
    }
  }

  // 4. Generate Instance Files
  const files = generateInstanceFiles({
    name: companionName,
    selectedManifests,
    organConfigs,
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

  if (files['docker-compose.yml']) {
    await writeFile(path.join(projectDir, 'docker-compose.yml'), files['docker-compose.yml'], 'utf8');
  }

  if (files.createAssetsDirs && files.createAssetsDirs.length > 0) {
    for (const dir of files.createAssetsDirs) {
      await mkdir(path.join(projectDir, dir), { recursive: true });
    }
  } else if (files.createAssetsBodyDir) {
    await mkdir(path.join(projectDir, 'assets/body'), { recursive: true });
  }

  printSuccess(`Generated standalone files at ${projectDir}`);

  // 5. Install dependencies from registry
  try {
    await withTask('Installing dependencies (npm install)', async () => {
      await execFile('npm', ['install', '--no-audit', '--no-fund'], { cwd: projectDir });
    });
    printSuccess('Dependencies installed successfully.');
  } catch (err: any) {
    console.warn(`${colors.yellow}!${colors.reset} Notice: npm install had warnings or requires network: ${err.message}`);
  }

  printSection('Instance Ready');
  console.log(`Your Siduri companion is ready! Next steps:\n`);
  console.log(`  cd ${path.relative(process.cwd(), projectDir) || '.'}`);
  console.log(`  cp .env.example .env          ${colors.dim}# Fill in required API keys/credentials${colors.reset}`);
  if (files['docker-compose.yml']) {
    console.log(`  npm run services:up           ${colors.dim}# Start local Docker services (PostgreSQL / VOICEVOX)${colors.reset}`);
  }
  const hasMemory = selectedManifests.some((m) => m.organType === 'memory');
  if (hasMemory) {
    console.log(`  npx @vxnus/siduri db push     ${colors.dim}# Push PostgreSQL memory schema${colors.reset}`);
  }
  console.log(`  npm run doctor                ${colors.dim}# Run diagnostic health probes${colors.reset}`);
  console.log(`  npm start                     ${colors.dim}# Start Web Companion & Memory Console at http://localhost:3000${colors.reset}\n`);
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

export async function runCliDb(subcommand?: string, targetDir?: string): Promise<void> {
  printHeader();
  if (subcommand !== 'push') {
    console.log('Usage: siduri db push');
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
    const targetDir = args[1];
    await runCreateWizard(targetDir);
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
  console.log('Usage: npx @vxnus/siduri create [directory]');
  console.log('       npx @vxnus/siduri doctor [directory]');
  console.log('       npx @vxnus/siduri db push [directory]');
  console.log('       npx @vxnus/siduri --version\n');
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
