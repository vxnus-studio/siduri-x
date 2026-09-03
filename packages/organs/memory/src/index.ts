import { MemoryOrgan, Claim, MemoryScope, BehaviorDirective, SourceEvent, MemoryQueryOptions } from '@siduri-x/core';
import { Pool } from 'pg';
import { UP_MIGRATION } from './schema';
export * from './teaching';

export interface PostgresMemoryConfig {
  connectionString: string;
  maxConnections?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  maxQueryTimeoutMillis?: number;
}

export class PostgresMemoryOrgan implements MemoryOrgan {
  private pool: Pool;
  private companionId: string | null = null;
  private readonly queryTimeoutMs: number;

  constructor(config: Partial<PostgresMemoryConfig> = {}) {
    this.queryTimeoutMs = config.maxQueryTimeoutMillis ?? 5000;
    const connectionString = config.connectionString || (typeof process !== 'undefined' && process.env ? process.env.DATABASE_URL : undefined);
    this.pool = new Pool({
      connectionString,
      max: config.maxConnections ?? 10,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 3000,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 10000,
    });
  }

  async runMigrations(): Promise<void> {
    await this.pool.query(UP_MIGRATION);
    // Keep databases created by the first Siduri-X migration compatible with
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
      replaces: row.replaces
    };
  }

  async searchClaims(
    query: string,
    scopeOrOptions: MemoryScope | MemoryQueryOptions = 'PUBLIC',
    limit: number = 10
  ): Promise<Claim[]> {
    this.ensureInitialized();

    const isOptionObject = typeof scopeOrOptions === 'object' && scopeOrOptions !== null;
    const channel = isOptionObject ? scopeOrOptions.channel : undefined;
    const audienceId = isOptionObject ? scopeOrOptions.audienceId : undefined;
    const sensitivity = isOptionObject ? scopeOrOptions.sensitivity : undefined;
    const effectiveLimit = isOptionObject ? (scopeOrOptions.limit ?? limit) : limit;

    const minConfidence = isOptionObject && typeof scopeOrOptions.minConfidence === 'number'
      ? scopeOrOptions.minConfidence
      : 0.5;

    let sql = `SELECT * FROM memory_claims WHERE companion_id = $1 AND status = 'APPROVED'`;
    const params: any[] = [this.companionId];

    // Enforce temporal validity: claim must be valid now (valid_from <= NOW or NULL, and valid_until >= NOW or NULL)
    sql += ` AND (valid_from IS NULL OR valid_from <= NOW()) AND (valid_until IS NULL OR valid_until >= NOW())`;

    // Enforce confidence threshold
    sql += ` AND confidence >= $${params.length + 1}`;
    params.push(minConfidence);

    if (isOptionObject) {
      if (channel === 'public' || (!channel && !audienceId)) {
        // Public channel: only records marked public sensitivity and public-safe audience
        sql += ` AND (sensitivity = 'public' OR scope = 'PUBLIC')`;
        if (audienceId) {
          sql += ` AND (allowed_audiences @> $${params.length + 1} OR allowed_audiences = '[]'::jsonb)`;
          params.push(JSON.stringify([audienceId]));
        }
      } else if (channel === 'direct') {
        // Direct channel: public + direct audience records
        sql += ` AND (sensitivity IN ('public', 'private') OR scope IN ('PUBLIC', 'VIEWER'))`;
        if (audienceId) {
          sql += ` AND (allowed_audiences @> $${params.length + 1} OR allowed_audiences = '[]'::jsonb)`;
          params.push(JSON.stringify([audienceId]));
        }
      } else if (channel === 'private') {
        // Private channel: public + direct + private restricted records
        sql += ` AND (sensitivity IN ('public', 'private', 'restricted') OR scope IN ('PUBLIC', 'VIEWER', 'OWNER'))`;
        if (audienceId) {
          sql += ` AND (allowed_audiences @> $${params.length + 1} OR allowed_audiences = '[]'::jsonb)`;
          params.push(JSON.stringify([audienceId]));
        }
      } else if (channel === 'operator') {
        // Operator channel: explicit operator audience
        if (audienceId) {
          sql += ` AND (allowed_audiences @> $${params.length + 1} OR allowed_audiences = '[]'::jsonb)`;
          params.push(JSON.stringify([audienceId]));
        }
      }
      if (sensitivity) {
        sql += ` AND sensitivity = $${params.length + 1}`;
        params.push(sensitivity);
      }
    } else {
      // Legacy MemoryScope fallback
      const safeScope = ['OWNER', 'VIEWER', 'OPERATOR', 'PUBLIC'].includes(scopeOrOptions)
        ? scopeOrOptions
        : 'PUBLIC';
      sql += ` AND (scope = 'PUBLIC' OR scope = '${safeScope}')`;
    }

    const safeLimit = Math.min(Math.max(1, effectiveLimit || 10), 100);

    if (query && query.trim()) {
      // Split on whitespace or punctuation, keeping alphanumeric and non-ASCII unicode characters
      const rawTerms = Array.from(new Set(query.toLowerCase().split(/[\s,.;:!?_#@$*()\[\]{}"'\\\/~`^&+=|<>-]+/)));
      // Filter out empty strings or characters that would break tsquery syntax
      const safeTerms = rawTerms
        .map(t => t.replace(/['":*&|!()\\]/g, '').trim())
        .filter(t => t.length > 0)
        .sort();

      if (safeTerms.length === 0) {
        return [];
      }

      const tsQueryStr = safeTerms.map(term => `${term}:*`).join(' | ');
      const queryParamIndex = params.length + 1;
      sql += ` AND search_document @@ to_tsquery('simple', $${queryParamIndex})`;
      params.push(tsQueryStr);
      sql += ` ORDER BY ts_rank(search_document, to_tsquery('simple', $${queryParamIndex})) DESC LIMIT $${params.length + 1}`;
      params.push(safeLimit);
    } else {
      sql += ` ORDER BY id LIMIT $${params.length + 1}`;
      params.push(safeLimit);
    }

    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => this.mapClaim(row));
  }

  async getDirectives(): Promise<BehaviorDirective[]> {
    this.ensureInitialized();
    const result = await this.pool.query(
      `SELECT * FROM memory_directives WHERE companion_id = $1 AND status = 'ACTIVE' ORDER BY priority DESC`,
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

  async approveClaim(id: string): Promise<void> {
    this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT id, status FROM memory_claims WHERE id = $1 AND companion_id = $2 FOR UPDATE`,
        [id, this.companionId]
      );
      if (res.rowCount === 0) {
        throw new Error(`Claim not found`);
      }
      if (res.rows[0].status !== 'PENDING') {
        throw new Error(`Invalid transition: Claim is already ${res.rows[0].status}`);
      }

      await client.query(
        `UPDATE memory_claims
         SET status = 'APPROVED', user_confirmation = 'explicit'
         WHERE id = $1 AND companion_id = $2`,
        [id, this.companionId]
      );
      await this.recordClaimHistoryWithClient(client, id, 'APPROVED', 'operator_approved');
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async rejectClaim(id: string): Promise<void> {
    this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT id, status FROM memory_claims WHERE id = $1 AND companion_id = $2 FOR UPDATE`,
        [id, this.companionId]
      );
      if (res.rowCount === 0) {
        throw new Error(`Claim not found`);
      }
      if (res.rows[0].status !== 'PENDING') {
        throw new Error(`Invalid transition: Claim is already ${res.rows[0].status}`);
      }

      await client.query(
        `UPDATE memory_claims SET status = 'REJECTED' WHERE id = $1 AND companion_id = $2`,
        [id, this.companionId]
      );
      await this.recordClaimHistoryWithClient(client, id, 'REJECTED', 'operator_rejected');
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async markClaimSessionOnly(id: string): Promise<void> {
    this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT id, status FROM memory_claims WHERE id = $1 AND companion_id = $2 FOR UPDATE`,
        [id, this.companionId]
      );
      if (res.rowCount === 0) {
        throw new Error(`Claim not found`);
      }
      if (res.rows[0].status !== 'PENDING') {
        throw new Error(`Invalid transition: Claim is already ${res.rows[0].status}`);
      }

      await client.query(
        `UPDATE memory_claims SET status = 'SESSION_ONLY' WHERE id = $1 AND companion_id = $2`,
        [id, this.companionId]
      );
      await this.recordClaimHistoryWithClient(client, id, 'SESSION_ONLY', 'marked_session_only');
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async expireClaim(id: string): Promise<void> {
    this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT id, status FROM memory_claims WHERE id = $1 AND companion_id = $2 FOR UPDATE`,
        [id, this.companionId]
      );
      if (res.rowCount === 0) {
        throw new Error(`Claim not found`);
      }
      if (res.rows[0].status !== 'PENDING' && res.rows[0].status !== 'APPROVED' && res.rows[0].status !== 'SESSION_ONLY') {
        throw new Error(`Invalid transition: Claim is already ${res.rows[0].status}`);
      }

      await client.query(
        `UPDATE memory_claims SET status = 'EXPIRED' WHERE id = $1 AND companion_id = $2`,
        [id, this.companionId]
      );
      await this.recordClaimHistoryWithClient(client, id, 'EXPIRED', 'claim_expired');
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async revokeClaim(id: string, reason: string = 'revoked_by_policy'): Promise<void> {
    this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT id, status FROM memory_claims WHERE id = $1 AND companion_id = $2 FOR UPDATE`,
        [id, this.companionId]
      );
      if (res.rowCount === 0) {
        throw new Error(`Claim not found`);
      }
      if (res.rows[0].status !== 'APPROVED') {
        throw new Error(`Invalid transition: Only APPROVED claims can be REVOKED (current: ${res.rows[0].status})`);
      }

      await client.query(
        `UPDATE memory_claims SET status = 'REVOKED' WHERE id = $1 AND companion_id = $2`,
        [id, this.companionId]
      );
      await this.recordClaimHistoryWithClient(client, id, 'REVOKED', reason);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getClaims(limit: number = 100): Promise<Claim[]> {
    this.ensureInitialized();
    const safeLimit = Math.min(Math.max(1, limit || 100), 1000);
    const result = await this.pool.query(
      `SELECT * FROM memory_claims WHERE companion_id = $1 ORDER BY id DESC LIMIT $2`,
      [this.companionId, safeLimit]
    );
    return result.rows.map((row) => this.mapClaim(row));
  }

  async getPendingClaims(limit: number = 100): Promise<Claim[]> {
    this.ensureInitialized();
    const safeLimit = Math.min(Math.max(1, limit || 100), 1000);
    const result = await this.pool.query(
      `SELECT * FROM memory_claims WHERE companion_id = $1 AND status = 'PENDING' ORDER BY id DESC LIMIT $2`,
      [this.companionId, safeLimit]
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
      `UPDATE memory_directives SET status = 'REVOKED' WHERE id = $1 AND companion_id = $2`,
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

  async expireDirective(id: string): Promise<void> {
    this.ensureInitialized();
    await this.pool.query(
      `UPDATE memory_directives SET status = 'EXPIRED' WHERE id = $1 AND companion_id = $2`,
      [id, this.companionId]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async recordClaimHistoryWithClient(client: any, id: string, status: string, reason: string): Promise<void> {
    await client.query(
      `INSERT INTO memory_claim_history (claim_id, companion_id, status, reason, snapshot)
       SELECT id, companion_id, $3, $4, to_jsonb(memory_claims)
       FROM memory_claims WHERE id = $1 AND companion_id = $2`,
      [id, this.companionId, status, reason]
    );
  }

  async supersedeClaim(id: string, replacement: Omit<Claim, 'id' | 'status' | 'companionId'>): Promise<Claim> {
    this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const prev = await client.query(
        `SELECT id, status FROM memory_claims WHERE id = $1 AND companion_id = $2 FOR UPDATE`,
        [id, this.companionId]
      );
      if (prev.rowCount === 0) {
        throw new Error(`Superseded claim ${id} not found`);
      }
      if (prev.rows[0].status !== 'APPROVED') {
        throw new Error(`Cannot supersede claim in status ${prev.rows[0].status}`);
      }

      await client.query(
        `UPDATE memory_claims SET status = 'SUPERSEDED' WHERE id = $1 AND companion_id = $2`,
        [id, this.companionId]
      );
      await this.recordClaimHistoryWithClient(client, id, 'SUPERSEDED', 'claim_replaced');

      const result = await client.query(
        `INSERT INTO memory_claims
         (companion_id, subject, predicate, value, status, scope, evidence, provenance,
          source_event_id, claim_type, authority, user_confirmation, sensitivity,
          allowed_audiences, confidence, valid_from, valid_until, supersedes, replaces)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING *`,
        [
          this.companionId,
          replacement.subject,
          replacement.predicate,
          replacement.value,
          'PENDING',
          replacement.scope,
          JSON.stringify(replacement.evidence || []),
          replacement.provenance || 'siduri_y_memory',
          replacement.sourceEventId || null,
          replacement.claimType || 'semantic',
          replacement.authority || 'user_explicit',
          replacement.userConfirmation || 'none',
          replacement.sensitivity || 'private',
          JSON.stringify(replacement.allowedAudiences || []),
          replacement.confidence ?? 1,
          replacement.validFrom || null,
          replacement.validUntil || null,
          id,
          replacement.replaces || null
        ]
      );

      await client.query('COMMIT');
      return this.mapClaim(result.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
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

  async updateClaim(
    id: string,
    updates: Partial<Pick<Claim, 'subject' | 'predicate' | 'value' | 'scope' | 'sensitivity' | 'confidence' | 'validFrom' | 'validUntil' | 'allowedAudiences'>>
  ): Promise<Claim> {
    this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const prev = await client.query(
        `SELECT * FROM memory_claims WHERE id = $1 AND companion_id = $2 FOR UPDATE`,
        [id, this.companionId]
      );
      if (prev.rowCount === 0) {
        throw new Error(`Claim not found`);
      }

      const current = prev.rows[0];
      const newSubject = updates.subject ?? current.subject;
      const newPredicate = updates.predicate ?? current.predicate;
      const newValue = updates.value ?? current.value;
      const newScope = updates.scope ?? current.scope;
      const newSensitivity = updates.sensitivity ?? current.sensitivity;
      const newConfidence = updates.confidence ?? current.confidence;
      const newValidFrom = updates.validFrom ?? current.valid_from;
      const newValidUntil = updates.validUntil ?? current.valid_until;
      const newAudiences = updates.allowedAudiences !== undefined
        ? JSON.stringify(updates.allowedAudiences)
        : JSON.stringify(current.allowed_audiences || []);

      const updateRes = await client.query(
        `UPDATE memory_claims
         SET subject = $3, predicate = $4, value = $5, scope = $6,
             sensitivity = $7, confidence = $8, valid_from = $9, valid_until = $10,
             allowed_audiences = $11::jsonb
         WHERE id = $1 AND companion_id = $2
         RETURNING *`,
        [
          id,
          this.companionId,
          newSubject,
          newPredicate,
          newValue,
          newScope,
          newSensitivity,
          newConfidence,
          newValidFrom || null,
          newValidUntil || null,
          newAudiences,
        ]
      );

      await this.recordClaimHistoryWithClient(client, id, current.status, 'claim_updated');
      await client.query('COMMIT');
      return this.mapClaim(updateRes.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async resetMemory(): Promise<void> {
    this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM memory_claims WHERE companion_id = $1`, [this.companionId]);
      await client.query(`DELETE FROM memory_claim_history WHERE companion_id = $1`, [this.companionId]);
      await client.query(`DELETE FROM memory_directives WHERE companion_id = $1`, [this.companionId]);
      await client.query(`DELETE FROM memory_source_events WHERE companion_id = $1`, [this.companionId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
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

export async function probeMemoryHealth(context: { config?: any; env?: Record<string, string | undefined> }): Promise<{ ok: boolean; message?: string }> {
  const connectionString = context?.config?.connectionString || context?.env?.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    return {
      ok: false,
      message: 'Missing DATABASE_URL for Memory organ.',
    };
  }
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000 });
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    return { ok: true, message: 'PostgreSQL connection successful' };
  } catch (err: any) {
    await pool.end().catch(() => {});
    return {
      ok: false,
      message: `PostgreSQL connection failed: ${err.message}`,
    };
  }
}

