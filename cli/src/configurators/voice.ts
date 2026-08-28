import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureVoice(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { provider } = await inquirer.prompt<{ provider: string }>({
    type: 'list',
    name: 'provider',
    message: 'Voice provider?',
    choices: [
      { name: 'VOICEVOX (Local high-fidelity neural speech synthesis engine)', value: 'voicevox' },
      { name: 'None (Disable voice synthesis)', value: 'none' },
    ],
  });

  if (provider === 'none') {
    return {
      config: { provider: 'none' },
      summary: { Provider: 'None (Voice disabled)' },
    };
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'VOICEVOX Engine Base URL:',
      default: 'http://localhost:50021',
    },
    {
      type: 'input',
      name: 'speakerId',
      message: 'Default Speaker ID (e.g. 1 for Zundamon, 2 for Shikoku Metan):',
      default: '1',
      validate: (v: string) => !isNaN(parseInt(v, 10)) || 'Speaker ID must be an integer.',
    },
    {
      type: 'confirm',
      name: 'enableRvc',
      message: 'Enable Headless RVC (Voice Conversion via ./assets/voice/[name])?',
      default: false,
    },
  ]);

  const speakerId = parseInt(answers.speakerId, 10) || 1;
  const companionSlug = _context.companionName.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default';

  const config: Record<string, any> = {
    provider: 'voicevox',
    baseUrl: answers.baseUrl.trim(),
    speakerId,
    maxQueueDepth: 50,
  };

  const summary: Record<string, string | number> = {
    Provider: 'VOICEVOX',
    'Speaker ID': speakerId,
    'Base URL': answers.baseUrl.trim(),
  };

  if (answers.enableRvc) {
    config.rvc = {
      enabled: true,
      serviceUrl: 'http://localhost:50055',
      modelName: companionSlug,
      modelPath: `./assets/voice/${companionSlug}/${companionSlug}.pth`,
      indexPath: `./assets/voice/${companionSlug}/${companionSlug}.index`,
      pitchShift: 0,
      f0Method: 'rmvpe',
      indexRate: 0.75,
    };
    summary['RVC Post-Processor'] = `Enabled (assets/voice/${companionSlug}/)`;
  }

  return {
    config,
    summary,
  };
}
