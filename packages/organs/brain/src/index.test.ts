import { OpenRouterBrain } from './index';
import { PromptAssembler } from './prompt';
import { BrainContext } from '@siduri-y/core';

// Mock fetch
global.fetch = jest.fn();

describe('OpenRouterBrain', () => {
  const config = { apiKey: 'test-key', model: 'test-model' };
  let brain: OpenRouterBrain;

  beforeEach(() => {
    brain = new OpenRouterBrain(config);
    (global.fetch as jest.Mock).mockClear();
  });

  const mockContext: BrainContext = {
    systemPrompt: "You are a test companion.",
    contextPrompt: "Here are memories: none.",
    recentMessages: [{ role: 'user', content: 'Hello' }]
  };

  test('request construction contains correct schema and auth', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: "submitResponsePlan",
                arguments: JSON.stringify({ speech: "Hi", language: "en" })
              }
            }]
          }
        }]
      })
    });

    await brain.generatePlan(mockContext);
    
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.headers['Authorization']).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("test-model");
    expect(body.tools[0].function.name).toBe("submitResponsePlan");
    expect(body.messages.length).toBe(3);
  });

  test('structured response validation succeeds with valid schema', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: "submitResponsePlan",
                arguments: JSON.stringify({ 
                  speech: "Hi", 
                  language: "en",
                  memoryProposals: [{ subject: "I", predicate: "am", value: "testing" }],
                  behaviorProposals: [{ directive: "Be nice", priority: 10 }]
                })
              }
            }]
          }
        }]
      })
    });

    const plan = await brain.generatePlan(mockContext);
    expect(plan.speech).toBe("Hi");
    expect(plan.language).toBe("en");
    expect(plan.memoryProposals?.[0].subject).toBe("I");
    expect(plan.behaviorProposals?.[0].priority).toBe(10);
  });

  test('malformed model response triggers retry and fails after 3 attempts', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: "submitResponsePlan",
                arguments: JSON.stringify({ speech: "Hi" }) // missing 'language' which is required
              }
            }]
          }
        }]
      })
    });

    await expect(brain.generatePlan(mockContext)).rejects.toThrow("Failed to generate plan after retries");
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

describe('PromptAssembler', () => {
  const assembler = new PromptAssembler();

  test('prompt construction assembles system and context boundaries correctly', () => {
    const res = assembler.assemble({
      systemPrompt: "I am Ganyu",
      contextPrompt: "Memories: none",
      recentMessages: []
    });

    expect(res.messages[0].content).toContain("[SIDURI TRUSTED SYSTEM CONTEXT]");
    expect(res.messages[0].content).toContain("I am Ganyu");
    expect(res.messages[1].content).toContain("[CONTEXTUAL AWARENESS]");
    expect(res.messages[1].content).toContain("Memories: none");
  });
});
