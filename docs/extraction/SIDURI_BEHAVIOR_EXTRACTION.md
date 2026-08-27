# Siduri behavior and memory extraction

Status: authoritative extraction boundary

## Purpose

Siduri-Y extracts the original `siduri/` experience as reusable contracts and
behavioral invariants. It does not copy the original project's personal
identity, relationship, configuration, or game-specific data.

The original repository is the behavioral oracle. Siduri-Y is the public,
provider-neutral implementation of that oracle.

## Two things that must remain separate

| Extract into Siduri-Y | Keep out of Siduri-Y defaults |
| --- | --- |
| Blank-slate behavior | Kur Zagin's identity |
| Neutral responses without approved personal memory | Master/creator relationship |
| Source-event and provenance requirements | `MASTER_PRIVATE` recipient names |
| Pending → approved/rejected memory lifecycle | Ganyu, Astra, or other personal fixtures |
| Audience and sensitivity enforcement | Personal addresses and interests |
| Supersession, expiry, revocation, and audit history | Genshin account/profile assumptions |
| Prompt-injection and untrusted-context boundaries | Repository-local personal configuration |
| Bounded history, response plans, citations, and safe failure | Any predeclared user name or relationship |

Personal values may exist only in an explicitly supplied companion
configuration or an explicitly taught, provenance-backed candidate. They must
never be inferred from source code, fixtures, repository assets, model output,
OCR, platform text, or external knowledge.

## Extraction inventory

The following original sources define behavior to extract, not identity to
copy:

| Concern | Original reference | Siduri-Y destination |
| --- | --- | --- |
| Blank-slate prompt rules | `siduri/tests/test_chat.py`, `siduri/packages/persona/prompt.py` | `@siduri-x/brain` prompt contract and regression tests |
| Chat routing and history bounds | `siduri/apps/chat/`, `siduri/apps/orchestrator/` | runtime channel/audience contract |
| Claim lifecycle | `siduri/docs/memory/TEACH_SIDURI.md`, `siduri/packages/memory/` | `@siduri-x/core` and memory organ |
| Candidate approval boundary | `siduri/docs/memory/MEMORY_MODEL.md` | memory and operator contracts |
| Provenance and evidence | `siduri/docs/memory/TEACH_SIDURI.md` | source events, claims, citations, response metadata |
| Active behavior compilation | `siduri/packages/persona/behavior.py` | behavior organ |
| Knowledge safety boundary | `siduri/apps/orchestrator/src/...` and knowledge docs | knowledge organ and prompt assembly |
| Observation grounding | original vision/observation flow | observation → grounding → approval pipeline |

The extraction work is complete only when each row has a neutral contract, an
implementation, and a behavior test tied to the original reference.

The detailed working inventory is maintained in
[`SIDURI_EXTRACTION_MATRIX.md`](./SIDURI_EXTRACTION_MATRIX.md).
The neutral contract decisions are recorded in
[`NEUTRAL_CONTRACT_DECISIONS.md`](./NEUTRAL_CONTRACT_DECISIONS.md).
The implementation handoff for those decisions is
[`PHASE-1-EXTRACTION-HANDOFF.md`](./PHASE-1-EXTRACTION-HANDOFF.md).
The current health baseline is
[`REPOSITORY_HEALTH_AUDIT.md`](./REPOSITORY_HEALTH_AUDIT.md).
Future extraction changes must use
[`EXTRACTION_CHANGE_RECORD_TEMPLATE.md`](./EXTRACTION_CHANGE_RECORD_TEMPLATE.md).
The original source classification is maintained in
[`EXTRACTION_SOURCE_CATALOG.md`](./EXTRACTION_SOURCE_CATALOG.md).

## Canonical blank-slate invariants

Every new Siduri-Y companion must satisfy these before any personality or
memory is configured:

1. No user name, preferred address, creator relationship, or private profile
   exists in initial memory.
2. Empty memory produces neutral language and no claim of prior personal
   knowledge.
3. User statements, model output, OCR, observations, platform text, and
   external knowledge can create only pending candidates.
4. Only an authorized approval action can make a candidate canonical or active.
5. Retrieved memory is filtered by companion, audience, sensitivity, status,
   and validity before prompt assembly.
6. Public responses never receive private evidence or private memory.
7. Routing metadata never establishes identity, relationship, title, or form of
   address.
8. Failed providers cannot partially mutate memory or conversation state.

## Required extraction order

1. Define neutral companion, actor, channel, audience, and sensitivity
   contracts. Do not overload an authentication role as a conversational
   relationship.
2. Extract the source-event, candidate, approval, revision, and audit model.
3. Extract blank-slate prompt assembly and retrieval gates.
4. Extract private/public chat behavior as configurable channels, without
   making private chat the default public API behavior.
5. Extract active behavior compilation and scope checks.
6. Extract evidence-linked knowledge and observation response flow.
7. Replace personal fixtures and stale parity claims with neutral fixtures and
   evidence-backed status documents.

## Completion gate

Do not describe Siduri-Y as parity-complete while any production path contains
personal defaults or while blank-slate behavior lacks a regression test. Build
and typecheck success is necessary, but it is not evidence of behavioral
parity.
