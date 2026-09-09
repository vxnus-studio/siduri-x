import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureMouth(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  return {
    config: {
      defaultMedium: 'web',
      maxTextLength: 8000,
    },
    summary: {
      'Default Medium': 'Web',
      'Max Text Length': '8000 chars',
    },
  };
}
