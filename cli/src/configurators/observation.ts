import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureObservation(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { provider } = await inquirer.prompt<{ provider: string }>({
    type: 'list',
    name: 'provider',
    message: 'Screen observation & frame capture?',
    choices: [
      { name: 'Frame Ingest (SHA-256 deduplicated visual grounding for vision)', value: 'fixture' },
      { name: 'None (Skip / Disable screen observation)', value: 'none' },
    ],
    default: 'none',
  });

  if (provider === 'none') {
    return {
      config: { provider: 'none' },
      summary: { Provider: 'None (Observation disabled)' },
    };
  }

  return {
    config: {},
    summary: {
      Provider: 'Grounded Observation Ingest',
      Deduplication: 'Cryptographic SHA-256 Hashing',
    },
  };
}
