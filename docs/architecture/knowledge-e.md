# E Knowledge Integration

> **Status:** Implemented and Renamed to `@siduri-x/eknowledge`  
> **Package Location:** `packages/organs/eknowledge`  
> **Note on Naming:** The name `@siduri-x/knowledge` is now canonically reserved for the **Internal Sovereign Life Database** domain (`packages/knowledge`). External cited packs and remote providers are managed by `@siduri-x/eknowledge`.

---

Siduri consumes external E knowledge packs through `@siduri-x/eknowledge`.

## Installation & Configuration

The companion configuration specifies external knowledge via `externalKnowledge` or `knowledge`:

```json
{
  "externalKnowledge": {
    "provider": "e-knowledge",
    "packPath": "/path/to/knowledge-pack"
  }
}
```

At boot, `EKnowledgeAdapter` loads and validates the pack before exposing it as an `EKnowledgeOrgan`. Invalid references, missing revisions, or hash mismatches fail before the runtime starts using the pack.

## Security & SSRF Hardening

`@siduri-x/eknowledge` includes strict SSRF defenses:
- Rejection of private, loopback, link-local, and cloud metadata IPs (`169.254.169.254`, etc.)
- Open redirect filtering
- DNS resolution checks prior to outbound fetches

## Runtime Boundary

```text
E knowledge pack → EKnowledgeAdapter → EKnowledgeOrgan → SiduriRuntime (Stream A) → Brain
```

Retrieved context includes its E revision and citations. Third-party lore or documentation is provided with cited evidence badges and strictly segregated from the companion's personal memory and sovereign life data.
