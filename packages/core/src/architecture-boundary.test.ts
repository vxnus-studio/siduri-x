import * as fs from 'fs';
import * as path from 'path';

describe('Architecture: Core & Organ Package Boundaries (Phase 2)', () => {
  const rootOrgansDir = path.resolve(__dirname, '../../organs');
  const coreSrcDir = path.resolve(__dirname);
  const corePackageJsonPath = path.resolve(__dirname, '../package.json');

  const EXPECTED_ORGANS = [
    { dir: 'brain', name: '@siduri-y/brain', organType: 'brain', configKey: 'brain' },
    { dir: 'memory', name: '@siduri-y/memory', organType: 'memory', configKey: 'memory' },
    { dir: 'knowledge', name: '@siduri-y/knowledge', organType: 'knowledge', configKey: 'knowledge' },
    { dir: 'behavior', name: '@siduri-y/behavior', organType: 'behavior', configKey: 'behavior' },
    { dir: 'ear', name: '@siduri-y/ear', organType: 'ear', configKey: 'ear' },
    { dir: 'vision', name: '@siduri-y/vision', organType: 'vision', configKey: 'vision' },
    { dir: 'hands', name: '@siduri-y/hands', organType: 'hands', configKey: 'hands' },
    { dir: 'body', name: '@siduri-y/body', organType: 'body', configKey: 'body' },
    { dir: 'voice', name: '@siduri-y/voice', organType: 'voice', configKey: 'voice' },
    { dir: 'observation', name: '@siduri-y/observation', organType: 'observation', configKey: 'observation' },
  ];

  it('package.json has zero dependencies on @siduri-y organ packages', () => {
    const pkg = JSON.parse(fs.readFileSync(corePackageJsonPath, 'utf8'));
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {}),
    };

    const organDeps = Object.keys(allDeps).filter(
      (dep) => dep.startsWith('@siduri-y/') && dep !== '@siduri-y/core'
    );

    expect(organDeps).toEqual([]);
  });

  it('source files in packages/core have zero imports referencing @siduri-y organ packages', () => {
    const files = fs.readdirSync(coreSrcDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

    const forbiddenImports: { file: string; match: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(coreSrcDir, file), 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (
          (line.includes('import ') || line.includes('require(') || line.includes('export * from')) &&
          line.includes('@siduri-y/') &&
          !line.includes('@siduri-y/core')
        ) {
          forbiddenImports.push({ file, match: line.trim() });
        }
      }
    }

    expect(forbiddenImports).toEqual([]);
  });

  it('all 10 organ packages have a valid organ-manifest.json', () => {
    for (const organ of EXPECTED_ORGANS) {
      const manifestPath = path.join(rootOrgansDir, organ.dir, 'organ-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.name).toBe(organ.name);
      expect(manifest.organType).toBe(organ.organType);
      expect(manifest.configKey).toBe(organ.configKey);
      expect(typeof manifest.version).toBe('string');
      expect(typeof manifest.displayName).toBe('string');
      expect(typeof manifest.entrypoint).toBe('string');
      expect(typeof manifest.factory).toBe('string');
      expect(manifest.configSchema).toBeDefined();
      expect(Array.isArray(manifest.environment)).toBe(true);
      expect(Array.isArray(manifest.services)).toBe(true);
    }
  });

  it('no organ package contains link: or relative monorepo dependencies in package.json', () => {
    for (const organ of EXPECTED_ORGANS) {
      const pkgPath = path.join(rootOrgansDir, organ.dir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...(pkg.dependencies || {}) };

      for (const [depName, version] of Object.entries(deps)) {
        if (typeof version === 'string') {
          expect(version.startsWith('link:')).toBe(false);
          expect(version.includes('../')).toBe(false);
        }
      }
    }
  });

  it('memory organ packages SQL migrations', () => {
    const memoryMigrationsDir = path.join(rootOrgansDir, 'memory', 'migrations');
    expect(fs.existsSync(memoryMigrationsDir)).toBe(true);
    const files = fs.readdirSync(memoryMigrationsDir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThanOrEqual(1);
  });
});
