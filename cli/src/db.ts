import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { OrganRegistry } from './discovery';
import { OrganManifest } from './manifest';

export function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return 'postgres://***:***@...';
  }
}

export interface MigrationFile {
  name: string;
  fullPath: string;
  sql: string;
  checksum: string;
}

export interface MigrationRecord {
  id: number;
  name: string;
  checksum: string;
  applied_at: string;
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
  const projectDir = options.projectDir ? path.resolve(options.projectDir) : process.cwd();
  const configPath = path.join(projectDir, 'siduri.config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`siduri.config.json not found at ${projectDir}. Make sure you are in a Siduri instance directory.`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configuredOrgans = config.organs || {};

  // 1. Discover manifests of configured organs
  const registry = OrganRegistry.discover([
    path.join(projectDir, 'node_modules/@siduri-x'),
    path.resolve(__dirname, '../../packages/organs'),
    path.resolve(process.cwd(), 'packages/organs'),
  ]);

  const databaseOrgans: { organType: string; manifest: OrganManifest; migrationsDir: string }[] = [];

  for (const [key] of Object.entries(configuredOrgans)) {
    const manifest = registry.get(key) || registry.getAll().find((m) => m.configKey === key || m.organType === key);
    if (manifest && manifest.database && manifest.database.migrationsDir) {
      // Resolve migrations directory relative to the organ package
      const candidatePaths = [
        path.resolve(projectDir, 'node_modules', manifest.name, manifest.database.migrationsDir),
        path.resolve(__dirname, '../../packages/organs', manifest.organType, manifest.database.migrationsDir),
        path.resolve(process.cwd(), 'packages/organs', manifest.organType, manifest.database.migrationsDir),
      ];
      const resolvedDir = candidatePaths.find((p) => fs.existsSync(p));
      if (resolvedDir) {
        databaseOrgans.push({
          organType: manifest.organType,
          manifest,
          migrationsDir: resolvedDir,
        });
      }
    }
  }

  if (databaseOrgans.length === 0) {
    return {
      status: 'NOOP',
      appliedMigrations: [],
      skippedMigrations: [],
      message: 'No database migrations are required by this instance.',
    };
  }

  // 2. Resolve DATABASE_URL
  const connectionString =
    options.connectionString ||
    options.env?.DATABASE_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run database migrations. Set it in .env or environment.');
  }

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  const client = await pool.connect();

  try {
    // 3. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS siduri_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Fetch applied migrations
    const existingRes = await client.query<MigrationRecord>(
      'SELECT name, checksum FROM siduri_migrations ORDER BY id ASC;'
    );
    const appliedMap = new Map<string, string>();
    for (const row of existingRes.rows) {
      appliedMap.set(row.name, row.checksum);
    }

    // 5. Gather all migration files across database organs in deterministic order
    const allMigrationFiles: MigrationFile[] = [];

    for (const item of databaseOrgans) {
      const files = fs.readdirSync(item.migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const fullPath = path.join(item.migrationsDir, file);
        const sql = fs.readFileSync(fullPath, 'utf8');
        const checksum = createHash('sha256').update(sql).digest('hex');
        allMigrationFiles.push({
          name: `${item.organType}/${file}`,
          fullPath,
          sql,
          checksum,
        });
      }
    }

    allMigrationFiles.sort((a, b) => a.name.localeCompare(b.name));

    const appliedList: string[] = [];
    const skippedList: string[] = [];

    for (const migration of allMigrationFiles) {
      const recordedChecksum = appliedMap.get(migration.name);

      if (recordedChecksum !== undefined) {
        if (recordedChecksum !== migration.checksum) {
          throw new Error(
            `Migration checksum mismatch for ${migration.name}! Recorded: ${recordedChecksum.slice(0, 8)}, Current: ${migration.checksum.slice(0, 8)}. Refusing to apply modified migration.`
          );
        }
        skippedList.push(migration.name);
      } else {
        // Apply migration in transaction
        await client.query('BEGIN');
        try {
          await client.query(migration.sql);
          await client.query(
            'INSERT INTO siduri_migrations (name, checksum) VALUES ($1, $2)',
            [migration.name, migration.checksum]
          );
          await client.query('COMMIT');
          appliedList.push(migration.name);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }
    }

    const redacted = redactDatabaseUrl(connectionString);
    const message = appliedList.length > 0
      ? `Applied ${appliedList.length} migration(s) to ${redacted}`
      : `Database schema up to date on ${redacted}`;

    return {
      status: appliedList.length > 0 ? 'APPLIED' : 'UP_TO_DATE',
      appliedMigrations: appliedList,
      skippedMigrations: skippedList,
      message,
    };
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}
