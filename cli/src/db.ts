export function redactDatabaseUrl(url: string): string {
  return url;
}

export interface DbPushOptions {
  projectDir?: string;
  connectionString?: string;
  env?: Record<string, string | undefined>;
}

export interface DbPushResult {
  status: 'NOOP' | 'APPLIED' | 'UP_TO_DATE';
  appliedMigrations: string[];
  skippedMigrations: string[];
  message: string;
}

export async function runDbPush(options: DbPushOptions = {}): Promise<DbPushResult> {
  return {
    status: 'NOOP',
    appliedMigrations: [],
    skippedMigrations: [],
    message: 'SQLite manages schema natively. No CLI migrations required.',
  };
}
