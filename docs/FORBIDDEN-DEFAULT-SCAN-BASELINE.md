# Forbidden-default scan baseline

Status: **failing as expected — baseline recorded 2026-08-25**

This document records the current scan procedure and classified findings for
the public blank-slate audit. It is a regression baseline, not permission to
retain the findings. A future scan may remove a finding only when the neutral
replacement and boundary evidence are present.

## Scan command

Run from the repository root:

```bash
rg -n -i \
  'MASTER_PRIVATE|primary_user|Primary User|Kur Zagin|Ganyu|Astra|I am your creator' \
  apps packages cli --glob '!**/node_modules/**'
```

Also scan legacy role/default patterns with contextual review:

```bash
rg -n -i \
  'OWNER|VIEWER|OPERATOR|master|creator|default' \
  apps packages cli --glob '!**/node_modules/**'
```

The first command should eventually return no unclassified production or
canonical-fixture hits. The second command will continue to find legitimate
compatibility, framework, and development references; every result requires
classification.

## Current classified findings

| Classification | Paths/patterns | Current disposition | Closure evidence |
| --- | --- | --- | --- |
| Production personal subject/audience | `apps/api/src/runtime.ts`: `primary_user`, `MASTER_PRIVATE`, creator teaching, private prompt | **Open H1**; must be replaced by actor-scoped subject and configured audience | T1/T2 runtime tests and clean production scan |
| Production invented identity | `apps/api/src/index.ts`: `Primary User` from `/me` | **Open H1**; return actor/auth metadata without personal fallback | Blank `/me` API test |
| Production private route | `apps/api/src/index.ts`: `/chat` forces `OWNER` | **Open H1**; route explicit neutral context | T1 route test and B0/B5/B6 evidence |
| Canonical memory display aliases | `apps/web/src/lib/memory-display.ts`: `primary_user`, `master`, `master_private` | **Open H2**; display neutral subject/audience labels | UI fixture test and classified scan |
| Client companion assumption | `apps/web/src/app/chat/chat-client.tsx`, `operator-client.tsx`: `default` | **Open H2**; resolve companion configuration/discovery | Two-companion client integration test |
| Personal UI teaching copy | `apps/web/src/app/chat/chat-client.tsx`: creator template | **Open H2**; replace with neutral teaching examples | Public UI review and fixture scan |
| Personal test fixtures | `apps/api/src/smoke.test.ts`, memory/brain/behavior tests | **Open H2** unless explicitly migration-labelled | Neutral fixture replacements and isolation assertions |
| Compatibility roles | `apps/api/src/auth.ts`, legacy organ signatures | Allowed only at one mapper boundary | T1 mapper test and no duplicated mapping search |
| Development bootstrap `default` | API/memory-service/CLI bootstrap paths | Temporary exception only; no public client assumption | Explicit development profile plus dynamic discovery evidence |
| Generic framework defaults | dependency/config templates and CSS/framework docs | Review individually; not necessarily personal | Classification recorded if shipped |

## Classification rules

### Failing hit

A hit is failing when it appears in production behavior, generated public
configuration, public UI copy, canonical neutral fixtures, or a schema/default
that can create personal identity, relationship, audience, or private scope.

### Allowed legacy hit

A hit may remain only when it is in a compatibility mapper, explicitly named
migration/regression fixture, or documentation that explains the legacy value.
The code path must not make it canonical, and the test must assert migration or
rejection behavior rather than rely on the value as a default.

### Unclassified hit

An unclassified hit blocks release. “It is only a test” or “it is only a
default” is not a classification; the reviewer must state whether it exercises
neutral behavior, migration rejection, development bootstrap, or personal
behavior.

## Scan record template

```text
Commit:
Date:
Command:
Environment:
Forbidden-value hits:
Legacy-pattern hits:
Production hits:
Canonical-fixture hits:
Migration-only hits:
Unclassified hits:
Reviewer:
Disposition: PASS | FAIL
```

## Release rule

The scan is a necessary but insufficient gate. A clean search cannot prove
behavioral parity, and a green test suite cannot waive an unclassified scan
hit. Release requires this scan to be `PASS` together with the T0–T7 evidence
gates in [`T7-RELEASE-EVIDENCE-CONTRACT.md`](./T7-RELEASE-EVIDENCE-CONTRACT.md).
