import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureMemory(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const { database } = await inquirer.prompt<{ database: string }>({
    type: 'list',
    name: 'database',
    message: 'Memory database?',
    choices: [
      { name: 'PostgreSQL (FTS relational claims with ACID durability)', value: 'postgres' },
    ],
  });

  const { deployment } = await inquirer.prompt<{ deployment: string }>({
    type: 'list',
    name: 'deployment',
    message: 'PostgreSQL deployment target?',
    choices: [
      { name: 'Supabase (Hosted Postgres with connection pooling)', value: 'supabase' },
      { name: 'Neon (Serverless Postgres with branch-per-companion)', value: 'neon' },
      { name: 'Local PostgreSQL (Docker or system service)', value: 'local' },
      { name: 'Other PostgreSQL URL', value: 'other' },
    ],
  });

  const deploymentDisplayNames: Record<string, string> = {
    supabase: 'Supabase',
    neon: 'Neon',
    local: 'Local PostgreSQL',
    other: 'Other PostgreSQL',
  };

  return {
    config: {
      provider: database,
      deployment,
    },
    summary: {
      Database: 'PostgreSQL',
      Deploy: deploymentDisplayNames[deployment] || deployment,
    },
  };
}
