# E Knowledge Integration

Siduri consumes E knowledge packs through `@siduri-y/knowledge`.

## Installation

The CLI writes an E pack path into `siduri.config.json`:

```json
{
  "knowledge": {
    "provider": "e-knowledge",
    "packPath": "/path/to/knowledge-pack"
  }
}
```

The repository's first end-to-end fixture is:

```text
/home/zagin/Projects/vxnuslabs/architecture/e/packages/knowledge/fixtures/siduri-basics
```

Use that path while developing Siduri. It contains one cited fact:
“Siduri is a persistent companion runtime.”

At boot, `EKnowledgeAdapter` loads and validates the pack before exposing it as a
`KnowledgeOrgan`. Invalid references, missing revisions, or hash mismatches
fail before the runtime starts using the pack.

## Runtime boundary

```text
E knowledge → EKnowledgeAdapter → KnowledgeOrgan → SiduriRuntime → Brain
```

Retrieved context includes its E revision and citations. The Hub will later
provide discovery and distribution metadata; Siduri remains responsible for
installing and managing the local pack.

The previous hardcoded E-Teyvat HTTP adapter is removed. Knowledge providers
must enter through the E pack/provider contract.
