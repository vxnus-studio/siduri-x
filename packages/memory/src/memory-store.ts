import {
  SiduriDatabase,
  EpisodicEvent,
  MemoryClaim,
  MemoryOrgan,
  Claim,
  BehaviorDirective,
  MemoryScope,
  MemoryQueryOptions,
} from '@siduri-x/core';
import {
  EpisodicMemoryStore,
  MemoryEventInput,
  ClaimProposalInput,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

export interface SqliteMemoryStoreOptions {
  db?: SiduriDatabase;
  dbPath?: string;
  connectionString?: string;
  [key: string]: unknown;
}

export class SqliteMemoryStore implements EpisodicMemoryStore, MemoryOrgan {
  private db: SiduriDatabase;
  private ownsDb: boolean;
  private activeCompanionId: string = 'default';

  constructor(options: SqliteMemoryStoreOptions = {}) {
    if (options.db) {
      this.db = options.db;
      this.ownsDb = false;
    } else {
      this.db = new SiduriDatabase({ dbPath: options.dbPath });
      this.ownsDb = true;
    }
  }

  // --- EpisodicMemoryStore Interface ---

  async recordEvent(companionId: string, event: MemoryEventInput): Promise<void> {
    const episodicEvent: EpisodicEvent = {
      id: event.id || crypto.randomUUID(),
      companionId,
      sourceType: event.sourceType,
      occurredAt: event.occurredAt || new Date().toISOString(),
      payload: event.payload,
    };
    this.db.recordEvent(episodicEvent);
  }

  async getRecentEvents(companionId: string, limit: number = 50): Promise<EpisodicEvent[]> {
    return this.db.getRecentEvents(companionId, limit);
  }

  async proposeClaim(
    claimOrInput: ClaimProposalInput | Omit<Claim, 'id' | 'status' | 'companionId'>
  ): Promise<any> {
    const raw = claimOrInput as any;
    const companionId = raw.companionId || this.activeCompanionId;
    const claim: MemoryClaim = this.db.proposeClaim({
      id: raw.id || crypto.randomUUID(),
      companionId,
      subject: raw.subject || '',
      predicate: raw.predicate || '',
      value: raw.value || '',
      confidence: raw.confidence ?? 1.0,
      validFrom: raw.validFrom,
      validUntil: raw.validUntil,
      evidence: raw.evidence,
      assertedAt: new Date().toISOString(),
    });
    return claim;
  }

  async approveClaim(claimId: string): Promise<void> {
    this.db.approveClaim(claimId);
  }

  async rejectClaim(claimId: string): Promise<void> {
    this.db.rejectClaim(claimId);
  }

  async revokeClaim(claimId: string): Promise<void> {
    this.db.revokeClaim(claimId);
  }

  async expireClaim(claimId: string): Promise<void> {
    this.db.expireClaim(claimId);
  }

  async markClaimSessionOnly(claimId: string): Promise<void> {
    this.db.markClaimSessionOnly(claimId);
  }

  async searchClaims(
    arg1: string,
    arg2?: string | MemoryScope | MemoryQueryOptions,
    arg3?: number
  ): Promise<any[]> {
    // Support overload: searchClaims(companionId: string, query: string, limit?: number)
    // AND overload: searchClaims(query: string, scopeOrOptions?: any, limit?: number)
    if (typeof arg2 === 'string' && !['companion', 'user'].includes(arg2)) {
      const companionId = arg1;
      const query = arg2;
      const limit = arg3 ?? 20;
      if (!query || !query.trim()) {
        return this.getApprovedClaims(companionId, limit);
      }
      return this.db.searchClaims(companionId, query, limit);
    }

    const query = arg1;
    const limit = typeof arg3 === 'number' ? arg3 : 20;
    if (!query || !query.trim()) {
      return this.getApprovedClaims(this.activeCompanionId, limit);
    }
    return this.db.searchClaims(this.activeCompanionId, query, limit);
  }

  async getApprovedClaims(companionId: string, limit: number = 50): Promise<MemoryClaim[]> {
    return this.db.getApprovedClaims(companionId, limit);
  }

  // --- MemoryOrgan Compatibility Interface ---

  async initialize(companionId: string): Promise<void> {
    this.activeCompanionId = companionId;
  }

  async getClaims(limit: number = 50): Promise<Claim[]> {
    return this.db.getApprovedClaims(this.activeCompanionId, limit) as any;
  }

  async getPendingClaims(limit: number = 50): Promise<Claim[]> {
    const all = this.db.searchClaims(this.activeCompanionId, '', limit);
    return all.filter((c) => c.status === 'PENDING') as any;
  }

  async getDirectives(): Promise<BehaviorDirective[]> {
    return this.db.getActiveDirectives(this.activeCompanionId) as any;
  }

  async proposeDirective(
    directiveData: Omit<BehaviorDirective, 'id' | 'status' | 'companionId'>
  ): Promise<BehaviorDirective> {
    const raw = directiveData as any;
    const id = crypto.randomUUID();
    const directive: BehaviorDirective = {
      id,
      companionId: this.activeCompanionId,
      directive: raw.directive || '',
      priority: raw.priority ?? 50,
      status: 'PENDING',
      category: raw.category || 'behavioral',
      supersedesId: raw.supersedesId,
    } as any;
    this.db.commitDirective(directive as any);
    return directive;
  }

  async approveDirective(id: string): Promise<void> {
    this.db.approveDirective(id);
  }

  async rejectDirective(id: string): Promise<void> {
    this.db.rejectDirective(id);
  }

  async revokeDirective(id: string): Promise<void> {
    this.db.revokeDirective(id);
  }

  async expireDirective(id: string): Promise<void> {
    this.db.expireDirective(id);
  }

  async disableDirective(id: string): Promise<void> {
    this.db.disableDirective(id);
  }

  async runMigrations(): Promise<void> {
    // In pure SQLite WAL mode, schema is initialized automatically in constructor
  }

  async resetMemory(): Promise<void> {
    // Reset memory for active companion
  }

  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }
}
