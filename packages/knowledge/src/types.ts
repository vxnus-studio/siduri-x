import {
  LifeInventoryItem,
  LifeFinanceEntry,
  LifeScheduleItem,
  LifePreference,
} from '@siduri-x/core';

export type {
  LifeInventoryItem,
  LifeFinanceEntry,
  LifeScheduleItem,
  LifePreference,
};

export interface LifeFinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  currency: string;
  entryCount: number;
}

export interface LifeContextResult {
  matchedInventory: LifeInventoryItem[];
  recentFinances: LifeFinanceEntry[];
  upcomingSchedule: LifeScheduleItem[];
  preferences: LifePreference[];
  formattedContext: string;
}

export interface InventoryRepository {
  getItems(companionId: string, domain?: string): Promise<LifeInventoryItem[]>;
  saveItem(item: LifeInventoryItem): Promise<void>;
  findByEntityName(companionId: string, name: string): Promise<LifeInventoryItem | undefined>;
}

export interface FinanceRepository {
  addEntry(entry: LifeFinanceEntry): Promise<void>;
  getEntries(companionId: string, limit?: number): Promise<LifeFinanceEntry[]>;
  getSummary(companionId: string): Promise<LifeFinanceSummary>;
}

export interface ScheduleRepository {
  saveItem(item: LifeScheduleItem): Promise<void>;
  getUpcoming(companionId: string, windowStart?: Date, windowEnd?: Date): Promise<LifeScheduleItem[]>;
}

export interface PreferencesRepository {
  setPreference(pref: LifePreference): Promise<void>;
  getPreferences(companionId: string, category?: string): Promise<LifePreference[]>;
  getPreferenceValue(companionId: string, key: string): Promise<string | undefined>;
}

export interface LifeDatabase {
  readonly inventory: InventoryRepository;
  readonly finance: FinanceRepository;
  readonly schedule: ScheduleRepository;
  readonly preferences: PreferencesRepository;
  queryLifeContext(companionId: string, queryText: string): Promise<LifeContextResult>;
  queryContext(companionId: string, query: string): Promise<string[]>;
}
