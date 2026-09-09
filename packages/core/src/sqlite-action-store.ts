import { ActionAuditEvent } from './action';
import { ActionStore, PersistentExecutionRecord, canonicalizeJson } from './capability';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

export interface SqliteActionStoreOptions {
  dbPath?: string;
}

export class SqliteActionStore implements ActionStore {
  private db: any;
  private lastAuditHash: string = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(options: SqliteActionStoreOptions = {}) {
    const dbPath = options.dbPath ?? ':memory:';
    // Dynamically require node:sqlite (supported natively in Node.js >= 22)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(dbPath);

    this.initSchema();
    this.initLastAuditHash();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS action_executions (
        execution_id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        parameters_hash TEXT NOT NULL,
        lifecycle TEXT NOT NULL,
        decision_json TEXT,
        result_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS action_approvals (
        execution_id TEXT PRIMARY KEY,
        approver_actor_id TEXT NOT NULL,
        reason TEXT,
        approved_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS action_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        provider_id TEXT,
        companion_id TEXT NOT NULL,
        actor_id TEXT,
        session_id TEXT,
        channel TEXT,
        correlation_id TEXT,
        risk_level TEXT NOT NULL,
        lifecycle TEXT NOT NULL,
        decision_json TEXT,
        parameters_hash TEXT,
        result_hash TEXT,
        event_hash TEXT NOT NULL,
        previous_event_hash TEXT NOT NULL,
        duration_ms REAL,
        error TEXT,
        timestamp TEXT NOT NULL
      );
    `);
  }

  private initLastAuditHash(): void {
    const row = this.db.prepare('SELECT event_hash FROM action_audit_log ORDER BY id DESC LIMIT 1').get();
    if (row && typeof row.event_hash === 'string') {
      this.lastAuditHash = row.event_hash;
    }
  }

  async reserveExecution(record: PersistentExecutionRecord): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO action_executions (
          execution_id, action_id, tool_name, provider_id, parameters_hash,
          lifecycle, decision_json, result_json, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        record.executionId,
        record.actionId,
        record.toolName,
        record.providerId,
        record.parametersHash,
        record.lifecycle,
        record.decision ? JSON.stringify(record.decision) : null,
        record.result !== undefined ? JSON.stringify(record.result) : null,
        record.error ?? null,
        record.createdAt,
        record.updatedAt
      );
      return true;
    } catch (err: any) {
      // Primary key constraint violation on execution_id
      if (err.message && (err.message.includes('UNIQUE constraint failed') || err.message.includes('constraint failed'))) {
        return false;
      }
      throw err;
    }
  }

  async updateExecution(record: PersistentExecutionRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO action_executions (
        execution_id, action_id, tool_name, provider_id, parameters_hash,
        lifecycle, decision_json, result_json, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(execution_id) DO UPDATE SET
        action_id = excluded.action_id,
        tool_name = excluded.tool_name,
        provider_id = excluded.provider_id,
        parameters_hash = excluded.parameters_hash,
        lifecycle = excluded.lifecycle,
        decision_json = excluded.decision_json,
        result_json = excluded.result_json,
        error = excluded.error,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.executionId,
      record.actionId,
      record.toolName,
      record.providerId,
      record.parametersHash,
      record.lifecycle,
      record.decision ? JSON.stringify(record.decision) : null,
      record.result !== undefined ? JSON.stringify(record.result) : null,
      record.error ?? null,
      record.createdAt,
      record.updatedAt
    );
  }

  async getExecution(executionId: string): Promise<PersistentExecutionRecord | undefined> {
    const stmt = this.db.prepare('SELECT * FROM action_executions WHERE execution_id = ?');
    const row = stmt.get(executionId);
    if (!row) {
      return undefined;
    }

    return {
      executionId: row.execution_id,
      actionId: row.action_id,
      toolName: row.tool_name,
      providerId: row.provider_id,
      parametersHash: row.parameters_hash,
      lifecycle: row.lifecycle,
      decision: row.decision_json ? JSON.parse(row.decision_json) : undefined,
      result: row.result_json ? JSON.parse(row.result_json) : undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async saveApproval(executionId: string, approverActorId: string, reason?: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO action_approvals (execution_id, approver_actor_id, reason, approved_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(execution_id) DO UPDATE SET
        approver_actor_id = excluded.approver_actor_id,
        reason = excluded.reason,
        approved_at = excluded.approved_at
    `);
    stmt.run(executionId, approverActorId, reason ?? null, new Date().toISOString());
  }

