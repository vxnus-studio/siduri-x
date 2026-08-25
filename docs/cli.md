# CLI

Status: Implemented

The CLI is a Node script using `inquirer` to run an interactive wizard.
`npx @vxnus/siduri create`

Brain and memory are required. Voice, knowledge, behavior, body, and vision
each remain visible in the wizard and offer an explicit `Do not use` option.

Memory currently uses PostgreSQL. The wizard separates the database engine
from its deployment and offers Local PostgreSQL, Neon, Supabase, or another
PostgreSQL provider. SQLite is reserved for a future release.

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
npx @vxnus/siduri@0.0.2 create
```

The companion name becomes a safe project directory under the current
directory. For example, `Ganyu` creates `./ganyu/siduri.config.json`.

The wizard creates a project directory, copies the bundled runtime into it,
installs runtime dependencies, and writes `siduri.config.json`. API keys stay
outside the configuration file; set the environment variable selected during
the Brain step before starting the API.

Start the generated instance with:

```bash
cd ganyu
npm run start
```

`siduri start` can also be used from the generated directory. The runtime
still depends on external services selected by the configuration, including
PostgreSQL for memory and VTube Studio for the Live2D body.
