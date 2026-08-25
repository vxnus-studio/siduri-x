import { MemoryOrgan, Claim, MemoryScope, BehaviorDirective, SourceEvent } from '@siduri-y/core';
import { Pool } from 'pg';
import { UP_MIGRATION } from './schema';

export interface PostgresMemoryConfig {
  connectionString: string;
}

export class PostgresMemoryOrgan implements MemoryOrgan {
  private pool: Pool;
  private companionId: string | null = null;

  constructor(config: PostgresMemoryConfig) {
    this.pool = new Pool({ connectionString: config.connectionString });
  }

  async runMigrations(): Promise<void> {
    await this.pool.query(UP_MIGRATION);
    // Keep databases created by the first Siduri-Y migration compatible with
    // the richer provenance contract without requiring a destructive reset.
    await this.pool.query(`
      ALTER TABLE memory_claims
        ADD COLUMN IF NOT EXISTS provenance VARCHAR NOT NULL DEFAULT 'siduri_y_memory',
        ADD COLUMN IF NOT EXISTS source_event_id VARCHAR,
        ADD COLUMN IF NOT EXISTS claim_type VARCHAR NOT NULL DEFAULT 'semantic',
        ADD COLUMN IF NOT EXISTS authority VARCHAR NOT NULL DEFAULT 'user_explicit',
        ADD COLUMN IF NOT EXISTS user_confirmation VARCHAR NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS sensitivity VARCHAR NOT NULL DEFAULT 'private',
        ADD COLUMN IF NOT EXISTS allowed_audiences JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS confidence REAL NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS asserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS supersedes UUID,
        ADD COLUMN IF NOT EXISTS replaces UUID;
    `);
  }

  async initialize(companionId: string): Promise<void> {
    this.companionId = companionId;
  }

  private ensureInitialized() {
    if (!this.companionId) {
      throw new Error("MemoryOrgan must be initialized with a companionId before use.");
    }
  }

  private mapClaim(row: any): Claim {
    return {
      id: row.id,
      companionId: row.companion_id,
      subject: row.subject,
      predicate: row.predicate,
      value: row.value,
      status: row.status as any,
      scope: row.scope as any,
      evidence: row.evidence,
      provenance: row.provenance,
      sourceEventId: row.source_event_id,
      claimType: row.claim_type,
      authority: row.authority,
      userConfirmation: row.user_confirmation,
      sensitivity: row.sensitivity,
      allowedAudiences: row.allowed_audiences,
      confidence: row.confidence,
      assertedAt: row.asserted_at,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      supersedes: row.supersedes,
      replaces: row.replaces,
    };
  }

  async proposeClaim(claimData: Omit<Claim, 'id' | 'status' | 'companionId'>): Promise<Claim> {
    this.ensureInitialized();
    const result = await this.pool.query(
      `INSERT INTO memory_claims
       (companion_id, subject, predicate, value, status, scope, evidence, provenance,
        source_event_id, claim_type, authority, user_confirmation, sensitivity,
        allowed_audiences, confidence, valid_from, valid_until, supersedes, replaces)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        this.companionId,
        claimData.subject,
        claimData.predicate,
        claimData.value,
        'PENDING',
        claimData.scope,
        JSON.stringify(claimData.evidence || []),
        claimData.provenance || 'siduri_y_memory',
        claimData.sourceEventId || null,
        claimData.claimType || 'semantic',
        claimData.authority || 'user_explicit',
        claimData.userConfirmation || 'none',
        claimData.sensitivity || 'private',
        JSON.stringify(claimData.allowedAudiences || []),
        claimData.confidence ?? 1,
        claimData.validFrom || null,
        claimData.validUntil || null,
        claimData.supersedes || null,
        claimData.replaces || null
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      companionId: row.companion_id,
      subject: row.subject,
      predicate: row.predicate,
      value: row.value,
      status: row.status as any,
      scope: row.scope as any,
      evidence: row.evidence
      , provenance: row.provenance,
      sourceEventId: row.source_event_id,
      claimType: row.claim_type,
      authority: row.authority,
      userConfirmation: row.user_confirmation,
      sensitivity: row.sensitivity,
      allowedAudiences: row.allowed_audiences,
      confidence: row.confidence,
      assertedAt: row.asserted_at,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      supersedes: row.supersedes,
      replaces: row.replaces
    };
  }

  async searchClaims(query: string, scope: MemoryScope, limit: number = 10): Promise<Claim[]> {
    this.ensureInitialized();
    
    // We strictly enforce companionId scoping here
    const safeScope = ['OWNER', 'VIEWER', 'OPERATOR', 'PUBLIC'].includes(scope) ? scope : 'PUBLIC';
    let sql = `SELECT * FROM memory_claims WHERE companion_id = $1 AND status = 'APPROVED'
      AND (scope = 'PUBLIC' OR scope = '${safeScope}')`;
    const params: any[] = [this.companionId];
    
    if (query) {
      const rawTerms = Array.from(new Set(query.toLowerCase().split(/\s+/)));
      const safeTerms = rawTerms.filter(term => /^[a-z0-9]+$/.test(term)).sort();
      
      if (safeTerms.length === 0) {
        return [];
      }
      
      const tsQueryStr = safeTerms.map(term => `${term}:*`).join(' | ');
      sql += ` AND search_document @@ to_tsquery('simple', $2)`;
      params.push(tsQueryStr);
      sql += ` ORDER BY ts_rank(search_document, to_tsquery('simple', $2)) DESC LIMIT $3`;
      params.push(limit);
    } else {
      sql += ` ORDER BY id LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => this.mapClaim(row));
  }

