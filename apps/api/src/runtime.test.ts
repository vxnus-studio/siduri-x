import { SiduriRuntime } from './runtime';

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
});
