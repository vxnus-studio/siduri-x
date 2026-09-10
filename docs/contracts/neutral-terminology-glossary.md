# Neutral terminology glossary

Status: canonical vocabulary for extraction review

Use these terms consistently in contracts, code reviews, tests, and incident
reports. A term is not neutral merely because its spelling changed; its
semantic responsibility must also remain separate.

## Canonical terms

| Term | Meaning | Does not mean |
| --- | --- | --- |
| Actor | Caller or source participant identified by an opaque actor/session reference | A known person, relationship, or profile |
| Authorization role | Relationship/permission class (owner/operator) used to authorize operations | Subject, creator, or unrestricted authority |
| Capability | Explicit permission for one operation in one scope | Permanent identity or unrestricted authority |
| Channel | Interaction mode such as direct (owner) or operator | Person who is speaking |
| Audience | Deprecated concept from multi-audience model; in single-owner deployments, the owner is the implicit recipient | Authentication role or relationship |
| Subject | Explicit target of a claim, directive, or profile fact | Implicit “main user” inferred from a route or token |
| Companion | Isolated runtime/configuration instance | A person or the original personal deployment |
| Source event | Immutable input/provenance envelope | Confirmed truth or approval |
| Claim proposal | Pending candidate fact about an explicit subject | Active memory before approval |
| Behavioral proposal | Pending candidate rule for companion behavior | Active self or system policy before approval |
| Active Self | Approved, scoped behavior projection | User profile or fixed personal persona |
| Evidence | Bounded, cited context with source/trust/expiry metadata | Memory, identity, instruction, or permission |
| Response plan | Staged candidate response with evidence and approval policy | Emitted speech or approved memory |
| Approval | Explicit decision scoped to a record, companion, and capability | Automatic model confidence |
| Disclosure | Policy decision about what data may be retrieved or emitted | Mere authentication success |
| Session-only | Non-durable context that expires with its session | Hidden permanent memory |
| Neutral default | Configured public-safe behavior with no personal relationship assumptions | “No configuration” or a private fallback |

## Terms requiring contextual qualification

### “Private”

Use `private channel`, `private audience`, or `private sensitivity` when that is
what is meant. Do not use “private user” as an identity category. Privacy is a
disclosure policy, not proof of a relationship.

### “Scope”

Prefer the precise term: `authorization scope`, `subject scope`, `audience
scope`, `channel scope`, or `validity window`. A bare `scope` field must not
silently combine these dimensions.

### “Owner”

The canonical term for the primary user relationship in single-owner deployments.
In multi-companion deployments, each companion has one owner. In external resource
contexts, refers to the configured resource owner.

### “Default”

Name what is default: `configured companion`, `development bootstrap`, or
`selected persona`. A bare default must not hide a personal/private value.

### “Identity”

Distinguish `companion identity/configuration`, `actor authentication metadata`,
and `learned subject profile`. An authentication token does not supply learned
identity.

## Legacy terms

These values may appear in a migration boundary or explicitly labeled legacy
test, but must not be canonical public semantics:

```text
OWNER / VIEWER / OPERATOR  -> authorization compatibility inputs only (migrated to owner/operator)
MASTER_PRIVATE             -> legacy private-audience marker only
audience-*                 -> legacy multi-audience tiers; single-owner uses direct channel
allowed_audiences          -> deprecated database column/field, dropped in single-owner model
primary_user               -> rejected global subject; actor-scoped mapping only
Primary User               -> forbidden invented profile fallback
master / creator           -> explicit taught relationship value only
default                    -> development bootstrap only, never public discovery
```

The full identifier mapping and scan policy are in
[`LEGACY_IDENTIFIER_MIGRATION.md`](./legacy-identifier-migration.md) and
[`FORBIDDEN-DEFAULT-SCAN-BASELINE.md`](./forbidden-default-scan-baseline.md).

## Review questions

For every new field, endpoint, event, or test, ask:

1. Is this describing who may act, where data is visible, or whose fact is
   represented? If more than one, split it.
2. Is the value configured, explicitly taught, or inferred? Inference cannot
   create identity, approval, or durable memory without policy.
3. Is the value public-safe by default? If not, require explicit channel,
   audience, sensitivity, and capability.
4. Is the value current canonical state, pending proposal, evidence, or audit
   history? Do not collapse lifecycle states.
5. Can a neutral fixture express the behavior without a personal name, title,
   account, or relationship? If not, the contract is probably overloaded.

Terminology review complements implementation tests; consistent words do not
prove runtime behavior. Evidence remains governed by the readiness board and
release contracts.
