import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureArchive(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { provider } = await inquirer.prompt<{ provider: string }>({
    type: 'list',
    name: 'provider',
    message: 'Archive storage engine (RFC VX-26-13: Audited Interaction Ledger)?',
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

/**
 * @deprecated Use configureArchive instead. RFC VX-26-13.
 */
export const configureMemory = configureArchive;
