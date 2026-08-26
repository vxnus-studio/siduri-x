import { RequestContext } from './context';
import {
  EvidenceRecord,
  StagedResponsePlan,
  ResponseGateEvaluation,
  ResponseApprovalStatus,
  ResponseCitation,
  filterEvidenceRecords,
} from './evidence';

export interface StageResponseOptions {
  requestContext: RequestContext;
  candidateSpeech: string;
  candidateLanguage: string;
  internalMonologue?: string;
  memoryProposals?: any[];
  behaviorProposals?: any[];
  evidenceRecords?: EvidenceRecord[];
  citations?: ResponseCitation[];
  requiresApproval?: boolean;
  ttlMs?: number;
  now?: string | Date;
}

export interface ApproveResponseOptions {
  responseId: string;
  companionId: string;
  correlationId: string;
  audienceId?: string;
}

export interface RejectResponseOptions {
  responseId: string;
  companionId: string;
  correlationId: string;
  reason?: string;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ResponseGatingEngine {
  private readonly stagedPlans = new Map<string, StagedResponsePlan>();
  private readonly consumedApprovals = new Set<string>();

  stageResponse(options: StageResponseOptions): StagedResponsePlan {
    const { requestContext } = options;
    const nowTime = options.now ? new Date(options.now).getTime() : Date.now();
    const ttlMs = options.ttlMs ?? 60_000;
    const expiresAt = new Date(nowTime + ttlMs).toISOString();

    const evidenceRecords = options.evidenceRecords ?? [];
    const evidenceIds = evidenceRecords.map((e) => e.evidenceId);
    
    // Calculate aggregate confidence from evidence records if present
    let confidenceSummary = 1.0;
    let uncertaintySummary: string | undefined;
    if (evidenceRecords.length > 0) {
      const confidences = evidenceRecords
        .map((e) => e.confidence)
        .filter((c): c is number => typeof c === 'number' && !isNaN(c));
      if (confidences.length > 0) {
        confidenceSummary = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
      }
      const uncertainties = evidenceRecords
        .map((e) => e.uncertainty)
        .filter((u): u is string => typeof u === 'string' && u.trim() !== '');
      if (uncertainties.length > 0) {
        uncertaintySummary = uncertainties.join('; ');
      }
    }

    const requiresApproval =
      options.requiresApproval !== undefined
        ? options.requiresApproval
        : requestContext.conversation.channel === 'operator' ||
          evidenceRecords.some((e) => e.origin === 'ocr' || e.trust === 'untrusted');

    const staged: StagedResponsePlan = {
      responseId: generateId('resp'),
      companionId: requestContext.companionId,
      correlationId: requestContext.conversation.correlationId,
      channel: requestContext.conversation.channel,
      audienceId: requestContext.conversation.audienceId,
      speech: options.candidateSpeech,
      language: options.candidateLanguage,
      evidenceIds,
      citations: options.citations ?? [],
      confidenceSummary,
      uncertaintySummary,
      requiresApproval,
      status: 'STAGED',
      createdAt: new Date(nowTime).toISOString(),
      expiresAt,
      memoryProposals: options.memoryProposals,
      behaviorProposals: options.behaviorProposals,
      internalMonologue: options.internalMonologue,
    };

    this.stagedPlans.set(staged.responseId, staged);
    return staged;
  }

  evaluateGate(
    staged: StagedResponsePlan,
    allEvidence: EvidenceRecord[] = [],
    now: string | Date = new Date()
  ): ResponseGateEvaluation {
    const nowTime = new Date(now).getTime();

    // 1. Check if empty speech
    if (!staged.speech || staged.speech.trim() === '') {
      return {
        admissible: false,
        disposition: 'REJECTED',
        reasonCode: 'EMPTY_SPEECH',
        stagedPlan: staged,
        filteredEvidenceIds: [],
        filteredCitations: [],
        diagnostics: { detail: 'Speech content is empty' },
      };
    }

    // 2. Check if expired
    if (staged.expiresAt && new Date(staged.expiresAt).getTime() <= nowTime) {
      staged.status = 'EXPIRED';
      return {
        admissible: false,
        disposition: 'EXPIRED',
        reasonCode: 'EVIDENCE_EXPIRED',
        stagedPlan: staged,
        filteredEvidenceIds: [],
        filteredCitations: [],
        diagnostics: { detail: 'Staged response plan expired' },
      };
    }

    // 3. Disclosure filter on attached evidence
    const attachedEvidence = allEvidence.filter((e) => staged.evidenceIds.includes(e.evidenceId));
    const { admitted, excluded } = filterEvidenceRecords(attachedEvidence, {
      companionId: staged.companionId,
      channel: staged.channel,
      audienceId: staged.audienceId,
      now,
    });

    // If any evidence attached to this plan violated disclosure in this channel, exclude it
    const admittedEvidenceIds = admitted.map((e) => e.evidenceId);
    const filteredCitations = staged.citations.filter((c) =>
      admitted.some((e) => e.sourceId === c.sourceId || (e.documentId && e.documentId === c.documentId))
    );

    // 4. Explicitly rejected or status check
    if (staged.status === 'REJECTED') {
      return {
        admissible: false,
        disposition: 'REJECTED',
        reasonCode: 'EXPLICITLY_REJECTED',
        stagedPlan: staged,
        filteredEvidenceIds: admittedEvidenceIds,
        filteredCitations,
      };
    }

    // 5. Staged approval check
    if (staged.requiresApproval && staged.status !== 'APPROVED') {
      return {
        admissible: false,
        disposition: staged.status,
        reasonCode: 'APPROVAL_REQUIRED',
        stagedPlan: staged,
        filteredEvidenceIds: admittedEvidenceIds,
        filteredCitations,
        diagnostics: {
          detail: 'Response plan requires operator approval before external emission',
          excludedEvidenceCount: String(excluded.length),
        },
      };
    }

    // 6. Direct approval / Admissible
    return {
      admissible: true,
      disposition: staged.status === 'APPROVED' ? 'APPROVED' : 'APPROVED',
      reasonCode: 'APPROVED_DIRECT',
      stagedPlan: staged,
      filteredEvidenceIds: admittedEvidenceIds,
      filteredCitations,
    };
  }

  approveResponse(options: ApproveResponseOptions): { success: boolean; reason?: string; plan?: StagedResponsePlan } {
    const plan = this.stagedPlans.get(options.responseId);
    if (!plan) {
      return { success: false, reason: 'UNKNOWN_APPROVAL_ID' };
    }

    if (this.consumedApprovals.has(options.responseId) || plan.status === 'APPROVED') {
      return { success: false, reason: 'APPROVAL_ALREADY_CONSUMED' };
    }

    if (plan.companionId !== options.companionId) {
      return { success: false, reason: 'COMPANION_MISMATCH' };
    }

    if (plan.correlationId !== options.correlationId) {
      return { success: false, reason: 'APPROVAL_ID_MISMATCH' };
    }

    if (options.audienceId && plan.audienceId !== options.audienceId) {
      return { success: false, reason: 'AUDIENCE_MISMATCH' };
    }

    if (plan.status === 'EXPIRED') {
      return { success: false, reason: 'EVIDENCE_EXPIRED' };
    }

    if (plan.status === 'REJECTED') {
      return { success: false, reason: 'EXPLICITLY_REJECTED' };
    }

    plan.status = 'APPROVED';
    this.consumedApprovals.add(options.responseId);
    return { success: true, plan };
  }

  rejectResponse(options: RejectResponseOptions): { success: boolean; reason?: string; plan?: StagedResponsePlan } {
    const plan = this.stagedPlans.get(options.responseId);
    if (!plan) {
      return { success: false, reason: 'UNKNOWN_APPROVAL_ID' };
    }

    if (plan.companionId !== options.companionId) {
      return { success: false, reason: 'COMPANION_MISMATCH' };
    }

    if (plan.correlationId !== options.correlationId) {
      return { success: false, reason: 'APPROVAL_ID_MISMATCH' };
    }

    plan.status = 'REJECTED';
    return { success: true, plan };
  }

  getStagedPlan(responseId: string): StagedResponsePlan | undefined {
    return this.stagedPlans.get(responseId);
  }

  findStagedPlanByCorrelation(companionId: string, correlationId: string): StagedResponsePlan | undefined {
    for (const plan of this.stagedPlans.values()) {
      if (plan.companionId === companionId && plan.correlationId === correlationId) {
        return plan;
      }
    }
    return undefined;
  }
}
