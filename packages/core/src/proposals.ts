export type ClaimType = 'semantic' | 'preference' | 'episodic' | 'relationship';
export type ClaimAuthority = 'user_explicit' | 'user_correction' | 'import' | 'repeated_dialogue' | 'inference' | 'observation';
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SESSION_ONLY' | 'EXPIRED' | 'SUPERSEDED' | 'REVOKED';

export interface SourceEvent {
  id: string;
  sourceType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  schemaVersion?: number;
}

export interface MemoryProposal {
  subject: string;
  predicate: string;
  value: string;
  content?: string;
  provenance?: string;
  claimType?: ClaimType;
  sensitivity?: string;
  sourceEventId?: string;
}

export interface BehaviorProposal {
  directive: string;
  priority?: number;
  category?: 'guardrail' | 'relational' | 'behavioral' | string;
  scopeActor?: string;
  supersedesId?: string;
  subject?: string;
  predicate?: string;
  value?: string;
  memoryClass?: 'identity' | 'relationship' | 'behavioral' | 'semantic' | 'episodic';
  sourceEventId?: string;
}
