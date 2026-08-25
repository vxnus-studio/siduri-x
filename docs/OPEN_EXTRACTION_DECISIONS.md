# Open extraction decisions

Status: implementation decisions required; safe proposals recorded

These questions are intentionally visible because an implicit answer in the
runtime can recreate the personal/private model we are removing. Until each
decision is accepted, use the proposed safe behavior and do not add a new
default.

| ID | Decision needed | Proposed safe decision | Owner phase | Acceptance impact |
| --- | --- | --- | --- | --- |
| D1 | How is an anonymous public actor represented? | Use an opaque session/actor identifier with no learned identity by default; do not persist cross-session memory without explicit account/consent policy | P1/P2 | B0, B2, and fresh-companion tests |
| D2 | What is the default audience when a public request omits one? | Use the companion's configured `public` audience; never infer private/operator audience from auth role | P1 | B5 and public retrieval test |
| D3 | How is a private channel authorized? | Require explicit channel selection plus an authorization capability; capability does not establish relationship or subject identity | P1/P4 | Private disclosure and role-separation tests |
| D4 | What subject receives an explicit user fact? | Use `actor:<opaque-actor-id>` or an explicitly configured subject; never a global `primary_user` | P1/P2 | Teaching and correction tests |
| D5 | Can an installation define shared user/profile subjects? | Yes, only through explicit configuration with documented audience and retention policy | P1 | Configuration and isolation tests |
| D6 | What replaces the development `default` companion? | Keep it only in an explicitly development-only bootstrap; clients use discovery/configuration and never assume the ID | P2 | Two-companion client test |
| D7 | When may a response be public? | Public output requires a public-safe response plan and permitted evidence; grounded/uncertain output may remain staged for approval | P4/P6 | Response approval and observation tests |
| D8 | Does memory approval imply behavior approval? | No; claim approval and directive approval are separate decisions and audit events | P2/P5 | B3/B4 and behavior lifecycle tests |
| D9 | How are domain-specific fields added? | Domain/knowledge extensions provide schemas and subjects; the core extractor must not embed a game or personal domain | P1/P6 | Generic profile teaching test |
| D10 | What legacy values are accepted during migration? | Accept only at one compatibility boundary, map explicitly, emit ambiguity/errors, and reject personal audiences in public mode | P1/P2 | Legacy migration and forbidden-default scan |
| D11 | What is the retention policy for anonymous teaching? | Candidate remains pending and actor/session scoped until explicit approval and consent policy; no silent durable profile | P2 | Source-event, approval, and expiry tests |
| D12 | What does `/me` mean in a public runtime? | Return actor capability/session metadata and optional approved profile fields; return no invented display name | P2/P4 | `/me` blank-slate API test |

## Decision protocol

For each ID:

1. record the accepted decision and rationale in the relevant contract doc;
2. add or update the extraction change record;
3. map the decision to an original behavior or safety test;
4. implement it at the neutral contract boundary;
5. run the affected B0–B9 scenarios;
6. update the health audit and release checklist.

An implementation must not silently close an open decision by choosing the
legacy behavior. If a proposed decision changes an original user-visible
outcome, document that deliberate contract change and its privacy impact.

## Current status

No decision in this register is evidence that the current runtime satisfies the
proposal. The register is a guardrail for the next implementation phase.
