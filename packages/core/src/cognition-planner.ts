import { BrainOrgan, Message, ResponsePlan, MemoryScope } from './index';

export interface CognitionPlanningParams {
  companionName: string;
  brain?: BrainOrgan;
  systemPrompt: string;
  contextPrompt: string;
  recentMessages: Message[];
  recipient?: MemoryScope;
  perceivedText: string;
}

/**
 * Invokes BrainOrgan to generate a structured ResponsePlan, or provides
 * a graceful baseline response if Brain is absent or in headless passive mode.
 */
export async function generateCognitionPlan(
  params: CognitionPlanningParams
): Promise<ResponsePlan> {
  const {
    companionName,
    brain,
    systemPrompt,
    contextPrompt,
    recentMessages,
    recipient,
    perceivedText,
  } = params;

  if (brain && typeof brain.generatePlan === 'function') {
    return brain.generatePlan({
      systemPrompt,
      contextPrompt,
      recentMessages,
      recipient,
    });
  }

  // Graceful baseline response when Brain is not configured or in headless passive mode
  return {
    speech: `[Siduri ${companionName}] Acknowledged: ${perceivedText}`,
    language: 'en',
  };
}
