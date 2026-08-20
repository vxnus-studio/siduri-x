import { SiduriRuntime } from './runtime';

async function runTest() {
  console.log("Starting runtime integration test...");

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
      await new Promise(r => setTimeout(r, 10)); // simulate delay
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

  const mockVoice = { enqueueSpeech: () => "speech-1" };
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

  console.log("Sending message...");
  const response = await runtime.handleUserMessage("Remember this", "OWNER");

  if (response.response.subtitle_en !== "Hello") throw new Error("Expected subtitle Hello");
  if (!knowledgeSearchCalled) throw new Error("Knowledge search was not called");
  if (!brainGenerateCalled) throw new Error("Brain generate was not called");
  if (!noKnowledgeContext) throw new Error("Brain should not have received KNOWLEDGE context after failure");
  
  if (proposedClaims.length !== 1) throw new Error("Expected 1 memory proposal");
  if (proposedClaims[0].subject !== "Test") throw new Error("Expected subject Test");
  if (proposedClaims[0].scope !== "OWNER") throw new Error("Expected scope OWNER");
  
  if (response.metadata.memory_proposals[0].proposal_id !== "claim-1") throw new Error("Expected proposal_id claim-1 in response");

  console.log("SUCCESS: Runtime orchestration handles concurrent context retrieval and graceful degradation.");
}

runTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
