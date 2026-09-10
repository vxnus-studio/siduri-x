#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isCheckMode = process.argv.includes('--check');

// 1. Read single source of truth (SSOT) from package.json files
function readJson(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

const cliPkg = readJson('cli/package.json');
const corePkg = readJson('packages/core/package.json');

const organNames = [
  'behavior',
  'body',
  'brain',
  'ear',
  'hands',
  'knowledge',
  'memory',
  'mouth',
  'observation',
  'vision',
  'voice'
];

const organPkgs = {};
for (const organ of organNames) {
  organPkgs[organ] = readJson(`packages/organs/${organ}/package.json`);
}

const allPackageVersions = {
  '@vxnus/siduri': cliPkg.version,
  '@siduri-x/core': corePkg.version,
  ...Object.fromEntries(organNames.map(name => [organPkgs[name].name, organPkgs[name].version]))
};

let hasDiff = false;

function updateFile(relativePath, transformFn) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return;

  const original = fs.readFileSync(fullPath, 'utf8');
  const updated = transformFn(original);

  if (original !== updated) {
    hasDiff = true;
    if (isCheckMode) {
      console.error(`❌ [OUT OF SYNC] ${relativePath}`);
    } else {
      fs.writeFileSync(fullPath, updated, 'utf8');
      console.log(`✅ [UPDATED] ${relativePath}`);
    }
  } else {
    console.log(`✓ [IN SYNC] ${relativePath}`);
  }
}

// 2. Sync README.md Canonical Packages Table
updateFile('README.md', (content) => {
  let res = content;
  for (const [pkgName, version] of Object.entries(allPackageVersions)) {
    if (pkgName === '@vxnus/siduri') continue;
    const regex = new RegExp(`(\\|\\s*\\*\\*\\\`${pkgName}\\\`\\*\\*\\s*\\|\\s*\`)\\^[0-9]+\\.[0-9]+\\.[0-9]+(\`\\s*\\|)`, 'g');
    res = res.replace(regex, `$1^${version}$2`);
  }
  return res;
});

// 3. Sync Navbar.astro
updateFile('apps/siduri-web-astro/src/components/Navbar.astro', (content) => {
  return content.replace(
    /<span>v[0-9]+\.[0-9]+\.[0-9]+ \(Testing\)<\/span>/g,
    `<span>v${cliPkg.version} (Testing)</span>`
  );
});

// 4. Sync Layout.astro
updateFile('apps/siduri-web-astro/src/layouts/Layout.astro', (content) => {
  return content.replace(
    /"softwareVersion": "[0-9]+\.[0-9]+\.[0-9]+(-[^"]*)?"/g,
    `"softwareVersion": "${cliPkg.version}-experimental"`
  );
});

// 5. Sync OrgansMatrix.astro
updateFile('apps/siduri-web-astro/src/components/OrgansMatrix.astro', (content) => {
  let res = content;
  for (const [pkgName, version] of Object.entries(allPackageVersions)) {
    if (pkgName === '@vxnus/siduri') continue;
    const regex = new RegExp(`(pkg:\\s*"${pkgName}",\\s*\\n\\s*version:\\s*")\\^[0-9]+\\.[0-9]+\\.[0-9]+(")`, 'g');
    res = res.replace(regex, `$1^${version}$2`);
  }
  return res;
});

if (isCheckMode && hasDiff) {
  console.error('\n🚨 Versions are out of sync with package.json! Run "pnpm run sync:versions" to fix.');
  process.exit(1);
} else {
  console.log('\n✨ All versions are synchronized with package.json SSOT.');
}
