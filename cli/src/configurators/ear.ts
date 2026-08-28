import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureEar(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { defaultSource } = await inquirer.prompt<{ defaultSource: string }>({
    type: 'list',
    name: 'defaultSource',
    message: 'Perception ingress channel:',
    choices: [
      { name: 'Text Chat (Standard multimodal chat ingress)', value: 'text_chat' },
      { name: 'Audio Streaming Ingress', value: 'audio_stream' },
    ],
  });

  return {
    config: {
      defaultSource,
      maxTextLength: 4000,
      maxAudioBytes: 10485760,
    },
    summary: {
      'Default Ingress': defaultSource === 'text_chat' ? 'Text Chat' : 'Audio Stream',
    },
  };
}
