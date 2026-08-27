import fs from 'node:fs';
import path from 'node:path';
import { OrganRegistry } from './discovery';
import { OrganManifest } from './manifest';
import { Pool } from 'pg';

export interface DoctorCheckResult {
  category: 'Environment' | 'Services' | 'Database' | 'Health Probe';
  name: string;
  status: 'PASS' | 'FAIL' | 'OPTIONAL_MISSING' | 'SKIPPED';
  organName?: string;
  message?: string;
  remediation?: string;
}

export interface DoctorReport {
  instanceName: string;
  configuredOrgans: string[];
  results: DoctorCheckResult[];
  passed: boolean;
}

export interface DoctorOptions {
  projectDir?: string;
  env?: Record<string, string | undefined>;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorReport> {
  const projectDir = options.projectDir ? path.resolve(options.projectDir) : process.cwd();
  const configPath = path.join(projectDir, 'siduri.config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`siduri.config.json not found at ${projectDir}. Make sure you are in a Siduri instance directory.`);
  }

  // Load .env if present in projectDir
  const envFile = path.join(projectDir, '.env');
  const fileEnv: Record<string, string> = {};
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        fileEnv[key] = val;
      }
    }
  }

  const effectiveEnv = {
    ...process.env,
    ...fileEnv,
    ...(options.env || {}),
  };

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configuredOrgansMap = config.organs || {};
  const organKeys = Object.keys(configuredOrgansMap);

  const registry = OrganRegistry.discover([
    path.join(projectDir, 'node_modules/@siduri-y'),
    path.resolve(__dirname, '../../packages/organs'),
    path.resolve(process.cwd(), 'packages/organs'),
  ]);

  const selectedManifests: OrganManifest[] = [];
  const results: DoctorCheckResult[] = [];

  // 1. Resolve manifests for selected organs
  for (const organKey of organKeys) {
    const m = registry.get(organKey) || registry.getAll().find((item) => item.configKey === organKey || item.organType === organKey);
    if (!m) {
      results.push({
        category: 'Environment',
        name: `Manifest resolution: ${organKey}`,
        status: 'FAIL',
        message: `Could not resolve package manifest for configured organ '${organKey}'.`,
        remediation: `Ensure @siduri-y/${organKey} is installed in package.json and npm install has been run.`,
      });
    } else {
      selectedManifests.push(m);
    }
  }

  // 2. Check Environment Variables (deduplicated)
  const checkedEnvVars = new Set<string>();
  for (const m of selectedManifests) {
    for (const envVar of m.environment || []) {
      if (checkedEnvVars.has(envVar.name)) continue;
      checkedEnvVars.add(envVar.name);

      const val = effectiveEnv[envVar.name];
      const isMissing = !val || val.trim() === '';

      if (isMissing) {
        if (envVar.required) {
          results.push({
            category: 'Environment',
            name: envVar.name,
            status: 'FAIL',
            organName: m.name,
            message: `Missing required environment variable '${envVar.name}'.`,
            remediation: `Set ${envVar.name} in .env or your shell environment. ${envVar.description || ''}`,
          });
        } else {
          results.push({
            category: 'Environment',
            name: envVar.name,
            status: 'OPTIONAL_MISSING',
            organName: m.name,
            message: `Optional variable '${envVar.name}' not set.`,
          });
        }
      } else {
        results.push({
          category: 'Environment',
          name: envVar.name,
          status: 'PASS',
          organName: m.name,
          message: 'Configured',
        });
      }
    }
  }

  // 3. Check External Services
  for (const m of selectedManifests) {
    for (const service of m.services || []) {
      results.push({
        category: 'Services',
        name: `${service.name} (${m.organType})`,
        status: 'PASS',
        organName: m.name,
        message: 'Service requirement declared',
      });
    }
  }

  // 4. Database Check (only if an organ declares database requirement)
  const dbOrgan = selectedManifests.find((m) => m.database !== null && m.database !== undefined);
  if (dbOrgan) {
    const dbUrl = effectiveEnv.DATABASE_URL;
    if (!dbUrl) {
      results.push({
        category: 'Database',
        name: 'PostgreSQL Connection',
        status: 'FAIL',
        organName: dbOrgan.name,
        message: 'DATABASE_URL is not configured.',
        remediation: 'Provide DATABASE_URL in .env (e.g. postgresql://postgres:postgres@localhost:5432/siduri)',
      });
    } else {
      const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 3000 });
      try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        results.push({
          category: 'Database',
          name: 'PostgreSQL Connection',
          status: 'PASS',
          organName: dbOrgan.name,
          message: 'Connection successful',
        });
      } catch (err: any) {
        await pool.end().catch(() => {});
        results.push({
          category: 'Database',
          name: 'PostgreSQL Connection',
          status: 'FAIL',
          organName: dbOrgan.name,
          message: `Connection failed: ${err.message}`,
          remediation: 'Check database host availability, port, credentials, and network accessibility.',
        });
      }
    }
  } else {
    results.push({
      category: 'Database',
      name: 'PostgreSQL Database',
      status: 'SKIPPED',
      message: 'Not required by current composition',
    });
  }

  // 5. Organ Health Probes
  for (const m of selectedManifests) {
    if (m.healthCheck) {
      try {
        // Resolve package entrypoint
        const candidateEntrypoints = [
          path.resolve(projectDir, 'node_modules', m.name, m.entrypoint),
          path.resolve(__dirname, '../../packages/organs', m.organType, m.entrypoint),
          path.resolve(process.cwd(), 'packages/organs', m.organType, m.entrypoint),
        ];
        const entryPath = candidateEntrypoints.find((p) => fs.existsSync(p));
        if (entryPath) {
          const mod = require(entryPath);
          const probeFn = mod[m.healthCheck];
          if (typeof probeFn === 'function') {
            const organConf = configuredOrgansMap[m.configKey] || configuredOrgansMap[m.organType];
            const probeRes = await probeFn({ config: organConf, env: effectiveEnv });
            if (probeRes && probeRes.ok === false) {
              results.push({
                category: 'Health Probe',
                name: `${m.displayName} Probe`,
                status: 'FAIL',
                organName: m.name,
                message: probeRes.message || 'Health probe check failed',
                remediation: `Check ${m.displayName} configuration in siduri.config.json.`,
              });
            } else {
              results.push({
                category: 'Health Probe',
                name: `${m.displayName} Probe`,
                status: 'PASS',
                organName: m.name,
                message: probeRes?.message || 'Operational',
              });
            }
          }
        }
      } catch (err: any) {
        results.push({
          category: 'Health Probe',
          name: `${m.displayName} Probe`,
          status: 'FAIL',
          organName: m.name,
          message: `Probe invocation failed: ${err.message}`,
        });
      }
    }
  }

  const passed = results.every((r) => r.status !== 'FAIL');

  return {
    instanceName: config.name || 'Siduri Instance',
    configuredOrgans: organKeys,
    results,
    passed,
  };
}
