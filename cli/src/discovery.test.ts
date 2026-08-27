import fs from 'node:fs';
import path from 'node:path';
import { OrganRegistry } from './discovery';
import { generateInstanceFiles } from './generator';

describe('Discovery & Dynamic Composition System Tests (Phase 3)', () => {
  const rootOrgansDir = path.resolve(__dirname, '../../packages/organs');

  test('Registry successfully discovers all 10 organ packages from workspace', () => {
    const registry = OrganRegistry.discover([rootOrgansDir]);
    const manifests = registry.getAll();
    expect(manifests.length).toBe(10);

    const organTypes = registry.getAvailableOrganTypes().sort();
    expect(organTypes).toEqual([
      'behavior',
      'body',
      'brain',
      'ear',
      'hands',
      'knowledge',
      'memory',
      'observation',
      'vision',
      'voice',
    ]);
  });

  test('Generates valid instances from discovered manifests', () => {
    const registry = OrganRegistry.discover([rootOrgansDir]);

    // Test Brain + Hands + Vision
    const brain = registry.get('brain')!;
    const hands = registry.get('hands')!;
    const vision = registry.get('vision')!;

    const files = generateInstanceFiles({
      name: 'robotics-agent',
      selectedManifests: [brain, hands, vision],
    });

    const pkg = JSON.parse(files['package.json']);
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      '@siduri-y/brain',
      '@siduri-y/core',
      '@siduri-y/hands',
      '@siduri-y/vision',
    ]);

    const schema = JSON.parse(files['siduri.schema.json']);
    expect(Object.keys(schema.properties.organs.properties).sort()).toEqual(['brain', 'hands', 'vision']);

    const config = JSON.parse(files['siduri.config.json']);
    expect(Object.keys(config.organs).sort()).toEqual(['brain', 'hands', 'vision']);

    expect(files['.env.example']).toContain('OPENROUTER_API_KEY');
    expect(files['.env.example']).toContain('ACTION_POLICY_SECRET');
    expect(files['.env.example']).not.toContain('DATABASE_URL');
  });

  test('Validates manifest contract integrity during discovery', () => {
    expect(() => {
      const invalidRegistry = new OrganRegistry();
      invalidRegistry.register({} as any);
    }).toThrow(/Invalid manifest/);
  });
});
