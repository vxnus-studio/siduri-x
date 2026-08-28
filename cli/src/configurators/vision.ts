import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureVision(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { model } = await inquirer.prompt<{ model: string }>({
    type: 'list',
    name: 'model',
    message: 'Vision model:',
    choices: [
      { name: 'GPT-4 Vision / GPT-4o (Multimodal OCR & Object Inspection)', value: 'gpt-4-vision' },
      { name: 'Claude 3.5 Sonnet Vision', value: 'anthropic/claude-3.5-sonnet' },
      { name: 'Custom Vision Model', value: 'custom' },
    ],
  });

  let selectedModel = model;
  if (model === 'custom') {
    const { customModel } = await inquirer.prompt<{ customModel: string }>({
      type: 'input',
      name: 'customModel',
      message: 'Vision Model ID:',
      default: 'gpt-4-vision',
    });
    selectedModel = customModel.trim();
  }

  return {
    config: {
      provider: 'openrouter',
      model: selectedModel,
    },
    summary: {
      Provider: 'OpenRouter Vision',
      Model: selectedModel,
    },
  };
}
