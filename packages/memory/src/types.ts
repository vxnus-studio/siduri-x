import {
  EpisodicEvent,
  MemoryClaim,
} from '@siduri-x/core';

export type {
  EpisodicEvent,
  MemoryClaim,
};

export interface MemoryEventInput {
  id?: string;
  sourceType: 'chat_turn' | 'tool_result' | 'sensory';
  occurredAt?: string;
  payload: Record<string, unknown>;
}

export interface ClaimProposalInput {
  id?: string;
  companionId: string;
  subject: string;
  predicate: string;
  value: string;
  confidence?: number;
  validFrom?: string;
  validUntil?: string;
  evidence?: string[];
}

export interface EpisodicMemoryStore {
  recordEvent(companionId: string, event: MemoryEventInput): Promise<void>;
  getRecentEvents(companionId: string, limit?: number): Promise<EpisodicEvent[]>;
  proposeClaim(claim: ClaimProposalInput): Promise<MemoryClaim>;
  approveClaim(claimId: string): Promise<void>;
  rejectClaim(claimId: string): Promise<void>;
  revokeClaim?(claimId: string): Promise<void>;
  expireClaim?(claimId: string): Promise<void>;
  markClaimSessionOnly?(claimId: string): Promise<void>;
  searchClaims(companionId: string, query: string, limit?: number): Promise<MemoryClaim[]>;
  getApprovedClaims(companionId: string, limit?: number): Promise<MemoryClaim[]>;
  close(): void;
}
