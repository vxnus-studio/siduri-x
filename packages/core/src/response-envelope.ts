import {
  StagedResponsePlan,
  ResponseGateEvaluation,
  Claim,
  ResponseCitation,
  ExperienceEvent,
  ActionExecutionResult,
  InteractionMode,
} from './index';
import { ProposalReceipt, ClaimProposalReceipt } from './interaction-settler';
import { FormattedMouthOutput } from './mouth-types';

export interface AssembleResponseEnvelopeParams {
  stagedPlan: StagedResponsePlan;
  speech: string;
  language?: string;
  subtitle?: string;
  subtitles?: Record<string, string>;
  subtitleLanguage?: string;
  speechId?: string;
  createdClaimProposals: Claim[];
  claimProposalReceipts: ClaimProposalReceipt[];
  behavioralProposalReceipts?: any[];
  actionResults: ActionExecutionResult[];
  filteredEvidenceIds?: string[];
  filteredCitations?: ResponseCitation[];
  subsystemDiagnostics: Record<string, string>;
  experienceEvents: ExperienceEvent[];
  mouthDelivery?: FormattedMouthOutput;
  effectiveMode?: InteractionMode;
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
      claim_proposals: [],
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
    subtitle,
    subtitles,
    subtitleLanguage,
    speechId,
    createdClaimProposals,
    claimProposalReceipts,
    behavioralProposalReceipts,
    actionResults,
    filteredEvidenceIds,
    filteredCitations,
    subsystemDiagnostics,
    experienceEvents,
    mouthDelivery,
    effectiveMode,
  } = params;

  const resolvedSubtitles: Record<string, string> = {
    ...(mouthDelivery?.subtitles as Record<string, string> || {}),
    ...(subtitles || {}),
  };
  if (subtitle && subtitleLanguage) {
    resolvedSubtitles[subtitleLanguage] = subtitle;
  }

  return {
    status: 'APPROVED',
    response_id: stagedPlan.responseId,
    correlation_id: stagedPlan.correlationId,
    response: {
      speech_id: speechId,
      audio_url: mouthDelivery?.audioUrl ?? (speechId ? `/voice/stream?id=${speechId}` : undefined),
      subtitle_ja: mouthDelivery?.subtitles?.ja ?? resolvedSubtitles['ja'] ?? speech,
      subtitle_en: mouthDelivery?.subtitles?.en ?? resolvedSubtitles['en'] ?? speech,
      subtitle: subtitle ?? (subtitleLanguage ? resolvedSubtitles[subtitleLanguage] : undefined),
      subtitle_language: subtitleLanguage,
      subtitles: resolvedSubtitles,
      evidence_ids: filteredEvidenceIds ?? [],
      citations: filteredCitations ?? [],
      gate: {
        status: 'APPROVED',
        requires_approval: stagedPlan.requiresApproval,
        confidence: stagedPlan.confidenceSummary,
        uncertainty: stagedPlan.uncertaintySummary,
      },
    },
    delivery: mouthDelivery,
    metadata: {
      mode: effectiveMode ?? 'hybrid',
      language,
      proposals: createdClaimProposals,
      directive_proposals: behavioralProposalReceipts || [],
      claim_proposals: claimProposalReceipts,
      behavioral_proposals: behavioralProposalReceipts || [],
      action_results: actionResults,
      evidence_ids: filteredEvidenceIds,
      citations: filteredCitations,
      gate: {
        status: 'APPROVED',
        requires_approval: stagedPlan.requiresApproval,
        confidence: stagedPlan.confidenceSummary,
        uncertainty: stagedPlan.uncertaintySummary,
      },
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
