# @siduri-x/hands

Hands Organ for Siduri: Model Context Protocol (MCP) server integration, tool execution, action lifecycle tracking, and cryptographic policy-driven action enforcement.

## Features

- **Model Context Protocol (MCP) Client**: Connects via Stdio, Server-Sent Events (SSE), or custom transports using `@modelcontextprotocol/sdk`.
- **Dynamic Tool Discovery**: Queries `tools/list` on connected MCP servers and maps definitions into Siduri's tool registry.
- **Cryptographic Capability Enforcement**: Verifies HMAC-signed `AuthorizationCapability` tokens before any tool execution can proceed.
- **Idempotency & Concurrency Locks**: Backed by `ActionStore` to prevent duplicate concurrent or replayed side-effects.
- **Recursive Schema Validation**: Enforces JSON Schema types and defends against prototype pollution attempts.
- **Execution Lifecycle Management**: Enforces configurable timeouts and propagates AbortController cancellation signals.

## Usage

```typescript
import { DefaultHandsOrgan } from '@siduri-x/hands';

const hands = new DefaultHandsOrgan({
  defaultTimeoutMs: 15000,
  providers: [
    {
      serverName: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir']
    }
  ]
});

// Discovers tools dynamically from configured providers
const tools = await hands.listTools();

// Executes authorized tool intents with policy tokens
const result = await hands.executeAction(actionIntent, authorizationCapability);
```
