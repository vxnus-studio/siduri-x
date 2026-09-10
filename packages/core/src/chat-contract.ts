import { RequestContext } from './context';
import { Message, Claim } from './index';
import { ActionExecutionResult } from './action';
import { ResponseCitation } from './evidence';
import { SiduriRuntime } from './runtime';
import { MouthMedium, FormattedMouthOutput } from './mouth-types';

export interface ChatRequest {
  id?: string;
  companionId?: string;
  message: string;
  role?: 'OWNER' | 'VIEWER' | 'OPERATOR' | string;
  context?: RequestContext;
  history?: Message[];
  medium?: MouthMedium;
  signal?: AbortSignal;
  [key: string]: any;
}

export interface ChatResponseMetadataEvent {
  event_id: string;
  kind: string;
  lifecycle: string;
  approval?: string;
  expression?: string;
  action?: string;
  durationMs?: number;
}

export interface ChatResponsePlan {
  speech_id?: string;
  audio_url?: string;
  subtitle_ja: string;
  subtitle_en: string;
  spoken_ja?: string;
  evidence_ids?: string[];
}

export interface ChatResponseMetadata {
  language?: string;
  proposals?: Claim[];
  memory_proposals?: Array<{
    proposal_id: string;
    subject?: string;
    predicate?: string;
    value?: string;
    status: string;
    content?: string;
    claim_type?: string;
  }>;
  behavioral_proposals?: Array<{
    directive_id: string;
    memory_class: string;
    domain: string;
    subject: string;
    predicate: string;
    value: string;
    status: string;
    behavior?: any;
    runtime_effect?: string;
  }>;
  action_results?: ActionExecutionResult[];
  evidence_ids?: string[];
  citations?: ResponseCitation[];
  subsystem_diagnostics?: Record<string, string>;
  events?: ChatResponseMetadataEvent[];
  [key: string]: any;
}

export interface ChatResponse {
  status: 'APPROVED' | 'REJECTED' | 'STAGED' | string;
  response_id?: string;
  correlation_id?: string;
  response: ChatResponsePlan;
  metadata?: ChatResponseMetadata;
  // Delivery from Mouth organ separating UI presentation from speech and text delivery
  delivery?: FormattedMouthOutput;
  // Backward compatibility fields for legacy clients or audio retrieval
  reply?: string;
  text?: string;
  audioUrl?: string;
  expression?: string;
}

/**
 * Canonical helper to dispatch a chat request to a SiduriRuntime instance.
 * Guarantees a 1:1 identical response structure for localweb (apps/api) and standalone CLI.
 */
export async function dispatchCompanionChat(
  runtime: SiduriRuntime,
  payload: ChatRequest
): Promise<ChatResponse> {
  const userMessage = payload.message || payload.text || '';
  const history = Array.isArray(payload.history) ? payload.history : [];

  let roleOrContext: 'OWNER' | 'VIEWER' | 'OPERATOR' | RequestContext | string;
  if (payload.context) {
    roleOrContext = payload.context;
  } else if (payload.role) {
    roleOrContext = payload.role;
  } else {
    roleOrContext = 'OWNER';
  }

  const runtimeResult = (payload.medium || payload.signal)
    ? await runtime.handleUserMessage(
        userMessage,
        roleOrContext,
        history,
        payload.medium,
        payload.signal
      )
    : await runtime.handleUserMessage(userMessage, roleOrContext, history);

  const delivery: FormattedMouthOutput | undefined = runtimeResult?.delivery;

  // Normalize response plan
  const speech =
    delivery?.displayText ||
    delivery?.text ||
    runtimeResult?.response?.subtitle_ja ||
    runtimeResult?.response?.subtitle_en ||
    '';
  const audioUrl = delivery?.audioUrl || runtimeResult?.response?.audio_url;

  // Extract avatar expression if any event was generated or provided by Mouth delivery
  let expression = delivery?.expression || 'neutral';
  if (expression === 'neutral') {
    const events = runtimeResult?.metadata?.events || [];
    const avatarEvent = events.find(
      (e: any) => e.kind === 'avatar' || e.kind === 'body'
    );
    if (avatarEvent && avatarEvent.expression) {
      expression = avatarEvent.expression;
    }
  }

  // Ensure both spoken_ja and subtitle_en are accessible alongside speech_id and evidence_ids
  const responsePlan: ChatResponsePlan = {
    speech_id: runtimeResult?.response?.speech_id,
    audio_url: audioUrl,
    subtitle_ja: delivery?.subtitles?.ja ?? runtimeResult?.response?.subtitle_ja ?? speech,
    subtitle_en: delivery?.subtitles?.en ?? runtimeResult?.response?.subtitle_en ?? speech,
    spoken_ja: delivery?.subtitles?.spoken ?? runtimeResult?.response?.spoken_ja ?? runtimeResult?.response?.subtitle_ja ?? speech,
    evidence_ids: runtimeResult?.metadata?.evidence_ids ?? runtimeResult?.response?.evidence_ids ?? [],
  };

  const metadata: ChatResponseMetadata = {
    ...(runtimeResult?.metadata || {}),
  };
  delete (metadata as any).internal_monologue;
  delete (metadata as any).internalMonologue;

  return {
    status: runtimeResult?.status || 'APPROVED',
    response_id: runtimeResult?.response_id,
    correlation_id: runtimeResult?.correlation_id,
    response: responsePlan,
    delivery,
    metadata,
    // Convenience fields for legacy/simple consumers
    reply: speech,
    text: speech,
    audioUrl,
    expression,
  };
}
