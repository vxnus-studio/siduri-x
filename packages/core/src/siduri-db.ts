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

export interface LifeEntity {
  id: string;
  companionId: string;
  entityType: string;
  domain: string;
  name: string;
  properties: Record<string, unknown>;
  updatedAt?: string;
}

export interface LifeEvent {
  id: string;
  companionId: string;
  stream: string;
  timestamp?: string;
  metricValue?: number;
  metadata?: Record<string, unknown>;
}

export interface LifeTask {
  id: string;
  companionId: string;
  title: string;
  status: 'backlog' | 'in_progress' | 'completed' | 'cancelled' | string;
  priority?: number;
  targetDate?: string;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
}

// --- Archive & Episodic Event Types ---
export interface ArchiveEvent {
  id: string;
  companionId: string;
  sourceType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export type EpisodicEvent = ArchiveEvent;

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

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SystemLog {
  id: string;
  companionId: string;
  level: LogLevel;
  subsystem: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function safeJsonParse<T = any>(str?: string | null, fallback: T = undefined as any): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
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
    this.db.exec('PRAGMA busy_timeout = 5000');
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

      CREATE TABLE IF NOT EXISTS life_entities (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        domain TEXT NOT NULL,
        name TEXT NOT NULL,
        properties TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS life_events (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        stream TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now')),
        metric_value REAL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS life_tasks (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT DEFAULT 'backlog',
        priority INTEGER DEFAULT 0,
        target_date TEXT,
        metadata TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_life_entities_comp ON life_entities(companion_id, entity_type);
      CREATE INDEX IF NOT EXISTS idx_life_events_comp ON life_events(companion_id, stream, timestamp);
      CREATE INDEX IF NOT EXISTS idx_life_tasks_comp ON life_tasks(companion_id, status);

      -- Archive Tables (RFC VX-26-13: Audited interaction ledger and cold search)
      CREATE TABLE IF NOT EXISTS archive_events (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        occurred_at TEXT DEFAULT (datetime('now')),
        payload TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS archive_search USING fts5(
        source_type,
        payload,
        content='archive_events',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS archive_events_ai AFTER INSERT ON archive_events BEGIN
        INSERT INTO archive_search(rowid, source_type, payload)
        VALUES (new.rowid, new.source_type, new.payload);
      END;

      CREATE TRIGGER IF NOT EXISTS archive_events_ad AFTER DELETE ON archive_events BEGIN
        INSERT INTO archive_search(archive_search, rowid, source_type, payload)
        VALUES('delete', old.rowid, old.source_type, old.payload);
      END;

      CREATE TRIGGER IF NOT EXISTS archive_events_au AFTER UPDATE ON archive_events BEGIN
        INSERT INTO archive_search(archive_search, rowid, source_type, payload)
        VALUES('delete', old.rowid, old.source_type, old.payload);
        INSERT INTO archive_search(rowid, source_type, payload)
        VALUES (new.rowid, new.source_type, new.payload);
      END;

      -- System Logs Table
      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL,
        level TEXT NOT NULL,
        subsystem TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_system_logs_comp ON system_logs(companion_id, level, created_at DESC);
    `;
    this.db.exec(schema);

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
      // Reconcile legacy creator claims if memory_claims table still exists from earlier versions
      const hasMemoryClaims = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_claims'"
      ).get();

      if (hasMemoryClaims) {
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
      ? this.db.prepare("SELECT id, companion_id, directive, scope_actor, status, priority, supersedes_id FROM self_directives WHERE id = ? AND companion_id = ?")
      : this.db.prepare("SELECT id, companion_id, directive, scope_actor, status, priority, supersedes_id FROM self_directives WHERE id = ?");
    const row = (companionId ? findStmt.get(id, companionId) : findStmt.get(id)) as any;
    if (!row) {
      return;
    }

    if (normalizeStatus(row.status) !== 'pending' && normalizeStatus(row.status) !== 'superseded') {
      if (normalizeStatus(row.status) === 'active') {
        return;
      }
      throw new Error(
        `Cannot approve directive '${id}': invalid transition from status '${row.status}' to 'active' (only pending or superseded directives can be approved)`
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

    // Automatic Supersession: If an address directive or single-value directive is approved,
    // transition conflicting older active/pending directives to 'superseded'
    const addressMatch = (row.directive || '').match(/^address\s+(actor:[^\s]+|the user|user)\s+as\s+["“']?([^"”'.]+)["”']?/i);
    let targetPriority = row.priority ?? 50;
    if (addressMatch) {
      targetPriority = 85;
      const targetActor = addressMatch[1].toLowerCase();
      const existingDirectives = this.getAllDirectives(companionId || 'default');
      for (const d of existingDirectives) {
        if (
          (d.status === 'active' || d.status === 'pending') &&
          d.id !== id &&
          d.directive &&
          d.directive.toLowerCase().startsWith(`address ${targetActor} as`)
        ) {
          this.supersedeDirective(d.id, companionId);
        }
      }
      const targetEntityId = targetActor === 'the user' || targetActor === 'user' ? 'actor:user' : targetActor;
      const existingRel = this.getRelationship(companionId || 'default', targetEntityId);
      if (existingRel) {
        const cleanedAddress = addressMatch[2].trim();
        const convs = (existingRel.interactionConventions || []).filter((c) => !c.toLowerCase().startsWith('address as'));
        convs.push(`Address as ${cleanedAddress}`);
        this.upsertRelationship({
          ...existingRel,
          companionId: companionId || 'default',
          interactionConventions: convs,
        });
      }
    }

    // Single-value directive canonical supersession and direct Self mutation (RFC VX-26-13)
    const roleMatch = (row.directive || '').match(/^acknowledge role as\s+([^"”'.]+)/i);
    if (roleMatch) {
      const existingDirectives = this.getAllDirectives(companionId || 'default');
      for (const d of existingDirectives) {
        if (
          (d.status === 'active' || d.status === 'pending') &&
          d.id !== id &&
          d.directive &&
          d.directive.toLowerCase().startsWith('acknowledge role as')
        ) {
          this.supersedeDirective(d.id, companionId);
        }
      }
      const newRole = roleMatch[1].trim();
      if (newRole) {
        const targetId = companionId || row.companion_id || 'default';
        const currentIdentity: SelfIdentity = this.getIdentity(targetId) || {
          companionId: targetId,
          name: '',
          version: '1.0.0',
          updatedAt: new Date().toISOString(),
        };
        currentIdentity.role = newRole;
        currentIdentity.archetype = newRole;
        currentIdentity.updatedAt = new Date().toISOString();
        this.setIdentity(currentIdentity);
      }
    }

    // Companion name directive detection: "Address companion as X", "Your name is X", "Call yourself X", "Acknowledge name as X"
    const compNameMatch = (row.directive || '').match(
      /^(?:address\s+companion\s+as|your\s+name\s+is|call\s+yourself|acknowledge\s+name\s+as|companion\s+name\s+is)\s+["“']?([^"”'.]+)["”']?/i
    );
    if (compNameMatch) {
      const newCompanionName = compNameMatch[1].trim();
      if (newCompanionName) {
        const targetId = companionId || row.companion_id || 'default';
        const currentIdentity: SelfIdentity = this.getIdentity(targetId) || {
          companionId: targetId,
          name: '',
          version: '1.0.0',
          updatedAt: new Date().toISOString(),
        };
        currentIdentity.name = newCompanionName;
        currentIdentity.updatedAt = new Date().toISOString();
        this.setIdentity(currentIdentity);
      }
    }

    // Relationship directive direct domain routing:
    // "Recognize <actor> stated relationship as <role>", "Recognize <actor> relationship as <role>", "Recognize <actor> as <role>"
    const relMatch = (row.directive || '').match(
      /^(?:recognize\s+(\S+)\s+(?:stated\s+)?relationship\s+as|recognize\s+(\S+)\s+as)\s+([^"”'.]+)/i
    );
    if (relMatch) {
      const rawActor = (relMatch[1] || relMatch[2] || '').trim();
      const roleOrStance = (relMatch[3] || '').trim();
      if (rawActor && roleOrStance) {
        const targetId = companionId || row.companion_id || 'default';
        const isCreator = roleOrStance.toLowerCase().includes('creator');
        const existingRel = this.getRelationship(targetId, rawActor);
        const stance = isCreator ? 'familiar_loyal' : (existingRel?.stance || 'neutral');
        const trustScore = isCreator ? 1.0 : (existingRel?.trustScore ?? 0.8);
        const familiarity = isCreator ? 0.9 : (existingRel?.familiarity ?? 0.5);
        const interactionConventions = isCreator
          ? Array.from(new Set([...(existingRel?.interactionConventions || []), 'Direct communication', 'Highest administrative trust']))
          : (existingRel?.interactionConventions || []);

        this.upsertRelationship({
          companionId: targetId,
          entityId: rawActor,
          entityType: 'human',
          name: existingRel?.name,
          affiliation: existingRel?.affiliation,
          role: roleOrStance,
          stance,
          trustScore,
          familiarity,
          interactionConventions,
        });

        if (isCreator) {
          const currentIdentity: SelfIdentity = this.getIdentity(targetId) || {
            companionId: targetId,
            name: '',
            version: '1.0.0',
            updatedAt: new Date().toISOString(),
          };
          const creatorName = existingRel?.name || (rawActor.startsWith('actor:') ? rawActor.slice(6) : rawActor);
          currentIdentity.origin = creatorName !== 'user' && creatorName !== 'primary' ? creatorName : roleOrStance;
          currentIdentity.updatedAt = new Date().toISOString();
          this.setIdentity(currentIdentity);
        }
      }
    }

    // User name address directive direct domain routing: "Address <actor> as <name>"
    const userAddrMatch = (row.directive || '').match(
      /^address\s+(actor:\S+|\S+)\s+as\s+([^"”'.]+)/i
    );
    if (userAddrMatch) {
      const actorId = userAddrMatch[1].trim();
      const userName = userAddrMatch[2].trim();
      if (actorId && userName) {
        const targetId = companionId || row.companion_id || 'default';
        const existingRel = this.getRelationship(targetId, actorId);
        const isCreator = existingRel?.role === 'creator' || (existingRel?.stance === 'familiar_loyal' && existingRel?.trustScore === 1.0);
        this.upsertRelationship({
          companionId: targetId,
          entityId: actorId,
          entityType: 'human',
          name: userName,
          affiliation: existingRel?.affiliation,
          role: existingRel?.role || (isCreator ? 'creator' : 'user'),
          stance: existingRel?.stance || (isCreator ? 'familiar_loyal' : 'neutral'),
          trustScore: existingRel?.trustScore ?? (isCreator ? 1.0 : 0.8),
          familiarity: existingRel?.familiarity ?? (isCreator ? 0.9 : 0.5),
          interactionConventions: existingRel?.interactionConventions || [],
        });

        if (isCreator) {
          const currentIdentity: SelfIdentity = this.getIdentity(targetId) || {
            companionId: targetId,
            name: '',
            version: '1.0.0',
            updatedAt: new Date().toISOString(),
          };
          currentIdentity.origin = userName;
          currentIdentity.updatedAt = new Date().toISOString();
          this.setIdentity(currentIdentity);
        }
      }
    }

    if (companionId) {
      const stmt = this.db.prepare(
        "UPDATE self_directives SET status = 'active', priority = MAX(priority, ?) WHERE id = ? AND companion_id = ? AND LOWER(status) IN ('pending', 'superseded')"
      );
      stmt.run(targetPriority, id, companionId);
    } else {
      const stmt = this.db.prepare(
        "UPDATE self_directives SET status = 'active', priority = MAX(priority, ?) WHERE id = ? AND LOWER(status) IN ('pending', 'superseded')"
      );
      stmt.run(targetPriority, id);
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

    if (normalizeStatus(row.status) !== 'pending' && normalizeStatus(row.status) !== 'superseded') {
      if (normalizeStatus(row.status) === 'rejected') {
        return;
      }
      throw new Error(
        `Cannot reject directive '${id}': invalid transition from status '${row.status}' to 'rejected' (only pending or superseded directives can be rejected)`
      );
    }

    if (companionId) {
      const stmt = this.db.prepare(
        "UPDATE self_directives SET status = 'rejected' WHERE id = ? AND companion_id = ? AND LOWER(status) IN ('pending', 'superseded')"
      );
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare(
        "UPDATE self_directives SET status = 'rejected' WHERE id = ? AND LOWER(status) IN ('pending', 'superseded')"
      );
      stmt.run(id);
    }
  }

  public supersedeDirective(id: string, companionId?: string): void {
    if (companionId) {
      const stmt = this.db.prepare("UPDATE self_directives SET status = 'superseded' WHERE id = ? AND companion_id = ?");
      stmt.run(id, companionId);
    } else {
      const stmt = this.db.prepare("UPDATE self_directives SET status = 'superseded' WHERE id = ?");
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

  public deleteScheduleItem(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM life_schedule WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
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

  // --- Generic Life Entities Methods ---

  public getEntities(companionId: string, entityType?: string, domain?: string): LifeEntity[] {
    let query = 'SELECT * FROM life_entities WHERE companion_id = ?';
    const params: any[] = [companionId];

    if (entityType) {
      query += ' AND entity_type = ?';
      params.push(entityType);
    }
    if (domain) {
      query += ' AND domain = ?';
      params.push(domain);
    }
    query += ' ORDER BY updated_at DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      entityType: row.entity_type,
      domain: row.domain,
      name: row.name,
      properties: JSON.parse(row.properties || '{}'),
      updatedAt: row.updated_at,
    }));
  }

  public getEntityById(id: string): LifeEntity | undefined {
    const stmt = this.db.prepare('SELECT * FROM life_entities WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      companionId: row.companion_id,
      entityType: row.entity_type,
      domain: row.domain,
      name: row.name,
      properties: JSON.parse(row.properties || '{}'),
      updatedAt: row.updated_at,
    };
  }

  public upsertEntity(entity: LifeEntity): void {
    const stmt = this.db.prepare(`
      INSERT INTO life_entities (id, companion_id, entity_type, domain, name, properties, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        entity_type = excluded.entity_type,
        domain = excluded.domain,
        name = excluded.name,
        properties = excluded.properties,
        updated_at = datetime('now')
    `);
    stmt.run(
      entity.id,
      entity.companionId,
      entity.entityType,
      entity.domain,
      entity.name,
      JSON.stringify(entity.properties || {})
    );
  }

  public deleteEntity(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM life_entities WHERE id = ?');
    const res = stmt.run(id);
    return res.changes > 0;
  }

  // --- Generic Life Events (Telemetry & Logs) Methods ---

  public getEvents(companionId: string, stream?: string, limit: number = 50): LifeEvent[] {
    let query = 'SELECT * FROM life_events WHERE companion_id = ?';
    const params: any[] = [companionId];

    if (stream) {
      query += ' AND stream = ?';
      params.push(stream);
    }
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      stream: row.stream,
      timestamp: row.timestamp,
      metricValue: row.metric_value != null ? row.metric_value : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  public addEvent(event: LifeEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO life_events (id, companion_id, stream, timestamp, metric_value, metadata)
      VALUES (?, ?, ?, coalesce(?, datetime('now')), ?, ?)
    `);
    stmt.run(
      event.id,
      event.companionId,
      event.stream,
      event.timestamp || null,
      event.metricValue != null ? event.metricValue : null,
      event.metadata ? JSON.stringify(event.metadata) : null
    );
  }

  // --- Generic Life Tasks (Verbs & Progress) Methods ---

  public getTasks(companionId: string, status?: string): LifeTask[] {
    let query = 'SELECT * FROM life_tasks WHERE companion_id = ?';
    const params: any[] = [companionId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY priority DESC, updated_at DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      targetDate: row.target_date || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      updatedAt: row.updated_at,
    }));
  }

  public upsertTask(task: LifeTask): void {
    const stmt = this.db.prepare(`
      INSERT INTO life_tasks (id, companion_id, title, status, priority, target_date, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        status = excluded.status,
        priority = excluded.priority,
        target_date = excluded.target_date,
        metadata = excluded.metadata,
        updated_at = datetime('now')
    `);
    stmt.run(
      task.id,
      task.companionId,
      task.title,
      task.status || 'backlog',
      task.priority ?? 0,
      task.targetDate || null,
      task.metadata ? JSON.stringify(task.metadata) : null
    );
  }

  public deleteTask(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM life_tasks WHERE id = ?');
    const res = stmt.run(id);
    return res.changes > 0;
  }

  // ==========================================
  // Archive Domain Methods (RFC VX-26-13: Audited interaction ledger and cold search)
  // ==========================================

  public recordArchiveEvent(event: ArchiveEvent | EpisodicEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO archive_events (id, companion_id, source_type, occurred_at, payload)
      VALUES (?, ?, ?, coalesce(?, datetime('now')), ?)
    `);
    stmt.run(
      event.id,
      event.companionId,
      event.sourceType,
      event.occurredAt || null,
      typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload)
    );
  }

  public getRecentArchiveEvents(companionId: string, limit: number = 50): ArchiveEvent[] {
    const stmt = this.db.prepare('SELECT * FROM archive_events WHERE companion_id = ? ORDER BY occurred_at DESC LIMIT ?');
    return stmt.all(companionId, limit).map((row: any) => ({
      id: row.id,
      companionId: row.companion_id,
      sourceType: row.source_type,
      occurredAt: row.occurred_at,
      payload: safeJsonParse(row.payload, {})
    }));
  }

  public getArchiveEvent(id: string): ArchiveEvent | undefined {
    const stmt = this.db.prepare('SELECT * FROM archive_events WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      companionId: row.companion_id,
      sourceType: row.source_type,
      occurredAt: row.occurred_at,
      payload: safeJsonParse(row.payload, {})
    };
  }

  public searchArchiveEvents(companionId: string, query: string, limit: number = 50): ArchiveEvent[] {
    if (!query || !query.trim()) {
      return this.getRecentArchiveEvents(companionId, limit);
    }
    const cleanTokens = query
      .replace(/[^\p{L}\p{N}\s_]/gu, ' ')
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => `"${t.replace(/"/g, '""')}"`);

    if (cleanTokens.length === 0) return this.getRecentArchiveEvents(companionId, limit);
    const ftsQuery = cleanTokens.join(' OR ');

    try {
      const stmt = this.db.prepare(`
        SELECT e.* FROM archive_events e
        JOIN archive_search s ON e.rowid = s.rowid
        WHERE e.companion_id = ? AND archive_search MATCH ?
        ORDER BY rank
        LIMIT ?
      `);
      return stmt.all(companionId, ftsQuery, limit).map((row: any) => ({
        id: row.id,
        companionId: row.companion_id,
        sourceType: row.source_type,
        occurredAt: row.occurred_at,
        payload: safeJsonParse(row.payload, {})
      }));
    } catch {
      const stmt = this.db.prepare(`
        SELECT * FROM archive_events
        WHERE companion_id = ? AND (source_type LIKE ? OR payload LIKE ?)
        ORDER BY occurred_at DESC
        LIMIT ?
      `);
      const pattern = `%${query.trim()}%`;
      return stmt.all(companionId, pattern, pattern, limit).map((row: any) => ({
        id: row.id,
        companionId: row.companion_id,
        sourceType: row.source_type,
        occurredAt: row.occurred_at,
        payload: safeJsonParse(row.payload, {})
      }));
    }
  }

  public resetArchive(companionId: string): void {
    try {
      this.db.prepare("DELETE FROM archive_events WHERE companion_id = ?").run(companionId);
    } catch {}
  }

  // --- System Logs ---

  public insertLog(entry: {
    id?: string;
    companionId?: string;
    level: LogLevel | string;
    subsystem: string;
    message: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }): SystemLog {
    const id = entry.id || crypto.randomUUID();
    const companionId = entry.companionId || 'default';
    const level = (entry.level || 'info').toLowerCase() as LogLevel;
    const subsystem = (entry.subsystem || 'system').toLowerCase();
    const message = entry.message || '';
    const metadata = entry.metadata ? JSON.stringify(entry.metadata) : null;
    const createdAt = entry.createdAt || new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO system_logs (id, companion_id, level, subsystem, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, companionId, level, subsystem, message, metadata, createdAt);

    // Prune logs beyond 5000 per companion to prevent unbounded growth
    try {
      this.db.prepare(`
        DELETE FROM system_logs
        WHERE companion_id = ? AND rowid NOT IN (
          SELECT rowid FROM system_logs WHERE companion_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 5000
        )
      `).run(companionId, companionId);
    } catch {
      // Best effort pruning
    }

    return {
      id,
      companionId,
      level,
      subsystem,
      message,
      metadata: entry.metadata,
      createdAt,
    };
  }

  public queryLogs(options: {
    companionId?: string;
    level?: string;
    subsystem?: string;
    q?: string;
    limit?: number;
    offset?: number;
  } = {}): SystemLog[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.companionId) {
      conditions.push('companion_id = ?');
      params.push(options.companionId);
    }
    if (options.level && options.level !== 'all') {
      conditions.push('level = ?');
      params.push(options.level.toLowerCase());
    }
    if (options.subsystem && options.subsystem !== 'all') {
      conditions.push('subsystem = ?');
      params.push(options.subsystem.toLowerCase());
    }
    if (options.q && options.q.trim().length > 0) {
      conditions.push('(message LIKE ? OR metadata LIKE ?)');
      const term = `%${options.q.trim()}%`;
      params.push(term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 1000);
    const offset = Math.max(Number(options.offset) || 0, 0);

    const query = `
      SELECT id, companion_id, level, subsystem, message, metadata, created_at
      FROM system_logs
      ${whereClause}
      ORDER BY created_at DESC, rowid DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((row) => ({
      id: row.id,
      companionId: row.companion_id,
      level: row.level as LogLevel,
      subsystem: row.subsystem,
      message: row.message,
      metadata: row.metadata ? safeJsonParse(row.metadata) : undefined,
      createdAt: row.created_at,
    }));
  }

  public clearLogs(companionId?: string): void {
    if (companionId) {
      this.db.prepare('DELETE FROM system_logs WHERE companion_id = ?').run(companionId);
    } else {
      this.db.prepare('DELETE FROM system_logs').run();
    }
  }
}
