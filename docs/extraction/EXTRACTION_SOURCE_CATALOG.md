# Original Siduri extraction source catalog

Status: reference classification; implementation pending

The original `siduri/` repository contains both reusable behavior and one
personal deployment. This catalog prevents source confusion during extraction.

Scenario-level source references are indexed in
[`ORIGINAL-SOURCE-TRACEABILITY.md`](./ORIGINAL-SOURCE-TRACEABILITY.md).

## Classification rules

| Class | Meaning | Siduri-Y treatment |
| --- | --- | --- |
| Behavioral oracle | Defines a user-visible outcome or safety invariant | Extract the invariant, fields, and test outcome |
| Contract/schema source | Defines lifecycle, provenance, or event shape | Extract into neutral core contracts |
| Adapter/reliability source | Defines provider, persistence, or failure behavior | Extract boundary and failure semantics; keep provider values configurable |
| Personal deployment | Defines one person's identity, relationship, or private configuration | Do not copy values; use only to identify what must be configurable/learned |
| Domain fixture | Provides game/platform/provider sample data | Replace with neutral fixtures or an explicit extension |

## Behavioral and contract oracles

| Original source | Class | Extract |
| --- | --- | --- |
| `packages/persona/prompt.py` | Behavioral oracle | Trusted/system/context boundaries, neutral empty-memory prompt, untrusted-data rule |
| `packages/persona/behavior.py` | Behavioral oracle | Active Self filtering, lifecycle, priority, supersession, injection rejection |
| `packages/persona/domain.py` | Contract + adapter source | Disclosure decisions, sensitivity/audience checks, routing mechanics; not personal recipient values |
| `packages/memory/service.py` | Contract/schema source | Source events, claims, proposals, directives, revisions, retrieval, approval, audit |
| `packages/memory/teaching.py` | Behavioral oracle | Explicit teaching detection, bounded atomic candidates, provenance; not personal field defaults |
| `packages/memory/postgres.py` | Adapter/reliability source | Persistence, search, transaction, failure, and migration semantics |
| `apps/orchestrator/src/siduri_orchestrator/contracts.py` | Contract/schema source | Event envelope, response plan, evidence IDs, approval and serialization behavior |
| `docs/memory/TEACH_SIDURI.md` | Contract/policy source | Candidate lifecycle, authority, provenance, sensitivity, audiences, approval |
| `docs/memory/MEMORY_MODEL.md` | Contract/policy source | Proposal/canonical separation, active behavior, retrieval rules |
| `docs/memory/MEMORY_WRITE_POLICY.md` | Policy source | Untrusted inputs can create only pending proposals |
| `docs/memory/PUBLIC_DISCLOSURE_POLICY.md` | Policy source | Public/private disclosure and audience filtering |
| `docs/memory/SUPABASE_RUNTIME_RELIABILITY.md` | Adapter/reliability source | Connection failure, timeout, transaction, retry, and observability behavior |
| `docs/personality/RESPONSE_POLICY.md` | Behavioral oracle | Response structure, uncertainty, refusal, and approval semantics; remove personal values |
| `docs/personality/AUDIENCE_AND_RECIPIENTS.md` | Contract source | Channel/audience mechanics; replace personal recipient identifiers |

## Personal deployment sources

| Original source | Why it is personal | Siduri-Y rule |
| --- | --- | --- |
| `docs/personality/IDENTITY_CANON.md` | Defines a specific creator and local companion identity | Do not copy values; provide explicit companion configuration |
| `docs/personality/RELATIONSHIP_WITH_KUR.md` | Defines a named creator/Master relationship | Treat only as explicit-teaching/disclosure example |
| `packages/persona/domain.py::RelationshipPolicy` defaults | Contains personal name and titles | Remove from public defaults; extract policy mechanics only |
| `config/me.example.yaml` | Contains sample personal identity, interests, and relationship | Keep out of shared runtime/config; use neutral examples |
| `packages/persona/domain.py::Recipient` personal modes | Encodes one deployment's private/stream names | Replace with configured channel/audience identifiers |

## Domain and integration fixtures

| Original source family | Domain values to neutralize | Behavior still extractable |
| --- | --- | --- |
| `tests/test_chat.py` | Private titles, creator wording, game account values | Empty slate, teaching, pending candidates, knowledge suppression, history bounds |
| `tests/test_behavioral_memory.py` | Master/primary-user fixtures | Approval, audience filtering, supersession, disable, injection resistance, empty slate |
| `tests/test_phase2.py` | Personal recipient and game/provider labels | Revision, expiry, disclosure, prompt trust, provider failure |
| `tests/test_eteyvat.py` and `test_ocr_and_eteyvat_resolution.py` | Game/provider/entity names | Trusted source, citations, revisions, confidence, unresolved labels |
| `tests/test_observation*.py` | Game frame/source names | Redaction, duplicate suppression, expiry, bounds, raw-frame safety |
| `tests/test_phase4_voice.py` | Provider/speaker fixture values | Speaker discovery, fallback, priority, cancellation, amplitude safety |
| `tests/test_platforms.py` | Broadcaster/login/account fixture values | Normalization, signatures, OAuth state, encryption, rate limits, outbound approval |
| `tests/test_response_approval.py` | Personal stream recipient | Staged response, explicit approval, unknown approval rejection |

## Source-reading order

1. Read the behavioral and policy oracles.
2. Read the corresponding original tests.
3. Classify every value in the test as invariant, configuration, personal data,
   or domain fixture.
4. Define the neutral contract and blank-slate behavior.
5. Read the adapter/reliability source.
6. Implement only after the extraction change record and acceptance evidence are
   written.

## Forbidden extraction shortcut

Do not copy a Python enum, default dataclass value, prompt phrase, fixture
name, or sample configuration into Siduri-Y merely because it exists in the
original repository. First classify it using this catalog. Personal and domain
values require explicit configuration or extension boundaries; safety and
behavior invariants require neutral tests.

See [SIDURI_BEHAVIOR_EXTRACTION.md](./SIDURI_BEHAVIOR_EXTRACTION.md),
[LEGACY_IDENTIFIER_MIGRATION.md](./LEGACY_IDENTIFIER_MIGRATION.md), and
[EXTRACTION_CHANGE_RECORD_TEMPLATE.md](./EXTRACTION_CHANGE_RECORD_TEMPLATE.md).
