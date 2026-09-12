import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureMemory(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { provider } = await inquirer.prompt<{ provider: string }>({
    type: 'list',
    name: 'provider',
    message: 'Memory storage engine?',
    choices: [
      { name: 'SQLite (Unified zero-config WAL + FTS5 full-text indexing)', value: 'sqlite' },
    ],
  });

  return {
    config: {
      provider,
    },
    summary: {
      Database: 'SQLite (WAL + FTS5)',
      Storage: 'siduri.sqlite',
    },
  };
}
