const fs = require('node:fs');
const path = require('node:path');

const webOutDir = path.resolve(__dirname, '../../apps/web/out');
const cliWebDistDir = path.resolve(__dirname, '../dist/web-dist');

if (fs.existsSync(webOutDir)) {
  if (fs.existsSync(cliWebDistDir)) {
    fs.rmSync(cliWebDistDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(cliWebDistDir), { recursive: true });
  fs.cpSync(webOutDir, cliWebDistDir, { recursive: true });
  console.log(`✓ Copied apps/web/out to ${cliWebDistDir}`);
} else {
  console.warn(`! apps/web/out not found at ${webOutDir}. Skipping web-dist copy.`);
}
