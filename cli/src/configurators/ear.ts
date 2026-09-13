import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureEar(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { choice } = await inquirer.prompt<{ choice: string }>({
    type: 'list',
    name: 'choice',
    message: 'Ear (Sensory Input & Perception Ingress):',
    choices: [
      {
        name: 'Enabled (Recommended: Active sensory bounds & audio/text ingress validation)',
        value: 'enabled',
      },
      {
        name: 'None (Skip / Disable sensory ingress)',
        value: 'none',
      },
    ],
    default: 'enabled',
  });

  if (choice === 'none') {
    return {
      config: { provider: 'none' },
      summary: { Provider: 'None (Ear disabled)' },
    };
  }

  return {
    config: {
      defaultSource: 'text_chat',
      maxTextLength: 4000,
      maxAudioBytes: 10485760,
    },
    summary: {
      Status: 'Enabled (Active sensory guard & audio/text ingress)',
      'Max Text': '4,000 characters',
      'Max Audio': '10 MB',
    },
  };
}
