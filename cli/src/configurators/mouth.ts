import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureMouth(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { provider } = await inquirer.prompt<{ provider: string }>({
    type: 'list',
    name: 'provider',
    message: 'Mouth output delivery channel?',
    choices: [
      { name: 'Web Streaming (Server-Sent Events, Live2D visemes & SSML)', value: 'web' },
      { name: 'None (Silent / Disable speech streaming output)', value: 'none' },
    ],
    default: 'web',
  });

  if (provider === 'none') {
    return {
      config: { provider: 'none' },
      summary: { Provider: 'None (Mouth disabled)' },
    };
  }

  return {
    config: {
      defaultMedium: 'web',
      maxTextLength: 8000,
    },
    summary: {
      'Delivery Medium': 'Web SSE Streaming',
      'Max Text Length': '8000 chars',
    },
  };
}
