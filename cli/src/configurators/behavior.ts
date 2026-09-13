import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureBehavior(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const companionName = _context.companionName || 'Companion';
  const companionSlug = companionName.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default';

  const { personaMode } = await inquirer.prompt<{ personaMode: 'now' | 'later' }>({
    type: 'list',
    name: 'personaMode',
    message: 'Define base persona now or later?',
    choices: [
      {
        name: 'Later (Start as a pure blank slate; evolve via interaction or add .self later)',
        value: 'later',
      },
      {
        name: 'Now (Define archetype, ethos, and generate base .self persona asset)',
        value: 'now',
      },
    ],
    default: 'later',
  });

  if (personaMode === 'later') {
    return {
      config: {
        provider: 'active_self',
        mode: 'blank_slate',
      },
      summary: {
        Persona: 'Blank Slate (Evolve via interaction)',
        Directives: 'Zero predeclared biases',
      },
    };
  }

  const personaAnswers = await inquirer.prompt<{
    archetype: string;
    ethos: string;
    directive: string;
  }>([
    {
      type: 'input',
      name: 'archetype',
      message: 'Companion archetype or role:',
      default: 'Knowledge Assistant & Research Partner',
    },
    {
      type: 'input',
      name: 'ethos',
      message: 'Core ethos & speaking demeanor:',
      default: 'Direct technical candor, thoughtful, concise, and loyal',
    },
    {
      type: 'input',
      name: 'directive',
      message: 'Primary behavioral directive or rule:',
      default: 'Speak concisely and stay in character without sycophantic filler',
    },
  ]);

  const archetype = personaAnswers.archetype.trim() || 'Knowledge Assistant & Research Partner';
  const ethos = personaAnswers.ethos.trim() || 'Direct technical candor, thoughtful, concise, and loyal';
  const directive = personaAnswers.directive.trim() || 'Speak concisely and stay in character without sycophantic filler';
  const selfPath = `./assets/self/${companionSlug}.self`;

  return {
    config: {
      provider: 'active_self',
      mode: 'custom',
      archetype,
      ethos,
      directive,
      selfPath,
    },
    summary: {
      Persona: 'Configured (.self asset)',
      Archetype: archetype,
      Ethos: ethos,
      'Self Asset': selfPath,
    },
  };
}
