import {
  RequestContext,
  StagedResponsePlan,
  ResponseGateEvaluation,
  ExperienceDispatcher,
  ExperienceEvent,
  ExperienceAdapter,
  createExperienceEvents,
  VoiceOrgan,
  BodyOrgan,
} from './index';

export interface ExperienceEmissionParams {
  companionId: string;
  requestContext: RequestContext;
  stagedPlan: StagedResponsePlan;
  gateEval: ResponseGateEvaluation;
  speech: string;
  language: string;
  dispatcher: ExperienceDispatcher;
  voice?: VoiceOrgan | ExperienceAdapter;
  body?: BodyOrgan | ExperienceAdapter;
}

export interface ExperienceEmissionResult {
  experienceEvents: ExperienceEvent[];
  speechId?: string;
}

/**
 * Creates ExperienceEvents, dispatches them through the ExperienceDispatcher,
 * and coordinates backward-compatible fallbacks for legacy Voice/Body adapters.
 */
export async function emitExperienceEvents(
  params: ExperienceEmissionParams
): Promise<ExperienceEmissionResult> {
  const {
    companionId,
    requestContext,
    stagedPlan,
    gateEval,
    speech,
    language,
    dispatcher,
    voice,
    body,
  } = params;

  const experienceEvents = createExperienceEvents({
    responseId: stagedPlan.responseId,
    companionId,
    correlationId: requestContext.conversation.correlationId,
    channel: requestContext.conversation?.channel,
    audienceId: requestContext.conversation?.audienceId,
    speech,
    language: language || 'ja',
    evidenceIds: gateEval.filteredEvidenceIds,
    citations: gateEval.filteredCitations,
    expression: 'neutral',
    action: 'talk',
    expiresAt: stagedPlan.expiresAt,
  });

  const dispatchResult = await dispatcher.dispatchEvents(experienceEvents);

  let speechId: string | undefined;
  const voiceResult = dispatchResult.eventResults.find((r) => r.event.kind === 'voice');
  if (voiceResult?.result?.metadata?.speechId) {
    speechId = voiceResult.result.metadata.speechId as string;
  } else if (
    voice &&
    typeof (voice as any).handleEvent !== 'function' &&
    typeof (voice as any).enqueueSpeech === 'function'
  ) {
    speechId = (voice as any).enqueueSpeech(speech, language || 'ja', 1);
  }

  if (body && typeof (body as any).handleEvent !== 'function') {
    if (typeof (body as any).setExpression === 'function') {
      (body as any).setExpression('neutral');
    }
    if (typeof (body as any).act === 'function') {
      (body as any).act('talk');
    }
  }

  return {
    experienceEvents,
    speechId,
  };
}
