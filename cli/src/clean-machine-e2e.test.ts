import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { generateInstanceFiles } from './generator';
import { OrganRegistry } from './discovery';
import { runDoctor } from './doctor';
import { runDbPush } from './db';

describe('Phase 5: Clean-Machine Distribution & E2E Integration Suite', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const tempPackDir = path.resolve(__dirname, '../temp-packs-e2e');
  const cleanMachineRoot = path.resolve(__dirname, '../temp-clean-machine-e2e');

  const ALL_CANONICAL_PACKAGES = [
    { filter: '@siduri-x/core', tarName: 'siduri-x-core-1.0.2.tgz', isOrgan: false },
    { filter: '@siduri-x/brain', tarName: 'siduri-x-brain-1.0.2.tgz', isOrgan: true },
    { filter: '@siduri-x/memory', tarName: 'siduri-x-memory-1.0.2.tgz', isOrgan: true },
    { filter: '@siduri-x/knowledge', tarName: 'siduri-x-knowledge-1.0.2.tgz', isOrgan: true },
    { filter: '@siduri-x/behavior', tarName: 'siduri-x-behavior-1.0.2.tgz', isOrgan: true },
    { filter: '@siduri-x/ear', tarName: 'siduri-x-ear-1.0.2.tgz', isOrgan: true },
    { filter: '@siduri-x/vision', tarName: 'siduri-x-vision-1.0.2.tgz', isOrgan: true },
    { filter: '@siduri-x/hands', tarName: 'siduri-x-hands-1.0.2.tgz', isOrgan: true },
    { filter: '@siduri-x/body', tarName: 'siduri-x-body-1.0.4.tgz', isOrgan: true },
    { filter: '@siduri-x/voice', tarName: 'siduri-x-voice-1.0.3.tgz', isOrgan: true },
    { filter: '@siduri-x/observation', tarName: 'siduri-x-observation-1.0.2.tgz', isOrgan: true },
    { filter: '@vxnus/siduri', tarName: 'vxnus-siduri-0.1.5.tgz', isOrgan: false },
  ];

  beforeAll(() => {
    // 1. Prepare clean directories
    if (fs.existsSync(tempPackDir)) fs.rmSync(tempPackDir, { recursive: true, force: true });
    if (fs.existsSync(cleanMachineRoot)) fs.rmSync(cleanMachineRoot, { recursive: true, force: true });
    fs.mkdirSync(tempPackDir, { recursive: true });
    fs.mkdirSync(cleanMachineRoot, { recursive: true });

    // 2. Build all packages in repo
    execSync('pnpm build', { cwd: repoRoot, stdio: 'pipe' });

    // 3. Pack each canonical package into tempPackDir
    for (const pkg of ALL_CANONICAL_PACKAGES) {
      execSync(`pnpm --filter ${pkg.filter} pack --pack-destination ${tempPackDir}`, {
        cwd: repoRoot,
        stdio: 'pipe',
      });
    }
  }, 90000);

  afterAll(() => {
    if (fs.existsSync(tempPackDir)) fs.rmSync(tempPackDir, { recursive: true, force: true });
    if (fs.existsSync(cleanMachineRoot)) fs.rmSync(cleanMachineRoot, { recursive: true, force: true });
  });

  describe('Phase 5A: Package Artifact Verification', () => {
    test('all 12 packages produce valid tarballs', () => {
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

    test('every organ package tarball contains organ-manifest.json and dist files', () => {
      const organPackages = ALL_CANONICAL_PACKAGES.filter((p) => p.isOrgan);
      for (const pkg of organPackages) {
        const tarPath = path.join(tempPackDir, pkg.tarName);
        const listing = execSync(`tar -tzf ${tarPath}`, { encoding: 'utf8' }).split('\n');

        expect(listing.some((line) => line.includes('package/organ-manifest.json'))).toBe(true);
        expect(listing.some((line) => line.includes('package/dist/index.js'))).toBe(true);
        expect(listing.some((line) => line.includes('package/dist/index.d.ts'))).toBe(true);
      }
    });

    test('memory organ tarball packages migrations/001_initial_schema.sql', () => {
      const memoryTarPath = path.join(tempPackDir, 'siduri-x-memory-1.0.2.tgz');
      const listing = execSync(`tar -tzf ${memoryTarPath}`, { encoding: 'utf8' });
      expect(listing).toContain('package/migrations/001_initial_schema.sql');
    });
  });

  describe('Phase 5B & 5C & 5G: Clean-Machine Installation & Isolation Acceptance', () => {
    const registry = OrganRegistry.discover([path.resolve(repoRoot, 'packages/organs')]);
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

      // Write instance files referencing packed tarballs directly for true clean machine install
      const pkgObj = JSON.parse(files['package.json']);
      pkgObj.dependencies = {
        '@siduri-x/core': `file:${path.join(tempPackDir, 'siduri-x-core-1.0.2.tgz')}`,
        '@siduri-x/brain': `file:${path.join(tempPackDir, 'siduri-x-brain-1.0.2.tgz')}`,
      };

      fs.writeFileSync(path.join(instanceDir, 'package.json'), JSON.stringify(pkgObj, null, 2) + '\n');
      fs.writeFileSync(path.join(instanceDir, 'siduri.config.json'), files['siduri.config.json']);
      fs.writeFileSync(path.join(instanceDir, 'siduri.schema.json'), files['siduri.schema.json']);
      fs.writeFileSync(path.join(instanceDir, '.env.example'), files['.env.example']);
      fs.writeFileSync(path.join(instanceDir, 'README.md'), files['README.md']);
      fs.writeFileSync(path.join(instanceDir, 'src/index.js'), files['src/index.js']);

      // 1. Run npm install in isolated directory
      execSync('npm install --no-audit --no-fund', { cwd: instanceDir, stdio: 'pipe' });

      // 2. Assert unselected organs are NOT in node_modules
      expect(fs.existsSync(path.join(instanceDir, 'node_modules/@siduri-x/memory'))).toBe(false);
      expect(fs.existsSync(path.join(instanceDir, 'node_modules/@siduri-x/hands'))).toBe(false);
      expect(fs.existsSync(path.join(instanceDir, 'node_modules/@siduri-x/voice'))).toBe(false);
      expect(fs.existsSync(path.join(instanceDir, 'siduri-x-runtime.js'))).toBe(false);

      // 3. Run node src/index.js (starts cleanly without PostgreSQL or unselected organs)
      const startOutput = execSync('node src/index.js', {
        cwd: instanceDir,
        env: { ...process.env, PORT: '0' },
        encoding: 'utf8',
      });
      expect(startOutput).toContain('✓ Siduri [CleanBrainOnly] initialized with [Brain].');

      // 4. Verify doctor from standalone directory
      const doctorPass = execSync(`node ${path.resolve(repoRoot, 'cli/dist/index.js')} doctor`, {
        cwd: instanceDir,
        env: { ...process.env, OPENROUTER_API_KEY: 'test-key-clean' },
        encoding: 'utf8',
      });
      expect(doctorPass).toContain('Result: PASS');
      expect(doctorPass).toContain('Database');
      expect(doctorPass).toContain('Not required by current composition');

      // 5. Verify db push from standalone directory
      const dbPushOutput = execSync(`node ${path.resolve(repoRoot, 'cli/dist/index.js')} db push`, {
        cwd: instanceDir,
        encoding: 'utf8',
      });
      expect(dbPushOutput).toContain('No database migrations are required by this instance.');
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
        '@siduri-x/core': `file:${path.join(tempPackDir, 'siduri-x-core-1.0.2.tgz')}`,
        '@siduri-x/brain': `file:${path.join(tempPackDir, 'siduri-x-brain-1.0.2.tgz')}`,
        '@siduri-x/hands': `file:${path.join(tempPackDir, 'siduri-x-hands-1.0.2.tgz')}`,
      };

      fs.writeFileSync(path.join(instanceDir, 'package.json'), JSON.stringify(pkgObj, null, 2) + '\n');
      fs.writeFileSync(path.join(instanceDir, 'siduri.config.json'), files['siduri.config.json']);
      fs.writeFileSync(path.join(instanceDir, 'siduri.schema.json'), files['siduri.schema.json']);
      fs.writeFileSync(path.join(instanceDir, '.env.example'), files['.env.example']);
      fs.writeFileSync(path.join(instanceDir, 'README.md'), files['README.md']);
      fs.writeFileSync(path.join(instanceDir, 'src/index.js'), files['src/index.js']);

      execSync('npm install --no-audit --no-fund', { cwd: instanceDir, stdio: 'pipe' });

      expect(fs.existsSync(path.join(instanceDir, 'node_modules/@siduri-x/memory'))).toBe(false);

      const startOutput = execSync('node src/index.js', {
        cwd: instanceDir,
        env: { ...process.env, PORT: '0' },
        encoding: 'utf8',
      });
      expect(startOutput).toContain('✓ Siduri [CleanBrainHands] initialized with [Brain, Hands].');

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

    test('Clean Composition 3: Brain + Memory discovers packaged migrations and detects DATABASE_URL', () => {
      const instanceDir = path.join(cleanMachineRoot, 'inst-brain-memory');
      fs.mkdirSync(path.join(instanceDir, 'src'), { recursive: true });

      const files = generateInstanceFiles({
        name: 'CleanBrainMemory',
        selectedManifests: [brain, memory],
      });

      const pkgObj = JSON.parse(files['package.json']);
      pkgObj.dependencies = {
        '@siduri-x/core': `file:${path.join(tempPackDir, 'siduri-x-core-1.0.2.tgz')}`,
        '@siduri-x/brain': `file:${path.join(tempPackDir, 'siduri-x-brain-1.0.2.tgz')}`,
        '@siduri-x/memory': `file:${path.join(tempPackDir, 'siduri-x-memory-1.0.2.tgz')}`,
      };

      fs.writeFileSync(path.join(instanceDir, 'package.json'), JSON.stringify(pkgObj, null, 2) + '\n');
      fs.writeFileSync(path.join(instanceDir, 'siduri.config.json'), files['siduri.config.json']);
      fs.writeFileSync(path.join(instanceDir, 'siduri.schema.json'), files['siduri.schema.json']);
      fs.writeFileSync(path.join(instanceDir, '.env.example'), files['.env.example']);
      fs.writeFileSync(path.join(instanceDir, 'README.md'), files['README.md']);
      fs.writeFileSync(path.join(instanceDir, 'src/index.js'), files['src/index.js']);

      execSync('npm install --no-audit --no-fund', { cwd: instanceDir, stdio: 'pipe' });

      // Verify migrations exist inside node_modules/@siduri-x/memory/migrations
      const installedMigrationsPath = path.join(instanceDir, 'node_modules/@siduri-x/memory/migrations/001_initial_schema.sql');
      expect(fs.existsSync(installedMigrationsPath)).toBe(true);

      // Doctor detects database requirement
      let doctorOutput = '';
      try {
        doctorOutput = execSync(`node ${path.resolve(repoRoot, 'cli/dist/index.js')} doctor`, {
          cwd: instanceDir,
          env: {
            ...process.env,
            OPENROUTER_API_KEY: 'test-key-clean',
            DATABASE_URL: '', // deliberately empty to test requirement detection
          },
          encoding: 'utf8',
        });
      } catch (err: any) {
        doctorOutput = (err.stdout || '') + (err.stderr || '');
      }
      expect(doctorOutput).toContain('DATABASE_URL is not configured');
      expect(doctorOutput).toContain('Result: FAIL');
    }, 60000);
  });
});
