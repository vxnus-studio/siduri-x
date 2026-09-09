# Canonical Release Status: Siduri-X

**Release Decision**: **RELEASE WITH EXPLICIT LIMITATIONS**  
**Current Verified Commit**: `06823ac2de61a5d8923f4072fe221bf943ea4aa4`  
**Branch**: `main`  
**Product Architecture**: **Single-owner / Single-machine / Local companion / Localhost-only**  

---

## 1. Verified Release Invariants

All core security, reliability, and architectural properties have been independently verified through source code AST analysis, adversarial suites, and clean-machine distribution packaging:

1. **Localhost-Only Ingress (P0)**:
   All listeners (`apps/api`, `apps/gateway`, `apps/memory-service`, and `cli/src/generator.ts` companion template) explicitly bind to `127.0.0.1`. No listener defaults to `0.0.0.0` or dual-stack broadcast.
2. **Production `/dev/*` Isolation (P0)**:
   Routes under `/dev/*` are conditionally mounted only when `process.env.NODE_ENV !== 'production' || process.env.SIDURI_DEV_MODE === 'true'`. In production, the router table does not contain these endpoints (HTTP 404).
3. **Static Path Traversal Defenses (P0)**:
   Decoded path traversal attacks (`../`, `%2e%2e%2f`, `%252e%252e%252f`, null bytes, backslashes, outside symlinks) are strictly rejected by the generator's path containment check (`path.relative(root, target)`).
4. **Approved Memory Immutability (P0)**:
   `PostgresMemoryOrgan.updateClaim` refuses in-place mutation of `APPROVED` claims. Any update generates a new `PENDING` replacement claim linked to the predecessor via `supersedes`. The approved original remains authoritative until explicit approval of the revision.
5. **Brain Global Wall-Clock Deadline (P1)**:
   Overall deadline is governed by a global `AbortController` timer spanning all retry attempts. In-flight `fetch` calls abort immediately upon deadline expiry; retries cannot extend execution indefinitely.
6. **Voice Response Byte Bounding (P1)**:
   `readBoundedResponseBody` enforces size ceilings on both `Content-Length` headers and incremental streaming chunks via `reader.cancel()`, preventing unbounded memory buffering.
7. **Durable Action Approval & Restart (P1)**:
   `ActionPolicyEngine` and `ActionStore` cryptographically sign capabilities and record approvals durably. Restarting the engine preserves approval validity without duplicate execution.
8. **Idempotency & Concurrency Safety (P1)**:
   Two-phase reservation prevents concurrent duplicate execution; replaying a completed execution returns the cached result without re-invoking the tool handler.
9. **Tamper-Evident Audit Chaining (P1)**:
   Audit events separate `previousEventHash`, `eventHash`, and `resultHash` into a SHA-256 hash chain over canonicalized payloads.
10. **Clean Distribution Packaging**:
    `npm run release:check` passes on all 12 canonical packages. Zero `workspace:` or `link:` references leak into distribution tarballs. Clean-machine E2E test passes in isolation.

---

## 2. Explicit Product Limitations

The following properties represent intentional architectural boundaries for Siduri's single-owner local model:

- **Local Trust Boundary**:
  Siduri does not implement multi-tenant authentication, public identity federation (OAuth2/OIDC), or tenant isolation. Authentication relies on server-verified local tokens (`OWNER_TOKEN`, `OPERATOR_TOKEN`) or development environment defaults.
- **Localhost-Only Deployment**:
  Siduri is designed to operate on the user's local workstation. Remote ingress is unsupported.
- **Platform Ingestion Stubs**:
  Streaming platform routes (`/platforms/*`) return truthful HTTP `501 Not Implemented`. Local companion operation is self-contained without external platform dependencies.
- **ActionStore Durability Scope**:
  `InMemoryActionStore` is the default in-memory implementation. Deployments requiring action approvals to survive host machine reboots must configure persistent storage (e.g. `PostgresActionStore`).
- **Web Client Lint Warnings**:
  The Next.js web application (`apps/web`) exports clean static artifacts for the CLI companion UI, but standalone ESLint reports non-blocking warnings concerning React 19 synchronous effect state setters and WebGL loader types.

---

## 3. Configuration Contract & Production Requirements

- `ACTION_POLICY_SECRET`: **Mandatory in production** (`NODE_ENV=production`). If unset, the Action Policy Engine and Hands organ fail closed immediately at startup.
- `DATABASE_URL`: Required for PostgreSQL memory persistence (`postgresql://...`).
- `PORT`: Defaults to `3001` (API), `3000` (Gateway / CLI Companion), `3002` (Memory Service).
- Host Binding: All listeners strictly bind to `127.0.0.1`.

---

## 4. Reproducible Release Verification Commands

```bash
# 1. Typecheck all packages
pnpm run typecheck

# 2. Build monorepo packages and web static distribution
npm run build

# 3. Full fresh test suite (27 suites across all organs and packages)
npm test -- --force

# 4. Packaging and distribution integrity check (12 packages inspected)
npm run release:check

# 5. Clean-machine packaging end-to-end verification
pnpm --filter @vxnus/siduri test src/clean-machine-e2e.test.ts
```
