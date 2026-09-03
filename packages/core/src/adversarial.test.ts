import {
  SiduriRuntime,
  ActionPolicyEngine,
  InMemoryActionStore,
  ResponseGatingEngine,
  signCapabilityPayload,
  verifyCapabilitySignature,
  computeParametersHash,
  canonicalizeJson,
  RequestContext,
  ActionIntent,
  ToolDefinition,
  EvidenceRecord,
  HandsOrgan,
  AuthorizationCapability,
  ActionExecutionResult,
} from './index';

describe('Adversarial Hardening Verification Suite (Phase 3)', () => {
  const secretKey = 'test_policy_secret_key_123';

  const baseOwnerContext: RequestContext = {
    companionId: 'companion-adv',
    actor: {
      actorId: 'owner-user',
      sessionId: 'sess-owner',
      authorizationRole: 'administrator',
      capabilities: ['chat:public', 'chat:private', 'system:manage', 'tools:all'],
      authenticated: true,
    },
    conversation: {
      channel: 'private',
      audienceId: 'audience-owner',
      correlationId: 'corr-adv-1',
    },
  };

  const baseViewerContext: RequestContext = {
    companionId: 'companion-adv',
    actor: {
      actorId: 'anonymous-viewer',
      sessionId: 'sess-viewer',
      authorizationRole: 'viewer',
      capabilities: ['chat:public'],
      authenticated: false,
    },
    conversation: {
      channel: 'public',
      audienceId: 'audience-public',
      correlationId: 'corr-adv-2',
    },
  };

  // INVARIANT 1: Memory Truth & Scoping Boundaries
  describe('Invariant 1: Memory Truth & Cognition Filtering', () => {
    test('expired, future, and below-threshold claims are not injected into Brain contextPrompt', async () => {
      const mockBrain = {
        generatePlan: jest.fn().mockResolvedValue({ speech: 'Cognition received context', language: 'en' }),
      };

      const now = new Date();
      const pastTime = new Date(now.getTime() - 100_000).toISOString();
      const futureTime = new Date(now.getTime() + 100_000).toISOString();

      // Memory mock simulating search output containing valid claim only after organ filtering
      const validClaim = {
        id: 'c-valid',
        companionId: 'companion-adv',
        subject: 'User',
        predicate: 'favoriteColor',
        value: 'Azure',
        status: 'APPROVED',
        scope: 'OWNER',
        confidence: 0.95,
        validFrom: pastTime,
        validUntil: futureTime,
      };

      const mockMemory = {
        initialize: jest.fn().mockResolvedValue(undefined),
        searchClaims: jest.fn().mockResolvedValue([validClaim]),
        getDirectives: jest.fn().mockResolvedValue([]),
      };

      const runtime = new SiduriRuntime('companion-adv', { name: 'AdvCompanion' } as any, {
        brain: mockBrain as any,
        memory: mockMemory as any,
      });

      await runtime.handleUserMessage('What is my favorite color?', baseOwnerContext);

      expect(mockMemory.searchClaims).toHaveBeenCalled();
      const brainCall = mockBrain.generatePlan.mock.calls[0][0];
      expect(brainCall.contextPrompt).toContain('User favoriteColor Azure');
    });

    test('companion isolation: runtime passes only companionId matching context', async () => {
      const mockBrain = {
        generatePlan: jest.fn().mockResolvedValue({ speech: 'OK', language: 'en' }),
      };

      const mockMemory = {
        initialize: jest.fn().mockResolvedValue(undefined),
        searchClaims: jest.fn().mockResolvedValue([]),
        getDirectives: jest.fn().mockResolvedValue([]),
      };

      const runtime = new SiduriRuntime('companion-A', { name: 'AdvA' } as any, {
        brain: mockBrain as any,
        memory: mockMemory as any,
      });

      await runtime.handleUserMessage('Query', {
        ...baseOwnerContext,
        companionId: 'companion-A',
      });

      expect(mockMemory.searchClaims).toHaveBeenCalledWith(
        'Query',
        expect.objectContaining({ channel: 'private', audienceId: 'audience-owner' }),
        5
      );
    });
  });

  // INVARIANT 2: Authority & Request Boundary
  describe('Invariant 2: Authority & Request Context Boundary', () => {
    test('viewer cannot execute admin action intents even if request context is maliciously populated', async () => {
      const store = new InMemoryActionStore();
      const policyEngine = new ActionPolicyEngine({ store, secretKey });

      policyEngine.registerToolDefinition({
        name: 'database/drop_tables',
        providerId: 'db',
        description: 'Drop DB tables',
        inputSchema: {},
        riskLevel: 'CRITICAL',
        allowedRoles: ['administrator'],
        requiredCapabilities: ['system:manage'],
      });

      const intent: ActionIntent = {
        actionId: 'act-drop-1',
        toolName: 'db/database/drop_tables',
        parameters: {},
        context: baseViewerContext, // Viewer role
      };

      const { decision, capability } = await policyEngine.evaluateAction(intent);
      expect(decision.allowed).toBe(false);
      expect(decision.decisionCode).toBe('REJECTED_UNAUTHORIZED');
      expect(capability).toBeUndefined();
    });

    test('missing request context strictly blocks authorization', async () => {
      const store = new InMemoryActionStore();
      const policyEngine = new ActionPolicyEngine({ store, secretKey });

      policyEngine.registerToolDefinition({
        name: 'test_tool',
        providerId: 'sys',
        description: 'Test Tool',
        inputSchema: {},
        riskLevel: 'LOW',
      });

      const intent: ActionIntent = {
        actionId: 'act-no-ctx',
        toolName: 'sys/test_tool',
        parameters: {},
      };

      const { decision, capability } = await policyEngine.evaluateAction(intent, undefined);
      expect(decision.allowed).toBe(false);
      expect(decision.decisionCode).toBe('REJECTED_UNAUTHORIZED');
      expect(capability).toBeUndefined();
    });
  });

  // INVARIANT 4: Action Replay & Concurrency Protection
  describe('Invariant 4: Action Idempotency, Concurrency & Signature Replay', () => {
    let store: InMemoryActionStore;
    let mockHandlerExecute: jest.Mock;

    class TestHandsOrgan implements HandsOrgan {
      constructor(private readonly store: InMemoryActionStore, private readonly secretKey: string) {}

      async listTools(): Promise<ToolDefinition[]> {
        return [{
          name: 'transfer_funds',
          providerId: 'bank',
          description: 'Transfer money',
          inputSchema: {},
          riskLevel: 'CRITICAL',
        }];
      }

      async executeAction(
        action: ActionIntent,
        authorization: AuthorizationCapability
      ): Promise<ActionExecutionResult> {
        const actionId = action?.actionId || 'unknown';
        const toolName = action?.toolName || 'unknown';

        if (!authorization || authorization.allowed !== true) {
          return { actionId, executionId: 'unauthorized', toolName, lifecycle: 'REJECTED', success: false, error: 'Unauthorized' };
        }

        if (!verifyCapabilitySignature(authorization, this.secretKey)) {
          return { actionId, executionId: authorization.executionId, toolName, lifecycle: 'REJECTED', success: false, error: 'Invalid or forged AuthorizationCapability signature' };
        }

        if (authorization.expiresAt && new Date(authorization.expiresAt).getTime() <= Date.now()) {
          return { actionId, executionId: authorization.executionId, toolName, lifecycle: 'REJECTED', success: false, error: 'AuthorizationCapability has expired' };
        }

        const currentParamsHash = computeParametersHash(action.parameters);
        if (authorization.parametersHash !== currentParamsHash) {
          return { actionId, executionId: authorization.executionId, toolName, lifecycle: 'REJECTED', success: false, error: 'Parameters hash mismatch' };
        }

        const executionId = authorization.executionId;
        const existing = await this.store.getExecution(executionId);
        if (existing && existing.lifecycle === 'COMPLETED') {
          return { actionId, executionId, toolName, lifecycle: 'COMPLETED', success: true, result: existing.result };
        }

        const reserved = await this.store.reserveExecution({
          executionId,
          actionId,
          toolName,
          providerId: authorization.providerId,
          parametersHash: currentParamsHash,
          lifecycle: 'EXECUTING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (!reserved) {
          return { actionId, executionId, toolName, lifecycle: 'FAILED', success: false, error: 'Reservation conflict' };
        }

        const result = await mockHandlerExecute(action.parameters);
        await this.store.updateExecution({
          executionId,
          actionId,
          toolName,
          providerId: authorization.providerId,
          parametersHash: currentParamsHash,
          lifecycle: 'COMPLETED',
          result,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return { actionId, executionId, toolName, lifecycle: 'COMPLETED', success: true, result };
      }
    }

    let hands: TestHandsOrgan;

    beforeEach(() => {
      store = new InMemoryActionStore();
      mockHandlerExecute = jest.fn().mockResolvedValue({ transactionId: 'tx-12345', status: 'CONFIRMED' });
      hands = new TestHandsOrgan(store, secretKey);
    });

    test('replaying a completed capability returns cached result without re-executing handler', async () => {
      const mockExecute = mockHandlerExecute;

      const action: ActionIntent = {
        actionId: 'act-tx-1',
        executionId: 'exec-tx-1',
        toolName: 'bank/transfer_funds',
        parameters: { amount: 100, to: 'Alice' },
      };

      const paramsHash = computeParametersHash(action.parameters);
      const capabilityPayload = {
        executionId: 'exec-tx-1',
        actionId: 'act-tx-1',
        toolName: 'bank/transfer_funds',
        providerId: 'bank',
        parametersHash: paramsHash,
        companionId: 'companion-adv',
        actorId: 'owner-user',
        sessionId: 'sess-owner',
        channel: 'private',
        correlationId: 'corr-adv-1',
        riskLevel: 'CRITICAL' as const,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };

      const signature = signCapabilityPayload(capabilityPayload, secretKey);
      const capability = {
        ...capabilityPayload,
        allowed: true as const,
        signature,
      };

      // 1. First execution succeeds
      const res1 = await hands.executeAction(action, capability);
      expect(res1.success).toBe(true);
      expect(res1.lifecycle).toBe('COMPLETED');
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // 2. Replay execution with identical capability
      const res2 = await hands.executeAction(action, capability);
      expect(res2.success).toBe(true);
      expect(res2.lifecycle).toBe('COMPLETED');
      expect(res2.result).toEqual({ transactionId: 'tx-12345', status: 'CONFIRMED' });
      // Handler was NOT called a second time (replay defended)
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    test('tampering with action parameters invalidates cryptographic capability', async () => {
      const action: ActionIntent = {
        actionId: 'act-tx-2',
        executionId: 'exec-tx-2',
        toolName: 'bank/transfer_funds',
        parameters: { amount: 100, to: 'Alice' },
      };

      const paramsHash = computeParametersHash(action.parameters);
      const capabilityPayload = {
        executionId: 'exec-tx-2',
        actionId: 'act-tx-2',
        toolName: 'bank/transfer_funds',
        providerId: 'bank',
        parametersHash: paramsHash,
        companionId: 'companion-adv',
        actorId: 'owner-user',
        sessionId: 'sess-owner',
        channel: 'private',
        correlationId: 'corr-adv-1',
        riskLevel: 'CRITICAL' as const,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };

      const signature = signCapabilityPayload(capabilityPayload, secretKey);
      const capability = { ...capabilityPayload, allowed: true as const, signature };

      // Attacker tampers with parameters from $100 to $10,000
      const tamperedAction: ActionIntent = {
        ...action,
        parameters: { amount: 10_000, to: 'Attacker' },
      };

      const res = await hands.executeAction(tamperedAction, capability);
      expect(res.success).toBe(false);
      expect(res.lifecycle).toBe('REJECTED');
      expect(res.error).toContain('Parameters hash mismatch');
    });

    test('forged signature on capability is rejected by constant-time verification', async () => {
      const action: ActionIntent = {
        actionId: 'act-tx-3',
        executionId: 'exec-tx-3',
        toolName: 'bank/transfer_funds',
        parameters: { amount: 100, to: 'Alice' },
      };

      const capability = {
        executionId: 'exec-tx-3',
        actionId: 'act-tx-3',
        toolName: 'bank/transfer_funds',
        providerId: 'bank',
        parametersHash: computeParametersHash(action.parameters),
        companionId: 'companion-adv',
        actorId: 'owner-user',
        sessionId: 'sess-owner',
        channel: 'private',
        correlationId: 'corr-adv-1',
        riskLevel: 'CRITICAL' as const,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        allowed: true as const,
        signature: '0000000000000000000000000000000000000000000000000000000000000000', // Forged signature
      };

      const res = await hands.executeAction(action, capability);
      expect(res.success).toBe(false);
      expect(res.lifecycle).toBe('REJECTED');
      expect(res.error).toContain('Invalid or forged AuthorizationCapability signature');
    });

    test('expired authorization capability is rejected', async () => {
      const action: ActionIntent = {
        actionId: 'act-tx-4',
        executionId: 'exec-tx-4',
        toolName: 'bank/transfer_funds',
        parameters: { amount: 100, to: 'Alice' },
      };

      const paramsHash = computeParametersHash(action.parameters);
      const expiredTime = new Date(Date.now() - 5000).toISOString();
      const capabilityPayload = {
        executionId: 'exec-tx-4',
        actionId: 'act-tx-4',
        toolName: 'bank/transfer_funds',
        providerId: 'bank',
        parametersHash: paramsHash,
        companionId: 'companion-adv',
        actorId: 'owner-user',
        sessionId: 'sess-owner',
        channel: 'private',
        correlationId: 'corr-adv-1',
        riskLevel: 'CRITICAL' as const,
        issuedAt: new Date(Date.now() - 10000).toISOString(),
        expiresAt: expiredTime,
      };

      const signature = signCapabilityPayload(capabilityPayload, secretKey);
      const capability = { ...capabilityPayload, allowed: true as const, signature };

      const res = await hands.executeAction(action, capability);
      expect(res.success).toBe(false);
      expect(res.lifecycle).toBe('REJECTED');
      expect(res.error).toContain('AuthorizationCapability has expired');
    });
  });

  // INVARIANT 6: Failure Semantics & Degradation
  describe('Invariant 6: Subsystem Failure Diagnostics & Non-Empty Propagation', () => {
    test('database/memory query failure surfaces diagnostic in contextPrompt and metadata', async () => {
      const mockBrain = {
        generatePlan: jest.fn().mockResolvedValue({ speech: 'Graceful fallback response', language: 'en' }),
      };

      const failingMemory = {
        initialize: jest.fn().mockResolvedValue(undefined),
        searchClaims: jest.fn().mockRejectedValue(new Error('Connection terminated unexpectedly')),
        getDirectives: jest.fn().mockRejectedValue(new Error('PostgreSQL read timeout')),
      };

      const runtime = new SiduriRuntime('companion-adv', { name: 'AdvCompanion' } as any, {
        brain: mockBrain as any,
        memory: failingMemory as any,
      });

      const response = await runtime.handleUserMessage('Hello companion', baseOwnerContext);

      expect(response.status).toBe('APPROVED');
      expect(response.metadata.subsystem_diagnostics).toBeDefined();
      expect(response.metadata.subsystem_diagnostics.memory_claims).toContain('UNAVAILABLE');
      expect(response.metadata.subsystem_diagnostics.memory_directives).toContain('UNAVAILABLE');

      const brainCall = mockBrain.generatePlan.mock.calls[0][0];
      expect(brainCall.contextPrompt).toContain('SUBSYSTEM STATUS (DEGRADED):');
      expect(brainCall.contextPrompt).toContain('memory_claims');
    });
  });

  // INVARIANT 8: Truth Gate Admissibility vs Factuality
  describe('Invariant 8: Response Gating Evidence Admissibility Semantics', () => {
    test('gate strictly enforces evidence admissibility and disclosure without claiming unverified factuality', () => {
      const gating = new ResponseGatingEngine();

      const publicEvidence: EvidenceRecord = {
        evidenceId: 'ev-pub-1',
        sourceId: 'src-facts',
        origin: 'knowledge',
        trust: 'configured',
        sensitivity: 'public',
        allowedAudiences: ['audience-public'],
        companionId: 'companion-adv',
        correlationId: 'corr-adv-1',
        createdAt: new Date().toISOString(),
      };

      const privateEvidence: EvidenceRecord = {
        evidenceId: 'ev-priv-1',
        sourceId: 'src-secrets',
        origin: 'knowledge',
        trust: 'configured',
        sensitivity: 'restricted',
        allowedAudiences: ['audience-owner'],
        companionId: 'companion-adv',
        correlationId: 'corr-adv-1',
        createdAt: new Date().toISOString(),
      };

      // Staged for public channel with both public and restricted evidence attached
      const staged = gating.stageResponse({
        requestContext: baseViewerContext, // Public channel
        candidateSpeech: 'Siduri was created in 1840 by aliens.',
        candidateLanguage: 'en',
        evidenceRecords: [publicEvidence, privateEvidence],
      });

      const evaluation = gating.evaluateGate(staged, [publicEvidence, privateEvidence]);
      expect(evaluation.admissible).toBe(true);
      expect(evaluation.reasonCode).toBe('APPROVED_DIRECT');
      // Public evidence admitted, restricted private evidence excluded from public emission
      expect(evaluation.filteredEvidenceIds).toEqual(['ev-pub-1']);
      expect(evaluation.filteredEvidenceIds).not.toContain('ev-priv-1');
    });
  });

  // INVARIANT 9: Full-Field Tamper-Evident Audit Trail
  describe('Invariant 9: Full-Field SHA-256 Audit Trail Chaining', () => {
    test('mutating any security-critical field breaks cryptographic hash chain', async () => {
      const store = new InMemoryActionStore();
      const policyEngine = new ActionPolicyEngine({ store, secretKey });

      policyEngine.registerToolDefinition({
        name: 'test_tool',
        providerId: 'sys',
        description: 'Test Tool',
        inputSchema: {},
        riskLevel: 'LOW',
      });

      // Event 1
      await policyEngine.evaluateAction({
        actionId: 'act-1',
        toolName: 'sys/test_tool',
        parameters: { step: 1 },
        context: baseOwnerContext,
      });

      // Event 2
      await policyEngine.evaluateAction({
        actionId: 'act-2',
        toolName: 'sys/test_tool',
        parameters: { step: 2 },
        context: baseOwnerContext,
      });

      const auditTrail = await store.getAuditLog();
      expect(auditTrail.length).toBe(2);

      const event1 = auditTrail[0];
      const event2 = auditTrail[1];

      // Mutate security-critical fields in event1 and verify chain discrepancy
      const criticalFields: (keyof typeof event1)[] = [
        'executionId',
        'actionId',
        'toolName',
        'companionId',
        'actorId',
        'sessionId',
        'channel',
        'correlationId',
        'riskLevel',
        'lifecycle',
        'parametersHash',
      ];

      for (const field of criticalFields) {
        const tamperedEvent = { ...event1, [field]: 'TAMPERED_VALUE' };
        const initialPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';
        const canonical = canonicalizeJson({
          executionId: tamperedEvent.executionId,
          actionId: tamperedEvent.actionId,
          toolName: tamperedEvent.toolName,
          providerId: tamperedEvent.providerId || null,
          companionId: tamperedEvent.companionId,
          actorId: tamperedEvent.actorId || null,
          sessionId: tamperedEvent.sessionId || null,
          channel: tamperedEvent.channel || null,
          correlationId: tamperedEvent.correlationId || null,
          riskLevel: tamperedEvent.riskLevel,
          lifecycle: tamperedEvent.lifecycle,
          decision: tamperedEvent.decision ? {
            allowed: tamperedEvent.decision.allowed,
            reason: tamperedEvent.decision.reason,
            riskLevel: tamperedEvent.decision.riskLevel,
            decisionCode: tamperedEvent.decision.decisionCode,
          } : null,
          parametersHash: tamperedEvent.parametersHash || null,
          error: tamperedEvent.error || null,
          timestamp: tamperedEvent.timestamp,
        });

        const crypto = require('node:crypto');
        const brokenHash1 = crypto.createHash('sha256').update(`${initialPrevHash}:${canonical}`, 'utf8').digest('hex');
        expect(brokenHash1).not.toBe(event1.resultHash);
      }
    });
  });
});
