import { HandsOrgan, ToolDefinition, ActionIntent, ActionExecutionResult } from '@siduri-y/core';

export interface ToolHandler {
  definition: ToolDefinition;
  execute: (parameters: Record<string, unknown>) => Promise<unknown>;
}

export interface MCPProviderConfig {
  serverName: string;
  baseUrl?: string;
  command?: string;
  args?: string[];
  tools?: ToolHandler[];
}

export class DefaultHandsOrgan implements HandsOrgan {
  private readonly toolRegistry = new Map<string, ToolHandler>();

  constructor(private readonly config: { providers?: MCPProviderConfig[] } = {}) {
    if (config.providers) {
      for (const provider of config.providers) {
        if (provider.tools) {
          for (const tool of provider.tools) {
            this.registerTool(tool);
          }
        }
      }
    }
  }

  registerTool(handler: ToolHandler): void {
    this.toolRegistry.set(handler.definition.name, handler);
  }

  unregisterTool(toolName: string): boolean {
    return this.toolRegistry.delete(toolName);
  }

  async listTools(): Promise<ToolDefinition[]> {
    return Array.from(this.toolRegistry.values()).map((handler) => handler.definition);
  }

  async executeAction(action: ActionIntent): Promise<ActionExecutionResult> {
    const handler = this.toolRegistry.get(action.toolName);
    if (!handler) {
      return {
        actionId: action.actionId,
        toolName: action.toolName,
        success: false,
        error: `Tool "${action.toolName}" is not registered in Hands organ`,
      };
    }

    try {
      const result = await handler.execute(action.parameters);
      return {
        actionId: action.actionId,
        toolName: action.toolName,
        success: true,
        result,
      };
    } catch (err: any) {
      return {
        actionId: action.actionId,
        toolName: action.toolName,
        success: false,
        error: err?.message || 'Tool execution failed',
      };
    }
  }
}
