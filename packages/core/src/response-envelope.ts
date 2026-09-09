import {
  StagedResponsePlan,
  ResponseGateEvaluation,
  Claim,
  ResponseCitation,
  ExperienceEvent,
  ActionExecutionResult,
} from './index';
import { MemoryProposalReceipt } from './memory-settler';
import { FormattedMouthOutput } from './mouth-types';

export interface AssembleResponseEnvelopeParams {
  stagedPlan: StagedResponsePlan;
  speech: string;
  language?: string;
  speechId?: string;
  createdMemoryProposals: Claim[];
  memoryProposalReceipts: MemoryProposalReceipt[];
  actionResults: ActionExecutionResult[];
  filteredEvidenceIds?: string[];
  filteredCitations?: ResponseCitation[];
  subsystemDiagnostics: Record<string, string>;
  experienceEvents: ExperienceEvent[];
  mouthDelivery?: FormattedMouthOutput;
}

/**
 * Creates the standardized rejection envelope for responses that fail gate evaluation.
 */
export function createGateRejectionEnvelope(
  stagedPlan: StagedResponsePlan,
  gateEval: ResponseGateEvaluation
): any {
  return {
    status: gateEval.disposition,
    reasonCode: gateEval.reasonCode,
    response_id: stagedPlan.responseId,
    correlation_id: stagedPlan.correlationId,
    response: {
      subtitle_ja: undefined,
      subtitle_en: undefined,
    },
    metadata: {
      requires_approval: stagedPlan.requiresApproval,
      staged: true,
      confidence: stagedPlan.confidenceSummary,
      uncertainty: stagedPlan.uncertaintySummary,
      proposals: [],
      memory_proposals: [],
    },
  };
}

/**
 * Assembles the standardized response structure for approved companion responses.
 */
export function assembleResponseEnvelope(
  params: AssembleResponseEnvelopeParams
): any {
  const {
    stagedPlan,
    speech,
    language,
    speechId,
    createdMemoryProposals,
    memoryProposalReceipts,
    actionResults,
    filteredEvidenceIds,
    filteredCitations,
    subsystemDiagnostics,
    experienceEvents,
    mouthDelivery,
  } = params;

  return {
    status: 'APPROVED',
    response_id: stagedPlan.responseId,
    correlation_id: stagedPlan.correlationId,
    response: {
      speech_id: speechId,
      audio_url: mouthDelivery?.audioUrl ?? (speechId ? `/voice/stream?id=${speechId}` : undefined),
      subtitle_ja: mouthDelivery?.subtitles?.ja ?? speech,
      subtitle_en: mouthDelivery?.subtitles?.en ?? speech,
    },
    delivery: mouthDelivery,
    metadata: {
      language,
      proposals: createdMemoryProposals,
      memory_proposals: memoryProposalReceipts,
      action_results: actionResults,
      evidence_ids: filteredEvidenceIds,
      citations: filteredCitations,
      subsystem_diagnostics:
        Object.keys(subsystemDiagnostics).length > 0
          ? subsystemDiagnostics
          : undefined,
      events: experienceEvents.map((e) => ({
        event_id: e.eventId,
        kind: e.kind,
        lifecycle: e.lifecycle,
        approval: e.approval,
        expression: e.expression,
        action: e.action,
      })),
    },
  };
}
