import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SqliteLifeDatabase,
  LifeInventoryItem,
  LifeFinanceEntry,
  LifeScheduleItem,
  LifePreference,
} from './index';

describe('@siduri-x/knowledge Domain Package (Internal Life DB)', () => {
  let tmpDir: string;
  let dbPath: string;
  let lifeDb: SqliteLifeDatabase;
  const companionId = 'siduri-companion';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siduri-life-test-'));
    dbPath = path.join(tmpDir, 'life.db');
    lifeDb = new SqliteLifeDatabase({ dbPath });
  });

  afterEach(() => {
    try {
      lifeDb.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Inventory Repository', () => {
    it('manages inventory items with JSON properties roundtrip and domain filtering', async () => {
      const item1: LifeInventoryItem = {
        id: 'inv-1',
        companionId,
        domain: 'gaming',
        entityName: 'Staff of Homa',
        properties: { rarity: 5, refinement: 1, baseAtk: 608 },
        updatedAt: new Date().toISOString(),
      };

      const item2: LifeInventoryItem = {
        id: 'inv-2',
        companionId,
        domain: 'hardware',
        entityName: 'RTX 4090 GPU',
        properties: { vram: '24GB', pcie: 'Gen4' },
        updatedAt: new Date().toISOString(),
      };

      await lifeDb.inventory.saveItem(item1);
      await lifeDb.inventory.saveItem(item2);

      const all = await lifeDb.inventory.getItems(companionId);
      expect(all).toHaveLength(2);

      const gaming = await lifeDb.inventory.getItems(companionId, 'gaming');
      expect(gaming).toHaveLength(1);
      expect(gaming[0].entityName).toBe('Staff of Homa');
      expect(gaming[0].properties).toEqual({ rarity: 5, refinement: 1, baseAtk: 608 });

      const found = await lifeDb.inventory.findByEntityName(companionId, 'rtx 4090 gpu');
      expect(found).toBeDefined();
      expect(found?.id).toBe('inv-2');
    });
  });

  describe('Finance Repository', () => {
    it('records entries and computes exact non-hallucinated financial arithmetic', async () => {
      const entries: LifeFinanceEntry[] = [
        {
          id: 'fin-1',
          companionId,
          category: 'consulting',
          amount: 1500.0, // income
          currency: 'USD',
          timestamp: '2026-09-01T10:00:00Z',
        },
        {
          id: 'fin-2',
          companionId,
          category: 'server_hosting',
          amount: -120.5, // expense
          currency: 'USD',
          timestamp: '2026-09-02T10:00:00Z',
        },
        {
          id: 'fin-3',
          companionId,
          category: 'coffee_beans',
          amount: -25.25, // expense
          currency: 'USD',
          timestamp: '2026-09-03T10:00:00Z',
        },
      ];

      for (const e of entries) {
        await lifeDb.finance.addEntry(e);
      }

      const summary = await lifeDb.finance.getSummary(companionId);
      expect(summary.totalIncome).toBe(1500.0);
      expect(summary.totalExpenses).toBe(145.75);
      expect(summary.netBalance).toBe(1354.25);
      expect(summary.currency).toBe('USD');
      expect(summary.entryCount).toBe(3);
    });
  });

  describe('Schedule Repository', () => {
    it('records schedule items and filters by time window', async () => {
      const items: LifeScheduleItem[] = [
        {
          id: 'sch-1',
          companionId,
          title: 'Daily Architecture Standup',
          startTime: '2026-09-11T09:00:00Z',
          endTime: '2026-09-11T09:30:00Z',
          isRecurring: true,
          status: 'active',
        },
        {
          id: 'sch-2',
          companionId,
          title: 'Deep Work Block',
          startTime: '2026-09-11T14:00:00Z',
          endTime: '2026-09-11T17:00:00Z',
          isRecurring: false,
          status: 'active',
        },
        {
          id: 'sch-3',
          companionId,
          title: 'Future Milestone Release',
          startTime: '2026-10-01T12:00:00Z',
          isRecurring: false,
          status: 'active',
        },
      ];

      for (const it of items) {
        await lifeDb.schedule.saveItem(it);
      }

      const all = await lifeDb.schedule.getUpcoming(companionId);
      expect(all).toHaveLength(3);

      const windowFiltered = await lifeDb.schedule.getUpcoming(
        companionId,
        new Date('2026-09-11T00:00:00Z'),
        new Date('2026-09-11T23:59:59Z')
      );
      expect(windowFiltered).toHaveLength(2);
      expect(windowFiltered.map((i) => i.id)).toEqual(['sch-1', 'sch-2']);
    });
  });

  describe('Preferences Repository', () => {
    it('manages categorized preferences and specific key lookups', async () => {
      const p1: LifePreference = {
        id: 'pref-1',
        companionId,
        preferenceKey: 'theme',
        preferenceValue: 'dark_tokyo_night',
        category: 'ui',
        updatedAt: new Date().toISOString(),
      };

      const p2: LifePreference = {
        id: 'pref-2',
        companionId,
        preferenceKey: 'coffee',
        preferenceValue: 'pourover_ethiopian_light_roast',
        category: 'food',
        updatedAt: new Date().toISOString(),
      };

      await lifeDb.preferences.setPreference(p1);
      await lifeDb.preferences.setPreference(p2);

      const uiPrefs = await lifeDb.preferences.getPreferences(companionId, 'ui');
      expect(uiPrefs).toHaveLength(1);
      expect(uiPrefs[0].preferenceKey).toBe('theme');

      const val = await lifeDb.preferences.getPreferenceValue(companionId, 'coffee');
      expect(val).toBe('pourover_ethiopian_light_roast');

      const missing = await lifeDb.preferences.getPreferenceValue(companionId, 'unknown_key');
      expect(missing).toBeUndefined();
    });
  });

  describe('LifeDatabase Context Retrieval', () => {
    it('synthesizes sovereign facts into prompt-ready <life_context> tokens', async () => {
      await lifeDb.inventory.saveItem({
        id: 'inv-10',
        companionId,
        domain: 'gaming',
        entityName: 'Staff of Homa',
        properties: { refinement: 5 },
        updatedAt: new Date().toISOString(),
      });

      await lifeDb.finance.addEntry({
        id: 'fin-10',
        companionId,
        category: 'income',
        amount: 2500,
        currency: 'USD',
        timestamp: new Date().toISOString(),
      });

      await lifeDb.schedule.saveItem({
        id: 'sch-10',
        companionId,
        title: 'Board Meeting',
        startTime: '2026-09-12T10:00:00Z',
        isRecurring: false,
        status: 'active',
      });

      await lifeDb.preferences.setPreference({
        id: 'pref-10',
        companionId,
        preferenceKey: 'favorite_snack',
        preferenceValue: 'pistachios',
        category: 'food',
        updatedAt: new Date().toISOString(),
      });

      const result = await lifeDb.queryLifeContext(companionId, 'Tell me about my Staff of Homa and favorite snack');
      expect(result.formattedContext).toContain('<life_context>');
      expect(result.formattedContext).toContain('Staff of Homa (gaming)');
      expect(result.formattedContext).toContain('favorite_snack: pistachios');
      expect(result.formattedContext).toContain('Financial Summary:');
      expect(result.formattedContext).toContain('</life_context>');

      const contextArray = await lifeDb.queryContext(companionId, 'Homa');
      expect(contextArray).toHaveLength(1);
      expect(contextArray[0]).toContain('Staff of Homa');
    });
  });
});
