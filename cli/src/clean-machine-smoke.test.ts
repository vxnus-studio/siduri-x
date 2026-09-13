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
    { filter: '@siduri-x/core', dir: 'packages/core', tarName: `siduri-x-core-${getPkgVer('packages/core')}.tgz`, isOrgan: false },
    { filter: '@siduri-x/brain', dir: 'packages/organs/brain', tarName: `siduri-x-brain-${getPkgVer('packages/organs/brain')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/memory', dir: 'packages/memory', tarName: `siduri-x-memory-${getPkgVer('packages/memory')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/knowledge', dir: 'packages/knowledge', tarName: `siduri-x-knowledge-${getPkgVer('packages/knowledge')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/self', dir: 'packages/self', tarName: `siduri-x-self-${getPkgVer('packages/self')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/ear', dir: 'packages/organs/ear', tarName: `siduri-x-ear-${getPkgVer('packages/organs/ear')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/vision', dir: 'packages/organs/vision', tarName: `siduri-x-vision-${getPkgVer('packages/organs/vision')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/hands', dir: 'packages/organs/hands', tarName: `siduri-x-hands-${getPkgVer('packages/organs/hands')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/body', dir: 'packages/organs/body', tarName: `siduri-x-body-${getPkgVer('packages/organs/body')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/voice', dir: 'packages/organs/voice', tarName: `siduri-x-voice-${getPkgVer('packages/organs/voice')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/observation', dir: 'packages/organs/observation', tarName: `siduri-x-observation-${getPkgVer('packages/organs/observation')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/mouth', dir: 'packages/organs/mouth', tarName: `siduri-x-mouth-${getPkgVer('packages/organs/mouth')}.tgz`, isOrgan: true },
    { filter: '@siduri-x/eknowledge', dir: 'packages/organs/eknowledge', tarName: `siduri-x-eknowledge-${getPkgVer('packages/organs/eknowledge')}.tgz`, isOrgan: true },
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
        '@siduri-x/core': `file:${getTarPath('@siduri-x/core')}`,
        '@siduri-x/brain': `file:${getTarPath('@siduri-x/brain')}`,
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

      expect(fs.existsSync(path.join(instanceDir, 'node_modules/@siduri-x/memory'))).toBe(false);
      expect(fs.existsSync(path.join(instanceDir, 'node_modules/@siduri-x/hands'))).toBe(false);

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
        '@siduri-x/core': `file:${getTarPath('@siduri-x/core')}`,
        '@siduri-x/brain': `file:${getTarPath('@siduri-x/brain')}`,
        '@siduri-x/hands': `file:${getTarPath('@siduri-x/hands')}`,
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
