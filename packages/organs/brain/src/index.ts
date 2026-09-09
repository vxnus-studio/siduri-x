import { BrainOrgan, BrainContext, ResponsePlan, Message } from '@siduri-x/core';
import { PromptAssembler } from './prompt';
import { z } from 'zod';

export interface OpenAICompatibleBrainConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface OpenRouterBrainConfig {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
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

const ActionIntentSchema = z.object({
  actionId: z.string(),
  toolName: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  description: z.string().optional(),
});


const ResponsePlanSchema = z.object({
  speech: z.string(),
  language: z.string(),
  internalMonologue: z.string().optional(),
  memoryProposals: z.array(MemoryProposalSchema).optional(),
  behaviorProposals: z.array(BehaviorProposalSchema).optional(),
  actionIntents: z.array(ActionIntentSchema).optional(),
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
              },
              actionIntents: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    actionId: { type: "string" },
                    toolName: { type: "string" },
                    parameters: { type: "object" },
                    description: { type: "string" }
                  },
                  required: ["actionId", "toolName", "parameters"]
                }
              }
            },
            required: ["speech", "language"]
          }
        }
      }
    ];

    const overallTimeoutMs = this.config.timeoutMs ?? 30000;
    const overallController = new AbortController();
    const overallTimer = setTimeout(() => {
      overallController.abort(new Error(`Brain provider exceeded overall wall-clock deadline of ${overallTimeoutMs}ms`));
    }, overallTimeoutMs);

    const maxRetries = Math.max(1, this.config.maxRetries ?? 3);
    const baseBackoffMs = this.config.initialBackoffMs ?? 100;
    const maxBackoffMs = this.config.maxBackoffMs ?? 2000;

    let attempt = 0;
    let lastError: Error | undefined;

    try {
      while (attempt < maxRetries) {
        if (overallController.signal.aborted) {
          throw new Error(`Brain request aborted: overall deadline of ${overallTimeoutMs}ms exceeded`);
        }

        attempt++;
        let retryAfterSec: number | undefined;

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
            }),
            signal: overallController.signal,
          });

          if (!response.ok) {
            const status = response.status;
            const retryHeader = response.headers?.get ? response.headers.get('retry-after') : undefined;
            if (retryHeader) {
              const parsedSec = parseInt(retryHeader, 10);
              if (!isNaN(parsedSec) && parsedSec > 0) {
                retryAfterSec = parsedSec;
              }
            }

            // Client authentication, forbidden, and bad request errors are fatal and should not be retried
            if (status === 400 || status === 401 || status === 403 || status === 404) {
              throw new Error(`Fatal upstream API error (${status}): ${response.statusText}`);
            }

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
          lastError = e;
          if (overallController.signal.aborted) {
            throw new Error(`Brain request timed out after overall deadline of ${overallTimeoutMs}ms: ${e.message}`);
          }
          // Do not retry on non-retryable fatal client errors
          if (e.message && e.message.startsWith('Fatal upstream API error')) {
            throw e;
          }

          if (attempt >= maxRetries) {
            throw new Error("Failed to generate plan after retries: " + e.message);
          }

          // Compute exponential backoff with jitter, or respect Retry-After header
          let delayMs: number;
          if (retryAfterSec !== undefined) {
            delayMs = Math.min(retryAfterSec * 1000, maxBackoffMs);
          } else {
            const expBackoff = Math.min(baseBackoffMs * Math.pow(2, attempt - 1), maxBackoffMs);
            // Full jitter between 0.5x and 1.5x
            const jitter = 0.5 + Math.random();
            delayMs = Math.min(Math.round(expBackoff * jitter), maxBackoffMs);
          }

          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      throw new Error(`Failed to generate plan after retries: ${lastError?.message || 'unknown error'}`);
    } finally {
      clearTimeout(overallTimer);
    }
  }
}

export class OpenRouterBrain extends OpenAICompatibleBrain {
  constructor(config: OpenRouterBrainConfig) {
    super({ ...config, baseUrl: 'https://openrouter.ai/api/v1' });
  }
}

export function probeBrainHealth(context: { config?: any; env?: Record<string, string | undefined> }): { ok: boolean; message?: string } {
  const provider = context?.config?.provider || 'openrouter';
  const apiKeyEnv = context?.config?.apiKeyEnv || (provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_COMPATIBLE_API_KEY');
  const apiKey = context?.config?.apiKey || (context?.env !== undefined ? context.env[apiKeyEnv] : process.env[apiKeyEnv]);

  if (!apiKey) {
    return {
      ok: false,
      message: `Missing API key for Brain (${provider}). Set ${apiKeyEnv} in environment.`,
    };
  }
  return { ok: true, message: `Brain configured with ${provider}` };
}

export * from './prompt';

