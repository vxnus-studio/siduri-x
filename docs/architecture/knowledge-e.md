# E Knowledge Integration

> **Status:** Merged into `@siduri-x/knowledge` (`UnifiedKnowledgeOrgan`)  
> **Package Location:** `packages/knowledge`  
> **Note on Naming:** External cited packs and remote providers are managed via `EKnowledgeAdapter` within `@siduri-x/knowledge`, unified alongside the sovereign Life Database.

---

Siduri consumes external E knowledge packs through `@siduri-x/knowledge`.

## Installation & Configuration

The companion configuration specifies external knowledge via the `pack` property within `knowledge`:

```json
{
  "organs": {
    "knowledge": {
      "provider": "unified",
      "dbPath": "siduri.sqlite",
      "pack": {
        "provider": "e-hub",
        "packId": "@vxnus/e-teyvat",
        "registryUrl": "https://e.vxnus.xyz/api/v1/knowledge",
        "mode": "remote"
      }
    }
  }
}
```

Or for a local pack:

```json
{
  "organs": {
    "knowledge": {
      "provider": "unified",
      "pack": {
        "provider": "e-knowledge",
        "packPath": "./assets/knowledge/my-pack",
        "mode": "local"
      }
    }
  }
}
```

At boot, `EKnowledgeAdapter` inside `UnifiedKnowledgeOrgan` loads and validates the pack before exposing it as an `EKnowledgeOrgan`. Invalid references, missing revisions, or hash mismatches fail before the runtime starts using the pack.

## Security & SSRF Hardening

`@siduri-x/knowledge` includes strict SSRF defenses for all external knowledge requests:
- Rejection of private, loopback, link-local, and cloud metadata IPs (`169.254.169.254`, etc.)
- Open redirect filtering
- DNS resolution checks prior to outbound fetches

## Runtime Boundary

```text
E knowledge pack → EKnowledgeAdapter → EKnowledgeOrgan → SiduriRuntime (Stream A) → Brain
```

Retrieved context includes its E revision and citations. Third-party lore or documentation is provided with cited evidence badges and strictly segregated from the companion's personal memory and sovereign life data.
