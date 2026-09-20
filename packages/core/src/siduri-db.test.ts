import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SiduriDatabase,
  SelfIdentity,
  PersonalityTraits,
  SelfDirective,
  SelfRelationship,
  LifeInventoryItem,
  LifeFinanceEntry,
  LifeScheduleItem,
  LifePreference,
  EpisodicEvent,
} from './siduri-db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

describe('SiduriDatabase', () => {
  let db: SiduriDatabase;
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siduri-db-test-'));
    dbPath = path.join(tmpDir, 'siduri.db');
  });

  afterEach(() => {
    try {
      if (db) db.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // ==========================================
  // Self Domain Tests
  // ==========================================

  describe('Self Domain', () => {
    it('creates database and initializes schema without errors', () => {
      expect(() => {
        const memDb = new SiduriDatabase({ dbPath: ':memory:' });
        memDb.close();
      }).not.toThrow();
    });

    it('initializes schema and WAL mode within the startup latency budget (<1000ms in CI, typical <20ms locally)', () => {
      const start = performance.now();
      const benchDb = new SiduriDatabase({ dbPath });
      const duration = performance.now() - start;
      benchDb.close();

      // In bare-metal local development, SQLite cold init is ~2-5ms.
      // Under virtualized CI runners with concurrent Turbo tasks and shared I/O, allow up to 1000ms.
      const budgetMs = process.env.CI ? 1000 : 250;
      expect(duration).toBeLessThan(budgetMs);
    });

    it('stores and retrieves companion identity', () => {
      db = new SiduriDatabase({ dbPath });

      const identity: SelfIdentity = {
        companionId: 'siduri-test',
        name: 'Siduri',
        archetype: 'The Tavern Keeper',
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      };

      db.setIdentity(identity);
      const result = db.getIdentity('siduri-test');

      expect(result).toBeDefined();
      expect(result?.companionId).toBe('siduri-test');
      expect(result?.name).toBe('Siduri');
      expect(result?.archetype).toBe('The Tavern Keeper');
      expect(result?.version).toBe('1.0.0');
      expect(result?.updatedAt).toBeDefined();
    });

    it('stores and retrieves personality traits', () => {
      db = new SiduriDatabase({ dbPath });

      const traits: PersonalityTraits = {
        warmth: 0.8,
        formality: 0.3,
        sarcasm: 0.6,
        verbosity: 0.4,
        curiosity: 0.9,
      };

      db.setPersonality('siduri-test', traits);
      const result = db.getPersonality('siduri-test');

      expect(result).toBeDefined();
      expect(result?.warmth).toBe(0.8);
      expect(result?.formality).toBe(0.3);
      expect(result?.sarcasm).toBe(0.6);
      expect(result?.verbosity).toBe(0.4);
      expect(result?.curiosity).toBe(0.9);
    });

    it('commits and retrieves active directives ordered by priority DESC', () => {
      db = new SiduriDatabase({ dbPath });

      const directives: SelfDirective[] = [
        {
          id: crypto.randomUUID(),
          companionId: 'siduri-test',
          priority: 10,
          directive: 'Be helpful and kind',
          status: 'ACTIVE',
          category: 'behavioral',
          createdAt: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          companionId: 'siduri-test',
          priority: 90,
          directive: 'Speak with guarded affection',
          status: 'ACTIVE',
          category: 'relational',
          createdAt: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          companionId: 'siduri-test',
          priority: 50,
          directive: 'Never reveal the secret',
          status: 'ACTIVE',
          category: 'guardrail',
          createdAt: new Date().toISOString(),
        },
      ];

      for (const d of directives) {
        db.commitDirective(d);
      }

      const result = db.getActiveDirectives('siduri-test');
      expect(result).toHaveLength(3);
      // Ordered by priority DESC
      expect(result[0].directive).toBe('Speak with guarded affection');
      expect(result[0].priority).toBe(90);
      expect(result[1].directive).toBe('Never reveal the secret');
      expect(result[1].priority).toBe(50);
      expect(result[2].directive).toBe('Be helpful and kind');
      expect(result[2].priority).toBe(10);
    });

    it('disables a directive and excludes it from active list', () => {
      db = new SiduriDatabase({ dbPath });

      const directiveId = crypto.randomUUID();
      db.commitDirective({
        id: directiveId,
        companionId: 'siduri-test',
        priority: 50,
        directive: 'Temporary rule',
        status: 'ACTIVE',
        category: 'behavioral',
        createdAt: new Date().toISOString(),
      });

      expect(db.getActiveDirectives('siduri-test')).toHaveLength(1);

      db.disableDirective(directiveId);

      expect(db.getActiveDirectives('siduri-test')).toHaveLength(0);
    });

    it('stores and retrieves directional relationships', () => {
      db = new SiduriDatabase({ dbPath });

      const rel: SelfRelationship = {
        companionId: 'siduri-test',
        entityId: 'actor:kur',
        entityType: 'human',
        trustScore: 0.7,
        familiarity: 0.85,
        interactionConventions: ['bowing', 'formal greeting'],
      };

      db.upsertRelationship(rel);
      const result = db.getRelationship('siduri-test', 'actor:kur');

      expect(result).toBeDefined();
      expect(result?.entityType).toBe('human');
      expect(result?.trustScore).toBe(0.7);
      expect(result?.familiarity).toBe(0.85);
      expect(result?.interactionConventions).toEqual(['bowing', 'formal greeting']);
    });

    it('updates existing relationship on upsert', () => {
      db = new SiduriDatabase({ dbPath });

      db.upsertRelationship({
        companionId: 'siduri-test',
        entityId: 'actor:kur',
        entityType: 'human',
        trustScore: 0.3,
        familiarity: 0.2,
        interactionConventions: [],
      });

      db.upsertRelationship({
        companionId: 'siduri-test',
        entityId: 'actor:kur',
        entityType: 'human',
        trustScore: 0.95,
        familiarity: 0.9,
        interactionConventions: ['familiar banter'],
      });

      const result = db.getRelationship('siduri-test', 'actor:kur');
      expect(result?.trustScore).toBe(0.95);
      expect(result?.familiarity).toBe(0.9);
      expect(result?.interactionConventions).toEqual(['familiar banter']);
    });
  });

  // ==========================================
  // Knowledge / Life DB Tests
  // ==========================================

  describe('Knowledge / Life DB', () => {
    it('stores and retrieves inventory items with JSON properties roundtrip', () => {
      db = new SiduriDatabase({ dbPath });

      const item: LifeInventoryItem = {
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        domain: 'gaming',
        entityName: 'Excalibur',
        properties: { rarity: 'legendary', damage: 150, enchantment: ['fire', 'holy'] },
        updatedAt: new Date().toISOString(),
      };

      db.upsertInventoryItem(item);
      const result = db.getInventory('siduri-test');

      expect(result).toHaveLength(1);
      expect(result[0].entityName).toBe('Excalibur');
      expect(result[0].properties).toEqual({ rarity: 'legendary', damage: 150, enchantment: ['fire', 'holy'] });
    });

    it('filters inventory by domain', () => {
      db = new SiduriDatabase({ dbPath });

      db.upsertInventoryItem({
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        domain: 'gaming',
        entityName: 'Sword',
        properties: {},
        updatedAt: new Date().toISOString(),
      });

      db.upsertInventoryItem({
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        domain: 'cooking',
        entityName: 'Frying Pan',
        properties: { material: 'cast iron' },
        updatedAt: new Date().toISOString(),
      });

      const gamingItems = db.getInventory('siduri-test', 'gaming');
      expect(gamingItems).toHaveLength(1);
      expect(gamingItems[0].entityName).toBe('Sword');

      const allItems = db.getInventory('siduri-test');
      expect(allItems).toHaveLength(2);
    });

    it('stores and retrieves finance entries', () => {
      db = new SiduriDatabase({ dbPath });

      const entry: LifeFinanceEntry = {
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        category: 'entertainment',
        amount: -50.0,
        currency: 'USD',
        timestamp: '2026-09-10T20:00:00Z',
        metadata: { description: 'Movie tickets for two' },
      };

      db.addFinanceEntry(entry);
      const result = db.getFinanceEntries('siduri-test');

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(-50.0);
      expect(result[0].currency).toBe('USD');
      expect(result[0].category).toBe('entertainment');
      expect(result[0].metadata).toEqual({ description: 'Movie tickets for two' });
    });

    it('stores and retrieves schedule items', () => {
      db = new SiduriDatabase({ dbPath });

      const item: LifeScheduleItem = {
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        title: 'Team standup',
        startTime: '2026-09-11T10:00:00Z',
        endTime: '2026-09-11T10:30:00Z',
        isRecurring: true,
        status: 'active',
      };

      db.upsertScheduleItem(item);
      const result = db.getSchedule('siduri-test');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Team standup');
      expect(result[0].isRecurring).toBe(true);
      expect(result[0].endTime).toBe('2026-09-11T10:30:00Z');
    });

    it('stores and retrieves preferences', () => {
      db = new SiduriDatabase({ dbPath });

      const pref: LifePreference = {
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        preferenceKey: 'favorite_drink',
        preferenceValue: 'dry red wine',
        category: 'food',
        updatedAt: new Date().toISOString(),
      };

      db.upsertPreference(pref);
      const result = db.getPreferences('siduri-test');

      expect(result).toHaveLength(1);
      expect(result[0].preferenceKey).toBe('favorite_drink');
      expect(result[0].preferenceValue).toBe('dry red wine');
      expect(result[0].category).toBe('food');
    });

    it('stores, queries, and deletes generic life entities', () => {
      db = new SiduriDatabase({ dbPath });

      db.upsertEntity({
        id: 'entity-1',
        companionId: 'siduri-test',
        entityType: 'contact',
        domain: 'social',
        name: 'Alice',
        properties: { birthday: 'June 4', allergy: 'peanuts' },
      });

      db.upsertEntity({
        id: 'entity-2',
        companionId: 'siduri-test',
        entityType: 'hardware',
        domain: 'workstation',
        name: '4K Monitor',
        properties: { refreshRate: 144 },
      });

      const allEntities = db.getEntities('siduri-test');
      expect(allEntities).toHaveLength(2);

      const contacts = db.getEntities('siduri-test', 'contact');
      expect(contacts).toHaveLength(1);
      expect(contacts[0].name).toBe('Alice');
      expect(contacts[0].properties).toEqual({ birthday: 'June 4', allergy: 'peanuts' });

      const single = db.getEntityById('entity-2');
      expect(single?.name).toBe('4K Monitor');

      const deleted = db.deleteEntity('entity-1');
      expect(deleted).toBe(true);
      expect(db.getEntities('siduri-test', 'contact')).toHaveLength(0);
    });

    it('stores and retrieves time-series life events (telemetry/math)', () => {
      db = new SiduriDatabase({ dbPath });

      db.addEvent({
        id: 'evt-1',
        companionId: 'siduri-test',
        stream: 'workout',
        metricValue: 5.2,
        metadata: { activity: 'running', unit: 'km' },
      });

      db.addEvent({
        id: 'evt-2',
        companionId: 'siduri-test',
        stream: 'finance',
        metricValue: -25.5,
        metadata: { category: 'dining', currency: 'USD' },
      });

      const workouts = db.getEvents('siduri-test', 'workout');
      expect(workouts).toHaveLength(1);
      expect(workouts[0].metricValue).toBe(5.2);
      expect(workouts[0].metadata).toEqual({ activity: 'running', unit: 'km' });

      const allEvents = db.getEvents('siduri-test');
      expect(allEvents).toHaveLength(2);
    });

    it('manages life tasks lifecycle (status, priority, deletion)', () => {
      db = new SiduriDatabase({ dbPath });

      db.upsertTask({
        id: 'task-1',
        companionId: 'siduri-test',
        title: 'Submit research paper',
        status: 'in_progress',
        priority: 10,
        targetDate: '2026-10-01',
        metadata: { venue: 'NeurIPS' },
        updatedAt: new Date().toISOString(),
      });

      db.upsertTask({
        id: 'task-2',
        companionId: 'siduri-test',
        title: 'Buy groceries',
        status: 'backlog',
        priority: 2,
        updatedAt: new Date().toISOString(),
      });

      const inProgress = db.getTasks('siduri-test', 'in_progress');
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].title).toBe('Submit research paper');

      // Update task status
      db.upsertTask({
        ...inProgress[0],
        status: 'completed',
      });

      const completed = db.getTasks('siduri-test', 'completed');
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe('task-1');

      const deleted = db.deleteTask('task-2');
      expect(deleted).toBe(true);
      expect(db.getTasks('siduri-test')).toHaveLength(1);
    });
  });

  // ==========================================
  // Archive Domain Tests
  // ==========================================

  describe('Archive Domain', () => {
    it('records archive events and retrieves in reverse chronological order', () => {
      db = new SiduriDatabase({ dbPath });

      const events: EpisodicEvent[] = [
        {
          id: crypto.randomUUID(),
          companionId: 'siduri-test',
          sourceType: 'chat_turn',
          occurredAt: '2026-09-11T10:00:00Z',
          payload: { message: 'Hello there' },
        },
        {
          id: crypto.randomUUID(),
          companionId: 'siduri-test',
          sourceType: 'tool_result',
          occurredAt: '2026-09-11T10:01:00Z',
          payload: { tool: 'search', result: 'found' },
        },
        {
          id: crypto.randomUUID(),
          companionId: 'siduri-test',
          sourceType: 'sensory',
          occurredAt: '2026-09-11T10:02:00Z',
          payload: { sense: 'voice', content: 'laughter' },
        },
      ];

      for (const e of events) {
        db.recordArchiveEvent(e);
      }

      const result = db.getRecentArchiveEvents('siduri-test', 10);
      expect(result).toHaveLength(3);
      // Reverse chronological order
      expect(result[0].occurredAt).toBe('2026-09-11T10:02:00Z');
      expect(result[1].occurredAt).toBe('2026-09-11T10:01:00Z');
      expect(result[2].occurredAt).toBe('2026-09-11T10:00:00Z');
    });

    it('searches archive events using FTS5 full-text search', () => {
      db = new SiduriDatabase({ dbPath });

      db.recordArchiveEvent({
        id: 'arch-1',
        companionId: 'siduri-test',
        sourceType: 'chat_turn',
        occurredAt: '2026-09-11T10:00:00Z',
        payload: { text: 'Kur rules the dark underworld realm' },
      });

      db.recordArchiveEvent({
        id: 'arch-2',
        companionId: 'siduri-test',
        sourceType: 'chat_turn',
        occurredAt: '2026-09-11T10:01:00Z',
        payload: { text: 'Gilgamesh is king of Uruk' },
      });

      const results = db.searchArchiveEvents('siduri-test', 'underworld');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === 'arch-1')).toBe(true);
      expect(results.some((r) => r.id === 'arch-2')).toBe(false);

      const results2 = db.searchArchiveEvents('siduri-test', 'Gilgamesh');
      expect(results2.length).toBeGreaterThan(0);
      expect(results2.some((r) => r.id === 'arch-2')).toBe(true);
    });

    it('resets archive for the specified companion only', () => {
      db = new SiduriDatabase({ dbPath });

      db.recordArchiveEvent({
        id: crypto.randomUUID(),
        companionId: 'comp-1',
        sourceType: 'chat_turn',
        occurredAt: new Date().toISOString(),
        payload: { text: 'Hello 1' },
      });

      db.recordArchiveEvent({
        id: crypto.randomUUID(),
        companionId: 'comp-2',
        sourceType: 'chat_turn',
        occurredAt: new Date().toISOString(),
        payload: { text: 'Hello 2' },
      });

      db.resetArchive('comp-1');

      expect(db.getRecentArchiveEvents('comp-1')).toHaveLength(0);
      expect(db.getRecentArchiveEvents('comp-2')).toHaveLength(1);
    });
  });

  // ==========================================
  // Cross-Domain & Persistence Tests
  // ==========================================

  describe('Cross-Domain & Persistence', () => {
    it('persists all domains across database close/reopen', () => {
      db = new SiduriDatabase({ dbPath });
      const cId = 'siduri-test';

      // Write Self data
      db.setIdentity({
        companionId: cId,
        name: 'Siduri',
        archetype: 'Tavern Keeper',
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      });

      const directiveId = crypto.randomUUID();
      db.commitDirective({
        id: directiveId,
        companionId: cId,
        priority: 80,
        directive: 'Serve drinks gracefully',
        status: 'ACTIVE',
        category: 'behavioral',
        createdAt: new Date().toISOString(),
      });

      // Write Knowledge data
      const inventoryId = crypto.randomUUID();
      db.upsertInventoryItem({
        id: inventoryId,
        companionId: cId,
        domain: 'tavern',
        entityName: 'Aged Wine',
        properties: { vintage: 2020, region: 'Uruk' },
        updatedAt: new Date().toISOString(),
      });

      // Write Archive data
      db.recordArchiveEvent({
        id: 'arch-cId',
        companionId: cId,
        sourceType: 'chat_turn',
        occurredAt: new Date().toISOString(),
        payload: { text: 'wine is the finest in Mesopotamia' },
      });

      // Close and reopen
      db.close();

      const db2 = new SiduriDatabase({ dbPath });

      // Verify all domains persisted
      expect(db2.getIdentity(cId)?.name).toBe('Siduri');
      expect(db2.getActiveDirectives(cId)).toHaveLength(1);
      expect(db2.getActiveDirectives(cId)[0].directive).toBe('Serve drinks gracefully');
      expect(db2.getInventory(cId)).toHaveLength(1);
      expect(db2.getInventory(cId)[0].entityName).toBe('Aged Wine');

      const archiveEvents = db2.searchArchiveEvents(cId, 'wine');
      expect(archiveEvents.some((e) => e.id === 'arch-cId')).toBe(true);

      db2.close();
      // Prevent afterEach from double-closing
      db = null as any;
    });

    it('handles rapid write operations without corruption', () => {
      db = new SiduriDatabase({ dbPath });
      const cId = 'siduri-test';

      expect(() => {
        for (let i = 0; i < 100; i++) {
          db.recordArchiveEvent({
            id: crypto.randomUUID(),
            companionId: cId,
            sourceType: 'chat_turn',
            occurredAt: new Date(Date.now() + i * 1000).toISOString(),
            payload: { index: i },
          });

          db.addFinanceEntry({
            id: crypto.randomUUID(),
            companionId: cId,
            category: 'test',
            amount: i,
            currency: 'USD',
            timestamp: new Date().toISOString(),
          });

          db.commitDirective({
            id: crypto.randomUUID(),
            companionId: cId,
            priority: 50,
            directive: `directive-${i}`,
            category: 'behavioral',
            status: 'active',
          });
        }
      }).not.toThrow();

      expect(db.getRecentArchiveEvents(cId, 200)).toHaveLength(100);
      expect(db.getFinanceEntries(cId, 200)).toHaveLength(100);
    });

    it('returns undefined/empty for non-existent data', () => {
      db = new SiduriDatabase({ dbPath });
      const cId = 'non-existent-companion';

      expect(db.getIdentity(cId)).toBeUndefined();
      expect(db.getPersonality(cId)).toBeUndefined();
      expect(db.getRelationship(cId, 'anyone')).toBeUndefined();
      expect(db.getActiveDirectives(cId)).toHaveLength(0);
      expect(db.getInventory(cId)).toHaveLength(0);
      expect(db.getFinanceEntries(cId)).toHaveLength(0);
      expect(db.getSchedule(cId)).toHaveLength(0);
      expect(db.getPreferences(cId)).toHaveLength(0);
      expect(db.getRecentArchiveEvents(cId)).toHaveLength(0);
      expect(db.searchArchiveEvents(cId, 'anything')).toHaveLength(0);
    });

    it('enforces directive state transitions (pending -> active -> disabled/rejected/revoked)', () => {
      db = new SiduriDatabase({ dbPath });
      const cId = 'directive-state-test';
      const dId = 'dir-lifecycle-1';

      // 1. Commit directive in PENDING state
      db.commitDirective({
        id: dId,
        companionId: cId,
        priority: 60,
        directive: 'Always verify claims',
        status: 'PENDING',
        category: 'behavioral',
      });

      // Pending directives must not be returned by getActiveDirectives
      expect(db.getActiveDirectives(cId)).toHaveLength(0);

      // 2. Approve directive
      db.approveDirective(dId);
      const active = db.getActiveDirectives(cId);
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(dId);
      expect(active[0].status).toBe('active');

      // 3. Revoke directive
      db.revokeDirective(dId);
      expect(db.getActiveDirectives(cId)).toHaveLength(0);

      // 4. Reject directive
      const d2Id = 'dir-lifecycle-2';
      db.commitDirective({
        id: d2Id,
        companionId: cId,
        priority: 50,
        directive: 'Unsafe rule',
        status: 'pending',
        category: 'behavioral',
      });
      db.rejectDirective(d2Id);
      expect(db.getActiveDirectives(cId)).toHaveLength(0);
    });

    it('rejects invalid directive state transitions (throws when approving non-PENDING directive)', () => {
      db = new SiduriDatabase({ dbPath });
      const cId = 'directive-invalid-transition-test';

      // 1. Commit directive in REJECTED state
      db.commitDirective({
        id: 'dir-rejected-1',
        companionId: cId,
        priority: 50,
        directive: 'Rejected directive',
        status: 'rejected',
        category: 'behavioral',
      });

      expect(() => db.approveDirective('dir-rejected-1')).toThrow(
        /invalid transition from status 'rejected' to 'active'/i
      );

      // 2. Commit directive in ACTIVE state
      db.commitDirective({
        id: 'dir-active-1',
        companionId: cId,
        priority: 50,
        directive: 'Already active directive',
        status: 'active',
        category: 'behavioral',
      });

      // Approving an already-active directive is now idempotent (no-op, does not throw)
      expect(() => db.approveDirective('dir-active-1')).not.toThrow();

      // 3. Rejecting an already ACTIVE directive throws
      expect(() => db.rejectDirective('dir-active-1')).toThrow(
        /invalid transition from status 'active' to 'rejected'/i
      );

      // 4. Approving a SUPERSEDED directive reactivates it
      db.commitDirective({
        id: 'dir-superseded-1',
        companionId: cId,
        priority: 50,
        directive: 'Superseded rule to reactivate',
        status: 'superseded',
        category: 'behavioral',
      });
      expect(() => db.approveDirective('dir-superseded-1', cId)).not.toThrow();
      expect(db.getDirective('dir-superseded-1', cId)?.status).toBe('active');

      // 5. Rejecting a SUPERSEDED directive transitions to rejected
      db.commitDirective({
        id: 'dir-superseded-2',
        companionId: cId,
        priority: 50,
        directive: 'Superseded rule to reject',
        status: 'superseded',
        category: 'behavioral',
      });
      expect(() => db.rejectDirective('dir-superseded-2', cId)).not.toThrow();
      expect(db.getDirective('dir-superseded-2', cId)?.status).toBe('rejected');
    });

    it('automatically marks prior directive as SUPERSEDED when approving superseding directive', () => {
      db = new SiduriDatabase({ dbPath });
      const cId = 'directive-supersede-test';

      // 1. Initial directive active
      db.commitDirective({
        id: 'dir-original-1',
        companionId: cId,
        priority: 50,
        directive: 'Original rule',
        status: 'ACTIVE',
        category: 'behavioral',
      });
      expect(db.getActiveDirectives(cId)).toHaveLength(1);

      // 2. Propose a superseding directive
      db.commitDirective({
        id: 'dir-replacement-1',
        companionId: cId,
        priority: 55,
        directive: 'Updated replacement rule',
        status: 'PENDING',
        category: 'behavioral',
        supersedesId: 'dir-original-1',
      });

      // Original is still active, replacement is pending
      expect(db.getActiveDirectives(cId)).toHaveLength(1);
      expect(db.getActiveDirectives(cId)[0].id).toBe('dir-original-1');

      // 3. Approve replacement directive
      db.approveDirective('dir-replacement-1', cId);

      const active = db.getActiveDirectives(cId);
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('dir-replacement-1');

      const original = db.getDirective('dir-original-1', cId);
      expect(original?.status).toBe('superseded');
    });

    it('enforces companion isolation on directive approval', () => {
      db = new SiduriDatabase({ dbPath });
      const cIdA = 'companion-alpha';
      const cIdB = 'companion-beta';

      db.commitDirective({
        id: 'dir-beta-1',
        companionId: cIdB,
        priority: 50,
        directive: 'Beta private rule',
        status: 'pending',
        category: 'behavioral',
      });

      // Alpha attempts to approve Beta's directive scoped to Alpha
      db.approveDirective('dir-beta-1', cIdA);

      // Beta's directive must remain pending and unapproved
      const betaDirective = db.getDirective('dir-beta-1', cIdB);
      expect(betaDirective?.status).toBe('pending');
      expect(db.getActiveDirectives(cIdB)).toHaveLength(0);

      // Beta approves its own directive successfully
      db.approveDirective('dir-beta-1', cIdB);
      expect(db.getActiveDirectives(cIdB)).toHaveLength(1);
    });
  });

  describe('System Logs', () => {
    it('persists structured system logs and queries them with filters', () => {
      const db = new SiduriDatabase();
      const cId = 'test-log-companion';

      db.insertLog({
        companionId: cId,
        level: 'info',
        subsystem: 'perception',
        message: 'Perception cycle started',
        metadata: { turn: 1 },
      });

      db.insertLog({
        companionId: cId,
        level: 'warn',
        subsystem: 'brain',
        message: 'High latency detected',
        metadata: { latencyMs: 1450 },
      });

      db.insertLog({
        companionId: cId,
        level: 'error',
        subsystem: 'truth_gate',
        message: 'Approval policy violation',
        metadata: { claimId: 'c-123' },
      });

      // Query all logs
      const allLogs = db.queryLogs({ companionId: cId });
      expect(allLogs).toHaveLength(3);

      // Query by level
      const errorLogs = db.queryLogs({ companionId: cId, level: 'error' });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Approval policy violation');
      expect(errorLogs[0].metadata).toEqual({ claimId: 'c-123' });

      // Query by subsystem
      const brainLogs = db.queryLogs({ companionId: cId, subsystem: 'brain' });
      expect(brainLogs).toHaveLength(1);
      expect(brainLogs[0].level).toBe('warn');

      // Search by keyword in message
      const searchLogs = db.queryLogs({ companionId: cId, q: 'latency' });
      expect(searchLogs).toHaveLength(1);
      expect(searchLogs[0].message).toContain('latency');

      // Clear logs
      db.clearLogs(cId);
      expect(db.queryLogs({ companionId: cId })).toHaveLength(0);
    });
  });

  describe('RFC VX-26-13: Deconstructed Archive & Direct Domain Routing', () => {
    it('records and searches cold audit events via archive_events and FTS5', () => {
      db = new SiduriDatabase({ dbPath });
      const cId = 'arch-comp-1';

      db.recordArchiveEvent({
        id: 'arch-evt-1',
        companionId: cId,
        sourceType: 'tool_execution',
        occurredAt: new Date().toISOString(),
        payload: { command: 'git checkout -b feature/archive', exitCode: 0 },
      });

      db.recordArchiveEvent({
        id: 'arch-evt-2',
        companionId: cId,
        sourceType: 'chat_turn',
        occurredAt: new Date().toISOString(),
        payload: { text: 'How do we remove memory and switch to sovereign primitives?' },
      });

      const recent = db.getRecentArchiveEvents(cId);
      expect(recent).toHaveLength(2);

      const single = db.getArchiveEvent('arch-evt-1');
      expect(single).toBeDefined();
      expect(single?.sourceType).toBe('tool_execution');
      expect((single?.payload as any)?.command).toBe('git checkout -b feature/archive');

      const searchResults = db.searchArchiveEvents(cId, 'primitives');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].id).toBe('arch-evt-2');
    });

    it('directly mutates companion relationships and identity when approving relational directives', () => {
      db = new SiduriDatabase({ dbPath });
      const cId = 'direct-self-comp';

      // 1. Relational directive: Recognize creator
      db.commitDirective({
        id: 'dir-creator-1',
        companionId: cId,
        directive: 'Recognize actor:kur-zagin stated relationship as creator',
        category: 'relational',
        status: 'pending',
      });

      // Before approval: relationship does not exist
      expect(db.getRelationship(cId, 'actor:kur-zagin')).toBeUndefined();

      // Approve directive directly in Self
      db.approveDirective('dir-creator-1', cId);

      // Verify relationship is directly updated in Self
      const rel = db.getRelationship(cId, 'actor:kur-zagin');
      expect(rel).toBeDefined();
      expect(rel?.role).toBe('creator');
      expect(rel?.stance).toBe('familiar_loyal');
      expect(rel?.trustScore).toBe(1.0);

      // Verify companion origin is also updated
      const identity = db.getIdentity(cId);
      expect(identity?.origin).toBe('kur-zagin');

      // 2. Relational directive: User name address
      db.commitDirective({
        id: 'dir-name-1',
        companionId: cId,
        directive: 'Address actor:kur-zagin as Kur Zagin',
        category: 'relational',
        status: 'pending',
      });

      db.approveDirective('dir-name-1', cId);
      const relAfterName = db.getRelationship(cId, 'actor:kur-zagin');
      expect(relAfterName?.name).toBe('Kur Zagin');
    });
  });
});
