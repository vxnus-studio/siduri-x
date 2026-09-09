import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ActionPolicyEngine, RequestContext } from '@siduri-x/core';
import { DefaultHandsOrgan } from './index';

describe('Hands Organ - Full MCP Protocol Integration Suite', () => {
  const secretKey = 'test_mcp_hands_secret';
  let engine: ActionPolicyEngine;
  let sampleContext: RequestContext;

  beforeEach(() => {
    engine = new ActionPolicyEngine({
      secretKey,
      defaultRiskLevel: 'LOW',
    });

    sampleContext = {
      companionId: 'comp-mcp-1',
      actor: {
        actorId: 'user-mcp-1',
        sessionId: 'sess-mcp-1',
        authorizationRole: 'operator',
        capabilities: ['tool:mcp_server/echo', 'tool:mcp_server/calculator', 'tool:failing_tool', 'tool:slow_tool'],
        authenticated: true,
      },
      conversation: {
        channel: 'direct',
        audienceId: 'aud-mcp-1',
        correlationId: 'corr-mcp-1',
      },
    };
  });

  test('dynamically discovers tools from an MCP server over transport', async () => {
    const server = new Server({ name: 'test-mcp-srv', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'echo',
          description: 'Echoes back the message',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
          },
        },
        {
          name: 'calculator',
          description: 'Adds two numbers',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' },
            },
            required: ['a', 'b'],
          },
        },
      ],
    }));

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const hands = new DefaultHandsOrgan({
      secretKey,
      providers: [
        {
          serverName: 'mcp_server',
          transport: clientTransport,
        },
      ],
    });

    const tools = await hands.listTools();
    expect(tools.length).toBe(2);
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['echo', 'calculator']));
    expect(tools.find((t) => t.name === 'echo')?.providerId).toBe('mcp_server');

    await hands.close();
    await server.close();
  });

  test('executes MCP tool call with cryptographic authorization and parameter validation', async () => {
    const server = new Server({ name: 'calc-srv', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'calculator',
          description: 'Adds two numbers',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' },
            },
            required: ['a', 'b'],
          },
        },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const args = request.params.arguments as { a: number; b: number };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ sum: args.a + args.b }),
          },
        ],
      };
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const hands = new DefaultHandsOrgan({
      secretKey,
      providers: [
        {
          serverName: 'mcp_server',
          transport: clientTransport,
        },
      ],
    });

    // Discover tools and register in policy engine
    const tools = await hands.listTools();
    for (const tool of tools) {
      engine.registerToolDefinition(tool);
    }

    // 1. Authorize action
    const action = {
      actionId: 'act-calc-101',
      toolName: 'mcp_server/calculator',
      parameters: { a: 15, b: 27 },
      context: sampleContext,
    };

    const { capability } = await engine.evaluateAction(action);
    expect(capability).toBeDefined();

    // 2. Execute action through hands organ
    const executionResult = await hands.executeAction(action, capability!);
    expect(executionResult.success).toBe(true);
    expect(executionResult.lifecycle).toBe('COMPLETED');
    expect((executionResult.result as any).content[0].text).toBe(JSON.stringify({ sum: 42 }));

    await hands.close();
    await server.close();
  });

  test('propagates MCP tool errors properly as execution failures', async () => {
    const server = new Server({ name: 'err-srv', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'failing_tool',
          description: 'Fails intentionally',
          inputSchema: { type: 'object' },
        },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async () => {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Database connection failed inside MCP server' }],
      };
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const hands = new DefaultHandsOrgan({
      secretKey,
      providers: [
        {
          serverName: 'mcp_err',
          transport: clientTransport,
        },
      ],
    });

    const tools = await hands.listTools();
    for (const tool of tools) {
      engine.registerToolDefinition(tool);
    }

    const action = {
      actionId: 'act-err-1',
      toolName: 'mcp_err/failing_tool',
      parameters: {},
      context: sampleContext,
    };

    const { capability } = await engine.evaluateAction(action);
    const result = await hands.executeAction(action, capability!);

    expect(result.success).toBe(false);
    expect(result.lifecycle).toBe('FAILED');
    expect(result.error).toContain('Database connection failed inside MCP server');

    await hands.close();
    await server.close();
  });

  test('aborts and handles cancellation of in-flight MCP calls', async () => {
    const server = new Server({ name: 'slow-srv', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'slow_tool',
          description: 'Takes long to run',
          inputSchema: { type: 'object' },
        },
      ],
    }));

    let timer: any;
    server.setRequestHandler(CallToolRequestSchema, async () => {
      return new Promise((resolve) => {
        timer = setTimeout(() => resolve({ content: [{ type: 'text', text: 'done' }] }), 200);
      });
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const hands = new DefaultHandsOrgan({
      secretKey,
      providers: [
        {
          serverName: 'mcp_slow',
          transport: clientTransport,
        },
      ],
    });

    const tools = await hands.listTools();
    for (const tool of tools) {
      engine.registerToolDefinition(tool);
    }

    const action = {
      actionId: 'act-abort-1',
      toolName: 'mcp_slow/slow_tool',
      parameters: {},
      context: sampleContext,
    };

    const { capability } = await engine.evaluateAction(action);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    const result = await hands.executeAction(action, capability!, { signal: controller.signal });
    clearTimeout(timer);

    expect(result.success).toBe(false);
    expect(['CANCELLED', 'TIMED_OUT', 'FAILED']).toContain(result.lifecycle);

    await hands.close();
    await server.close();
  });
});
