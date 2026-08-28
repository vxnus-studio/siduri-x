import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureBehavior(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { preset } = await inquirer.prompt<{ preset: string }>({
    type: 'list',
    name: 'preset',
    message: 'Personality projection preset:',
    choices: [
      { name: 'Calm & Precise (Default)', value: 'calm_precise' },
      { name: 'Cheerful & Enthusiastic', value: 'cheerful' },
      { name: 'Analytical & Methodical', value: 'analytical' },
      { name: 'Custom Directive State Machine', value: 'custom' },
    ],
  });

  const presetLabels: Record<string, string> = {
    calm_precise: 'Calm & Precise',
    cheerful: 'Cheerful & Enthusiastic',
    analytical: 'Analytical & Methodical',
    custom: 'Custom Directives',
  };

  return {
    config: {
      provider: 'active_self',
      preset,
    },
    summary: {
      Provider: 'Active Self Directives',
      Preset: presetLabels[preset] || preset,
    },
  };
}
