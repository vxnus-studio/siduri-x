import {
  SiduriDatabase,
  LifeInventoryItem,
  LifeFinanceEntry,
  LifeScheduleItem,
  LifePreference,
} from '@siduri-x/core';
import {
  InventoryRepository,
  FinanceRepository,
  ScheduleRepository,
  PreferencesRepository,
  LifeFinanceSummary,
} from './types';

export class SqliteInventoryRepository implements InventoryRepository {
  constructor(private db: SiduriDatabase) {}

  async getItems(companionId: string, domain?: string): Promise<LifeInventoryItem[]> {
    return this.db.getInventory(companionId, domain);
  }

  async saveItem(item: LifeInventoryItem): Promise<void> {
    this.db.upsertInventoryItem(item);
  }

  async findByEntityName(companionId: string, name: string): Promise<LifeInventoryItem | undefined> {
    const items = this.db.getInventory(companionId);
    const target = name.toLowerCase().trim();
    return items.find((i) => i.entityName.toLowerCase().trim() === target);
  }
}

export class SqliteFinanceRepository implements FinanceRepository {
  constructor(private db: SiduriDatabase) {}

  async addEntry(entry: LifeFinanceEntry): Promise<void> {
    this.db.addFinanceEntry(entry);
  }

  async getEntries(companionId: string, limit?: number): Promise<LifeFinanceEntry[]> {
    return this.db.getFinanceEntries(companionId, limit);
  }

  async getSummary(companionId: string): Promise<LifeFinanceSummary> {
    const entries = this.db.getFinanceEntries(companionId, 1000);
    let totalIncome = 0;
    let totalExpenses = 0;
    let currency = 'USD';

    for (const e of entries) {
      if (e.currency) currency = e.currency;
      if (e.amount > 0) {
        totalIncome += e.amount;
      } else {
        totalExpenses += Math.abs(e.amount);
      }
    }

    const netBalance = Math.round((totalIncome - totalExpenses) * 100) / 100;
    return {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netBalance,
      currency,
      entryCount: entries.length,
    };
  }
}

export class SqliteScheduleRepository implements ScheduleRepository {
  constructor(private db: SiduriDatabase) {}

  async saveItem(item: LifeScheduleItem): Promise<void> {
    this.db.upsertScheduleItem(item);
  }

  async getUpcoming(companionId: string, windowStart?: Date, windowEnd?: Date): Promise<LifeScheduleItem[]> {
    const all = this.db.getSchedule(companionId);
    if (!windowStart && !windowEnd) return all;

    return all.filter((item) => {
      const start = new Date(item.startTime);
      if (windowStart && start < windowStart) return false;
      if (windowEnd && start > windowEnd) return false;
      return true;
    });
  }
}

export class SqlitePreferencesRepository implements PreferencesRepository {
  constructor(private db: SiduriDatabase) {}

  async setPreference(pref: LifePreference): Promise<void> {
    this.db.upsertPreference(pref);
  }

  async getPreferences(companionId: string, category?: string): Promise<LifePreference[]> {
    const all = this.db.getPreferences(companionId);
    if (!category) return all;
    return all.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }

  async getPreferenceValue(companionId: string, key: string): Promise<string | undefined> {
    const all = this.db.getPreferences(companionId);
    const target = key.toLowerCase().trim();
    const found = all.find((p) => p.preferenceKey.toLowerCase().trim() === target);
    return found?.preferenceValue;
  }
}
