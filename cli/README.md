# @vxnus/siduri

Experimental CLI for creating and configuring Siduri companions.

Requires Node.js 20 or newer.

```bash
npx @vxnus/siduri@0.0.1 create
```

The wizard configures the required Brain and Memory organs, then lets you
enable or disable Voice, Knowledge, Behavior, Body, and Vision. Knowledge can
come from an installed E pack, an E Hub distribution, or a hosted provider.

Brain providers:

- **OpenRouter** — managed model routing using `OPENROUTER_API_KEY`.
- **OpenAI-compatible API** — a custom `baseUrl`, model ID, and API-key
  environment variable.

The wizard writes `siduri.config.json` in the current directory. API keys are
never written to that file. Optional organs can be configured as
`{ "provider": "none" }`; Brain and Memory remain required.

For local development, build the CLI from the repository root with
`pnpm --filter @vxnus/siduri build`. For the full architecture, see the
[CLI documentation](../docs/cli.md) and
[configuration reference](../docs/configuration.md).

This release is experimental and is not intended for production use.
