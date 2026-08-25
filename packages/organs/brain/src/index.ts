import { BrainOrgan, BrainContext, ResponsePlan, Message } from '@siduri-y/core';
import { PromptAssembler } from './prompt';
import { z } from 'zod';

export interface OpenAICompatibleBrainConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface OpenRouterBrainConfig {
  apiKey: string;
  model: string;
}

const MemoryProposalSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  value: z.string(),
});

const BehaviorProposalSchema = z.object({
  directive: z.string(),
  priority: z.number(),
});

const ResponsePlanSchema = z.object({
  speech: z.string(),
  language: z.string(),
  internalMonologue: z.string().optional(),
  memoryProposals: z.array(MemoryProposalSchema).optional(),
  behaviorProposals: z.array(BehaviorProposalSchema).optional()
});

export class OpenAICompatibleBrain implements BrainOrgan {
  private config: OpenAICompatibleBrainConfig;
  private assembler: PromptAssembler;
  
  constructor(config: OpenAICompatibleBrainConfig) {
    this.config = config;
    this.assembler = new PromptAssembler();
  }
  
  async generatePlan(context: BrainContext): Promise<ResponsePlan> {
    const { messages } = this.assembler.assemble(context);

    const tools = [
      {
        type: "function",
        function: {
          name: "submitResponsePlan",
          description: "Submit the final response plan for the companion, including speech and proposals.",
          parameters: {
            type: "object",
            properties: {
              speech: { type: "string", description: "The text that the companion will speak." },
              language: { type: "string", description: "The primary language of the speech (e.g., 'en', 'ja', 'id')." },
              internalMonologue: { type: "string", description: "Internal reasoning before responding." },
              memoryProposals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    subject: { type: "string" },
                    predicate: { type: "string" },
                    value: { type: "string" }
                  },
                  required: ["subject", "predicate", "value"]
                }
              },
              behaviorProposals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    directive: { type: "string" },
                    priority: { type: "number" }
                  },
                  required: ["directive", "priority"]
                }
              }
            },
            required: ["speech", "language"]
          }
        }
      }
    ];

    let retries = 3;
    while (retries > 0) {
      try {
        const response = await fetch(`${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.model,
            messages,
            tools,
            tool_choice: { type: "function", function: { name: "submitResponsePlan" } }
          })
        });

        if (!response.ok) {
          throw new Error(`OpenRouter API error: ${response.statusText}`);
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        
        if (toolCall && toolCall.function.name === "submitResponsePlan") {
          const rawArgs = JSON.parse(toolCall.function.arguments);
          const parsed = ResponsePlanSchema.parse(rawArgs);
          return parsed;
        }

        throw new Error("No valid tool call returned from OpenRouter");
      } catch (e: any) {
        retries--;
        if (retries === 0) {
          throw new Error("Failed to generate plan after retries: " + e.message);
        }
        // backoff
        await new Promise(r => setTimeout(r, 10)); // keep test fast
      }
    }

    throw new Error("Failed to generate plan after retries");
  }
}

export class OpenRouterBrain extends OpenAICompatibleBrain {
  constructor(config: OpenRouterBrainConfig) {
    super({ ...config, baseUrl: 'https://openrouter.ai/api/v1' });
  }
}

export * from './prompt';
