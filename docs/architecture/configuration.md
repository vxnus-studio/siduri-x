# Configuration Reference

Status: Composable standalone configuration schema (`@siduri-x/*` ecosystem)

The `siduri.config.json` determines the identity and active organ composition of a Siduri companion.

Each generated companion instance validates its configuration against a tailored JSON schema (`siduri.schema.json`) dynamically compiled from the manifests of its selected organs.

---

## Configuration Schema

```json
{
  "$schema": "./siduri.schema.json",
  "id": "companion-unique-id",
  "name": "My Companion",
  "organs": {
    "brain": {
      "provider": "openrouter",
      "model": "anthropic/claude-3.5-sonnet",
      "apiKeyEnv": "OPENROUTER_API_KEY"
    },
    "memory": {
      "provider": "postgres",
      "deployment": "local"
    },
    "hands": {
      "defaultTimeoutMs": 10000,
      "providers": []
    },
    "voice": {
      "provider": "voicevox",
      "speakerId": 1,
      "baseUrl": "http://localhost:50021"
    },
    "body": {
      "provider": "live2d",
      "initialExpression": "neutral"
    }
  }
}
```

---

## Key Configuration Principles

1. **Blank-Slate Identity**:
   Configuration defines the companion's operational capabilities, not a predeclared persona, back-story, or private user relationship (per [`BLANK_SLATE_CONTRACT.md`](../contracts/BLANK_SLATE_CONTRACT.md)).
2. **Organ Subtrees**:
   Active organ configurations are isolated within the `organs` dictionary keyed by their organ type or configuration key. Unused organs are omitted from the configuration rather than stubbed with disabled placeholders.
3. **Secret Separation**:
   API keys, passwords, and cryptographic secrets are never saved into `siduri.config.json`. The configuration references environment variable names (e.g. `apiKeyEnv: "OPENROUTER_API_KEY"`), and secrets are loaded from the environment or `.env` at runtime.
