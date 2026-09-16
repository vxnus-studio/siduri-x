// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite');

import { ClaimStatus, DirectiveStatus } from './proposals';

// ==========================================
// Type Definitions
// ==========================================

// --- Self Domain Types ---
export interface SelfIdentity {
  companionId: string;
  name: string;
  archetype?: string;
  role?: string;
  origin?: string;
  ethos?: string;
  version: string;
  updatedAt: string;
}

export interface PersonalityTraits {
  warmth?: number;
  formality?: number;
  sarcasm?: number;
  verbosity?: number;
  curiosity?: number;
}

export interface SelfDirective {
  id: string;
  companionId: string;
  priority?: number;
  directive: string;
  status: DirectiveStatus;
  category: 'behavioral' | 'guardrail' | 'relational' | string;
  scopeActor?: string;
  supersedesId?: string;
  createdAt?: string;
}

export interface SelfRelationship {
  companionId: string;
  entityId: string;
  entityType?: 'human' | 'companion' | 'system';
  name?: string;
  affiliation?: string;
  role?: string;
  stance?: string;
  trustScore?: number;
  familiarity?: number;
  interactionConventions: string[];
  updatedAt?: string;
}

export interface SelfDialogueExample {
  id?: string;
  companionId?: string;
  user: string;
  assistant: string;
  createdAt?: string;
}

// --- Knowledge Domain Types ---
export interface LifeInventoryItem {
  id: string;
  companionId: string;
  domain: string;
  entityName: string;
  properties: Record<string, unknown>;
  updatedAt: string;
}

export interface LifeFinanceEntry {
  id: string;
  companionId: string;
  category: string;
  amount: number;
  currency: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface LifeScheduleItem {
  id: string;
  companionId: string;
  title: string;
  startTime: string;
  endTime?: string;
  isRecurring: boolean;
  status: string;
}

export interface LifePreference {
  id: string;
  companionId: string;
  preferenceKey: string;
  preferenceValue: string;
  category: string;
  updatedAt: string;
}

// --- Memory Domain Types ---
export interface EpisodicEvent {
  id: string;
  companionId: string;
  sourceType: 'chat_turn' | 'tool_result' | 'sensory';
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface MemoryClaim {
  id: string;
  companionId: string;
  subject: string;
  predicate: string;
  value: string;
  status: ClaimStatus;
  confidence: number;
  validFrom?: string;
  validUntil?: string;
  evidence?: string[];
  assertedAt: string;
  supersedes?: string;
  sourceEventId?: string;
}

export function normalizeStatus(status?: string, defaultStatus: string = 'pending'): string {
  if (!status) return defaultStatus;
  return status.toLowerCase().replace(/_/g, '-');
}


// ==========================================
// Database Class
// ==========================================

export interface SiduriDatabaseOptions {
  dbPath?: string;
}

export class SiduriDatabase {
  private db: any;

