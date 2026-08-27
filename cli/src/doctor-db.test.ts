import fs from 'node:fs';
import path from 'node:path';
import { runDoctor } from './doctor';
import { runDbPush, redactDatabaseUrl } from './db';
import { generateInstanceFiles } from './generator';
import { OrganRegistry } from './discovery';

describe('Phase 4: Diagnostics and Database Provisioning Tests', () => {
  const rootOrgansDir = path.resolve(__dirname, '../../packages/organs');
  const registry = OrganRegistry.discover([rootOrgansDir]);
  const brain = registry.get('brain')!;
  const hands = registry.get('hands')!;
  const memory = registry.get('memory')!;

  const testTempRoot = path.resolve(__dirname, '../temp-phase4-test');

  beforeAll(() => {
    if (fs.existsSync(testTempRoot)) {
      fs.rmSync(testTempRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testTempRoot, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testTempRoot)) {
      fs.rmSync(testTempRoot, { recursive: true, force: true });
    }
  });

  test('redactDatabaseUrl redacts password and sensitive credentials', () => {
    const raw = 'postgresql://myuser:supersecretpassword@db.example.com:5432/siduri_db';
    const redacted = redactDatabaseUrl(raw);
    expect(redacted).not.toContain('supersecretpassword');
    expect(redacted).toContain('***');
    expect(redacted).toContain('myuser');
    expect(redacted).toContain('db.example.com:5432/siduri_db');
  });

  test('Test Matrix A: Brain only instance doctor and db push', async () => {
    const instanceDir = path.join(testTempRoot, 'brain-only');
    fs.mkdirSync(path.join(instanceDir, 'src'), { recursive: true });
    const files = generateInstanceFiles({
      name: 'BrainOnlyInstance',
      selectedManifests: [brain],
    });
    for (const [name, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        fs.writeFileSync(path.join(instanceDir, name), content);
      }
    }

    // 1. Doctor without OPENROUTER_API_KEY -> FAIL (Brain Health Probe fails)
    const doctorFail = await runDoctor({ projectDir: instanceDir, env: { OPENROUTER_API_KEY: '' } });
    expect(doctorFail.passed).toBe(false);
    expect(doctorFail.results.some((r) => r.category === 'Health Probe' && r.status === 'FAIL')).toBe(true);

    // Database check must be SKIPPED
    expect(doctorFail.results.some((r) => r.category === 'Database' && r.status === 'SKIPPED')).toBe(true);

    // 2. Doctor with OPENROUTER_API_KEY -> PASS
    const doctorPass = await runDoctor({
      projectDir: instanceDir,
      env: { OPENROUTER_API_KEY: 'test-key-123' },
    });
    expect(doctorPass.passed).toBe(true);

    // 3. db push -> NOOP ("No database migrations are required...")
    const dbResult = await runDbPush({ projectDir: instanceDir });
    expect(dbResult.status).toBe('NOOP');
    expect(dbResult.message).toContain('No database migrations are required');
  });

  test('Test Matrix B: Brain + Hands instance doctor and db push', async () => {
    const instanceDir = path.join(testTempRoot, 'brain-hands');
    fs.mkdirSync(path.join(instanceDir, 'src'), { recursive: true });
    const files = generateInstanceFiles({
      name: 'BrainHandsInstance',
      selectedManifests: [brain, hands],
    });
    for (const [name, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        fs.writeFileSync(path.join(instanceDir, name), content);
      }
    }

    // Doctor checks both keys
    const doctorRes = await runDoctor({
      projectDir: instanceDir,
      env: {
        OPENROUTER_API_KEY: 'test-openrouter-key',
        ACTION_POLICY_SECRET: 'test-policy-secret',
      },
    });
    expect(doctorRes.passed).toBe(true);
    expect(doctorRes.results.some((r) => r.name === 'OPENROUTER_API_KEY' && r.status === 'PASS')).toBe(true);
    expect(doctorRes.results.some((r) => r.name === 'ACTION_POLICY_SECRET' && r.status === 'PASS')).toBe(true);

    // Database check must be SKIPPED
    expect(doctorRes.results.some((r) => r.category === 'Database' && r.status === 'SKIPPED')).toBe(true);

    // db push returns NOOP
    const dbResult = await runDbPush({ projectDir: instanceDir });
    expect(dbResult.status).toBe('NOOP');
  });

  test('Test Matrix C: Brain + Memory instance requires DATABASE_URL', async () => {
    const instanceDir = path.join(testTempRoot, 'brain-memory');
    fs.mkdirSync(path.join(instanceDir, 'src'), { recursive: true });
    const files = generateInstanceFiles({
      name: 'BrainMemoryInstance',
      selectedManifests: [brain, memory],
    });
    for (const [name, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        fs.writeFileSync(path.join(instanceDir, name), content);
      }
    }

    // 1. Doctor fails without DATABASE_URL
    const doctorMissingDb = await runDoctor({
      projectDir: instanceDir,
      env: { OPENROUTER_API_KEY: 'test-key' },
    });
    expect(doctorMissingDb.passed).toBe(false);
    expect(doctorMissingDb.results.some((r) => r.name === 'DATABASE_URL' && r.status === 'FAIL')).toBe(true);

    // 2. db push fails clearly without DATABASE_URL
    await expect(runDbPush({ projectDir: instanceDir, env: {} })).rejects.toThrow(/DATABASE_URL is required/);
  });

  test('Test Matrix D: Diagnostics and Error Handling for invalid or missing configs', async () => {
    // 1. Missing siduri.config.json
    const nonExistentDir = path.join(testTempRoot, 'non-existent-dir');
    await expect(runDoctor({ projectDir: nonExistentDir })).rejects.toThrow(/siduri.config.json not found/);
    await expect(runDbPush({ projectDir: nonExistentDir })).rejects.toThrow(/siduri.config.json not found/);

    // 2. Unreachable PostgreSQL host reported gracefully by doctor
    const instDir = path.join(testTempRoot, 'brain-memory');
    const doctorUnreachable = await runDoctor({
      projectDir: instDir,
      env: {
        OPENROUTER_API_KEY: 'test-key',
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:59999/non_existent_db',
      },
    });
    expect(doctorUnreachable.passed).toBe(false);
    expect(doctorUnreachable.results.some((r) => r.category === 'Database' && r.status === 'FAIL')).toBe(true);
  });
});

