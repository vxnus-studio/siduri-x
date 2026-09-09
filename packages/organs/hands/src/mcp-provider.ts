import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ToolDefinition } from '@siduri-x/core';

export interface MCPProviderConfig {
  serverName: string;
  baseUrl?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: Array<{
    definition: ToolDefinition;
    execute: (parameters: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
  }>;
  transport?: Transport; // Pre-created or custom transport (useful for testing and in-memory bridges)
  defaultTimeoutMs?: number;
}

export interface MCPToolHandler {
  definition: ToolDefinition;
  execute: (parameters: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
}

export class MCPClientProvider {
  private client?: Client;
  private connected = false;
  private connectingPromise?: Promise<void>;

  constructor(public readonly config: MCPProviderConfig) {}

  get serverName(): string {
    return this.config.serverName;
  }

  isConnected(): boolean {
    return this.connected && !!this.client;
  }

  getClient(): Client | undefined {
    return this.client;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = (async () => {
      let transport: Transport | undefined = this.config.transport;

      if (!transport) {
        if (this.config.command) {
          transport = new StdioClientTransport({
            command: this.config.command,
            args: this.config.args,
            env: this.config.env,
          });
        } else if (this.config.baseUrl) {
          transport = new SSEClientTransport(new URL(this.config.baseUrl));
        }
      }

      if (!transport) {
        // In-memory or static tools provider (no remote transport configured)
        this.connected = true;
        return;
      }

      const client = new Client(
        {
          name: `siduri-x-${this.config.serverName}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);
      this.client = client;
      this.connected = true;
    })();

    try {
      await this.connectingPromise;
    } finally {
      this.connectingPromise = undefined;
    }
  }

  async discoverTools(): Promise<MCPToolHandler[]> {
    const handlers: MCPToolHandler[] = [];

    // 1. If static tools are provided in config, include them
    if (this.config.tools) {
      for (const tool of this.config.tools) {
        handlers.push({
          definition: {
            ...tool.definition,
            providerId: this.config.serverName,
          },
          execute: tool.execute,
        });
      }
    }

    // 2. If remote client is configured or connectable, discover tools dynamically via MCP
    if (this.config.command || this.config.baseUrl || this.config.transport) {
      if (!this.connected) {
        await this.connect();
      }

      if (this.client) {
        const response = await this.client.listTools();
        for (const remoteTool of response.tools) {
          const definition: ToolDefinition = {
            name: remoteTool.name,
            description: remoteTool.description || '',
            inputSchema: (remoteTool.inputSchema as Record<string, unknown>) || { type: 'object' },
            providerId: this.config.serverName,
            timeoutMs: this.config.defaultTimeoutMs,
          };

          const execute = async (
            parameters: Record<string, unknown>,
            signal?: AbortSignal
          ): Promise<unknown> => {
            if (!this.client) {
              throw new Error(`MCP Provider "${this.config.serverName}" is not connected`);
            }

            const result = await this.client.callTool(
              {
                name: remoteTool.name,
                arguments: parameters,
              },
              undefined,
              { signal }
            );

            if (result.isError) {
              const errorMessage = Array.isArray(result.content)
                ? result.content.map((c: any) => ('text' in c ? c.text : JSON.stringify(c))).join('\n')
                : 'Tool execution returned error status';
              throw new Error(errorMessage);
            }

            return result;
          };

          handlers.push({ definition, execute });
        }
      }
    }

    return handlers;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore close errors during cleanup
      }
      this.client = undefined;
    }
    this.connected = false;
  }
}
