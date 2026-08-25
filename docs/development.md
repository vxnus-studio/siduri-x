# Development

Status: Implemented

Use Turborepo:
- `pnpm install`
- `pnpm build`
- Start API: `cd apps/api && pnpm start`
- Start Web: `cd apps/web && pnpm dev`

## CLI release

The experimental CLI is published as `@vxnus/siduri`. Before publishing a
new version, run the checks from the repository root:

```bash
pnpm build
pnpm typecheck
pnpm test
git diff --check
```

Then inspect the package contents and publish from `cli/`:

```bash
cd cli
npm pack --dry-run
npm whoami
npm publish --access public
```

Scoped public releases require access to the `@vxnus` npm organization. A
published name/version cannot be reused, so increment the CLI version before
publishing a correction.
