import {
  MemoryOrgan,
  Claim,
  MemoryScope,
  BehaviorDirective,
  SourceEvent,
  MemoryQueryOptions,
  ClaimType,
  ClaimAuthority,
} from '@siduri-x/core';
import { randomUUID } from 'node:crypto';

export class InMemoryMemoryOrgan implements MemoryOrgan {
  private companionId: string | null = null;
  private claims = new Map<string, Claim>();
  private directives = new Map<string, BehaviorDirective>();
  private sourceEvents = new Map<string, SourceEvent>();

  async initialize(companionId: string): Promise<void> {
    this.companionId = companionId;
  }

  async runMigrations(): Promise<void> {
    // No-op for in-memory storage
  }

  private ensureInitialized() {
    if (!this.companionId) {
      throw new Error('MemoryOrgan must be initialized with a companionId before use.');
    }
  }

  async proposeClaim(claimData: Omit<Claim, 'id' | 'status' | 'companionId'>): Promise<Claim> {
    this.ensureInitialized();
    const id = randomUUID();
    const data = claimData as any;
    const claim: Claim = {
      id,
      companionId: this.companionId!,
      subject: String(data.subject || ''),
      predicate: String(data.predicate || ''),
      value: String(data.value || ''),
      status: 'PENDING',
      scope: (data.scope as MemoryScope) || 'COMPANION',
      evidence: Array.isArray(data.evidence) ? data.evidence : [],
      provenance: typeof data.provenance === 'string' ? data.provenance : 'siduri_memory_in_memory',
      sourceEventId: typeof data.sourceEventId === 'string' ? data.sourceEventId : undefined,
      claimType: (data.claimType as ClaimType) || 'semantic',
      authority: (data.authority as ClaimAuthority) || 'user_explicit',
      userConfirmation: data.userConfirmation || 'none',
      sensitivity: typeof data.sensitivity === 'string' ? data.sensitivity : 'private',
      confidence: typeof data.confidence === 'number' ? data.confidence : 1,
      assertedAt: new Date().toISOString(),
      validFrom: typeof data.validFrom === 'string' ? data.validFrom : undefined,
      validUntil: typeof data.validUntil === 'string' ? data.validUntil : undefined,
      supersedes: typeof data.supersedes === 'string' ? data.supersedes : undefined,
      replaces: typeof data.replaces === 'string' ? data.replaces : undefined,
    };
    this.claims.set(id, claim);
    return claim;
  }

  async searchClaims(
    query: string,
    scopeOrOptions: MemoryScope | MemoryQueryOptions = 'COMPANION',
    limit: number = 10
  ): Promise<Claim[]> {
    this.ensureInitialized();
    const isOptionObject = typeof scopeOrOptions === 'object' && scopeOrOptions !== null;
    const sensitivity = isOptionObject ? scopeOrOptions.sensitivity : undefined;
    const effectiveLimit = isOptionObject ? (scopeOrOptions.limit ?? limit) : limit;
    const minConfidence = isOptionObject && typeof scopeOrOptions.minConfidence === 'number'
      ? scopeOrOptions.minConfidence
      : 0.5;

    const now = new Date();
    const results: Claim[] = [];

    const lowerQuery = query ? query.toLowerCase().trim() : '';
    const queryTerms = lowerQuery ? lowerQuery.split(/\s+/).filter(Boolean) : [];

    for (const claim of this.claims.values()) {
      if (claim.companionId !== this.companionId) continue;
      if (claim.status !== 'APPROVED') continue;
      const conf = claim.confidence ?? 1;
      if (conf < minConfidence) continue;
      if (claim.validFrom && new Date(claim.validFrom) > now) continue;
      if (claim.validUntil && new Date(claim.validUntil) < now) continue;
      if (sensitivity && claim.sensitivity !== sensitivity) continue;

      if (queryTerms.length > 0) {
        const fullText = `${claim.subject} ${claim.predicate} ${claim.value} ${JSON.stringify(claim.evidence || '')}`.toLowerCase();
        const matches = queryTerms.some((term) => fullText.includes(term));
        if (!matches) continue;
      }

      results.push(claim);
      if (results.length >= effectiveLimit) break;
    }

    return results;
  }

