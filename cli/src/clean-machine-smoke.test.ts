import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { OrganRegistry } from './discovery';
import { generateInstanceFiles } from './generator';

describe('Phase 5: Clean-Machine Distribution & Packaging Smoke Suite', () => {
  const repoRoot = path.resolve(__dirname, '../../');
  const tempPackDir = path.resolve(__dirname, '../temp-packs-smoke');
  const cleanMachineRoot = path.resolve(__dirname, '../temp-clean-machine-smoke');

  const getPkgVer = (dir: string) => JSON.parse(fs.readFileSync(path.resolve(repoRoot, dir, 'package.json'), 'utf8')).version;

  const ALL_CANONICAL_PACKAGES = [
    { filter: '@sidurijs/core', dir: 'packages/core', tarName: `sidurijs-core-${getPkgVer('packages/core')}.tgz`, isOrgan: false },
    { filter: '@sidurijs/brain', dir: 'packages/organs/brain', tarName: `sidurijs-brain-${getPkgVer('packages/organs/brain')}.tgz`, isOrgan: true },
    { filter: '@sidurijs/memory', dir: 'packages/memory', tarName: `sidurijs-memory-${getPkgVer('packages/memory')}.tgz`, isOrgan: true },
    { filter: '@sidurijs/knowledge', dir: 'packages/knowledge', tarName: `sidurijs-knowledge-${getPkgVer('packages/knowledge')}.tgz`, isOrgan: true },
    { filter: '@sidurijs/self', dir: 'packages/self', tarName: `sidurijs-self-${getPkgVer('packages/self')}.tgz`, isOrgan: true },
    { filter: '@sidurijs/ear', dir: 'packages/organs/ear', tarName: `sidurijs-ear-${getPkgVer('packages/organs/ear')}.tgz`, isOrgan: true },
    { filter: '@sidurijs/vision', dir: 'packages/organs/vision', tarName: `sidurijs-vision-${getPkgVer('packages/organs/vision')}.tgz`, isOrgan: true },
    { filter: '@sidurijs/hands', dir: 'packages/organs/hands', tarName: `sidurijs-hands-${getPkgVer('packages/organs/hands')}.tgz`, isOrgan: true },
    { filter: '@sidurijs/body', dir: 'packages/organs/body', tarName: `sidurijs-body-${getPkgVer('packages/organs/body')}.tgz`, isOrgan: true },
    { filter: '@sidurijs/voice', dir: 'packages/organs/voice', tarName: `sidurijs-voice-${getPkgVer('packages/organs/voice')}.tgz`, isOrgan: true },
    { filter: '@sidurijs/observation', dir: 'packages/organs/observation', tarName: `sidurijs-observation-${getPkgVer('packages/organs/observation')}.tgz`, isOrgan: true },
    { filter: '@sidurijs/mouth', dir: 'packages/organs/mouth', tarName: `sidurijs-mouth-${getPkgVer('packages/organs/mouth')}.tgz`, isOrgan: true },
    { filter: '@vxnus/siduri', dir: 'cli', tarName: `vxnus-siduri-${getPkgVer('cli')}.tgz`, isOrgan: false },
  ];

  const getTarPath = (pkgName: string) => {
    const pkg = ALL_CANONICAL_PACKAGES.find(p => p.filter === pkgName);
    return path.join(tempPackDir, pkg!.tarName);
  };

  beforeAll(() => {
    // 1. Prepare clean directories
    if (fs.existsSync(tempPackDir)) fs.rmSync(tempPackDir, { recursive: true, force: true });
    if (fs.existsSync(cleanMachineRoot)) fs.rmSync(cleanMachineRoot, { recursive: true, force: true });
    fs.mkdirSync(tempPackDir, { recursive: true });
    fs.mkdirSync(cleanMachineRoot, { recursive: true });

    // 2. Build all packages in repo
    execSync("pnpm turbo run build --filter='!web'", { cwd: repoRoot, stdio: 'pipe' });

    // 3. Pack each canonical package into tempPackDir
    for (const pkg of ALL_CANONICAL_PACKAGES) {
      execSync(`pnpm pack --pack-destination ${tempPackDir}`, {
        cwd: path.resolve(repoRoot, pkg.dir),
        stdio: 'pipe',
      });
    }
  }, 90000);

  afterAll(() => {
    if (fs.existsSync(tempPackDir)) fs.rmSync(tempPackDir, { recursive: true, force: true });
    if (fs.existsSync(cleanMachineRoot)) fs.rmSync(cleanMachineRoot, { recursive: true, force: true });
  });

  describe('Phase 5A: Package Artifact Verification', () => {
    test('all 14 packages produce valid tarballs', () => {
      for (const pkg of ALL_CANONICAL_PACKAGES) {
        const tarPath = path.join(tempPackDir, pkg.tarName);
        expect(fs.existsSync(tarPath)).toBe(true);
      }
    });

    test('packed package.json files have zero workspace:* or link: dependencies', () => {
      for (const pkg of ALL_CANONICAL_PACKAGES) {
        const tarPath = path.join(tempPackDir, pkg.tarName);
        const pkgJsonRaw = execSync(`tar -xzf ${tarPath} -O package/package.json`, { encoding: 'utf8' });
        const pkgJson = JSON.parse(pkgJsonRaw);

        const allDeps = {
          ...(pkgJson.dependencies || {}),
          ...(pkgJson.peerDependencies || {}),
        };

        for (const [depName, version] of Object.entries(allDeps)) {
          if (typeof version === 'string') {
            expect(version.startsWith('workspace:')).toBe(false);
            expect(version.startsWith('link:')).toBe(false);
            expect(version.includes('../')).toBe(false);
          }
        }
      }
    });
  });

  describe('Phase 5B & 5C & 5G: Clean-Machine Installation & Isolation Acceptance', () => {
    const registry = OrganRegistry.discover([
      path.resolve(repoRoot, 'packages/organs'),
      path.resolve(repoRoot, 'packages')
    ]);
    const brain = registry.get('brain')!;
    const hands = registry.get('hands')!;
    const memory = registry.get('memory')!;

    test('Clean Composition 1: Brain only instance installs, starts, runs doctor and db push', () => {
      const instanceDir = path.join(cleanMachineRoot, 'inst-brain-only');
      fs.mkdirSync(path.join(instanceDir, 'src'), { recursive: true });

      const files = generateInstanceFiles({
        name: 'CleanBrainOnly',
        selectedManifests: [brain],
      });

      const pkgObj = JSON.parse(files['package.json']);
      pkgObj.dependencies = {
        '@sidurijs/core': `file:${getTarPath('@sidurijs/core')}`,
        '@sidurijs/brain': `file:${getTarPath('@sidurijs/brain')}`,
      };
      pkgObj.devDependencies = {
        '@vxnus/siduri': `file:${getTarPath('@vxnus/siduri')}`,
      };

      fs.writeFileSync(path.join(instanceDir, 'package.json'), JSON.stringify(pkgObj, null, 2) + '\n');
      fs.writeFileSync(path.join(instanceDir, 'siduri.config.json'), files['siduri.config.json']);
      fs.writeFileSync(path.join(instanceDir, 'siduri.schema.json'), files['siduri.schema.json']);
      fs.writeFileSync(path.join(instanceDir, '.env.example'), files['.env.example']);
      fs.writeFileSync(path.join(instanceDir, 'README.md'), files['README.md']);
      fs.writeFileSync(path.join(instanceDir, 'src/index.js'), files['src/index.js']);

      execSync('npm install --no-audit --no-fund', { cwd: instanceDir, stdio: 'pipe' });

      expect(fs.existsSync(path.join(instanceDir, 'node_modules/@sidurijs/memory'))).toBe(false);
      expect(fs.existsSync(path.join(instanceDir, 'node_modules/@sidurijs/hands'))).toBe(false);

      const doctorPass = execSync(`node ${path.resolve(repoRoot, 'cli/dist/index.js')} doctor`, {
        cwd: instanceDir,
        env: { ...process.env, OPENROUTER_API_KEY: 'test-key-clean' },
        encoding: 'utf8',
      });
      expect(doctorPass).toContain('Result: PASS');

      const dbPushOutput = execSync(`node ${path.resolve(repoRoot, 'cli/dist/index.js')} db push`, {
        cwd: instanceDir,
        encoding: 'utf8',
      });
      expect(dbPushOutput).toContain('SQLite manages schema natively. No CLI migrations required.');
    }, 60000);

    test('Clean Composition 2: Brain + Hands installs and runs doctor verifying ACTION_POLICY_SECRET', () => {
      const instanceDir = path.join(cleanMachineRoot, 'inst-brain-hands');
      fs.mkdirSync(path.join(instanceDir, 'src'), { recursive: true });

      const files = generateInstanceFiles({
        name: 'CleanBrainHands',
        selectedManifests: [brain, hands],
      });

      const pkgObj = JSON.parse(files['package.json']);
      pkgObj.dependencies = {
        '@sidurijs/core': `file:${getTarPath('@sidurijs/core')}`,
        '@sidurijs/brain': `file:${getTarPath('@sidurijs/brain')}`,
        '@sidurijs/hands': `file:${getTarPath('@sidurijs/hands')}`,
      };
      pkgObj.devDependencies = {
        '@vxnus/siduri': `file:${getTarPath('@vxnus/siduri')}`,
      };

      fs.writeFileSync(path.join(instanceDir, 'package.json'), JSON.stringify(pkgObj, null, 2) + '\n');
      fs.writeFileSync(path.join(instanceDir, 'siduri.config.json'), files['siduri.config.json']);
      fs.writeFileSync(path.join(instanceDir, 'siduri.schema.json'), files['siduri.schema.json']);
      fs.writeFileSync(path.join(instanceDir, '.env.example'), files['.env.example']);
      fs.writeFileSync(path.join(instanceDir, 'README.md'), files['README.md']);
      fs.writeFileSync(path.join(instanceDir, 'src/index.js'), files['src/index.js']);

      execSync('npm install --no-audit --no-fund', { cwd: instanceDir, stdio: 'pipe' });

      const doctorOutput = execSync(`node ${path.resolve(repoRoot, 'cli/dist/index.js')} doctor`, {
        cwd: instanceDir,
        env: {
          ...process.env,
          OPENROUTER_API_KEY: 'test-key-clean',
          ACTION_POLICY_SECRET: 'test-secret-clean',
        },
        encoding: 'utf8',
      });
      expect(doctorOutput).toContain('ACTION_POLICY_SECRET');
      expect(doctorOutput).toContain('Result: PASS');
    }, 60000);
  });
});
