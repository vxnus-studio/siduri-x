import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { PostgresMemoryOrgan } from '@siduri-x/memory';

export function createServer(memoryConfig?: { connectionString: string }): { app: import("express").Express, memory: any, mcpServer: any } {
  const app = express();
  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : []),
  ]);
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }));
  app.use(express.json());

  // Memory instance for this service
  const memory = new PostgresMemoryOrgan({ 
    connectionString: memoryConfig?.connectionString || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/siduri'
  });
  
  // We don't await initialize here to keep sync, tests can await it.
  // In a real startup script we'd await it.
  
  // MCP Server Setup
  // TODO: [MCP Tools Pending] Register tools like `store_claim` or `retrieve_context` using mcpServer.setRequestHandler.
  const mcpServer = new Server({
      name: "siduri-x-memory-organ",
      version: "1.0.0"
    }, {
      capabilities: { tools: {} }
  });

  let transport: SSEServerTransport;

  app.get('/mcp', async (req, res) => {
    transport = new SSEServerTransport('/mcp/messages', res as any);
    await mcpServer.connect(transport);
  });

  app.post('/mcp/messages', async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res as any);
    }
  });

  // Expose the claims functionally properly
  app.get('/api/claims', async (req, res) => {
    try {
      const claims = await memory.getClaims();
      res.json({ claims });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return { app, memory, mcpServer };
}

// Start if executed directly
if (require.main === module) {
  const PORT = process.env.PORT || 3002;
  const { app, memory } = createServer();
  memory.initialize('default-companion').then(() => {
    app.listen(Number(PORT), '127.0.0.1', () => {
      console.log(`Memory Service (API + MCP) running on port ${PORT} (127.0.0.1)`);
    });
  }).catch(console.error);
}