  constructor(options: SiduriDatabaseOptions = {}) {
    const dbPath = options.dbPath || ':memory:';
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    const schema = `
      -- Self Tables
      CREATE TABLE IF NOT EXISTS self_identity (
        companion_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        archetype TEXT,
        role TEXT,
        origin TEXT,
        ethos TEXT,
        version TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS self_personality (
        companion_id TEXT PRIMARY KEY,
        warmth REAL DEFAULT 0.5,
        formality REAL DEFAULT 0.5,
        sarcasm REAL DEFAULT 0.5,
        verbosity REAL DEFAULT 0.5,
        curiosity REAL DEFAULT 0.5,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS self_directives (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        priority INTEGER DEFAULT 50,
        directive TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        category TEXT DEFAULT 'behavioral',
        scope_actor TEXT,
        supersedes_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS self_relationships (
        companion_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL DEFAULT 'human',
        name TEXT,
        affiliation TEXT,
        role TEXT DEFAULT 'user',
        stance TEXT DEFAULT 'neutral',
        trust_score REAL DEFAULT 0.5,
        familiarity REAL DEFAULT 0.5,
        interaction_conventions TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY(companion_id, entity_id)
      );

      CREATE TABLE IF NOT EXISTS self_exemplars (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        user_prompt TEXT NOT NULL,
        companion_response TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Knowledge Tables
      CREATE TABLE IF NOT EXISTS life_inventory (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        entity_name TEXT NOT NULL,
        properties TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS life_finance (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        timestamp TEXT DEFAULT (datetime('now')),
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS life_schedule (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        title TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        is_recurring INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS life_preferences (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        preference_key TEXT NOT NULL,
        preference_value TEXT NOT NULL,
        category TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Memory Tables
      CREATE TABLE IF NOT EXISTS memory_events (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        occurred_at TEXT DEFAULT (datetime('now')),
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_claims (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        predicate TEXT NOT NULL,
        value TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        confidence REAL DEFAULT 1.0,
        valid_from TEXT,
        valid_until TEXT,
        evidence TEXT,
        asserted_at TEXT DEFAULT (datetime('now')),
        supersedes TEXT,
        source_event_id TEXT
      );

      -- FTS5 Virtual Table for Memory Claims
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_search USING fts5(
        subject,
        predicate,
        value,
        content='memory_claims',
        content_rowid='rowid'
      );

      -- FTS5 Triggers
      CREATE TRIGGER IF NOT EXISTS memory_claims_ai AFTER INSERT ON memory_claims BEGIN
        INSERT INTO memory_search(rowid, subject, predicate, value) 
        VALUES (new.rowid, new.subject, new.predicate, new.value);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_claims_ad AFTER DELETE ON memory_claims BEGIN
        INSERT INTO memory_search(memory_search, rowid, subject, predicate, value) 
        VALUES('delete', old.rowid, old.subject, old.predicate, old.value);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_claims_au AFTER UPDATE ON memory_claims BEGIN
        INSERT INTO memory_search(memory_search, rowid, subject, predicate, value) 
        VALUES('delete', old.rowid, old.subject, old.predicate, old.value);
        INSERT INTO memory_search(rowid, subject, predicate, value) 
        VALUES (new.rowid, new.subject, new.predicate, new.value);
      END;
    `;
    this.db.exec(schema);

    try {
      this.db.exec("ALTER TABLE memory_claims ADD COLUMN supersedes TEXT");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE memory_claims ADD COLUMN source_event_id TEXT");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE self_identity ADD COLUMN origin TEXT");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE self_identity ADD COLUMN ethos TEXT");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE self_directives ADD COLUMN scope_actor TEXT");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE self_relationships ADD COLUMN role TEXT DEFAULT 'user'");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE self_relationships ADD COLUMN stance TEXT DEFAULT 'neutral'");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE self_relationships ADD COLUMN updated_at TEXT");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE self_identity ADD COLUMN role TEXT");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE self_relationships ADD COLUMN name TEXT");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE self_relationships ADD COLUMN affiliation TEXT");
    } catch {
      // Column already exists
    }

    try {
      // Reconcile creator claims that may have been recorded before origin dual-promotion
      const creatorClaims = this.db.prepare(`
        SELECT * FROM memory_claims
        WHERE predicate = 'stated_relationship'
          AND LOWER(value) LIKE '%creator%'
          AND LOWER(status) = 'approved'
      `).all() as any[];

      for (const claim of creatorClaims) {
        const identity = this.db.prepare(`SELECT * FROM self_identity WHERE companion_id = ?`).get(claim.companion_id) as any;
        if (identity && !identity.origin) {
          const nameClaim = this.db.prepare(`
            SELECT value FROM memory_claims
            WHERE companion_id = ? AND subject = ? AND predicate = 'name' AND LOWER(status) = 'approved'
            ORDER BY asserted_at DESC LIMIT 1
          `).get(claim.companion_id, claim.subject) as any;
          const originName = nameClaim?.value || (claim.subject.startsWith('actor:') ? claim.subject.slice(6) : claim.subject);
          this.db.prepare(`UPDATE self_identity SET origin = ? WHERE companion_id = ?`).run(originName, claim.companion_id);
        }

        const rel = this.db.prepare(`SELECT * FROM self_relationships WHERE companion_id = ? AND entity_id = ?`).get(claim.companion_id, claim.subject) as any;
        if (rel && (rel.role !== 'creator' || rel.stance !== 'familiar_loyal')) {
          this.db.prepare(`UPDATE self_relationships SET role = 'creator', stance = 'familiar_loyal', trust_score = 1.0 WHERE companion_id = ? AND entity_id = ?`).run(claim.companion_id, claim.subject);
        }
      }
    } catch {
      // Best-effort auto-reconciliation
    }
  }

  public close(): void {
    this.db.close();
  }

  // ==========================================
  // Self Domain Methods
  // ==========================================

  public getIdentity(companionId: string): SelfIdentity | undefined {
    const stmt = this.db.prepare('SELECT * FROM self_identity WHERE companion_id = ?');
    const row = stmt.get(companionId) as any;
    if (!row) return undefined;
    return {
      companionId: row.companion_id,
      name: row.name,
      archetype: row.archetype || undefined,
      role: row.role || row.archetype || undefined,
      origin: row.origin || undefined,
      ethos: row.ethos || undefined,
      version: row.version,
      updatedAt: row.updated_at
    };
  }

  public setIdentity(identity: SelfIdentity): void {
    const role = identity.role || identity.archetype || null;
    const archetype = identity.archetype || identity.role || null;
    const stmt = this.db.prepare(`
      INSERT INTO self_identity (companion_id, name, archetype, role, origin, ethos, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(companion_id) DO UPDATE SET
        name = excluded.name,
        archetype = excluded.archetype,
        role = excluded.role,
        origin = excluded.origin,
        ethos = excluded.ethos,
        version = excluded.version,
        updated_at = datetime('now')
    `);
    stmt.run(identity.companionId, identity.name, archetype, role, identity.origin || null, identity.ethos || null, identity.version);
  }

  public getPersonality(companionId: string): PersonalityTraits | undefined {
    const stmt = this.db.prepare('SELECT * FROM self_personality WHERE companion_id = ?');
    const row = stmt.get(companionId);
    if (!row) return undefined;
    return {
      warmth: row.warmth,
      formality: row.formality,
      sarcasm: row.sarcasm,
      verbosity: row.verbosity,
      curiosity: row.curiosity
    };
  }

  public setPersonality(companionId: string, traits: PersonalityTraits): void {
    const stmt = this.db.prepare(`
      INSERT INTO self_personality (companion_id, warmth, formality, sarcasm, verbosity, curiosity, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(companion_id) DO UPDATE SET
        warmth = excluded.warmth,
        formality = excluded.formality,
        sarcasm = excluded.sarcasm,
        verbosity = excluded.verbosity,
        curiosity = excluded.curiosity,
        updated_at = datetime('now')
    `);
    stmt.run(
      companionId,
      traits.warmth,
      traits.formality,
      traits.sarcasm,
      traits.verbosity,
      traits.curiosity
    );
  }

  private rowToSelfDirective(row: any): SelfDirective {
    return {
      id: row.id,
      companionId: row.companion_id,
      priority: row.priority,
      directive: row.directive,
      status: normalizeStatus(row.status, 'active') as any,
      category: row.category,
      scopeActor: row.scope_actor || undefined,
      supersedesId: row.supersedes_id || undefined,
      createdAt: row.created_at,
    };
  }

  public getActiveDirectives(companionId: string): SelfDirective[] {
    const stmt = this.db.prepare(`
      SELECT * FROM self_directives 
      WHERE companion_id = ? AND LOWER(status) = 'active'
      ORDER BY priority DESC, created_at ASC
    `);
    return stmt.all(companionId).map((row: any) => this.rowToSelfDirective(row));
  }

  public getAllDirectives(companionId: string): SelfDirective[] {
    const stmt = this.db.prepare(`
      SELECT * FROM self_directives 
      WHERE companion_id = ?
      ORDER BY priority DESC, created_at ASC
    `);
    return stmt.all(companionId).map((row: any) => this.rowToSelfDirective(row));
  }

  public commitDirective(directive: SelfDirective): void {
    const stmt = this.db.prepare(`
      INSERT INTO self_directives (id, companion_id, priority, directive, status, category, scope_actor, supersedes_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        companion_id = excluded.companion_id,
        priority = excluded.priority,
        directive = excluded.directive,
        status = excluded.status,
        category = excluded.category,
        scope_actor = excluded.scope_actor,
        supersedes_id = excluded.supersedes_id
    `);
    stmt.run(
      directive.id,
      directive.companionId,
      directive.priority !== undefined ? directive.priority : 50,
      directive.directive,
      normalizeStatus(directive.status, 'active'),
      directive.category || 'behavioral',
      directive.scopeActor || null,
      directive.supersedesId || null,
      directive.createdAt || new Date().toISOString()
    );
  }

  public getDirective(id: string, companionId?: string): SelfDirective | undefined {
    const stmt = companionId
      ? this.db.prepare('SELECT * FROM self_directives WHERE id = ? AND companion_id = ?')
      : this.db.prepare('SELECT * FROM self_directives WHERE id = ?');
    const row = (companionId ? stmt.get(id, companionId) : stmt.get(id)) as any;
    if (!row) return undefined;
    return this.rowToSelfDirective(row);
  }

  public approveDirective(id: string, companionId?: string): void {
    const findStmt = companionId
      ? this.db.prepare("SELECT id, companion_id, status, supersedes_id FROM self_directives WHERE id = ? AND companion_id = ?")
      : this.db.prepare("SELECT id, companion_id, status, supersedes_id FROM self_directives WHERE id = ?");
    const row = (companionId ? findStmt.get(id, companionId) : findStmt.get(id)) as any;
    if (!row) {
      return;
    }

    if (normalizeStatus(row.status) !== 'pending') {
      if (normalizeStatus(row.status) === 'active') {
        return;
      }
      throw new Error(
        `Cannot approve directive '${id}': invalid transition from status '${row.status}' to 'active' (only pending directives can be approved)`
      );
    }

    // If this directive supersedes an earlier directive, transition that prior directive to superseded
    if (row.supersedes_id) {
      const supersededId = row.supersedes_id;
      const effectiveCompanionId = companionId || row.companion_id;
      if (effectiveCompanionId) {
        const supersedeStmt = this.db.prepare(
          "UPDATE self_directives SET status = 'superseded' WHERE id = ? AND companion_id = ?"
        );
        supersedeStmt.run(supersededId, effectiveCompanionId);
      } else {
        const supersedeStmt = this.db.prepare("UPDATE self_directives SET status = 'superseded' WHERE id = ?");
        supersedeStmt.run(supersededId);
      }
    }

    if (companionId) {
      const stmt = this.db.prepare(
        "UPDATE self_directives SET status = 'active' WHERE id = ? AND companion_id = ? AND LOWER(status) = 'pending'"
      );
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare(
        "UPDATE self_directives SET status = 'active' WHERE id = ? AND LOWER(status) = 'pending'"
      );
      stmt.run(id);
    }
  }

  public rejectDirective(id: string, companionId?: string): void {
    const findStmt = companionId
      ? this.db.prepare("SELECT id, companion_id, status FROM self_directives WHERE id = ? AND companion_id = ?")
      : this.db.prepare("SELECT id, companion_id, status FROM self_directives WHERE id = ?");
    const row = (companionId ? findStmt.get(id, companionId) : findStmt.get(id)) as any;
    if (!row) {
      return;
    }

    if (normalizeStatus(row.status) !== 'pending') {
      throw new Error(
        `Cannot reject directive '${id}': invalid transition from status '${row.status}' to 'rejected' (only pending directives can be rejected)`
      );
    }

    if (companionId) {
      const stmt = this.db.prepare(
        "UPDATE self_directives SET status = 'rejected' WHERE id = ? AND companion_id = ? AND LOWER(status) = 'pending'"
      );
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare(
        "UPDATE self_directives SET status = 'rejected' WHERE id = ? AND LOWER(status) = 'pending'"
      );
      stmt.run(id);
    }
  }

  public revokeDirective(id: string, companionId?: string): void {
    if (companionId) {
      const stmt = this.db.prepare("UPDATE self_directives SET status = 'revoked' WHERE id = ? AND companion_id = ?");
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare("UPDATE self_directives SET status = 'revoked' WHERE id = ?");
      stmt.run(id);
    }
  }

  public expireDirective(id: string, companionId?: string): void {
    if (companionId) {
      const stmt = this.db.prepare("UPDATE self_directives SET status = 'expired' WHERE id = ? AND companion_id = ?");
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare("UPDATE self_directives SET status = 'expired' WHERE id = ?");
      stmt.run(id);
    }
  }

  public disableDirective(id: string, companionId?: string): void {
    if (companionId) {
      const stmt = this.db.prepare("UPDATE self_directives SET status = 'disabled' WHERE id = ? AND companion_id = ?");
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare("UPDATE self_directives SET status = 'disabled' WHERE id = ?");
      stmt.run(id);
    }
  }


  public getRelationship(companionId: string, entityId: string): SelfRelationship | undefined {
    const stripped = entityId.startsWith('actor:') ? entityId.slice(6) : entityId;
    const prefixed = entityId.startsWith('actor:') ? entityId : `actor:${entityId}`;
    const stmt = this.db.prepare('SELECT * FROM self_relationships WHERE companion_id = ? AND (entity_id = ? OR entity_id = ? OR entity_id = ?)');
    let row = stmt.get(companionId, entityId, stripped, prefixed) as any;
    if (!row && (entityId === 'owner-user' || entityId === 'local-user' || entityId === 'owner' || entityId === 'primary' || entityId === 'user')) {
      const fallbackStmt = this.db.prepare("SELECT * FROM self_relationships WHERE companion_id = ? AND entity_type = 'human' ORDER BY updated_at DESC LIMIT 1");
      row = fallbackStmt.get(companionId) as any;
    }
    if (!row) return undefined;
    return {
      companionId: row.companion_id,
      entityId: row.entity_id,
      entityType: row.entity_type || 'human',
      name: row.name || undefined,
      affiliation: row.affiliation || undefined,
      role: row.role || 'user',
      stance: row.stance || 'neutral',
      trustScore: row.trust_score !== undefined && row.trust_score !== null ? row.trust_score : 0.5,
      familiarity: row.familiarity !== undefined && row.familiarity !== null ? row.familiarity : 0.5,
      interactionConventions: row.interaction_conventions ? JSON.parse(row.interaction_conventions) : [],
      updatedAt: row.updated_at || undefined,
    };
  }

  public getRelationships(companionId: string): SelfRelationship[] {
    const stmt = this.db.prepare('SELECT * FROM self_relationships WHERE companion_id = ? ORDER BY entity_id ASC');
    return stmt.all(companionId).map((row: any) => ({
      companionId: row.companion_id,
      entityId: row.entity_id,
      entityType: row.entity_type || 'human',
      name: row.name || undefined,
      affiliation: row.affiliation || undefined,
      role: row.role || 'user',
      stance: row.stance || 'neutral',
      trustScore: row.trust_score !== undefined && row.trust_score !== null ? row.trust_score : 0.5,
      familiarity: row.familiarity !== undefined && row.familiarity !== null ? row.familiarity : 0.5,
      interactionConventions: row.interaction_conventions ? JSON.parse(row.interaction_conventions) : [],
      updatedAt: row.updated_at || undefined,
    }));
  }

  public upsertRelationship(rel: SelfRelationship): void {
    const stmt = this.db.prepare(`
      INSERT INTO self_relationships (companion_id, entity_id, entity_type, name, affiliation, role, stance, trust_score, familiarity, interaction_conventions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(companion_id, entity_id) DO UPDATE SET
        entity_type = excluded.entity_type,
        name = COALESCE(excluded.name, self_relationships.name),
        affiliation = COALESCE(excluded.affiliation, self_relationships.affiliation),
        role = COALESCE(excluded.role, self_relationships.role),
        stance = COALESCE(excluded.stance, self_relationships.stance),
        trust_score = excluded.trust_score,
        familiarity = excluded.familiarity,
        interaction_conventions = excluded.interaction_conventions,
        updated_at = datetime('now')
    `);
    stmt.run(
      rel.companionId,
      rel.entityId,
      rel.entityType || 'human',
      rel.name || null,
      rel.affiliation || null,
      rel.role || 'user',
      rel.stance || 'neutral',
      rel.trustScore !== undefined && rel.trustScore !== null ? rel.trustScore : 0.5,
      rel.familiarity !== undefined && rel.familiarity !== null ? rel.familiarity : 0.5,
      JSON.stringify(rel.interactionConventions || [])
    );
  }

  public getExemplars(companionId: string): SelfDialogueExample[] {
    const stmt = this.db.prepare('SELECT * FROM self_exemplars WHERE companion_id = ? ORDER BY created_at ASC');
    return stmt.all(companionId).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      user: row.user_prompt,
      assistant: row.companion_response,
      createdAt: row.created_at,
    }));
  }

  public setExemplars(companionId: string, exemplars: SelfDialogueExample[]): void {
    const delStmt = this.db.prepare('DELETE FROM self_exemplars WHERE companion_id = ?');
    delStmt.run(companionId);

    const insertStmt = this.db.prepare(`
      INSERT INTO self_exemplars (id, companion_id, user_prompt, companion_response, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    for (let i = 0; i < exemplars.length; i++) {
      const ex = exemplars[i];
      const id = ex.id || `ex-${i + 1}-${Date.now()}`;
      insertStmt.run(id, companionId, ex.user, ex.assistant);
    }
  }

  // ==========================================
  // Knowledge / Life DB Methods
  // ==========================================

  public getInventory(companionId: string, domain?: string): LifeInventoryItem[] {
    let stmt;
    let rows;
    if (domain) {
      stmt = this.db.prepare('SELECT * FROM life_inventory WHERE companion_id = ? AND domain = ?');
      rows = stmt.all(companionId, domain);
    } else {
      stmt = this.db.prepare('SELECT * FROM life_inventory WHERE companion_id = ?');
      rows = stmt.all(companionId);
    }
    
    return rows.map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      domain: row.domain,
      entityName: row.entity_name,
      properties: JSON.parse(row.properties),
      updatedAt: row.updated_at
    }));
  }

  public upsertInventoryItem(item: LifeInventoryItem): void {
    const stmt = this.db.prepare(`
      INSERT INTO life_inventory (id, companion_id, domain, entity_name, properties, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        domain = excluded.domain,
        entity_name = excluded.entity_name,
        properties = excluded.properties,
        updated_at = datetime('now')
    `);
    stmt.run(
      item.id,
      item.companionId,
      item.domain,
      item.entityName,
      JSON.stringify(item.properties)
    );
  }

  public getFinanceEntries(companionId: string, limit: number = 50): LifeFinanceEntry[] {
    const stmt = this.db.prepare('SELECT * FROM life_finance WHERE companion_id = ? ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(companionId, limit).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      category: row.category,
      amount: row.amount,
      currency: row.currency,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  public addFinanceEntry(entry: LifeFinanceEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO life_finance (id, companion_id, category, amount, currency, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, coalesce(?, datetime('now')), ?)
    `);
    stmt.run(
      entry.id,
      entry.companionId,
      entry.category,
      entry.amount,
      entry.currency || 'USD',
      entry.timestamp || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null
    );
  }

  public getSchedule(companionId: string): LifeScheduleItem[] {
    const stmt = this.db.prepare('SELECT * FROM life_schedule WHERE companion_id = ? AND status = ? ORDER BY start_time ASC');
    return stmt.all(companionId, 'active').map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      title: row.title,
      startTime: row.start_time,
      endTime: row.end_time || undefined,
      isRecurring: row.is_recurring === 1,
      status: row.status
    }));
  }

  public upsertScheduleItem(item: LifeScheduleItem): void {
    const stmt = this.db.prepare(`
      INSERT INTO life_schedule (id, companion_id, title, start_time, end_time, is_recurring, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        is_recurring = excluded.is_recurring,
        status = excluded.status
    `);
    stmt.run(
      item.id,
      item.companionId,
      item.title,
      item.startTime,
      item.endTime || null,
      item.isRecurring ? 1 : 0,
      item.status || 'active'
    );
  }

  public getPreferences(companionId: string): LifePreference[] {
    const stmt = this.db.prepare('SELECT * FROM life_preferences WHERE companion_id = ?');
    return stmt.all(companionId).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      preferenceKey: row.preference_key,
      preferenceValue: row.preference_value,
      category: row.category,
      updatedAt: row.updated_at
    }));
  }

  public upsertPreference(pref: LifePreference): void {
    const stmt = this.db.prepare(`
      INSERT INTO life_preferences (id, companion_id, preference_key, preference_value, category, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        preference_key = excluded.preference_key,
        preference_value = excluded.preference_value,
        category = excluded.category,
        updated_at = datetime('now')
    `);
    stmt.run(
      pref.id,
      pref.companionId,
      pref.preferenceKey,
      pref.preferenceValue,
      pref.category
    );
  }

  // ==========================================
  // Memory Domain Methods
  // ==========================================

  public recordEvent(event: EpisodicEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO memory_events (id, companion_id, source_type, occurred_at, payload)
      VALUES (?, ?, ?, coalesce(?, datetime('now')), ?)
    `);
    stmt.run(
      event.id,
      event.companionId,
      event.sourceType,
      event.occurredAt || null,
      JSON.stringify(event.payload)
    );
  }

  public getRecentEvents(companionId: string, limit: number = 50): EpisodicEvent[] {
    const stmt = this.db.prepare('SELECT * FROM memory_events WHERE companion_id = ? ORDER BY occurred_at DESC LIMIT ?');
    return stmt.all(companionId, limit).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      sourceType: row.source_type,
      occurredAt: row.occurred_at,
      payload: JSON.parse(row.payload)
    }));
  }

  public getEvent(id: string): EpisodicEvent | undefined {
    const stmt = this.db.prepare('SELECT * FROM memory_events WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      companionId: row.companion_id,
      sourceType: row.source_type,
      occurredAt: row.occurred_at,
      payload: JSON.parse(row.payload)
    };
  }

  private rowToMemoryClaim(row: any): MemoryClaim {
    return {
      id: row.id,
      companionId: row.companion_id,
      subject: row.subject,
      predicate: row.predicate,
      value: row.value,
      status: normalizeStatus(row.status, 'pending') as any,
      confidence: row.confidence,
      validFrom: row.valid_from || undefined,
      validUntil: row.valid_until || undefined,
      evidence: row.evidence ? (typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence) : undefined,
      assertedAt: row.asserted_at,
      supersedes: row.supersedes || undefined,
      sourceEventId: row.source_event_id || undefined,
    };
  }

  public proposeClaim(
    claim: Omit<MemoryClaim, 'status' | 'confidence' | 'assertedAt'> & {
      confidence?: number;
      assertedAt?: string;
      supersedes?: string;
      sourceEventId?: string;
      status?: string;
    }
  ): MemoryClaim {
    const id = claim.id || crypto.randomUUID();
    const status = normalizeStatus(claim.status, 'pending');
    const confidence = claim.confidence ?? 1.0;
    const assertedAt = claim.assertedAt || new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO memory_claims (id, companion_id, subject, predicate, value, status, confidence, valid_from, valid_until, evidence, asserted_at, supersedes, source_event_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, coalesce(?, datetime('now')), ?, ?)
    `);
    stmt.run(
      id,
      claim.companionId || 'default',
      claim.subject,
      claim.predicate,
      claim.value,
      status,
      confidence,
      claim.validFrom || null,
      claim.validUntil || null,
      claim.evidence ? JSON.stringify(claim.evidence) : null,
      assertedAt || null,
      claim.supersedes || null,
      claim.sourceEventId || null
    );

    return {
      ...claim,
      id,
      status: status as any,
      confidence,
      assertedAt,
      supersedes: claim.supersedes,
      sourceEventId: claim.sourceEventId,
    };
  }

  public approveClaim(id: string, companionId?: string): void {
    const findClaim = companionId
      ? this.db.prepare("SELECT id, status, supersedes FROM memory_claims WHERE id = ? AND companion_id = ?")
      : this.db.prepare("SELECT id, status, supersedes FROM memory_claims WHERE id = ?");
    const row = (companionId ? findClaim.get(id, companionId) : findClaim.get(id)) as any;
    if (!row) {
      return;
    }

    if (normalizeStatus(row.status) !== 'pending') {
      if (normalizeStatus(row.status) === 'approved') {
        return;
      }
      throw new Error(`Cannot approve claim '${id}': invalid transition from status '${row.status}' to 'approved' (only pending claims can be approved)`);
    }

    // If this claim supersedes an earlier claim, transition that prior claim to superseded
    if (row.supersedes) {
      const supersededId = row.supersedes;
      if (companionId) {
        const supersedeStmt = this.db.prepare("UPDATE memory_claims SET status = 'superseded' WHERE id = ? AND companion_id = ?");
        supersedeStmt.run(supersededId, companionId);
      } else {
        const supersedeStmt = this.db.prepare("UPDATE memory_claims SET status = 'superseded' WHERE id = ?");
        supersedeStmt.run(supersededId);
      }
    }

    if (companionId) {
      const stmt = this.db.prepare("UPDATE memory_claims SET status = 'approved' WHERE id = ? AND companion_id = ? AND LOWER(status) = 'pending'");
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare("UPDATE memory_claims SET status = 'approved' WHERE id = ? AND LOWER(status) = 'pending'");
      stmt.run(id);
    }

    // Canonically promote approved claim to Self domain state (identity, role, relationships)
    const approvedClaim = this.getClaim(id);
    if (approvedClaim) {
      this.promoteClaimToSelf(approvedClaim);
    }
  }

  /**
   * Canonically promotes a Claim into Self domain tables.
   */
  public promoteClaimToSelf(claim: MemoryClaim | any): void {
    const companionId = claim.companionId || 'default';
    const subject = (claim.subject || '').toLowerCase();
    const predicate = (claim.predicate || '').toLowerCase();
    const value = claim.value || '';

    if (!value) return;

    // 1. Identity mutations: companion identity/role/origin/name/ethos
    if (
      subject.startsWith('companion:') ||
      subject === 'companion' ||
      subject === 'siduri' ||
      subject === 'self'
    ) {
      const existing: SelfIdentity = this.getIdentity(companionId) || {
        companionId,
        name: 'Siduri',
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      };

      if (predicate === 'role' || predicate === 'archetype') {
        existing.archetype = value;
        existing.role = value;
        this.setIdentity(existing);
        this.commitDirective({
          id: `dir-role-${claim.id || Date.now()}`,
          companionId,
          priority: 70,
          directive: `Acknowledge role as ${value}`,
          status: 'active' as any,
          category: 'relational',
          createdAt: new Date().toISOString(),
        });
      } else if (predicate === 'origin' || predicate === 'created_by') {
        existing.origin = value;
        this.setIdentity(existing);
      } else if (predicate === 'name') {
        existing.name = value;
        this.setIdentity(existing);
      } else if (predicate === 'ethos') {
        existing.ethos = value;
        this.setIdentity(existing);
      }
      return;
    }

    // 2. Relationship mutations: creator or user stated relationship, name, or affiliation
    if (
      claim.claimType === 'relationship' ||
      predicate === 'stated_relationship' ||
      predicate === 'relationship' ||
      predicate === 'relationship_to_siduri' ||
      (predicate === 'name' && (subject.startsWith('actor:') || subject === 'user' || subject === 'primary_user')) ||
      predicate === 'preferred_address' ||
      predicate === 'affiliation'
    ) {
      const rawSubject = (claim.subject || 'actor:user').replace(/^actor:actor:/, 'actor:');
      const isCreator = value.toLowerCase().includes('creator');
      const isName = predicate === 'name' || predicate === 'preferred_address';
      const isAffil = predicate === 'affiliation';

      const existingRel = this.getRelationship(companionId, rawSubject);
      const isPriorCreator = existingRel?.role === 'creator' || (existingRel?.stance === 'familiar_loyal' && existingRel.trustScore === 1.0);
      const role = isCreator
        ? 'creator'
        : (isPriorCreator ? 'creator' : (existingRel?.role && existingRel.role !== 'user' ? existingRel.role : (isName || isAffil ? existingRel?.role || 'user' : value)));
      const name = isName ? value : existingRel?.name;
      const affiliation = isAffil ? value : existingRel?.affiliation;
      const stance = isCreator || isPriorCreator ? 'familiar_loyal' : (existingRel?.stance || 'neutral');
      const trustScore = isCreator || isPriorCreator ? 1.0 : (existingRel?.trustScore ?? 0.8);
      const familiarity = isCreator || isPriorCreator ? 0.9 : (existingRel?.familiarity ?? 0.5);
      const interactionConventions = isCreator || isPriorCreator
        ? Array.from(new Set([...(existingRel?.interactionConventions || []), 'Direct communication', 'Highest administrative trust']))
        : (existingRel?.interactionConventions || []);

      this.upsertRelationship({
        companionId,
        entityId: rawSubject,
        entityType: 'human',
        name,
        affiliation,
        role,
        stance,
        trustScore,
        familiarity,
        interactionConventions,
      });

      // Dual promotion: If this actor is established as creator, also populate companion's origin in self_identity
      if (isCreator || (isName && isPriorCreator)) {
        const existingIdentity: SelfIdentity = this.getIdentity(companionId) || {
          companionId,
          name: 'Siduri',
          version: '1.0.0',
          updatedAt: new Date().toISOString(),
        };
        const creatorName = name || existingRel?.name || (rawSubject.startsWith('actor:') && rawSubject !== 'actor:user' && rawSubject !== 'actor:primary' ? rawSubject.slice(6) : value);
        existingIdentity.origin = creatorName !== 'user' && creatorName !== 'primary' ? creatorName : value;
        existingIdentity.updatedAt = new Date().toISOString();
        this.setIdentity(existingIdentity);
      }

      if (isName) {
        this.commitDirective({
          id: `dir-name-${claim.id || Date.now()}`,
          companionId,
          priority: 75,
          directive: `Address ${rawSubject} as ${value}`,
          status: 'active' as any,
          category: 'relational',
          createdAt: new Date().toISOString(),
        });
      }
      return;
    }

    // 3. Behavioral rule claim
    if (predicate === 'behavioral_rule' || predicate === 'rule') {
      this.commitDirective({
        id: `dir-rule-${claim.id || Date.now()}`,
        companionId,
        priority: 60,
        directive: value,
        status: 'active' as any,
        category: 'behavioral',
        createdAt: new Date().toISOString(),
      });
    }
  }

  public rejectClaim(id: string, companionId?: string): void {
    if (companionId) {
      const stmt = this.db.prepare("UPDATE memory_claims SET status = 'rejected' WHERE id = ? AND companion_id = ?");
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare("UPDATE memory_claims SET status = 'rejected' WHERE id = ?");
      stmt.run(id);
    }
  }

  public revokeClaim(id: string, companionId?: string): void {
    if (companionId) {
      const stmt = this.db.prepare("UPDATE memory_claims SET status = 'revoked' WHERE id = ? AND companion_id = ?");
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare("UPDATE memory_claims SET status = 'revoked' WHERE id = ?");
      stmt.run(id);
    }
  }

  public expireClaim(id: string, companionId?: string): void {
    if (companionId) {
      const stmt = this.db.prepare("UPDATE memory_claims SET status = 'expired' WHERE id = ? AND companion_id = ?");
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare("UPDATE memory_claims SET status = 'expired' WHERE id = ?");
      stmt.run(id);
    }
  }

  public markClaimSessionOnly(id: string, companionId?: string): void {
    if (companionId) {
      const stmt = this.db.prepare("UPDATE memory_claims SET status = 'session-only' WHERE id = ? AND companion_id = ?");
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare("UPDATE memory_claims SET status = 'session-only' WHERE id = ?");
      stmt.run(id);
    }
  }

  public searchClaims(companionId: string, query: string, limit: number = 20): MemoryClaim[] {
    const cleanTokens = query
      .replace(/[^\p{L}\p{N}\s_]/gu, ' ')
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => `"${t.replace(/"/g, '""')}"`);

    if (cleanTokens.length === 0) return [];
    const ftsQuery = cleanTokens.join(' OR ');

    const stmt = this.db.prepare(`
      SELECT c.* FROM memory_claims c
      JOIN memory_search s ON c.rowid = s.rowid
      WHERE c.companion_id = ? AND LOWER(c.status) = 'approved' AND memory_search MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    return stmt.all(companionId, ftsQuery, limit).map((row: any) => this.rowToMemoryClaim(row));
  }

  public getPendingClaims(companionId: string, limit: number = 50): MemoryClaim[] {
    const stmt = this.db.prepare("SELECT * FROM memory_claims WHERE companion_id = ? AND LOWER(status) = 'pending' ORDER BY asserted_at DESC LIMIT ?");
    return stmt.all(companionId, limit).map((row: any) => this.rowToMemoryClaim(row));
  }

  public getApprovedClaims(companionId: string, limit: number = 50): MemoryClaim[] {
    const stmt = this.db.prepare("SELECT * FROM memory_claims WHERE companion_id = ? AND LOWER(status) = 'approved' ORDER BY asserted_at DESC LIMIT ?");
    return stmt.all(companionId, limit).map((row: any) => this.rowToMemoryClaim(row));
  }

  public getAllClaims(companionId?: string, limit: number = 100): MemoryClaim[] {
    const stmt = companionId
      ? this.db.prepare("SELECT * FROM memory_claims WHERE companion_id = ? ORDER BY asserted_at DESC LIMIT ?")
      : this.db.prepare("SELECT * FROM memory_claims ORDER BY asserted_at DESC LIMIT ?");
    const rows = companionId ? stmt.all(companionId, limit) : stmt.all(limit);
    return rows.map((row: any) => this.rowToMemoryClaim(row));
  }

  public getClaim(id: string): MemoryClaim | undefined {
    const stmt = this.db.prepare("SELECT * FROM memory_claims WHERE id = ?");
    const row = stmt.get(id);
    if (!row) return undefined;
    return this.rowToMemoryClaim(row);
  }

  public resetMemory(companionId: string): void {
    const deleteClaims = this.db.prepare("DELETE FROM memory_claims WHERE companion_id = ?");
    deleteClaims.run(companionId);
    const deleteEvents = this.db.prepare("DELETE FROM memory_events WHERE companion_id = ?");
    deleteEvents.run(companionId);
  }
}
