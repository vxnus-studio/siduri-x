import { SiduriRuntime } from './runtime';
import { DefaultHandsOrgan } from '@siduri-y/hands';
import { DefaultEarOrgan } from '@siduri-y/ear';
import { ActionPolicyEngine, RequestContext } from '@siduri-y/core';

describe('Siduri Runtime Orchestration', () => {
  test('handles concurrent context retrieval and graceful degradation', async () => {
    let knowledgeSearchCalled = false;
    let brainGenerateCalled = false;
    let proposedClaims: any[] = [];
    let noKnowledgeContext = false;

    const mockBrain = {
      generatePlan: async (args: any) => {
        brainGenerateCalled = true;
        if (!args.contextPrompt.includes("KNOWLEDGE:")) {
          noKnowledgeContext = true;
        }
        return {
          speech: "Hello",
          language: "en",
          memoryProposals: [
            { subject: "Test", predicate: "is", value: "working" }
          ]
        };
      }
    };

    const mockMemory = {
      initialize: async () => {},
      searchClaims: async () => {
        await new Promise(r => setTimeout(r, 10));
        return [];
      },
      getDirectives: async () => [],
      proposeClaim: async (claim: any) => {
        proposedClaims.push(claim);
        return { id: "claim-1", ...claim };
      },
      proposeDirective: async () => ({})
    };

    const mockKnowledge = {
      search: async () => {
        knowledgeSearchCalled = true;
        throw new Error("E-Teyvat is down");
      }
    };

    const mockVoice = {
      enqueueSpeech: () => "speech-1",
      onLifecycleEvent: () => {},
      getQueueStatus: () => ({ pending: 0 }),
    };
    const mockVision = { analyze: async () => "" };
    const mockBehavior = { compile: async () => "Compiled behavior" };
    const mockBody = { speak: () => {} };

    const runtime = new SiduriRuntime(
      'default',
      { name: "Test Companion" } as any,
      {
        brain: mockBrain as any,
        memory: mockMemory as any,
        voice: mockVoice as any,
        knowledge: mockKnowledge as any,
        vision: mockVision as any,
        behavior: mockBehavior as any,
        body: mockBody as any
      }
    );

    const response = await runtime.handleUserMessage("Remember this", "OWNER");

    expect(response.response.subtitle_en).toBe("Hello");
    expect(knowledgeSearchCalled).toBe(true);
    expect(brainGenerateCalled).toBe(true);
    expect(noKnowledgeContext).toBe(true);
    expect(proposedClaims.length).toBe(1);
    expect(proposedClaims[0].subject).toBe("Test");
    expect(proposedClaims[0].scope).toBe("OWNER");
    expect(response.metadata.memory_proposals[0].proposal_id).toBe("claim-1");
  });

  test('Primary Invariant: Brain proposes an action, ActionPolicyEngine authorizes, Hands executes', async () => {
    let toolExecuted = false;
    const hands = new DefaultHandsOrgan();
    hands.registerTool({
      definition: {
        name: 'search_web',
        providerId: 'builtin',
        description: 'Web search',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        riskLevel: 'LOW',
        requiredCapabilities: ['chat:public'],
      },
      execute: async (params) => {
        toolExecuted = true;
        return { hits: [`Result for ${params.query}`] };
      },
    });

    const mockBrain = {
      generatePlan: async () => ({
        speech: "I found this for you.",
        language: "en",
        actionIntents: [
          {
            actionId: 'act-plan-1',
            toolName: 'builtin/search_web',
            parameters: { query: 'Teyvat history' },
          }
        ]
      })
    };

    const mockMemory = {
      initialize: async () => {},
      searchClaims: async () => [],
      getDirectives: async () => [],
      proposeClaim: async (c: any) => c,
    };

    const actionPolicy = new ActionPolicyEngine();

    const runtime = new SiduriRuntime(
      'companion-secure',
      { name: "SecureCompanion" } as any,
      {
        brain: mockBrain as any,
        memory: mockMemory as any,
        hands,
        actionPolicy,
      }
    );
    await runtime.initialize();

    const context: RequestContext = {
      companionId: 'companion-secure',
      actor: {
        actorId: 'user-alice',
        sessionId: 'sess-alice',
        authorizationRole: 'operator',
        capabilities: ['chat:public'],
        authenticated: true,
      },
      conversation: {
        channel: 'direct',
        audienceId: 'audience-direct',
        correlationId: 'corr-alice-123',
      },
    };

    const res = await runtime.handleUserMessage("Find history", context);
    expect(res.status).toBe('APPROVED');
    expect(toolExecuted).toBe(true);
    expect(res.metadata.action_results).toHaveLength(1);
    expect(res.metadata.action_results[0].success).toBe(true);
    expect(res.metadata.action_results[0].lifecycle).toBe('COMPLETED');
    expect(res.metadata.action_results[0].decision.allowed).toBe(true);

    // Verify audit log has recorded the action execution
    const auditLogs = await actionPolicy.getAuditLog();
    expect(auditLogs.length).toBeGreaterThan(0);
    const audit = auditLogs.find(a => a.actionId === 'act-plan-1');
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe('user-alice');
    expect(audit?.correlationId).toBe('corr-alice-123');
  });

  test('Policy rejects unauthorized action proposed by Brain and Hands never executes it', async () => {
    let dangerousExecuted = false;
    const hands = new DefaultHandsOrgan();
    hands.registerTool({
      definition: {
        name: 'delete_system',
        providerId: 'admin',
        description: 'Delete system',
        inputSchema: { type: 'object' },
        riskLevel: 'CRITICAL',
        requiredCapabilities: ['system:admin'],
        allowedRoles: ['administrator'],
      },
      execute: async () => {
        dangerousExecuted = true;
        return { deleted: true };
      },
    });

    const mockBrain = {
      generatePlan: async () => ({
        speech: "Attempting to delete system.",
        language: "en",
        actionIntents: [
          {
            actionId: 'act-danger-1',
            toolName: 'admin/delete_system',
            parameters: {},
          }
        ]
      })
    };

    const mockMemory = {
      initialize: async () => {},
      searchClaims: async () => [],
      getDirectives: async () => [],
    };

    const actionPolicy = new ActionPolicyEngine();

    const runtime = new SiduriRuntime(
      'companion-secure-2',
      { name: "SecureCompanion2" } as any,
      {
        brain: mockBrain as any,
        memory: mockMemory as any,
        hands,
        actionPolicy,
      }
    );
    await runtime.initialize();

    // Viewer context without administrator role or system:admin capability
    const viewerContext: RequestContext = {
      companionId: 'companion-secure-2',
      actor: {
        actorId: 'viewer-bob',
        sessionId: 'sess-bob',
        authorizationRole: 'viewer',
        capabilities: ['chat:public'],
        authenticated: false,
      },
      conversation: {
        channel: 'public',
        audienceId: 'audience-public',
        correlationId: 'corr-bob-999',
      },
    };

    const res = await runtime.handleUserMessage("Delete system", viewerContext);
    expect(dangerousExecuted).toBe(false);
    expect(res.metadata.action_results).toHaveLength(1);
    expect(res.metadata.action_results[0].success).toBe(false);
    expect(res.metadata.action_results[0].lifecycle).toBe('REJECTED');
    expect(res.metadata.action_results[0].error).toContain('Action authorization rejected by policy');
  });

  test('Universal Perception: User input passes through EarOrgan and validates resource limits', async () => {
    const ear = new DefaultEarOrgan({
      maxTextLength: 50,
    });

    const mockBrain = {
      generatePlan: async (ctx: any) => ({
        speech: "Response",
        language: "en",
      })
    };

    const mockMemory = {
      initialize: async () => {},
      searchClaims: async () => [],
      getDirectives: async () => [],
    };

    const runtime = new SiduriRuntime(
      'companion-ear-test',
      { name: "EarCompanion" } as any,
      {
        brain: mockBrain as any,
        memory: mockMemory as any,
        ear,
      }
    );
    await runtime.initialize();

    // Oversized message should be rejected at Ear boundary
    const oversizedMsg = 'X'.repeat(100);
    await expect(runtime.handleUserMessage(oversizedMsg, 'OWNER')).rejects.toThrow(
      /Ear text input exceeds maximum allowed length/
    );
  });
});
