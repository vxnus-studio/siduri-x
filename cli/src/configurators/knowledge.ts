import inquirer from 'inquirer';
import fs from 'node:fs';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';
import {
  KnowledgeHubClient,
  displayKnowledgeProviderSummary,
  KnowledgeHubManifest,
} from '../providers/knowledge-hub';

export interface KnowledgeConfiguratorOptions {
  client?: KnowledgeHubClient;
}

export async function configureKnowledge(
  _context: OrganConfiguratorContext,
  options: KnowledgeConfiguratorOptions = {}
): Promise<OrganConfigurationResult> {
  const client = options.client || new KnowledgeHubClient();

  // 1. Ask Knowledge source / mode
  const { source } = await inquirer.prompt<{ source: string }>({
    type: 'list',
    name: 'source',
    message: 'Select knowledge configuration:',
    choices: [
      { name: 'E Knowledge Hub / Portable Pack (with Life Database)', value: 'e-hub' },
      { name: 'Life Database Only (SQLite personal state, schedule, preferences)', value: 'life-only' },
      { name: 'Do not use knowledge', value: 'none' },
    ],
  });

  if (source === 'none') {
    return {
      config: {
        provider: 'none',
        lifeDatabase: false,
      },
      summary: {
        Source: 'Do not use knowledge',
        Knowledge: 'Disabled',
      },
    };
  }

  const summary: Record<string, unknown> = {};
  const config: Record<string, any> = {
    dbPath: 'siduri.sqlite',
    lifeDatabase: true,
  };

  if (source === 'life-only') {
    config.provider = 'unified';
    summary.Source = 'Life Database';
    summary['Life Database'] = 'Enabled (siduri.sqlite)';
    summary['E-Pack'] = 'None';
    return { config, summary };
  }

  // 2. Discovery-First E-Knowledge Resolution Flow
  while (true) {
    const promptRes = await inquirer.prompt<{ packId?: string; query?: string }>({
      type: 'input',
      name: 'packId',
      message: 'Enter package ID (@publisher/name), local pack path, or remote URL:',
      default: '@vxnus/e-teyvat',
      validate: (val) => val.trim().length > 0 || 'Please enter a package ID, path, or URL.',
    });

    const target = (promptRes.packId || promptRes.query || '').trim();

    // Case A: Remote HTTP endpoint
    if (target.startsWith('http://') || target.startsWith('https://')) {
      console.log(`\n\x1b[36m── Knowledge Provider ────────────────────────\x1b[0m\n`);
      console.log(`  \x1b[2mType:\x1b[0m        Remote E-Provider`);
      console.log(`  \x1b[2mEndpoint:\x1b[0m    ${target}`);
      console.log(`  \x1b[2mConnectors:\x1b[0m  Remote only (HTTP stream)\n`);

      config.provider = 'e-remote';
      config.baseUrl = target;
      config.pack = {
        mode: 'remote',
        baseUrl: target,
      };
      summary.Source = 'Remote E-Provider';
      summary.Provider = target;
      summary['E-Pack'] = `Remote (${target})`;
      return { config, summary };
    }

    // Case B: Local path / file
    if (target.startsWith('./') || target.startsWith('/') || fs.existsSync(target)) {
      console.log(`\n\x1b[36m── Knowledge Provider ────────────────────────\x1b[0m\n`);
      console.log(`  \x1b[2mType:\x1b[0m        Local Knowledge Pack`);
      console.log(`  \x1b[2mPath:\x1b[0m        ${target}`);
      console.log(`  \x1b[2mConnectors:\x1b[0m  Local only (Filesystem)\n`);

      config.provider = 'e-knowledge';
      config.packPath = target;
      config.pack = {
        mode: 'local',
        packPath: target,
      };
      summary.Source = 'Local Knowledge Pack';
      summary.Provider = target;
      summary['E-Pack'] = `Local (${target})`;
      return { config, summary };
    }

    // Case C: E Knowledge Hub package ID (@publisher/name)
    let manifest: KnowledgeHubManifest;
    try {
      process.stdout.write('\x1b[2mResolving knowledge metadata...\x1b[0m');
      manifest = await client.resolveProvider(target);
      process.stdout.write('\r\x1b[32m✓\x1b[0m Knowledge metadata resolved\n');
    } catch (err: any) {
      process.stdout.write('\r\x1b[33m!\x1b[0m Knowledge resolution failed\n');
      console.log(`\x1b[33mReason:\x1b[0m ${err.message}\n`);

      const { failureAction } = await inquirer.prompt<{ failureAction: string }>({
        type: 'list',
        name: 'failureAction',
        message: 'What would you like to do?',
        choices: [
          { name: 'Try again / Enter another package ID or path', value: 'retry' },
          { name: 'Skip attaching E-pack (keep Life DB only)', value: 'skip' },
          { name: 'Cancel', value: 'cancel' },
        ],
      });

      if (failureAction === 'retry') continue;
      if (failureAction === 'skip') {
        config.provider = 'unified';
        summary.Source = 'Life Database';
        summary['E-Pack'] = 'None';
        return { config, summary };
      }
      throw new Error('Knowledge configuration cancelled.');
    }

    // Display metadata
    displayKnowledgeProviderSummary(manifest, target);

    // Inspect supported connectors
    const hasRemoteUrl = Boolean(manifest.distribution?.url);
    const connectorChoices = [];

    if (hasRemoteUrl) {
      connectorChoices.push({
        name: `Remote (Stream directly from ${manifest.distribution?.url} without local storage)`,
        value: 'remote',
      });
      connectorChoices.push({
        name: 'Local (Download and run offline pack files on this machine)',
        value: 'local',
      });
      connectorChoices.push({
        name: 'Hybrid (Local pack cache with remote provider fallback/sync)',
        value: 'hybrid',
      });
    } else {
      connectorChoices.push({
        name: 'Local (Offline pack files on this machine)',
        value: 'local',
      });
    }
    connectorChoices.push({
      name: 'Choose another provider',
      value: 'retry',
    });

    const choiceRes = await inquirer.prompt<{ connectorMode?: string; confirmProvider?: string }>({
      type: 'list',
      name: 'connectorMode',
      message: 'Choose connection type for this pack:',
      choices: connectorChoices,
    });

    const rawChoice = choiceRes.connectorMode ?? choiceRes.confirmProvider;
    if (rawChoice === 'retry') {
      continue;
    }

    const connectorMode = (rawChoice === 'yes'
      ? (hasRemoteUrl ? 'remote' : 'local')
      : (['remote', 'local', 'hybrid'].includes(rawChoice || '') ? rawChoice : 'local')) as 'remote' | 'local' | 'hybrid';

    config.provider = 'e-hub';
    config.registryUrl = 'https://e.vxnus.xyz/api/v1/knowledge';
    config.packId = target;
    config.pack = {
      mode: connectorMode,
      packId: target,
      registryUrl: 'https://e.vxnus.xyz/api/v1/knowledge',
      baseUrl: manifest.distribution?.url,
      preferredMode: 'lexical',
    };
    if (manifest.distribution?.url) {
      config.baseUrl = manifest.distribution.url;
    }

    summary.Source = 'E Knowledge Hub';
    summary.Provider = manifest.displayName || manifest.name;
    summary.Package = target;
    summary.Version = manifest.version;
    summary['Life Database'] = 'Enabled (siduri.sqlite)';
    summary['E-Pack'] = `${manifest.displayName || manifest.name} (${connectorMode})`;

    return {
      config,
      summary,
      metadata: { manifest },
    };
  }
}
