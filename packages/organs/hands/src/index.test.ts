import { DefaultHandsOrgan, ToolHandler } from './index';

describe('DefaultHandsOrgan', () => {
  it('registers and lists tools', async () => {
    const hands = new DefaultHandsOrgan();
    const mockTool: ToolHandler = {
      definition: {
        name: 'search_web',
        description: 'Search the internet',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
      },
      execute: async (params) => ({ results: [`Result for ${params.query}`] }),
    };

    hands.registerTool(mockTool);
    const tools = await hands.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_web');
  });

  it('executes registered tool successfully', async () => {
    const hands = new DefaultHandsOrgan();
    hands.registerTool({
      definition: {
        name: 'calculator',
        description: 'Calculate addition',
        inputSchema: {},
      },
      execute: async (params: any) => ({ sum: params.a + params.b }),
    });

    const result = await hands.executeAction({
      actionId: 'act-1',
      toolName: 'calculator',
      parameters: { a: 10, b: 20 },
    });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ sum: 30 });
  });

  it('returns error when executing unregistered tool', async () => {
    const hands = new DefaultHandsOrgan();
    const result = await hands.executeAction({
      actionId: 'act-2',
      toolName: 'missing_tool',
      parameters: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('is not registered');
  });
});
