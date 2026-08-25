# Phase 4: API-First & MCP Modularization Architecture

> Historical modularization track. This document describes service-boundary
> experiments and does not establish extracted behavior, blank-slate safety, or
> public release readiness. Use the [documentation authority index](./README.md)
> and [health audit](./REPOSITORY_HEALTH_AUDIT.md) for current status.

## Vision
Siduri-Y's current architecture couples all organ logic (Memory, Behavior, Voice, Knowledge) into a single Node.js Express monolith (`apps/api`). To achieve true distributed modularity, scale independently, and allow seamless external integration, we are transitioning to a hybrid **API-First & MCP (Model Context Protocol)** architecture.

In this new phase, each Organ becomes a fully independent microservice.

## The Dual-Interface Approach

Every organ will implement a dual-interface strategy:

1. **Standard API (REST / WebSockets / gRPC)**: 
   - Exposes robust control, monitoring, and state manipulation for frontends (`apps/web`), operator consoles, and traditional systems.
   - Example: `GET /api/claims` for the Operator UI to review memory state.

2. **MCP Server Interface (Model Context Protocol)**:
   - Exposes semantic tools and resources directly to the LLM (the Brain).
   - Example: The LLM receives `store_claim` or `retrieve_context` as native MCP tools, standardizing how the AI interacts with the system without needing custom middleware.

## Architectural Breakdown

### 1. The Gateway (Formerly `apps/api`)
- **Role**: Acts as the central router, authentication boundary, and the primary **MCP Client**.
- **Behavior**: Instead of instantiating TypeScript classes for each organ, the Gateway connects to the separated microservices over HTTP/WS. For LLM inference, it passes the user's message to the Brain, providing it with the aggregated MCP tools from all connected Organ microservices.
- **Current Status**: Implemented as a highly experimental stub (`apps/gateway`) pending full microservice split. It provides a `POST /chat` placeholder route.

### 2. Standalone Organ Microservices

#### Memory Organ (`apps/memory-service`)
- **API**: Provides REST endpoints (like `GET /api/claims`) leveraging the actual `PostgresMemoryOrgan` from `@siduri-y/memory`, preserving isolated contexts.
- **MCP**: Provides a standard `/mcp` SSE endpoint configured with the Model Context Protocol SDK. (Tool registration is pending).
- **Status**: Implemented with integration testing.

#### Knowledge Organ (E-Teyvat)
- **Status**: Pending extraction.

#### Voice & Body Organs
- **Status**: Pending extraction.

## Implementation Steps

1. **Scaffold Microservices**: ✅ Converted memory into standalone `apps/memory-service`.
2. **Implement API Controllers**: ✅ Implemented `GET /api/claims` using the Postgres FTS engine.
3. **Implement MCP Servers**: 🚧 Added `@modelcontextprotocol/sdk` and scaffolded the `/mcp` SSE endpoint in `apps/memory-service`. Tool registration is pending.
4. **Refactor Gateway**: 🚧 Built `apps/gateway` as an experimental MCP Client stub. Full tool orchestration to OpenRouter remains an actionable TODO.
5. **Update Docker Compose**: 🚧 Orchestrate the new microservices network (pending).
