const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['../apps/api/src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/runtime.js',
  external: ['express', 'cors', 'pg', 'ws', 'zod', '@vxnus/e', '@vxnus/e-knowledge'],
}).catch(() => process.exit(1));
