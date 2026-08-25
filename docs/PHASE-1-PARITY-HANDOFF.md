# Siduri-Y Parity Handoff: Memory, Chat, and Voice Slice

Status: implemented and pushed

Commits:

- `c0515fd6` — memory/chat parity slice
- `ad4f1fe4` — deterministic teaching and claim lifecycle

## Implemented behavior

Siduri-Y now preserves the first part of the original Siduri experience while
keeping the organs decoupled:

- private chat accepts bounded user/assistant history;
- private chat uses the primary-user scope;
- identity questions and explicit teaching do not trigger external knowledge
  retrieval;
- approved memory is scope-filtered before prompt assembly;
- memory proposals remain pending until approval;
- explicit teaching recognizes preferred address, name, creator relationship,
  Genshin UID, server, and main character;
- chat-created proposals carry `private_chat` provenance and a source event;
- citations preserve source, document/chunk, locator, revision, provenance, and
  bounded preview metadata;
- claim approval records explicit confirmation and lifecycle history;
- voice lifecycle events drive body and overlay speaking/idle state;
- speech text and language are delivered to the overlay for captions.

## Verification

The following checks pass from the repository root:

```bash
pnpm typecheck
pnpm test
```

The test run currently reports 17 successful Turbo tasks.

## Known intentional gaps

This slice is behavioral parity work, not hardening. The following remain:

- claim lifecycle writes are not yet transactionally grouped;
- full versioned-claim history queries are not exposed to the operator UI;
- behavioral directives still need the original audience/session schema;
- observation capture and grounded response flow are not yet connected to the
  Siduri-Y API;
- voice audio is synthesized but still needs a real playback/output boundary;
- platform ingestion and outbound approval remain stubs.

## Next phase

Implement grounded observation parity:

```text
observation -> bounded evidence -> knowledge grounding -> response metadata
```

Start with a fixture-first observation organ and API contract. Preserve the
original guarantees: expiry, duplicate suppression, confidence, evidence IDs,
no raw-frame persistence, and no public broadcast before an explicit approval
boundary.
