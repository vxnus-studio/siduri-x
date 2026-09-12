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
  MemoryClaim,
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
  });

  // ==========================================
  // Memory Domain Tests
  // ==========================================

  describe('Memory Domain', () => {
    it('records episodic events and retrieves in reverse chronological order', () => {
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
        db.recordEvent(e);
      }

      const result = db.getRecentEvents('siduri-test', 10);
      expect(result).toHaveLength(3);
      // Reverse chronological order
      expect(result[0].occurredAt).toBe('2026-09-11T10:02:00Z');
      expect(result[1].occurredAt).toBe('2026-09-11T10:01:00Z');
      expect(result[2].occurredAt).toBe('2026-09-11T10:00:00Z');
    });

    it('proposes a claim with PENDING status', () => {
      db = new SiduriDatabase({ dbPath });

      const claim = db.proposeClaim({
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        subject: 'Kur',
        predicate: 'is',
        value: 'a dark entity from the underworld',
        confidence: 0.8,
        evidence: ['lore book chapter 3'],
        assertedAt: new Date().toISOString(),
      });

      expect(claim.status).toBe('PENDING');
      expect(claim.subject).toBe('Kur');
      expect(claim.predicate).toBe('is');
      expect(claim.value).toBe('a dark entity from the underworld');
      expect(claim.confidence).toBe(0.8);
    });

    it('approves and rejects claims', () => {
      db = new SiduriDatabase({ dbPath });

      const claim1 = db.proposeClaim({
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        subject: 'Kur',
        predicate: 'is',
        value: 'a god of the underworld',
        confidence: 0.9,
        assertedAt: new Date().toISOString(),
      });

      const claim2 = db.proposeClaim({
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        subject: 'Kur',
        predicate: 'likes',
        value: 'apples',
        confidence: 0.3,
        assertedAt: new Date().toISOString(),
      });

      db.approveClaim(claim1.id);
      db.rejectClaim(claim2.id);

      const approved = db.getApprovedClaims('siduri-test');
      expect(approved).toHaveLength(1);
      expect(approved[0].id).toBe(claim1.id);
      expect(approved[0].status).toBe('APPROVED');
    });

    it('searches claims using FTS5 full-text search', () => {
      db = new SiduriDatabase({ dbPath });

      // Insert and approve several claims
      const c1 = db.proposeClaim({
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        subject: 'Kur',
        predicate: 'rules',
        value: 'the dark underworld realm',
        confidence: 0.9,
        assertedAt: new Date().toISOString(),
      });

      const c2 = db.proposeClaim({
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        subject: 'Gilgamesh',
        predicate: 'is',
        value: 'king of Uruk',
        confidence: 0.95,
        assertedAt: new Date().toISOString(),
      });

      const c3 = db.proposeClaim({
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        subject: 'Enkidu',
        predicate: 'wanders',
        value: 'the wild forest',
        confidence: 0.85,
        assertedAt: new Date().toISOString(),
      });

      db.approveClaim(c1.id);
      db.approveClaim(c2.id);
      db.approveClaim(c3.id);

      // Search for "underworld" — should match c1 only
      const results = db.searchClaims('siduri-test', 'underworld');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((c) => c.id === c1.id)).toBe(true);
      expect(results.some((c) => c.id === c2.id)).toBe(false);

      // Search for "Gilgamesh" — should match c2 only
      const results2 = db.searchClaims('siduri-test', 'Gilgamesh');
      expect(results2.length).toBeGreaterThan(0);
      expect(results2.some((c) => c.id === c2.id)).toBe(true);
    });

    it('FTS5 search returns results ranked by relevance', () => {
      db = new SiduriDatabase({ dbPath });

      // c1 mentions "dark" twice → should rank higher
      const c1 = db.proposeClaim({
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        subject: 'dark forest',
        predicate: 'has',
        value: 'dark trees and dark monsters',
        confidence: 0.8,
        assertedAt: new Date().toISOString(),
      });

      // c2 mentions "dark" once → should rank lower
      const c2 = db.proposeClaim({
        id: crypto.randomUUID(),
        companionId: 'siduri-test',
        subject: 'cave',
        predicate: 'has',
        value: 'a dark entrance',
        confidence: 0.8,
        assertedAt: new Date().toISOString(),
      });

      db.approveClaim(c1.id);
      db.approveClaim(c2.id);

      const results = db.searchClaims('siduri-test', 'dark');
      expect(results).toHaveLength(2);
      // More occurrences of "dark" → better BM25 rank (lower rank value = better match)
      expect(results[0].id).toBe(c1.id);
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

      // Write Memory data
      const claim = db.proposeClaim({
        id: crypto.randomUUID(),
        companionId: cId,
        subject: 'wine',
        predicate: 'is',
        value: 'the finest in Mesopotamia',
        confidence: 1.0,
        assertedAt: new Date().toISOString(),
      });
      db.approveClaim(claim.id);

      // Close and reopen
      db.close();

      const db2 = new SiduriDatabase({ dbPath });

      // Verify all domains persisted
      expect(db2.getIdentity(cId)?.name).toBe('Siduri');
      expect(db2.getActiveDirectives(cId)).toHaveLength(1);
      expect(db2.getActiveDirectives(cId)[0].directive).toBe('Serve drinks gracefully');
      expect(db2.getInventory(cId)).toHaveLength(1);
      expect(db2.getInventory(cId)[0].entityName).toBe('Aged Wine');

      const claims = db2.searchClaims(cId, 'wine');
      expect(claims.some((c) => c.id === claim.id && c.status === 'APPROVED')).toBe(true);

      db2.close();
      // Prevent afterEach from double-closing
      db = null as any;
    });

    it('handles rapid write operations without corruption', () => {
      db = new SiduriDatabase({ dbPath });
      const cId = 'siduri-test';

      expect(() => {
        for (let i = 0; i < 100; i++) {
          db.recordEvent({
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

          db.proposeClaim({
            id: crypto.randomUUID(),
            companionId: cId,
            subject: `subject-${i}`,
            predicate: 'is',
            value: `value-${i}`,
            confidence: 1.0,
            assertedAt: new Date().toISOString(),
          });
        }
      }).not.toThrow();

      expect(db.getRecentEvents(cId, 200)).toHaveLength(100);
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
      expect(db.getRecentEvents(cId)).toHaveLength(0);
      expect(db.searchClaims(cId, 'anything')).toHaveLength(0);
      expect(db.getApprovedClaims(cId)).toHaveLength(0);
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
      expect(active[0].status).toBe('ACTIVE');

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
        status: 'PENDING',
        category: 'behavioral',
      });
      db.rejectDirective(d2Id);
      expect(db.getActiveDirectives(cId)).toHaveLength(0);
    });

    it('enforces claim state transitions (pending -> approved -> revoked/expired/session_only)', () => {
      db = new SiduriDatabase({ dbPath });
      const cId = 'claim-state-test';

      const claim = db.proposeClaim({
        id: 'claim-1',
        companionId: cId,
        subject: 'user',
        predicate: 'likes',
        value: 'matcha',
      });
      expect(claim.status).toBe('PENDING');
      expect(db.getApprovedClaims(cId)).toHaveLength(0);

      // Approve
      db.approveClaim('claim-1');
      expect(db.getApprovedClaims(cId)).toHaveLength(1);

      // Revoke
      db.revokeClaim('claim-1');
      expect(db.getApprovedClaims(cId)).toHaveLength(0);

      // Session only
      const claim2 = db.proposeClaim({
        id: 'claim-2',
        companionId: cId,
        subject: 'session',
        predicate: 'topic',
        value: 'investigation',
      });
      db.markClaimSessionOnly('claim-2');
      expect(db.getApprovedClaims(cId)).toHaveLength(0);

      // Expire
      db.expireClaim('claim-2');
      expect(db.getApprovedClaims(cId)).toHaveLength(0);
    });
  });
});
