import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export function createGateway(): import("express").Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post('/chat', async (req, res) => {
    // TODO: [OUT OF SCOPE / EXPERIMENTAL]
    // This MCP Gateway is currently an experimental stub and not the primary backend (which lives in apps/api).
    // Future work may implement this to dynamically route tool execution to organs via MCP:
    // 1. Initialize MCP SSEClientTransport to connected microservices (e.g. Memory Service)
    // 2. Call mcpClient.listTools()
    // 3. Send user message + tools to OpenRouter (Brain)
    // 4. Handle tool execution dynamically
    // 5. Return final AI response
    res.json({ message: "MCP Gateway Chat Placeholder" });
  });

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const app = createGateway();
  app.listen(PORT, () => {
    console.log(`MCP Gateway running on port ${PORT}`);
  });
}
