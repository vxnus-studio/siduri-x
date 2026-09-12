// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite');

// ==========================================
// Type Definitions
// ==========================================

// --- Self Domain Types ---
export interface SelfIdentity {
  companionId: string;
  name: string;
  archetype?: string;
  version: string;
  updatedAt: string;
}

export interface PersonalityTraits {
  warmth: number;
  formality: number;
  sarcasm: number;
  verbosity: number;
  curiosity: number;
}

export interface SelfDirective {
  id: string;
  companionId: string;
  priority: number;
  directive: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED' | 'SUPERSEDED' | 'REJECTED' | 'REVOKED' | 'EXPIRED';
  category: 'behavioral' | 'guardrail' | 'relational' | string;
  supersedesId?: string;
  createdAt?: string;
}

export interface SelfRelationship {
  companionId: string;
  entityId: string;
  entityType: 'human' | 'companion' | 'system';
  trustScore: number;
  familiarity: number;
  interactionConventions: string[];
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SESSION_ONLY' | 'SUPERSEDED' | 'REVOKED' | 'EXPIRED';
  confidence: number;
  validFrom?: string;
  validUntil?: string;
  evidence?: string[];
  assertedAt: string;
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
        status TEXT DEFAULT 'ACTIVE',
        category TEXT DEFAULT 'behavioral',
        supersedes_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS self_relationships (
        companion_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        trust_score REAL DEFAULT 0.5,
        familiarity REAL DEFAULT 0.5,
        interaction_conventions TEXT,
        PRIMARY KEY(companion_id, entity_id)
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
        status TEXT DEFAULT 'PENDING',
        confidence REAL DEFAULT 1.0,
        valid_from TEXT,
        valid_until TEXT,
        evidence TEXT,
        asserted_at TEXT DEFAULT (datetime('now'))
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
  }

  public close(): void {
    this.db.close();
  }

  // ==========================================
  // Self Domain Methods
  // ==========================================

  public getIdentity(companionId: string): SelfIdentity | undefined {
    const stmt = this.db.prepare('SELECT * FROM self_identity WHERE companion_id = ?');
    const row = stmt.get(companionId);
    if (!row) return undefined;
    return {
      companionId: row.companion_id,
      name: row.name,
      archetype: row.archetype || undefined,
      version: row.version,
      updatedAt: row.updated_at
    };
  }

