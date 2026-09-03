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

  const companionSlug = _context.companionName.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default';

  const { modelSource, initialExpression } = await inquirer.prompt<{
    modelSource: string;
    initialExpression: string;
  }>([
    {
      type: 'input',
      name: 'modelSource',
      message: 'Live2D Model path / URL (.model3.json):',
      default: `./assets/body/${companionSlug}/model.model3.json`,
    },
    {
      type: 'list',
      name: 'initialExpression',
      message: 'Initial avatar expression:',
      choices: [
        { name: 'Neutral', value: 'neutral' },
        { name: 'Happy / Cheerful', value: 'happy' },
        { name: 'Calm', value: 'calm' },
      ],
      default: 'neutral',
    },
  ]);

  const modelPath = modelSource.trim() || `./assets/body/${companionSlug}/model.model3.json`;
  const isHttpOrAbsolute = modelPath.startsWith('http://') || modelPath.startsWith('https://') || modelPath.startsWith('/');
  const webModelUrl = isHttpOrAbsolute ? modelPath : `/assets/body/${companionSlug}/model.model3.json`;

  return {
    config: {
      provider: 'live2d',
      modelPath,
      modelUrl: webModelUrl,
      initialExpression,
    },
    summary: {
      Provider: 'Live2D',
      'Model Path': modelPath,
      Expression: initialExpression,
    },
  };
}
