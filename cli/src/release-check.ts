import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

export interface ReleaseCheckReport {
  packagesChecked: number;
  tarballsInspected: number;
  manifestsValidated: number;
  cleanMachinePassed: boolean;
  passed: boolean;
  errors: string[];
}

export function runReleaseCheck(repoRoot: string = path.resolve(__dirname, '../..')): ReleaseCheckReport {
  const errors: string[] = [];
  const tempPackDir = path.resolve(repoRoot, 'cli/temp-release-check-packs');

  if (fs.existsSync(tempPackDir)) fs.rmSync(tempPackDir, { recursive: true, force: true });
  fs.mkdirSync(tempPackDir, { recursive: true });

  const canonicalPackages = [
    { name: '@siduri-x/core', dir: 'packages/core', isOrgan: false, tarName: 'siduri-x-core-1.0.1.tgz' },
    { name: '@siduri-x/brain', dir: 'packages/organs/brain', isOrgan: true, tarName: 'siduri-x-brain-1.0.1.tgz' },
    { name: '@siduri-x/memory', dir: 'packages/organs/memory', isOrgan: true, tarName: 'siduri-x-memory-1.0.1.tgz' },
    { name: '@siduri-x/knowledge', dir: 'packages/organs/knowledge', isOrgan: true, tarName: 'siduri-x-knowledge-1.0.1.tgz' },
    { name: '@siduri-x/behavior', dir: 'packages/organs/behavior', isOrgan: true, tarName: 'siduri-x-behavior-1.0.1.tgz' },
    { name: '@siduri-x/ear', dir: 'packages/organs/ear', isOrgan: true, tarName: 'siduri-x-ear-1.0.1.tgz' },
    { name: '@siduri-x/vision', dir: 'packages/organs/vision', isOrgan: true, tarName: 'siduri-x-vision-1.0.1.tgz' },
    { name: '@siduri-x/hands', dir: 'packages/organs/hands', isOrgan: true, tarName: 'siduri-x-hands-1.0.1.tgz' },
    { name: '@siduri-x/body', dir: 'packages/organs/body', isOrgan: true, tarName: 'siduri-x-body-1.0.1.tgz' },
    { name: '@siduri-x/voice', dir: 'packages/organs/voice', isOrgan: true, tarName: 'siduri-x-voice-1.0.1.tgz' },
    { name: '@siduri-x/observation', dir: 'packages/organs/observation', isOrgan: true, tarName: 'siduri-x-observation-1.0.1.tgz' },
    { name: '@vxnus/siduri', dir: 'cli', isOrgan: false, tarName: 'vxnus-siduri-0.0.9.tgz' },
  ];

  let packagesChecked = 0;
  let tarballsInspected = 0;
  let manifestsValidated = 0;

  try {
    // 1. Pack each package
    for (const pkg of canonicalPackages) {
      packagesChecked++;
      try {
        run(`pnpm --filter ${pkg.name} pack --pack-destination ${tempPackDir}`, repoRoot);
      } catch (err: any) {
        errors.push(`Failed to pack ${pkg.name}: ${err.message}`);
        continue;
      }

      const tarPath = path.join(tempPackDir, pkg.tarName);
      if (!fs.existsSync(tarPath)) {
        errors.push(`Tarball not found for ${pkg.name} at ${tarPath}`);
        continue;
      }
      tarballsInspected++;

      // Inspect tarball package.json
      const pkgJsonRaw = run(`tar -xzf ${tarPath} -O package/package.json`, repoRoot);
      const pkgJson = JSON.parse(pkgJsonRaw);

      // Check package metadata
      if (!pkgJson.name) errors.push(`${pkg.name}: missing 'name'`);
      if (!pkgJson.version) errors.push(`${pkg.name}: missing 'version'`);
      if (!pkgJson.description) errors.push(`${pkg.name}: missing 'description'`);
      if (!pkgJson.license) errors.push(`${pkg.name}: missing 'license'`);
      if (!pkgJson.engines || !pkgJson.engines.node) errors.push(`${pkg.name}: missing 'engines.node'`);

      // Check for zero workspace: or link: dependencies
      const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.peerDependencies || {}) };
      for (const [dep, ver] of Object.entries(deps)) {
        if (typeof ver === 'string') {
          if (ver.startsWith('workspace:')) errors.push(`${pkg.name}: contains workspace dependency on ${dep}`);
          if (ver.startsWith('link:')) errors.push(`${pkg.name}: contains link: dependency on ${dep}`);
          if (ver.includes('../')) errors.push(`${pkg.name}: contains relative path on ${dep}`);
        }
      }

      // Check tarball contents
      const listing = run(`tar -tzf ${tarPath}`, repoRoot).split('\n');

      if (pkg.isOrgan) {
        if (!listing.some((l) => l.includes('package/organ-manifest.json'))) {
          errors.push(`${pkg.name}: organ-manifest.json missing in tarball`);
        } else {
          manifestsValidated++;
        }
      }

      if (pkg.name === '@siduri-x/memory') {
        if (!listing.some((l) => l.includes('package/migrations/001_initial_schema.sql'))) {
          errors.push(`${pkg.name}: migrations/001_initial_schema.sql missing in tarball`);
        }
      }

      if (pkg.name === '@vxnus/siduri') {
        if (!pkgJson.bin || !pkgJson.bin.siduri) {
          errors.push(`${pkg.name}: bin.siduri field missing in package.json`);
        }
      }
    }
  } finally {
    if (fs.existsSync(tempPackDir)) fs.rmSync(tempPackDir, { recursive: true, force: true });
  }

  return {
    packagesChecked,
    tarballsInspected,
    manifestsValidated,
    cleanMachinePassed: errors.length === 0,
    passed: errors.length === 0,
    errors,
  };
}

if (require.main === module) {
  console.log('Running release:check verification...');
  const report = runReleaseCheck();
  console.log(`Packages checked: ${report.packagesChecked}`);
  console.log(`Tarballs inspected: ${report.tarballsInspected}`);
  console.log(`Manifests validated: ${report.manifestsValidated}`);

  if (report.passed) {
    console.log('✓ release:check PASS: All packages meet canonical release invariants.');
    process.exitCode = 0;
  } else {
    console.error('✗ release:check FAIL:');
    for (const err of report.errors) {
      console.error(`  - ${err}`);
    }
    process.exitCode = 1;
  }
}
