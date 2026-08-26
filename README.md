# Siduri-Y

**NOTICE:** This project is currently under active development. The first
experimental CLI release is `@vxnus/siduri@0.0.5`; it is strictly **untested**
and should only be used by developers who are willing to inspect the generated
artifacts directly.

> **Important Disclaimer:** **Siduri-Y** is an experimental variant of the Siduri architecture built specifically for maximal testing and boundary validation. Please note that this is **NOT** the original `Siduri` core project, nor is it `Siduri-X`.

## Overview
Siduri-Y is a next-generation TypeScript monorepo implementation of the Siduri AI companion architecture. It orchestrates autonomous AI agents with rich capabilities across several modular "organs":

- **Brain**: Uses a provider-neutral OpenAI-compatible client, with OpenRouter
  available as a managed routing preset, for structured AI inference and strict
  response planning.
- **Memory**: A powerful conversational memory engine utilizing PostgreSQL Full-Text Search (FTS) for highly relevant context retrieval and companion isolation.
- **Behavior**: An atomic directive state machine for managing AI companion goals and guidelines.
- **Knowledge**: Installed or hosted E-compatible packs/providers with bounded,
  cited context integration for domain-specific data.
- **Voice & Vision**: Advanced queueing for speech synthesis and visual processing (via ffmpeg).
- **Body**: A real-time `Live2DAdapter` that broadcasts expressions, speech, and lifecycle transitions via WebSockets for seamless integration with overlays and frontends.

The project encompasses a backend API layer, a CLI tool, Next.js web frontends (Chat UI, Operator Console, DOM-based OBS Overlay), and experimental Model Context Protocol (MCP) microservice scaffolding (`apps/gateway` and `apps/memory-service`).

## Experimental CLI

Install and run the experimental CLI with Node.js 20 or newer:

```bash
npx @vxnus/siduri@0.0.5 create
```

The companion name becomes the generated project directory, such as
`./my-companion/siduri.config.json` for a companion named `My Companion`.

The wizard requires a Brain and Memory configuration. Voice, Knowledge,
Behavior, Body, and Vision are optional and can each be set to **Do not use**.
It creates a runnable project, installs its runtime dependencies, keeps API
keys in environment variables, and supports OpenRouter or any
OpenAI-compatible chat-completions endpoint.

After setup:

```bash
cd my-companion
npm run start
```

The runtime still requires external services selected by the configuration,
such as PostgreSQL or VTube Studio.

For the behavioral extraction plan, blank-slate contract, and current RED
health status, start with the [documentation index](./docs/README.md).
The current next-session handoff is
[CURRENT_EXTRACTION_HANDOFF.md](./docs/CURRENT_EXTRACTION_HANDOFF.md).
The [Siduri-Y parity roadmap](./docs/SIDURI_PARITY_ROADMAP.md) tracks phase
gates; it does not treat build success as behavioral parity.

See [CLI usage](./docs/cli.md), [configuration](./docs/configuration.md), and
[development and release](./docs/development.md) for details.

## License
All rights are restricted until the project is officially released publicly to
VXNUS Creative Technology Studio. See the
[experimental CLI license](./cli/LICENSE) for more details.
