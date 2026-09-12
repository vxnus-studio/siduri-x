import fs from 'node:fs';
import path from 'node:path';
import { runDoctor } from './doctor';
import { runDbPush } from './db';
import { generateInstanceFiles } from './generator';
import { OrganRegistry } from './discovery';

describe('Phase 4: Diagnostics and Database Provisioning Tests', () => {
  const rootOrgansDir = path.resolve(__dirname, '../../packages/organs');
  const registry = OrganRegistry.discover();
  const brain = registry.get('brain')!;
  const hands = registry.get('hands')!;

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

  test('Test Matrix A: Brain only instance doctor and db push', async () => {
    const instanceDir = path.join(testTempRoot, 'brain-only');
    fs.mkdirSync(path.join(instanceDir, 'src'), { recursive: true });
    const files = generateInstanceFiles({
      name: 'BrainOnlyInstance',
      selectedManifests: [brain],
    });
    for (const [name, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        const fullPath = path.join(instanceDir, name);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
      }
    }

    const doctorPass = await runDoctor({
      projectDir: instanceDir,
      env: { OPENROUTER_API_KEY: 'test-key-123' },
    });
    expect(doctorPass.passed).toBe(true);

    const dbResult = await runDbPush({ projectDir: instanceDir });
    expect(dbResult.status).toBe('NOOP');
    expect(dbResult.message).toContain('SQLite manages schema natively.');
  });
});
