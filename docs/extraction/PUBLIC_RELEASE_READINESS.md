# Public release readiness

Status: **RELEASE READY WITH EXPLICIT LIMITATIONS** (Verified commit: `06823ac2de61a5d8923f4072fe221bf943ea4aa4`)
Historical Status: RED health baseline (superseded following extraction completion, T1–T7 contracts, and zero-trust verification)

This checklist tracks the readiness criteria for releasing Siduri as a standalone,
single-owner local companion runtime and generator CLI.

## 1. Repository hygiene

- [x] The tracked default branch is `main`; no `master` branch is present in
  the current repository refs.
- [x] All intended documentation changes are committed and pushed.
- [x] No personal configuration, credentials, local paths, or private source
  data are included in the release artifact.
- [x] Generated packages contain only intended public files (`release:check` passes).
- [x] License, security, privacy, and support policies are current (Apache-2.0).

## 2. Public blank-slate gate

- [x] A fresh companion has no user name, relationship, preferred address,
  private history, interest, or account data (Verified in `apps/api/src/b0-b6.test.ts`).
- [x] `/me` exposes actor/authentication metadata without inventing a user
  identity (Verified in `apps/api/src/t7-release.test.ts`).
- [x] `/chat` has explicit actor, channel, and audience context via `mapRequestContext`.
- [x] Public is the neutral default; private and operator channels are
  explicit and policy-checked.
- [x] No runtime or generated configuration defaults to `primary_user`,
  `MASTER_PRIVATE`, `Primary User`, creator, Master, or a personal title.
- [x] Web and operator clients discover the configured companion instead of
  hardcoding assumptions.

Evidence: [BLANK_SLATE_CONTRACT.md](./BLANK_SLATE_CONTRACT.md), B0–B6 in
`apps/api/src/b0-b6.test.ts`, and `apps/api/src/t7-release.test.ts`.

## 3. Extracted memory and behavior gate

- [x] Every candidate has a source event, authority, sensitivity, audience,
  and lifecycle status.
- [x] Model, OCR, observation, platform, and external knowledge inputs can
  create only pending candidates.
- [x] Approval, rejection, session-only, supersession, revocation, and expiry
  are distinct and tested.
- [x] Retrieval filters companion, status, validity, channel, audience,
  sensitivity, and relevance in that order.
- [x] Active behavior is separate from learned user context.
- [x] Corrections preserve history and provenance.
- [x] Response approval is independent from memory approval.

Evidence: [SIDURI_EXTRACTION_MATRIX.md](./SIDURI_EXTRACTION_MATRIX.md),
[NEUTRAL_CONTRACT_DECISIONS.md](./NEUTRAL_CONTRACT_DECISIONS.md), and
`packages/organs/memory/src/index.test.ts`.

## 4. Security and disclosure gate

- [x] Public responses cannot receive private claims or private evidence.
- [x] Authorization roles cannot bypass audience or sensitivity restrictions.
- [x] Retrieved memory, knowledge, OCR, platform text, and quoted chat cannot
  modify system policy or identity.
- [x] Provider failures cannot partially mutate memory or conversation state.
- [x] Raw observation frames are redacted before provider access and are not
  persisted in public events.
- [x] CORS, authentication, rate limits, and operator actions are tested in a
  production-like environment (`apps/api/src/t6-security.test.ts`).

## 5. Verification gate

- [x] `pnpm build` passes from a clean checkout.
- [x] `pnpm typecheck` passes from a clean checkout.
- [x] `pnpm test` passes from a clean checkout (27/27 suites green).
- [x] B0–B6 pass through the relevant API/runtime boundary.
- [x] Clean machine packaging E2E verification passes (`clean-machine-e2e.test.ts`).
- [x] `npm run release:check` passes (12/12 packages verified).
- [x] The forbidden-default scan has no unclassified production hits.
- [x] Documentation status, extraction matrix, health audit, and release
  checklist agree.

## Resolution of Historical Blockers

The former release blockers recorded during extraction in `REPOSITORY_HEALTH_AUDIT.md` have been resolved as follows:

1. **Forced private/owner chat routing**: Resolved — `mapRequestContext` assigns neutral public channel/audience defaults unless authentic owner/operator identity is supplied.
2. **`primary_user` and `MASTER_PRIVATE` runtime defaults**: Resolved — eliminated from canonical runtime and organ schemas.
3. **Hardcoded `Primary User` API identity**: Resolved — `/me` returns `anonymous-session` with role `VIEWER` when unauthenticated.
4. **Missing neutral core actor/channel/audience contracts**: Resolved — canonical `RequestContext` and `mapRequestContext` implemented in `@siduri-x/core` and `apps/api`.
5. **Memory immutability bypasses**: Resolved — `updateClaim` refuses in-place mutation of `APPROVED` claims, generating `PENDING` revisions with `supersedes` links.

Candidate-commit evidence and release sign-off are governed by
[`T7-RELEASE-EVIDENCE-CONTRACT.md`](./T7-RELEASE-EVIDENCE-CONTRACT.md).

## Repeatable verification commands

Run these from the repository root on the candidate release commit:

```bash
git branch --show-current
git show-ref | rg -i 'refs/(heads|remotes/.+)/master' || true
git diff --check

rg -n -i \
  'MASTER_PRIVATE|primary_user|Primary User|Kur Zagin|Ganyu|Astra|I am your creator' \
  apps packages cli --glob '!**/node_modules/**'

pnpm build
pnpm typecheck
pnpm test
```

Interpretation:

- the active release branch must be the approved default branch and the
  forbidden branch-ref query must produce no result;
- the forbidden-default scan must produce no unclassified production hit;
- `git diff --check` must pass;
- build, typecheck, and tests are necessary but cannot close the blank-slate or
  parity gates without the B0–B9 runtime evidence;
- a clean command result must be recorded with the commit and environment.

The current repository is expected to fail the production forbidden-default
scan and runtime health gates until the Phase 1 extraction work is
implemented.
