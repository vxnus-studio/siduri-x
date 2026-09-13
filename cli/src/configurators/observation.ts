import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureObservation(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { provider } = await inquirer.prompt<{ provider: string }>({
    type: 'list',
    name: 'provider',
    message: 'Screen observation & continuous frame ingest:',
    choices: [
      {
        name: 'None (Disabled as default - Work in progress)',
        value: 'none',
      },
      {
        name: 'Experimental Frame Ingest (Prototype - requires active vision)',
        value: 'fixture',
      },
    ],
    default: 'none',
  });

  if (provider === 'none') {
    return {
      config: { provider: 'none' },
      summary: { Provider: 'Disabled (Work in progress)' },
    };
  }

  return {
    config: {},
    summary: {
      Provider: 'Experimental Frame Ingest (Work in progress)',
      Deduplication: 'Cryptographic SHA-256 Hashing',
    },
  };
}
