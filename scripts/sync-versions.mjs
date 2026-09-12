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
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

const packagePaths = [
  'cli/package.json',
  'packages/core/package.json',
  'packages/self/package.json',
  'packages/knowledge/package.json',
  'packages/memory/package.json',
  'packages/organs/body/package.json',
  'packages/organs/brain/package.json',
  'packages/organs/ear/package.json',
  'packages/organs/eknowledge/package.json',
  'packages/organs/hands/package.json',
  'packages/organs/mouth/package.json',
  'packages/organs/observation/package.json',
  'packages/organs/vision/package.json',
  'packages/organs/voice/package.json',
  'apps/api/package.json'
];

const allPackageVersions = {};
for (const rel of packagePaths) {
  const pkg = readJson(rel);
  if (pkg && pkg.name && pkg.version) {
    allPackageVersions[pkg.name] = pkg.version;
  }
}

const cliVer = allPackageVersions['@vxnus/siduri'] || '2.0.0';
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
    `<span>v${cliVer} (Testing)</span>`
  );
});

// 4. Sync Layout.astro
updateFile('apps/siduri-web-astro/src/layouts/Layout.astro', (content) => {
  return content.replace(
    /"softwareVersion": "[0-9]+\.[0-9]+\.[0-9]+(-[^"]*)?"/g,
    `"softwareVersion": "${cliVer}-experimental"`
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

// 6. Sync CLI_VERSION in cli/src/index.ts
updateFile('cli/src/index.ts', (content) => {
  return content.replace(
    /export const CLI_VERSION = '[0-9]+\.[0-9]+\.[0-9]+';/g,
    `export const CLI_VERSION = '${cliVer}';`
  );
});

if (isCheckMode && hasDiff) {
  console.error('\nDocumentation or metadata versions are out of sync with package.json.');
  console.error('Run "pnpm run sync:versions" to update them.');
  process.exit(1);
} else if (!isCheckMode && hasDiff) {
  console.log('\nAll version references successfully synchronized to package.json sources of truth.');
} else {
  console.log('\nAll version references already in sync.');
}
