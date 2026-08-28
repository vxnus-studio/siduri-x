import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureObservation(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  return {
    config: {},
    summary: {
      Provider: 'Grounded Observation Ingest',
      Deduplication: 'Cryptographic SHA-256 Hashing',
    },
  };
}