  async getDirectives(): Promise<BehaviorDirective[]> {
    this.ensureInitialized();
    const result = await this.pool.query(
      `SELECT * FROM memory_directives WHERE companion_id = $1 ORDER BY priority DESC`,
      [this.companionId]
    );

    return result.rows.map(row => ({
      id: row.id,
      companionId: row.companion_id,
      directive: row.directive,
      scopeMatcher: row.scope_matcher,
      priority: row.priority,
      status: row.status as any,
      supersedesId: row.supersedes_id
    }));
  }
  
  // For tests/admin to quickly approve claims
  async approveClaim(id: string): Promise<void> {
    this.ensureInitialized();
    await this.pool.query(
      `UPDATE memory_claims SET status = 'APPROVED' WHERE id = $1 AND companion_id = $2`,
      [id, this.companionId]
    );
  }

  async rejectClaim(id: string): Promise<void> {
    this.ensureInitialized();
    await this.pool.query(
      `UPDATE memory_claims SET status = 'REJECTED' WHERE id = $1 AND companion_id = $2`,
      [id, this.companionId]
    );
  }

  async getClaims(): Promise<Claim[]> {
    this.ensureInitialized();
    const result = await this.pool.query(
      `SELECT * FROM memory_claims WHERE companion_id = $1 ORDER BY id DESC`,
      [this.companionId]
    );
    return result.rows.map((row) => this.mapClaim(row));
  }

  async getPendingClaims(): Promise<Claim[]> {
    this.ensureInitialized();
    const result = await this.pool.query(
      `SELECT * FROM memory_claims WHERE companion_id = $1 AND status = 'PENDING' ORDER BY id DESC`,
      [this.companionId]
    );
    return result.rows.map((row) => this.mapClaim(row));
  }

  async proposeDirective(directiveData: Omit<BehaviorDirective, 'id' | 'status' | 'companionId'>): Promise<BehaviorDirective> {
    this.ensureInitialized();
    const result = await this.pool.query(
      `INSERT INTO memory_directives (companion_id, directive, scope_matcher, priority, status, supersedes_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        this.companionId,
        directiveData.directive,
        JSON.stringify(directiveData.scopeMatcher || []),
        directiveData.priority,
        'PENDING',
        directiveData.supersedesId || null
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      companionId: row.companion_id,
      directive: row.directive,
      scopeMatcher: row.scope_matcher,
      priority: row.priority,
      status: row.status as any,
      supersedesId: row.supersedes_id
    };
  }

  async approveDirective(id: string): Promise<void> {
    this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query(
        `SELECT * FROM memory_directives WHERE id = $1 AND companion_id = $2 FOR UPDATE`,
        [id, this.companionId]
      );

      if (res.rowCount === 0) {
        throw new Error(`Directive not found`);
      }

      const pending = res.rows[0];
      if (pending.status !== 'PENDING') {
        throw new Error(`Directive is already ${pending.status}`);
      }

      await client.query(
        `UPDATE memory_directives SET status = 'ACTIVE' WHERE id = $1`,
        [id]
      );

      if (pending.supersedes_id) {
        await client.query(
          `UPDATE memory_directives SET status = 'SUPERSEDED' WHERE id = $1 AND companion_id = $2`,
          [pending.supersedes_id, this.companionId]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async rejectDirective(id: string): Promise<void> {
    this.ensureInitialized();
    await this.pool.query(
      `UPDATE memory_directives SET status = 'REJECTED' WHERE id = $1 AND companion_id = $2`,
      [id, this.companionId]
    );
  }

  async revokeDirective(id: string): Promise<void> {
    this.ensureInitialized();
    await this.pool.query(
      `UPDATE memory_directives SET status = 'SUPERSEDED' WHERE id = $1 AND companion_id = $2`,
      [id, this.companionId]
    );
  }

  async disableDirective(id: string): Promise<void> {
    this.ensureInitialized();
    await this.pool.query(
      `UPDATE memory_directives SET status = 'DISABLED' WHERE id = $1 AND companion_id = $2`,
      [id, this.companionId]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async addSourceEvent(event: SourceEvent): Promise<SourceEvent> {
    this.ensureInitialized();
    await this.pool.query(
      `INSERT INTO memory_source_events (id, companion_id, source_type, occurred_at, payload, schema_version)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [event.id, this.companionId, event.sourceType, event.occurredAt, JSON.stringify(event.payload), event.schemaVersion || 1]
    );
    return event;
  }

  async getSourceEvent(id: string): Promise<SourceEvent | undefined> {
    this.ensureInitialized();
    const result = await this.pool.query(
      `SELECT id, source_type, occurred_at, payload, schema_version
       FROM memory_source_events WHERE id = $1 AND companion_id = $2`,
      [id, this.companionId]
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      sourceType: row.source_type,
      occurredAt: row.occurred_at,
      payload: row.payload,
      schemaVersion: row.schema_version,
    };
  }
}
