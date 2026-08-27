import { DefaultHandsOrgan, ToolHandler } from './index';
import { AuthorizationCapability, ActionPolicyEngine, RequestContext } from '@siduri-y/core';

describe('DefaultHandsOrgan Adversarial Remediation Suite', () => {
  const secretKey = 'test_hands_secret';
  let engine: ActionPolicyEngine;
  let sampleContext: RequestContext;

  beforeEach(() => {
    engine = new ActionPolicyEngine({
      secretKey,
      defaultRiskLevel: 'LOW',
    });

    sampleContext = {
      companionId: 'comp-1',
      actor: {
        actorId: 'user-1',
        sessionId: 'sess-1',
        authorizationRole: 'operator',
        capabilities: ['tool:calc', 'tool:search', 'tool:complex'],
        authenticated: true,
      },
      conversation: {
        channel: 'direct',
        audienceId: 'aud-1',
        correlationId: 'corr-1',
      },
    };
  });

  describe('P0 — Elimination of Hands Authorization Bypass', () => {
    it('rejects execution when authorization is missing or undefined', async () => {
      let executed = false;
      const hands = new DefaultHandsOrgan({ secretKey });
      hands.registerTool({
        definition: { name: 'calc', inputSchema: {}, description: 'calc' },
        execute: async () => { executed = true; return 42; },
      });

      const res = await hands.executeAction(
        { actionId: 'act-1', toolName: 'calc', parameters: {} },
        undefined as any
      );

      expect(res.success).toBe(false);
      expect(res.lifecycle).toBe('REJECTED');
      expect(res.error).toContain('Missing mandatory AuthorizationCapability');
      expect(executed).toBe(false);
    });

    it('rejects forged { allowed: true } without valid policy signature', async () => {
      let executed = false;
      const hands = new DefaultHandsOrgan({ secretKey });
      hands.registerTool({
        definition: { name: 'admin_tool', inputSchema: {}, description: 'admin' },
        execute: async () => { executed = true; return 'pwned'; },
      });

      const forgedCapability: AuthorizationCapability = {
        executionId: 'exec-forged',
        actionId: 'act-forged',
        toolName: 'admin_tool',
        providerId: 'builtin',
        parametersHash: 'h_forged',
        companionId: 'comp-1',
        riskLevel: 'LOW',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        allowed: true,
        signature: 'fake_forged_sig',
      };

      const res = await hands.executeAction(
        { actionId: 'act-forged', toolName: 'admin_tool', parameters: {} },
        forgedCapability
      );

      expect(res.success).toBe(false);
      expect(res.lifecycle).toBe('REJECTED');
      expect(res.error).toContain('Invalid or forged AuthorizationCapability signature');
      expect(executed).toBe(false);
    });

    it('rejects authorization with mismatched actionId, toolName, or parameter hash', async () => {
      const hands = new DefaultHandsOrgan({ secretKey });
      hands.registerTool({
        definition: { name: 'search', inputSchema: {}, description: 'search' },
        execute: async () => ({ results: [] }),
      });
      engine.registerToolDefinition({ name: 'search', inputSchema: {}, description: 'search', riskLevel: 'LOW' });

      // Generate authentic capability for parameters { q: 'foo' }
      const { capability } = await engine.evaluateAction({
        actionId: 'act-auth-1',
        toolName: 'search',
        parameters: { q: 'foo' },
        context: sampleContext,
      });
      expect(capability).toBeDefined();

      // Attack: Mismatched parameters (tampered from 'foo' to 'malicious')
      const tamperedRes = await hands.executeAction(
        { actionId: 'act-auth-1', toolName: 'search', parameters: { q: 'malicious' } },
        capability!
      );
      expect(tamperedRes.success).toBe(false);
      expect(tamperedRes.lifecycle).toBe('REJECTED');
      expect(tamperedRes.error).toContain('Parameters hash mismatch');

      // Attack: Mismatched actionId
      const mismatchedActionRes = await hands.executeAction(
        { actionId: 'act-different-id', toolName: 'search', parameters: { q: 'foo' } },
        capability!
      );
      expect(mismatchedActionRes.success).toBe(false);
      expect(mismatchedActionRes.error).toContain('ActionId mismatch');
    });

    it('executes when authentic policy-issued AuthorizationCapability is presented', async () => {
      let executed = false;
      const hands = new DefaultHandsOrgan({ secretKey });
      hands.registerTool({
        definition: { name: 'search', inputSchema: {}, description: 'search' },
        execute: async (p) => { executed = true; return { ok: true, query: p.q }; },
      });
      engine.registerToolDefinition({ name: 'search', inputSchema: {}, description: 'search', riskLevel: 'LOW' });

      const action = {
        actionId: 'act-legit-1',
        toolName: 'search',
        parameters: { q: 'hello' },
        context: sampleContext,
      };

      const { capability } = await engine.evaluateAction(action);
      expect(capability).toBeDefined();

      const res = await hands.executeAction(action, capability!);
      expect(res.success).toBe(true);
      expect(res.lifecycle).toBe('COMPLETED');
      expect(executed).toBe(true);
      expect((res.result as any).query).toBe('hello');
    });

    it('rejects tampered companionId, executionId, expiresAt, and cross-companion capability reuse', async () => {
      const hands = new DefaultHandsOrgan({ secretKey });
      hands.registerTool({
        definition: { name: 'search', inputSchema: {}, description: 'search' },
        execute: async () => ({ results: [] }),
      });
      engine.registerToolDefinition({ name: 'search', inputSchema: {}, description: 'search', riskLevel: 'LOW' });

      const action = {
        actionId: 'act-tamper-1',
        toolName: 'search',
        parameters: { q: 'secure' },
        context: sampleContext,
      };

      const { capability } = await engine.evaluateAction(action);
      expect(capability).toBeDefined();

      // Tamper companionId
      const tamperedCompanionCap = { ...capability!, companionId: 'attacker-companion' };
      const compRes = await hands.executeAction(action, tamperedCompanionCap);
      expect(compRes.success).toBe(false);
      expect(compRes.error).toContain('Invalid or forged AuthorizationCapability signature');

      // Tamper executionId
      const tamperedExecCap = { ...capability!, executionId: 'exec-hijacked' };
      const execRes = await hands.executeAction(action, tamperedExecCap);
      expect(execRes.success).toBe(false);
      expect(execRes.error).toContain('Invalid or forged AuthorizationCapability signature');

      // Expired capability
      const expiredCap = { ...capability!, expiresAt: new Date(Date.now() - 1000).toISOString() };
      const expRes = await hands.executeAction(action, expiredCap);
      expect(expRes.success).toBe(false);
      expect(expRes.error).toContain('Invalid or forged AuthorizationCapability signature');
    });
  });

  describe('P1 — Recursive Schema Validation & Prototype Pollution Defense', () => {
    let hands: DefaultHandsOrgan;

    beforeEach(() => {
      hands = new DefaultHandsOrgan({ secretKey });
      hands.registerTool({
        definition: {
          name: 'update_user',
          description: 'Update user',
          inputSchema: {
            type: 'object',
            required: ['user'],
            properties: {
              user: {
                type: 'object',
                required: ['id', 'role'],
                properties: {
                  id: { type: 'number' },
                  role: { type: 'string', enum: ['admin', 'operator', 'viewer'] },
                },
              },
              tags: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['tagId'],
                  properties: {
                    tagId: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        execute: async (p) => p,
      });

      engine.registerToolDefinition({
        name: 'update_user',
        description: 'Update user',
        inputSchema: {},
        riskLevel: 'LOW',
      });
    });

    it('rejects invalid nested object types and missing nested required fields', async () => {
      const invalidAction = {
        actionId: 'act-nest-1',
        toolName: 'update_user',
        parameters: {
          user: { id: 'not-a-number', role: 'admin' }, // id should be number
        },
        context: sampleContext,
      };

      const { capability } = await engine.evaluateAction(invalidAction);
      const res = await hands.executeAction(invalidAction, capability!);

      expect(res.success).toBe(false);
      expect(res.lifecycle).toBe('REJECTED');
      expect(res.error).toContain('user.id');
      expect(res.error).toContain('expected type number');
    });

    it('rejects invalid array item types at specific index paths', async () => {
      const invalidArrayAction = {
        actionId: 'act-arr-1',
        toolName: 'update_user',
        parameters: {
          user: { id: 100, role: 'viewer' },
          tags: [
            { tagId: 1 },
            { tagId: 'invalid-tag-id' }, // index 1 is invalid
          ],
        },
        context: sampleContext,
      };

      const { capability } = await engine.evaluateAction(invalidArrayAction);
      const res = await hands.executeAction(invalidArrayAction, capability!);

      expect(res.success).toBe(false);
      expect(res.lifecycle).toBe('REJECTED');
      expect(res.error).toContain('tags[1].tagId');
    });

    it('detects and rejects prototype pollution attempts (__proto__, constructor, prototype)', async () => {
      const parsedProtoPayload = JSON.parse('{"user":{"id":1,"role":"admin"},"__proto__":{"isAdmin":true}}');
      const protoPollutionAction = {
        actionId: 'act-proto-1',
        toolName: 'update_user',
        parameters: parsedProtoPayload,
        context: sampleContext,
      };

      const { capability } = await engine.evaluateAction(protoPollutionAction);
      const res = await hands.executeAction(protoPollutionAction, capability!);

      expect(res.success).toBe(false);
      expect(res.lifecycle).toBe('REJECTED');
      expect(res.error).toContain('Forbidden prototype pollution key "__proto__"');
    });
  });

  describe('P1 — Idempotency and Concurrency Reservation', () => {
    it('prevents concurrent duplicate execution with reservation conflict', async () => {
      let resolveSlowTool: any;
      const slowExecutionPromise = new Promise((r) => { resolveSlowTool = r; });

      const hands = new DefaultHandsOrgan({ secretKey });
      hands.registerTool({
        definition: { name: 'long_task', inputSchema: {}, description: 'long task' },
        execute: async () => slowExecutionPromise,
      });
      engine.registerToolDefinition({ name: 'long_task', inputSchema: {}, description: 'long task', riskLevel: 'LOW' });

      const action = {
        actionId: 'act-race-1',
        toolName: 'long_task',
        parameters: {},
        context: sampleContext,
        executionId: 'exec-concurrent-test-99',
      };

      const { capability } = await engine.evaluateAction(action);

      // Start first execution (which stays EXECUTING)
      const firstPromise = hands.executeAction(action, capability!);

      // Concurrently start second execution with same executionId
      const secondRes = await hands.executeAction(action, capability!);
      expect(secondRes.success).toBe(false);
      expect(secondRes.error).toContain('Concurrent execution');

      // Finish first execution
      resolveSlowTool({ done: true });
      const firstRes = await firstPromise;
      expect(firstRes.success).toBe(true);
      expect(firstRes.lifecycle).toBe('COMPLETED');
    });

    it('deduplicates/returns cached result on replay of completed executionId', async () => {
      let runCount = 0;
      const hands = new DefaultHandsOrgan({ secretKey });
      hands.registerTool({
        definition: { name: 'idempotent_task', inputSchema: {}, description: 'idempotent' },
        execute: async () => { runCount++; return { runCount, status: 'done' }; },
      });
      engine.registerToolDefinition({ name: 'idempotent_task', inputSchema: {}, description: 'idempotent', riskLevel: 'LOW' });

      const action = {
        actionId: 'act-idem-1',
        toolName: 'idempotent_task',
        parameters: { data: 'test' },
        context: sampleContext,
        executionId: 'exec-replay-test-101',
      };

      const { capability } = await engine.evaluateAction(action);

      // First run
      const res1 = await hands.executeAction(action, capability!);
      expect(res1.success).toBe(true);
      expect(res1.lifecycle).toBe('COMPLETED');
      expect(runCount).toBe(1);

      // Replay run with identical capability
      const res2 = await hands.executeAction(action, capability!);
      expect(res2.success).toBe(true);
      expect(res2.lifecycle).toBe('COMPLETED');
      expect(runCount).toBe(1); // Did not re-execute side effect!
      expect((res2.result as any).status).toBe('done');
    });
  });
});
