import {
  SiduriDatabase,
  LifeInventoryItem,
  LifeFinanceEntry,
  LifeScheduleItem,
  LifePreference,
  LifeEntity,
  LifeEvent,
  LifeTask,
} from '@siduri-x/core';
import {
  InventoryRepository,
  FinanceRepository,
  ScheduleRepository,
  PreferencesRepository,
  EntityRepository,
  EventRepository,
  TaskRepository,
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

  async deleteItem(id: string): Promise<boolean> {
    return this.db.deleteScheduleItem(id);
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

export class SqliteEntityRepository implements EntityRepository {
  constructor(private db: SiduriDatabase) {}

  async getEntities(companionId: string, entityType?: string, domain?: string): Promise<LifeEntity[]> {
    return this.db.getEntities(companionId, entityType, domain);
  }

  async getEntityById(id: string): Promise<LifeEntity | undefined> {
    return this.db.getEntityById(id);
  }

  async saveEntity(entity: LifeEntity): Promise<void> {
    this.db.upsertEntity(entity);
  }

  async deleteEntity(id: string): Promise<boolean> {
    return this.db.deleteEntity(id);
  }
}

export class SqliteEventRepository implements EventRepository {
  constructor(private db: SiduriDatabase) {}

  async addEvent(event: LifeEvent): Promise<void> {
    this.db.addEvent(event);
  }

  async getEvents(companionId: string, stream?: string, limit?: number): Promise<LifeEvent[]> {
    return this.db.getEvents(companionId, stream, limit);
  }
}

export class SqliteTaskRepository implements TaskRepository {
  constructor(private db: SiduriDatabase) {}

  async getTasks(companionId: string, status?: string): Promise<LifeTask[]> {
    return this.db.getTasks(companionId, status);
  }

  async saveTask(task: LifeTask): Promise<void> {
    this.db.upsertTask(task);
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.db.deleteTask(id);
  }
}
