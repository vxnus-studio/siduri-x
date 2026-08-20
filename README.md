# Siduri-Y

**NOTICE:** This project is currently under active development. It is being made public solely for documentation and reference purposes. It is strictly **untested for stability** and should not be relied upon for production use. 

> **Important Disclaimer:** **Siduri-Y** is an experimental variant of the Siduri architecture built specifically for maximal testing and boundary validation. Please note that this is **NOT** the original `Siduri` core project, nor is it `Siduri-X`.

## Overview
Siduri-Y is a next-generation TypeScript monorepo implementation of the Siduri AI companion architecture. It orchestrates autonomous AI agents with rich capabilities across several modular "organs":

- **Brain**: Powered by OpenRouter for structured AI inference and strict response planning.
- **Memory**: A powerful conversational memory engine utilizing PostgreSQL Full-Text Search (FTS) for highly relevant context retrieval and companion isolation.
- **Behavior**: An atomic directive state machine for managing AI companion goals and guidelines.
- **Knowledge (E-Teyvat)**: External retrieval and bounded context integration for domain-specific lore and data.
- **Voice & Vision**: Advanced queueing for speech synthesis and visual processing (via ffmpeg).
- **Body**: A real-time `Live2DAdapter` that broadcasts expressions, speech, and lifecycle transitions via WebSockets for seamless integration with overlays and frontends.

The project encompasses a backend API layer, a CLI tool, Next.js web frontends (Chat UI, Operator Console, DOM-based OBS Overlay), and experimental Model Context Protocol (MCP) microservice scaffolding (`apps/gateway` and `apps/memory-service`).

## License
All rights are restricted until the project is officially released publicly to VXNUS Creative Technology Studio. See the [LICENSE](./LICENSE) file for more details.
