# @vxnus/siduri

Experimental CLI for creating and configuring Siduri companions.

Requires Node.js 20 or newer.

```bash
npx @vxnus/siduri@0.0.4 create
```

The companion name becomes the project directory. For example, answering
`My Companion` creates `./my-companion/siduri.config.json` from the current
directory.

The wizard configures the required Brain and Memory organs, then lets you
enable or disable Voice, Knowledge, Behavior, Body, and Vision. Knowledge can
come from an installed E pack, an E Hub distribution, or a hosted provider.

Brain providers:

- **OpenRouter** — managed model routing using `OPENROUTER_API_KEY`.
- **OpenAI-compatible API** — a custom `baseUrl`, model ID, and API-key
  environment variable.

Memory currently uses PostgreSQL. The wizard lets you choose Local PostgreSQL,
Neon, Supabase, or another PostgreSQL provider; all use `DATABASE_URL`. SQLite
is shown as a future option but is not selectable in this release.

The wizard creates a project directory from the companion name, writes
`siduri.config.json`, copies the Siduri runtime, and installs the runtime
dependencies. API keys are never written to the configuration file. Optional
organs can be configured as `{ "provider": "none" }`; Brain and Memory remain
required.

After setup, start the generated instance with:

```bash
cd my-companion
npm run start
```

For local development, build the CLI from the repository root with
`pnpm --filter @vxnus/siduri build`. For the full architecture, see the
[CLI documentation](../docs/cli.md) and
[configuration reference](../docs/configuration.md).

This release is experimental and is not intended for production use.
