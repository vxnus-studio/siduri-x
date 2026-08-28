import inquirer from 'inquirer';
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

  const { source } = await inquirer.prompt<{ source: string }>({
    type: 'list',
    name: 'source',
    message: 'Knowledge source?',
    choices: [
      { name: 'E Knowledge Hub (Search and attach remote factual pack)', value: 'e-hub' },
      { name: 'Do not use knowledge', value: 'none' },
    ],
  });

  if (source === 'none') {
    return {
      config: {
        provider: 'none',
      },
      summary: {
        Source: 'Do not use knowledge',
      },
    };
  }

  // E Knowledge Hub flow
  while (true) {
    const { packId } = await inquirer.prompt<{ packId: string }>({
      type: 'input',
      name: 'packId',
      message: 'Search E Knowledge Hub or enter package ID:',
      default: '@vxnus/e-teyvat',
      validate: (val) => val.trim().length > 0 || 'Please enter a package ID.',
    });

    const trimmedPackId = packId.trim();
    let manifest: KnowledgeHubManifest;

    try {
      process.stdout.write('\u001b[2mSearching E Knowledge Hub...\u001b[0m');
      manifest = await client.resolveProvider(trimmedPackId);
      process.stdout.write('\r\u001b[32m✓\u001b[0m Checking provider manifest\n');
    } catch (err: any) {
      process.stdout.write('\r\u001b[33m!\u001b[0m Provider resolution failed\n');
      console.log(`\u001b[33mReason:\u001b[0m ${err.message}\n`);

      const { failureAction } = await inquirer.prompt<{ failureAction: string }>({
        type: 'list',
        name: 'failureAction',
        message: 'What would you like to do?',
        choices: [
          { name: 'Try again / Search another provider', value: 'retry' },
          { name: 'Do not use knowledge', value: 'skip' },
          { name: 'Cancel', value: 'cancel' },
        ],
      });

      if (failureAction === 'retry') {
        continue;
      }
      if (failureAction === 'skip') {
        return {
          config: { provider: 'none' },
          summary: { Source: 'Do not use knowledge' },
        };
      }
      throw new Error('Knowledge configuration cancelled.');
    }

    // Display provider summary
    displayKnowledgeProviderSummary(manifest, trimmedPackId);

    const { confirmProvider } = await inquirer.prompt<{ confirmProvider: string }>({
      type: 'list',
      name: 'confirmProvider',
      message: 'Use this knowledge provider?',
      choices: [
        { name: 'Yes, use this provider', value: 'yes' },
        { name: 'Choose another provider', value: 'retry' },
      ],
    });

    if (confirmProvider === 'yes') {
      return {
        config: {
          provider: 'e-hub',
          registryUrl: 'https://e.vxnus.xyz/api/v1/knowledge',
          packId: trimmedPackId,
        },
        summary: {
          Source: 'E Knowledge Hub',
          Provider: manifest.displayName || manifest.name,
          Package: trimmedPackId,
          Version: manifest.version,
        },
        metadata: {
          manifest,
        },
      };
    }
  }
}
