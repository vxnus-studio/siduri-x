import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureHands(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { provider } = await inquirer.prompt<{ provider: string }>({
    type: 'list',
    name: 'provider',
    message: 'Hands tool execution engine?',
    choices: [
      { name: 'MCP Client (Model Context Protocol & signed capability tokens)', value: 'mcp' },
      { name: 'None (Skip / No external tool execution)', value: 'none' },
    ],
    default: 'none',
  });

  if (provider === 'none') {
    return {
      config: { provider: 'none' },
      summary: { Provider: 'None (Hands disabled)' },
    };
  }

  const { timeoutSeconds } = await inquirer.prompt<{ timeoutSeconds: string }>({
    type: 'input',
    name: 'timeoutSeconds',
    message: 'MCP Tool execution timeout (seconds):',
    default: '10',
    validate: (v: string) => (!isNaN(Number(v)) && Number(v) > 0) || 'Timeout must be a positive number.',
  });

  const timeoutMs = Math.round(Number(timeoutSeconds) * 1000);

  return {
    config: {
      defaultTimeoutMs: timeoutMs,
      providers: [],
    },
    summary: {
      'Default Timeout': `${timeoutSeconds}s`,
      'MCP Execution': 'Active Policy HMAC Protected',
    },
  };
}
