# Development

Status: Monorepo Development & Testing Workflow

Use Turborepo:
- `pnpm install`
- `pnpm build`
- Start API: `cd apps/api && pnpm start`
- Start Web: `cd apps/web && pnpm dev`

Before declaring a release ready, verify release invariants and test suites documented in
[`docs/release-status.md`](../release-status.md) and [`docs/architecture/testing.md`](./testing.md).


## CLI & Organ Releases

The CLI is published to npm as `siduri` (with `@vxnus/siduri` maintained as a compatibility alias). Peripheral organs and domain packages are published under the `@sidurijs/*` namespace.

Before publishing a release, ensure all packages are built, typechecked, and verified against release invariants:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm run release:check
pnpm run sync:check
git diff --check
```

To publish the entire monorepo workspace to npm (resolving all internal `workspace:*` dependencies cleanly):

```bash
pnpm publish -r --access public --no-git-checks
```

Or to publish a specific package (e.g. `siduri` CLI):

```bash
pnpm --filter siduri publish --access public --no-git-checks
```

Published package versions cannot be overwritten on npm. Always run `node scripts/sync-versions.mjs` after bumping versions to guarantee that `README.md`, Astro components, `organ-manifest.json` files, and `builtin-manifests.ts` remain synchronized with package sources of truth.