  public setIdentity(identity: SelfIdentity): void {
    const stmt = this.db.prepare(`
      INSERT INTO self_identity (companion_id, name, archetype, version, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(companion_id) DO UPDATE SET
        name = excluded.name,
        archetype = excluded.archetype,
        version = excluded.version,
        updated_at = datetime('now')
    `);
    stmt.run(identity.companionId, identity.name, identity.archetype || null, identity.version);
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

  public getActiveDirectives(companionId: string): SelfDirective[] {
    const stmt = this.db.prepare(`
      SELECT * FROM self_directives 
      WHERE companion_id = ? AND status = 'ACTIVE'
      ORDER BY priority DESC, created_at ASC
    `);
    return stmt.all(companionId).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      priority: row.priority,
      directive: row.directive,
      status: row.status,
      category: row.category,
      supersedesId: row.supersedes_id || undefined,
      createdAt: row.created_at
    }));
  }

  public commitDirective(directive: SelfDirective): void {
    const stmt = this.db.prepare(`
      INSERT INTO self_directives (id, companion_id, priority, directive, status, category, supersedes_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      directive.id,
      directive.companionId,
      directive.priority,
      directive.directive,
      directive.status,
      directive.category,
      directive.supersedesId || null,
      directive.createdAt || new Date().toISOString()
    );
  }

  public approveDirective(id: string): void {
    const stmt = this.db.prepare("UPDATE self_directives SET status = 'ACTIVE' WHERE id = ?");
    stmt.run(id);
  }

  public rejectDirective(id: string): void {
    const stmt = this.db.prepare("UPDATE self_directives SET status = 'REJECTED' WHERE id = ?");
    stmt.run(id);
  }

  public revokeDirective(id: string): void {
    const stmt = this.db.prepare("UPDATE self_directives SET status = 'REVOKED' WHERE id = ?");
    stmt.run(id);
  }

  public expireDirective(id: string): void {
    const stmt = this.db.prepare("UPDATE self_directives SET status = 'EXPIRED' WHERE id = ?");
    stmt.run(id);
  }

  public disableDirective(id: string): void {
    const stmt = this.db.prepare("UPDATE self_directives SET status = 'DISABLED' WHERE id = ?");
    stmt.run(id);
  }

  public getRelationship(companionId: string, entityId: string): SelfRelationship | undefined {
    const stmt = this.db.prepare('SELECT * FROM self_relationships WHERE companion_id = ? AND entity_id = ?');
    const row = stmt.get(companionId, entityId);
    if (!row) return undefined;
    return {
      companionId: row.companion_id,
      entityId: row.entity_id,
      entityType: row.entity_type,
      trustScore: row.trust_score,
      familiarity: row.familiarity,
      interactionConventions: row.interaction_conventions ? JSON.parse(row.interaction_conventions) : []
    };
  }

  public upsertRelationship(rel: SelfRelationship): void {
    const stmt = this.db.prepare(`
      INSERT INTO self_relationships (companion_id, entity_id, entity_type, trust_score, familiarity, interaction_conventions)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(companion_id, entity_id) DO UPDATE SET
        entity_type = excluded.entity_type,
        trust_score = excluded.trust_score,
        familiarity = excluded.familiarity,
        interaction_conventions = excluded.interaction_conventions
    `);
    stmt.run(
      rel.companionId,
      rel.entityId,
      rel.entityType,
      rel.trustScore,
      rel.familiarity,
      JSON.stringify(rel.interactionConventions || [])
    );
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

  public proposeClaim(
    claim: Omit<MemoryClaim, 'status' | 'confidence' | 'assertedAt'> & {
      confidence?: number;
      assertedAt?: string;
    }
  ): MemoryClaim {
    const id = claim.id || crypto.randomUUID();
    const status = 'PENDING';
    const confidence = claim.confidence ?? 1.0;
    const assertedAt = claim.assertedAt || new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO memory_claims (id, companion_id, subject, predicate, value, status, confidence, valid_from, valid_until, evidence, asserted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, coalesce(?, datetime('now')))
    `);
    stmt.run(
      id,
      claim.companionId,
      claim.subject,
      claim.predicate,
      claim.value,
      status,
      confidence,
      claim.validFrom || null,
      claim.validUntil || null,
      claim.evidence ? JSON.stringify(claim.evidence) : null,
      assertedAt || null
    );

    return {
      ...claim,
      id,
      status,
      confidence,
      assertedAt,
    };
  }

  public approveClaim(id: string): void {
    const stmt = this.db.prepare("UPDATE memory_claims SET status = 'APPROVED' WHERE id = ?");
    stmt.run(id);
  }

  public rejectClaim(id: string): void {
    const stmt = this.db.prepare("UPDATE memory_claims SET status = 'REJECTED' WHERE id = ?");
    stmt.run(id);
  }

  public revokeClaim(id: string): void {
    const stmt = this.db.prepare("UPDATE memory_claims SET status = 'REVOKED' WHERE id = ?");
    stmt.run(id);
  }

  public expireClaim(id: string): void {
    const stmt = this.db.prepare("UPDATE memory_claims SET status = 'EXPIRED' WHERE id = ?");
    stmt.run(id);
  }

  public markClaimSessionOnly(id: string): void {
    const stmt = this.db.prepare("UPDATE memory_claims SET status = 'SESSION_ONLY' WHERE id = ?");
    stmt.run(id);
  }

  public searchClaims(companionId: string, query: string, limit: number = 20): MemoryClaim[] {
    const stmt = this.db.prepare(`
      SELECT c.* FROM memory_claims c
      JOIN memory_search s ON c.rowid = s.rowid
      WHERE c.companion_id = ? AND memory_search MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    return stmt.all(companionId, query, limit).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      subject: row.subject,
      predicate: row.predicate,
      value: row.value,
      status: row.status,
      confidence: row.confidence,
      validFrom: row.valid_from || undefined,
      validUntil: row.valid_until || undefined,
      evidence: row.evidence ? JSON.parse(row.evidence) : undefined,
      assertedAt: row.asserted_at
    }));
  }

  public getApprovedClaims(companionId: string, limit: number = 50): MemoryClaim[] {
    const stmt = this.db.prepare("SELECT * FROM memory_claims WHERE companion_id = ? AND status = 'APPROVED' ORDER BY asserted_at DESC LIMIT ?");
    return stmt.all(companionId, limit).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      subject: row.subject,
      predicate: row.predicate,
      value: row.value,
      status: row.status,
      confidence: row.confidence,
      validFrom: row.valid_from || undefined,
      validUntil: row.valid_until || undefined,
      evidence: row.evidence ? JSON.parse(row.evidence) : undefined,
      assertedAt: row.asserted_at
    }));
  }
}
