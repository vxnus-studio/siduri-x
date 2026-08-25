# CLI

Status: Implemented

The CLI is a Node script using `inquirer` to run an interactive wizard.
`npx @vxnus/siduri create`

Brain and memory are required. Voice, knowledge, behavior, body, and vision
each remain visible in the wizard and offer an explicit `Do not use` option.

The Brain step offers `OpenRouter (managed model routing)` or
`OpenAI-compatible API (custom endpoint)`. The custom option asks for the
OpenAI-compatible base URL, model ID, and the name of an environment variable
that contains the API key. Keys are never written to `siduri.config.json`.

During creation, the knowledge step can:

- search the E Hub and install a validated archive locally;
- use an already-installed local E pack; or
- validate and configure a hosted E provider.

Local archives are installed under `~/.siduri/knowledge/` and validated with
`@vxnus/e-knowledge` before the configuration is written. The CLI writes
`siduri.config.json`, which the API loads from the current directory (or from
`SIDURI_CONFIG`). Environment variables such as `SIDURI_KNOWLEDGE_PACK` and
`VTS_URL` override the corresponding generated settings.

## Install and run

The published experimental package requires Node.js 20 or newer:

```bash
npx @vxnus/siduri@0.0.1 create
```

The generated configuration is intended to be used from the directory where
the Siduri API is started. API keys stay outside the configuration file; set
the environment variable selected during the Brain step before starting the
API.
