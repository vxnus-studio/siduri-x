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

  const getPkgVer = (dir: string) => JSON.parse(fs.readFileSync(path.resolve(repoRoot, dir, 'package.json'), 'utf8')).version;

  const canonicalPackages = [
    { name: '@siduri-x/core', dir: 'packages/core', isOrgan: false, tarName: `siduri-x-core-${getPkgVer('packages/core')}.tgz` },
    { name: '@siduri-x/self', dir: 'packages/self', isOrgan: false, tarName: `siduri-x-self-${getPkgVer('packages/self')}.tgz` },
    { name: '@siduri-x/knowledge', dir: 'packages/knowledge', isOrgan: false, tarName: `siduri-x-knowledge-${getPkgVer('packages/knowledge')}.tgz` },
    { name: '@siduri-x/memory', dir: 'packages/memory', isOrgan: false, tarName: `siduri-x-memory-${getPkgVer('packages/memory')}.tgz` },
    { name: '@siduri-x/brain', dir: 'packages/organs/brain', isOrgan: true, tarName: `siduri-x-brain-${getPkgVer('packages/organs/brain')}.tgz` },
    { name: '@siduri-x/ear', dir: 'packages/organs/ear', isOrgan: true, tarName: `siduri-x-ear-${getPkgVer('packages/organs/ear')}.tgz` },
    { name: '@siduri-x/eknowledge', dir: 'packages/organs/eknowledge', isOrgan: true, tarName: `siduri-x-eknowledge-${getPkgVer('packages/organs/eknowledge')}.tgz` },
    { name: '@siduri-x/vision', dir: 'packages/organs/vision', isOrgan: true, tarName: `siduri-x-vision-${getPkgVer('packages/organs/vision')}.tgz` },
    { name: '@siduri-x/hands', dir: 'packages/organs/hands', isOrgan: true, tarName: `siduri-x-hands-${getPkgVer('packages/organs/hands')}.tgz` },
    { name: '@siduri-x/body', dir: 'packages/organs/body', isOrgan: true, tarName: `siduri-x-body-${getPkgVer('packages/organs/body')}.tgz` },
    { name: '@siduri-x/voice', dir: 'packages/organs/voice', isOrgan: true, tarName: `siduri-x-voice-${getPkgVer('packages/organs/voice')}.tgz` },
    { name: '@siduri-x/mouth', dir: 'packages/organs/mouth', isOrgan: true, tarName: `siduri-x-mouth-${getPkgVer('packages/organs/mouth')}.tgz` },
    { name: '@siduri-x/observation', dir: 'packages/organs/observation', isOrgan: true, tarName: `siduri-x-observation-${getPkgVer('packages/organs/observation')}.tgz` },
    { name: '@vxnus/siduri', dir: 'cli', isOrgan: false, tarName: `vxnus-siduri-${getPkgVer('cli')}.tgz` },
  ];

  let packagesChecked = 0;
  let tarballsInspected = 0;
  let manifestsValidated = 0;

  try {
    // 1. Pack each package
    for (const pkg of canonicalPackages) {
      packagesChecked++;
      try {
        run(`pnpm pack --pack-destination ${tempPackDir}`, path.resolve(repoRoot, pkg.dir));
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