  async isActionApproved(executionId: string): Promise<boolean> {
    const stmt = this.db.prepare('SELECT 1 FROM action_approvals WHERE execution_id = ?');
    const row = stmt.get(executionId);
    return !!row;
  }

  async appendAudit(event: ActionAuditEvent): Promise<void> {
    const prevHash = this.lastAuditHash;
    const eventPayload = {
      executionId: event.executionId,
      actionId: event.actionId,
      toolName: event.toolName,
      providerId: event.providerId || null,
      companionId: event.companionId,
      actorId: event.actorId || null,
      sessionId: event.sessionId || null,
      channel: event.channel || null,
      correlationId: event.correlationId || null,
      riskLevel: event.riskLevel,
      lifecycle: event.lifecycle,
      decision: event.decision ? {
        allowed: event.decision.allowed,
        reason: event.decision.reason,
        riskLevel: event.decision.riskLevel,
        decisionCode: event.decision.decisionCode,
      } : null,
      parametersHash: event.parametersHash || null,
      error: event.error || null,
      timestamp: event.timestamp,
    };
    const canonical = canonicalizeJson(eventPayload);
    const eventHash = crypto
      .createHash('sha256')
      .update(`${prevHash}:${canonical}`, 'utf8')
      .digest('hex');
    this.lastAuditHash = eventHash;

    const resultHash = event.resultHash || eventHash;

    const stmt = this.db.prepare(`
      INSERT INTO action_audit_log (
        execution_id, action_id, tool_name, provider_id, companion_id,
        actor_id, session_id, channel, correlation_id, risk_level,
        lifecycle, decision_json, parameters_hash, result_hash, event_hash,
        previous_event_hash, duration_ms, error, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.executionId,
      event.actionId,
      event.toolName,
      event.providerId ?? null,
      event.companionId,
      event.actorId ?? null,
      event.sessionId ?? null,
      event.channel ?? null,
      event.correlationId ?? null,
      event.riskLevel,
      event.lifecycle,
      event.decision ? JSON.stringify(event.decision) : null,
      event.parametersHash ?? null,
      resultHash,
      eventHash,
      prevHash,
      event.durationMs ?? null,
      event.error ?? null,
      event.timestamp
    );
  }

  async getAuditLog(executionId?: string): Promise<ActionAuditEvent[]> {
    let rows: any[];
    if (executionId) {
      const stmt = this.db.prepare('SELECT * FROM action_audit_log WHERE execution_id = ? ORDER BY id ASC');
      rows = stmt.all(executionId);
    } else {
      const stmt = this.db.prepare('SELECT * FROM action_audit_log ORDER BY id ASC');
      rows = stmt.all();
    }

    return rows.map((row: any) => ({
      executionId: row.execution_id,
      actionId: row.action_id,
      toolName: row.tool_name,
      providerId: row.provider_id ?? undefined,
      companionId: row.companion_id,
      actorId: row.actor_id ?? undefined,
      sessionId: row.session_id ?? undefined,
      channel: row.channel ?? undefined,
      correlationId: row.correlation_id ?? undefined,
      riskLevel: row.risk_level,
      lifecycle: row.lifecycle,
      decision: row.decision_json ? JSON.parse(row.decision_json) : undefined,
      parametersHash: row.parameters_hash ?? undefined,
      resultHash: row.result_hash ?? undefined,
      eventHash: row.event_hash,
      previousEventHash: row.previous_event_hash,
      durationMs: row.duration_ms ?? undefined,
      error: row.error ?? undefined,
      timestamp: row.timestamp,
    }));
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}
