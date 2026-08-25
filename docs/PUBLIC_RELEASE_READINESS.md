# Public release readiness

Status: **not ready — RED health baseline**

This checklist is for releasing Siduri-Y as a public, blank-slate companion
framework. It is stricter than “the monorepo builds” and must be completed
before publishing a runtime or CLI release that claims public readiness.

## 1. Repository hygiene

- [x] The tracked default branch is `main`; no `master` branch is present in
  the current repository refs.
- [ ] All intended documentation changes are committed and pushed.
- [ ] No personal configuration, credentials, local paths, or private source
  data are included in the release artifact.
- [ ] Generated packages contain only intended public files.
- [ ] License, security, privacy, and support policies are current.

The branch check does not prove that legacy `master` identifiers are absent
from code. Those are covered by the legacy identifier migration and forbidden-
default scan.

## 2. Public blank-slate gate

- [ ] A fresh companion has no user name, relationship, preferred address,
  private history, interest, or account data.
- [ ] `/me` exposes actor/authentication metadata without inventing a user
  identity.
- [ ] `/chat` has explicit actor, channel, and audience context.
- [ ] Public is the neutral default; private and operator channels are
  explicit and policy-checked.
- [ ] No runtime or generated configuration defaults to `primary_user`,
  `MASTER_PRIVATE`, `Primary User`, creator, Master, or a personal title.
- [ ] Web and operator clients discover the configured companion instead of
  assuming `default`.

Evidence: [BLANK_SLATE_CONTRACT.md](./BLANK_SLATE_CONTRACT.md), B0, B2, B4,
B5, and B6 in [PHASE-0-EXTRACTION-BASELINE.md](./PHASE-0-EXTRACTION-BASELINE.md).
The immediate T1 boundary cases are listed in
[`T1-IMPLEMENTATION-CHECKLIST.md`](./T1-IMPLEMENTATION-CHECKLIST.md) and
their current proof status is tracked in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).

## 3. Extracted memory and behavior gate

- [ ] Every candidate has a source event, authority, sensitivity, audience,
  and lifecycle status.
- [ ] Model, OCR, observation, platform, and external knowledge inputs can
  create only pending candidates.
- [ ] Approval, rejection, session-only, supersession, revocation, and expiry
  are distinct and tested.
- [ ] Retrieval filters companion, status, validity, channel, audience,
  sensitivity, and relevance in that order.
- [ ] Active behavior is separate from learned user context.
- [ ] Corrections preserve history and provenance.
- [ ] Response approval is independent from memory approval.

Evidence: [SIDURI_EXTRACTION_MATRIX.md](./SIDURI_EXTRACTION_MATRIX.md) and
[NEUTRAL_CONTRACT_DECISIONS.md](./NEUTRAL_CONTRACT_DECISIONS.md).

## 4. Security and disclosure gate

- [ ] Public responses cannot receive private claims or private evidence.
- [ ] Authorization roles cannot bypass audience or sensitivity restrictions.
- [ ] Retrieved memory, knowledge, OCR, platform text, and quoted chat cannot
  modify system policy or identity.
- [ ] Provider failures cannot partially mutate memory or conversation state.
- [ ] Raw observation frames are redacted before provider access and are not
  persisted in public events.
- [ ] CORS, authentication, rate limits, and operator actions are tested in a
  production-like environment.

## 5. Verification gate

- [ ] `pnpm build` passes from a clean checkout.
- [ ] `pnpm typecheck` passes from a clean checkout.
- [ ] `pnpm test` passes from a clean checkout.
- [ ] B0–B9 pass through the relevant API/runtime boundary.
- [ ] At least one manual public chat walkthrough starts from empty memory.
- [ ] At least one manual private/operator walkthrough proves disclosure
  separation and approval behavior.
- [ ] The forbidden-default scan has no unclassified production hits.
- [ ] Documentation status, extraction matrix, health audit, and release
  checklist agree.

## Current blockers

The release is currently blocked by the RED findings in
[REPOSITORY_HEALTH_AUDIT.md](./REPOSITORY_HEALTH_AUDIT.md), especially:

1. forced private/owner chat routing;
2. `primary_user` and `MASTER_PRIVATE` runtime defaults;
3. hardcoded `Primary User` API identity;
4. hardcoded client companion IDs and creator teaching copy;
5. missing neutral core actor/channel/audience contracts.

Do not mark this checklist ready based on build or unit-test results alone.
The current test-boundary inventory is maintained in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
Security and operations gates are specified in
[`SECURITY-OPERATIONS-EXTRACTION-HANDOFF.md`](./SECURITY-OPERATIONS-EXTRACTION-HANDOFF.md).

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