  async getClaims(limit: number = 50): Promise<Claim[]> {
    this.ensureInitialized();
    const results: Claim[] = [];
    for (const claim of this.claims.values()) {
      if (claim.companionId === this.companionId && claim.status === 'APPROVED') {
        results.push(claim);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  async getAllClaims(): Promise<Claim[]> {
    this.ensureInitialized();
    return Array.from(this.claims.values()).filter((c) => c.companionId === this.companionId);
  }

  async getPendingClaims(limit: number = 50): Promise<Claim[]> {
    this.ensureInitialized();
    const results: Claim[] = [];
    for (const claim of this.claims.values()) {
      if (claim.companionId === this.companionId && claim.status === 'PENDING') {
        results.push(claim);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  async approveClaim(id: string): Promise<void> {
    this.ensureInitialized();
    const claim = this.claims.get(id);
    if (claim && claim.companionId === this.companionId) {
      claim.status = 'APPROVED';
    }
  }

  async rejectClaim(id: string): Promise<void> {
    this.ensureInitialized();
    const claim = this.claims.get(id);
    if (claim && claim.companionId === this.companionId) {
      claim.status = 'REJECTED';
    }
  }

  async revokeClaim(id: string): Promise<void> {
    this.ensureInitialized();
    const claim = this.claims.get(id);
    if (claim && claim.companionId === this.companionId) {
      claim.status = 'REVOKED';
    }
  }

  async expireClaim(id: string): Promise<void> {
    this.ensureInitialized();
    const claim = this.claims.get(id);
    if (claim && claim.companionId === this.companionId) {
      claim.status = 'EXPIRED';
    }
  }

  async updateClaim(
    id: string,
    updates: Partial<Pick<Claim, 'subject' | 'predicate' | 'value' | 'scope' | 'sensitivity' | 'confidence' | 'validFrom' | 'validUntil'>>
  ): Promise<Claim> {
    this.ensureInitialized();
    const claim = this.claims.get(id);
    if (!claim || claim.companionId !== this.companionId) {
      throw new Error(`Claim not found: ${id}`);
    }
    Object.assign(claim, updates);
    return claim;
  }

  async supersedeClaim(id: string, replacement: Omit<Claim, 'id' | 'status' | 'companionId'>): Promise<Claim> {
    this.ensureInitialized();
    const old = this.claims.get(id);
    if (old && old.companionId === this.companionId) {
      old.status = 'SUPERSEDED';
    }
    return this.proposeClaim({
      ...replacement,
      supersedes: id,
    });
  }

  async resetMemory(): Promise<void> {
    this.ensureInitialized();
    for (const [id, claim] of this.claims.entries()) {
      if (claim.companionId === this.companionId) {
        this.claims.delete(id);
      }
    }
    for (const [id, dir] of this.directives.entries()) {
      if (dir.companionId === this.companionId) {
        this.directives.delete(id);
      }
    }
    for (const [id, ev] of this.sourceEvents.entries()) {
      this.sourceEvents.delete(id);
    }
  }

  async getDirectives(): Promise<BehaviorDirective[]> {
    this.ensureInitialized();
    return Array.from(this.directives.values()).filter(
      (d) => d.companionId === this.companionId && d.status === 'ACTIVE'
    );
  }

  async proposeDirective(
    directiveData: Omit<BehaviorDirective, 'id' | 'status' | 'companionId'>
  ): Promise<BehaviorDirective> {
    this.ensureInitialized();
    const id = randomUUID();
    const data = directiveData as any;
    const directive: BehaviorDirective = {
      id,
      companionId: this.companionId!,
      directive: String(data.directive || ''),
      priority: typeof data.priority === 'number' ? data.priority : 50,
      status: 'PENDING',
      supersedesId: typeof data.supersedesId === 'string' ? data.supersedesId : undefined,
      memoryClass: data.memoryClass || 'behavioral',
      subject: typeof data.subject === 'string' ? data.subject : undefined,
      predicate: typeof data.predicate === 'string' ? data.predicate : undefined,
      value: typeof data.value === 'string' ? data.value : undefined,
      validFrom: typeof data.validFrom === 'string' ? data.validFrom : undefined,
      validUntil: typeof data.validUntil === 'string' ? data.validUntil : undefined,
    };
    this.directives.set(id, directive);
    return directive;
  }

  async approveDirective(id: string): Promise<void> {
    this.ensureInitialized();
    const directive = this.directives.get(id);
    if (directive && directive.companionId === this.companionId) {
      directive.status = 'ACTIVE';
      if (directive.supersedesId) {
        const superseded = this.directives.get(directive.supersedesId);
        if (superseded && superseded.companionId === this.companionId) {
          superseded.status = 'SUPERSEDED';
        }
      }
    }
  }

  async rejectDirective(id: string): Promise<void> {
    this.ensureInitialized();
    const directive = this.directives.get(id);
    if (directive && directive.companionId === this.companionId) {
      directive.status = 'REJECTED';
    }
  }

  async revokeDirective(id: string): Promise<void> {
    this.ensureInitialized();
    const directive = this.directives.get(id);
    if (directive && directive.companionId === this.companionId) {
      directive.status = 'REVOKED';
    }
  }

  async disableDirective(id: string): Promise<void> {
    this.ensureInitialized();
    const directive = this.directives.get(id);
    if (directive && directive.companionId === this.companionId) {
      directive.status = 'DISABLED';
    }
  }

  async addSourceEvent(event: SourceEvent): Promise<SourceEvent> {
    this.ensureInitialized();
    this.sourceEvents.set(event.id, event);
    return event;
  }

  async getSourceEvent(id: string): Promise<SourceEvent | undefined> {
    this.ensureInitialized();
    return this.sourceEvents.get(id);
  }
}
