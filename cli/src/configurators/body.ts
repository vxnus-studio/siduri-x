import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';
import { colors } from '../colors';

export async function configureBody(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { provider } = await inquirer.prompt<{ provider: string }>({
    type: 'list',
    name: 'provider',
    message: 'Body avatar provider?',
    choices: [
      { name: 'Live2D Cubism (Interactive 2D avatar motion & expression state)', value: 'live2d' },
      { name: 'VRM 3D Humanoid (Interactive 3D avatar, VRoid / glTF)', value: 'vrm' },
      { name: 'None (Headless / No visual body)', value: 'none' },
    ],
  });

  if (provider === 'none') {
    return {
      config: { provider: 'none' },
      summary: { Provider: 'None (Headless)' },
    };
  }

  if (provider === 'vrm') {
    const { modelSource, lookAtMode } = await inquirer.prompt<{
      modelSource: string;
      lookAtMode: string;
    }>([
      {
        type: 'input',
        name: 'modelSource',
        message: 'VRM Model path / URL (.vrm):',
        default: './assets/body/default/model.vrm',
      },
      {
        type: 'list',
        name: 'lookAtMode',
        message: 'VRM Camera LookAt target behavior:',
        choices: [
          { name: 'Camera (Look towards viewer)', value: 'camera' },
          { name: 'Cursor (Track mouse / touch cursor)', value: 'cursor' },
          { name: 'Head (Restricted head-only tracking)', value: 'head' },
          { name: 'None (Fixed gaze)', value: 'none' },
        ],
        default: 'camera',
      },
    ]);

    const modelPath = modelSource.trim() || './assets/body/default/model.vrm';
    const isHttpOrAbsolute = modelPath.startsWith('http://') || modelPath.startsWith('https://') || modelPath.startsWith('/');
    const webModelUrl = isHttpOrAbsolute
      ? modelPath
      : modelPath.startsWith('./')
        ? modelPath.slice(1)
        : `/${modelPath}`;

    return {
      config: {
        provider: 'vrm',
        format: 'vrm',
        modelPath,
        modelUrl: webModelUrl,
        initialExpression: 'neutral',
        vrm: {
          specVersion: 'auto',
          lookAtMode: lookAtMode as 'camera' | 'cursor' | 'head' | 'none',
        },
      },
      summary: {
        Provider: 'VRM (3D Avatar)',
        'Model Path': modelPath,
        'LookAt Mode': lookAtMode,
      },
    };
  }

  // provider === 'live2d'
  console.log(`\n  ${colors.yellow}⚠ Live2D Cubism Licensing & Runtime Notice:${colors.reset}`);
  console.log(`  • ${colors.dim}Proprietary Core:${colors.reset}   Live2D Cubism Core is proprietary software of Live2D Inc.`);
  console.log(`  • ${colors.dim}Indie / Small Biz:${colors.reset}  Free & royalty-free for entities with annual revenue < 10M JPY (~$67k USD).`);
  console.log(`  • ${colors.dim}Commercial License:${colors.reset} Entities exceeding this threshold require a Publication License from Live2D Inc.`);
  console.log(`  • ${colors.dim}Runtime Download:${colors.reset}   Clients fetch live2dcubismcore.min.js directly from Live2D CDN at runtime.\n`);

  const { modelSource } = await inquirer.prompt<{
    modelSource: string;
  }>([
    {
      type: 'input',
      name: 'modelSource',
      message: 'Live2D Model path / URL (.model3.json):',
      default: './assets/body/default/model.model3.json',
    },
  ]);

  const modelPath = modelSource.trim() || './assets/body/default/model.model3.json';
  const isHttpOrAbsolute = modelPath.startsWith('http://') || modelPath.startsWith('https://') || modelPath.startsWith('/');
  const webModelUrl = isHttpOrAbsolute
    ? modelPath
    : modelPath.startsWith('./')
      ? modelPath.slice(1)
      : `/${modelPath}`;

  return {
    config: {
      provider: 'live2d',
      format: 'live2d',
      modelPath,
      modelUrl: webModelUrl,
      initialExpression: 'neutral',
    },
    summary: {
      Provider: 'Live2D',
      'Model Path': modelPath,
    },
  };
}
