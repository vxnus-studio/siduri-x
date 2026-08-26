export type EvidenceOrigin = 'knowledge' | 'observation' | 'ocr' | 'platform' | 'conversation';
export type EvidenceTrust = 'configured' | 'provider' | 'untrusted';
export type EvidenceSensitivity = 'public' | 'private' | 'restricted';

export interface EvidenceRecord {
  evidenceId: string;
  sourceId: string;
  documentId?: string;
  chunkId?: string;
  locator?: string;
  revision?: string;
  origin: EvidenceOrigin;
  confidence?: number;
  uncertainty?: string;
  createdAt: string;
  expiresAt?: string;
  trust: EvidenceTrust;
  sensitivity: EvidenceSensitivity;
  allowedAudiences: string[];
  companionId: string;
  correlationId: string;
}

export type ResponseApprovalStatus = 'STAGED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EMITTED';

export type ResponseGateReasonCode =
  | 'APPROVED_DIRECT'
  | 'APPROVAL_REQUIRED'
  | 'UNKNOWN_APPROVAL_ID'
  | 'APPROVAL_ID_MISMATCH'
  | 'COMPANION_MISMATCH'
  | 'AUDIENCE_MISMATCH'
  | 'EVIDENCE_EXPIRED'
  | 'EVIDENCE_SENSITIVITY_EXCLUDED'
  | 'UNRESOLVED_LOW_CONFIDENCE'
  | 'EMPTY_SPEECH'
  | 'PROPOSAL_VALIDATION_FAILED'
  | 'EXPLICITLY_REJECTED';

export interface ResponseCitation {
  sourceId: string;
  documentId?: string;
  chunkId?: string;
  locator?: string;
  revision?: string;
}

export interface StagedResponsePlan {
  responseId: string;
  companionId: string;
  correlationId: string;
  channel: 'public' | 'direct' | 'private' | 'operator';
  audienceId: string;
  speech: string;
  language: string;
  evidenceIds: string[];
  citations: ResponseCitation[];
  confidenceSummary: number;
  uncertaintySummary?: string;
  requiresApproval: boolean;
  status: ResponseApprovalStatus;
  createdAt: string;
  expiresAt?: string;
  memoryProposals?: any[];
  behaviorProposals?: any[];
  internalMonologue?: string;
}

export interface ResponseGateEvaluation {
  admissible: boolean;
  disposition: ResponseApprovalStatus;
  reasonCode: ResponseGateReasonCode;
  stagedPlan: StagedResponsePlan;
  filteredEvidenceIds: string[];
  filteredCitations: ResponseCitation[];
  diagnostics?: Record<string, string>;
}

export interface EvidenceFilterOptions {
  companionId: string;
  channel: 'public' | 'direct' | 'private' | 'operator';
  audienceId: string;
  now?: string | Date;
}

export function filterEvidenceRecords(
  records: EvidenceRecord[],
  options: EvidenceFilterOptions
): { admitted: EvidenceRecord[]; excluded: { record: EvidenceRecord; reason: string }[] } {
  const admitted: EvidenceRecord[] = [];
  const excluded: { record: EvidenceRecord; reason: string }[] = [];
  const nowTime = options.now ? new Date(options.now).getTime() : Date.now();

  for (const record of records) {
    // 1. Companion isolation
    if (record.companionId !== options.companionId) {
      excluded.push({ record, reason: 'companion_isolation_mismatch' });
      continue;
    }

    // 2. Expiry
    if (record.expiresAt) {
      const expTime = new Date(record.expiresAt).getTime();
      if (expTime <= nowTime) {
        excluded.push({ record, reason: 'evidence_expired' });
        continue;
      }
    }

    // 3. Audience intersection
    if (
      record.allowedAudiences &&
      record.allowedAudiences.length > 0 &&
      !record.allowedAudiences.includes(options.audienceId)
    ) {
      excluded.push({ record, reason: 'audience_not_allowed' });
      continue;
    }

    // 4. Sensitivity policy based on channel
    if (options.channel === 'public') {
      if (record.sensitivity !== 'public') {
        excluded.push({ record, reason: 'sensitivity_private_in_public_channel' });
        continue;
      }
    } else if (options.channel === 'direct') {
      if (record.sensitivity === 'restricted') {
        excluded.push({ record, reason: 'sensitivity_restricted_in_direct_channel' });
        continue;
      }
    }

    admitted.push(record);
  }

  return { admitted, excluded };
}
