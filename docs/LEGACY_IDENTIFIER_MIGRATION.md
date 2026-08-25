# Legacy identifier migration map

Status: removal policy; implementation pending

This document distinguishes values that must be removed from public defaults
from operational role names that may remain in an authentication migration
layer. The goal is not a blind text replacement: each identifier must be
replaced with the neutral contract that preserves the original behavior.

| Legacy identifier or pattern | Current use | Neutral replacement | Removal/retention rule | Required evidence |
| --- | --- | --- | --- | --- |
| `OWNER` / `VIEWER` / `OPERATOR` | Auth roles, chat scopes, behavior matchers | `AuthorizationRole` plus explicit `ConversationContext` | Retain only as auth compatibility inputs; remove from audience/subject semantics | Role cannot create relationship or bypass disclosure |
| `MASTER_PRIVATE` | Private audience default and fixtures | Configured `audience` under `channel: private` | Remove from public runtime, schema defaults, and ordinary fixtures; allow only migration tests/config | Public request cannot retrieve private claim |
| `primary_user` | Claim subject and teaching extractor | `SubjectRef` such as `actor:<opaque-id>` | Remove global subject from canonical contracts and production extraction | Fresh companion has no user subject until explicit teaching |
| `Primary User` | `/me` response | Actor metadata with optional learned profile | Remove hardcoded display value | `/me` does not invent a name |
| `creator` / `master` relationship | Teaching template and relationship claim | Explicit relationship value on an approved candidate | Never default; retain only when explicitly taught and policy permits | Empty-memory relationship question stays neutral |
| `primary_user.genshin.*` | Game-specific teaching parser | Configurable domain/profile subject supplied by an extension | Remove from core/public defaults; domain packs may define their own fields | Generic profile teaching remains atomic and pending |
| `default` companion ID | API bootstrap and web request payloads | Selected configured companion ID/discovery response | Keep only as isolated development bootstrap; remove from public client assumptions | Client operates against two configured companions without code changes |
| `Ganyu` / `Astra` | Isolation and brain test fixtures | `companion-a` / `companion-b` or generated IDs | Replace in ordinary tests/docs; retain only explicitly labeled historical migration fixtures | Scan finds no personal fixture names in canonical tests |
| `Ganyu` in prompt fixture | Brain prompt identity test | Neutral configured companion fixture | Replace with `Example Companion` or generated fixture | Prompt test verifies configuration injection, not persona identity |
| `ME_PROFILE` / personal config fields | Original deployment concept | Explicit companion configuration plus approved learned behavior | Do not port personal values; extract validation/disclosure mechanics only | Fresh config contains no user relationship |

## Migration order

1. Introduce neutral actor, channel, audience, and subject contracts.
2. Add one compatibility mapper for legacy request roles/scopes.
3. Make private audience explicit and reject `MASTER_PRIVATE` in public mode.
4. Replace global user subjects with actor-scoped subjects.
5. Remove personal teaching templates and replace them with neutral examples.
6. Make web/operator companion selection dynamic.
7. Rename ordinary fixtures and update their assertions to test isolation or
   configuration, not a personal character.
8. Run the forbidden-default scan and B0–B9 baseline.

## Forbidden-default scan

The following are forbidden in production defaults, generated configuration,
public UI copy, and canonical fixtures:

```text
MASTER_PRIVATE
primary_user
Primary User
Kur Zagin
Ganyu
Astra
"I am your creator"
```

The following may appear only in authentication compatibility code, migration
tests, or documentation that explicitly identifies them as legacy references:

```text
OWNER
VIEWER
OPERATOR
master
creator
default
```

The scan must be contextual. A documentation warning about a forbidden value
is not itself a violation; executable defaults and ordinary fixtures are.

The dated scan inventory, classifications, and recording template are in
[`FORBIDDEN-DEFAULT-SCAN-BASELINE.md`](./FORBIDDEN-DEFAULT-SCAN-BASELINE.md).

## Completion gate

This migration is complete only when every row has a neutral implementation,
an original-behavior regression test, a blank-slate negative test, and an
updated health audit. Text search alone cannot prove completion, but it must
not reveal forbidden values in unclassified production paths.
