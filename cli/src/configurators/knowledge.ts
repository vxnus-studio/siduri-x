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

  const config: Record<string, any> = {
    provider: 'unified',
    dbPath: 'siduri.sqlite',
    lifeDatabase: true,
  };
  const summary: Record<string, unknown> = {
    'Life Database': 'Enabled (siduri.sqlite)',
  };

  // 1. Life Database is the sovereign default. Ask whether to attach an external knowledge pack
  const { useExternalPack } = await inquirer.prompt<{ useExternalPack: boolean }>({
    type: 'confirm',
    name: 'useExternalPack',
    message: 'Attach an external knowledge pack from E Knowledge Hub?',
    default: false,
  });

  if (!useExternalPack) {
    summary['E-Pack'] = 'None';
    return { config, summary };
  }

  // 2. Discover and resolve E Knowledge Hub package
  while (true) {
    const promptRes = await inquirer.prompt<{ packId?: string; query?: string }>({
      type: 'input',
      name: 'packId',
      message: 'Enter package ID (@publisher/name):',
      default: '@vxnus/e-teyvat',
      validate: (val) => val.trim().length > 0 || 'Please enter a package ID.',
    });

    const target = (promptRes.packId || promptRes.query || '').trim();

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
          { name: 'Try again / Enter another package ID', value: 'retry' },
          { name: 'Continue without external pack (Life DB only)', value: 'skip' },
          { name: 'Cancel', value: 'cancel' },
        ],
      });

      if (failureAction === 'retry') continue;
      if (failureAction === 'skip') {
        summary['E-Pack'] = 'None';
        return { config, summary };
      }
      throw new Error('Knowledge configuration cancelled.');
    }

    // Display provider summary
    displayKnowledgeProviderSummary(manifest, target);

    // Determine connection type: User selects strictly 1 mode (Remote OR Local)
    let connectionType: 'remote' | 'local';

    const isHybrid = manifest.distributionType === 'both';
    const isLocalOnly = manifest.distributionType === 'local' || manifest.distribution?.kind === 'archive';

    if (isHybrid) {
      const { selectedMode } = await inquirer.prompt<{ selectedMode: 'remote' | 'local' }>({
        type: 'list',
        name: 'selectedMode',
        message: 'This pack offers both remote and local options. Select connection type:',
        choices: [
          {
            name: `Remote (Stream directly from ${manifest.distribution?.url || 'provider'} without local storage)`,
            value: 'remote',
          },
          {
            name: 'Local (Download archive and run offline on this machine)',
            value: 'local',
          },
        ],
      });
      connectionType = selectedMode;
    } else if (isLocalOnly) {
      connectionType = 'local';
    } else {
      connectionType = 'remote';
    }

    if (connectionType === 'remote') {
      config.provider = 'e-hub';
      config.registryUrl = 'https://e.vxnus.xyz/api/v1/knowledge';
      config.packId = target;
      config.pack = {
        mode: 'remote',
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
      summary['E-Pack'] = `${manifest.displayName || manifest.name} (Remote)`;
    } else {
      // Local archive: stored in our defined path inside companion assets (user doesn't type path)
      const packSlug = target.replace(/^@/, '').replace(/[/_]/g, '-');
      const packDir = `./assets/knowledge/${packSlug}`;
      config.provider = 'e-knowledge';
      config.packPath = packDir;
      config.packId = target;
      config.pack = {
        mode: 'local',
        packId: target,
        packPath: packDir,
        archiveUrl: manifest.distribution?.url,
        checksum: (manifest.distribution as any)?.checksum,
        preferredMode: 'lexical',
      };
      summary.Source = 'E Knowledge Hub';
      summary.Provider = manifest.displayName || manifest.name;
      summary.Package = target;
      summary.Version = manifest.version;
      summary['E-Pack'] = `${manifest.displayName || manifest.name} (Local @ ${packDir})`;
    }

    return {
      config,
      summary,
      metadata: { manifest },
    };
  }
}
