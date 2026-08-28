import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureBody(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { provider } = await inquirer.prompt<{ provider: string }>({
    type: 'list',
    name: 'provider',
    message: 'Body avatar provider?',
    choices: [
      { name: 'Live2D Cubism (Interactive avatar motion & expression state)', value: 'live2d' },
      { name: 'None (Headless / No visual body)', value: 'none' },
    ],
  });

  if (provider === 'none') {
    return {
      config: { provider: 'none' },
      summary: { Provider: 'None (Headless)' },
    };
  }

  const { initialExpression } = await inquirer.prompt<{ initialExpression: string }>({
    type: 'list',
    name: 'initialExpression',
    message: 'Initial avatar expression:',
    choices: [
      { name: 'Neutral', value: 'neutral' },
      { name: 'Happy / Cheerful', value: 'happy' },
      { name: 'Calm', value: 'calm' },
    ],
  });

  return {
    config: {
      provider: 'live2d',
      initialExpression,
    },
    summary: {
      Provider: 'Live2D',
      Expression: initialExpression,
    },
  };
}
