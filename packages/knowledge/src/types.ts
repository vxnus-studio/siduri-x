import {
  LifeInventoryItem,
  LifeFinanceEntry,
  LifeScheduleItem,
  LifePreference,
  LifeEntity,
  LifeEvent,
  LifeTask,
} from '@sidurijs/core';

export type {
  LifeInventoryItem,
  LifeFinanceEntry,
  LifeScheduleItem,
  LifePreference,
  LifeEntity,
  LifeEvent,
  LifeTask,
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
  matchedEntities?: LifeEntity[];
  recentEvents?: LifeEvent[];
  activeTasks?: LifeTask[];
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
  deleteItem?(id: string): Promise<boolean>;
}

export interface PreferencesRepository {
  setPreference(pref: LifePreference): Promise<void>;
  getPreferences(companionId: string, category?: string): Promise<LifePreference[]>;
  getPreferenceValue(companionId: string, key: string): Promise<string | undefined>;
}

export interface EntityRepository {
  getEntities(companionId: string, entityType?: string, domain?: string): Promise<LifeEntity[]>;
  getEntityById(id: string): Promise<LifeEntity | undefined>;
  saveEntity(entity: LifeEntity): Promise<void>;
  deleteEntity(id: string): Promise<boolean>;
}

export interface EventRepository {
  addEvent(event: LifeEvent): Promise<void>;
  getEvents(companionId: string, stream?: string, limit?: number): Promise<LifeEvent[]>;
}

export interface TaskRepository {
  getTasks(companionId: string, status?: string): Promise<LifeTask[]>;
  saveTask(task: LifeTask): Promise<void>;
  deleteTask(id: string): Promise<boolean>;
}

export interface LifeDatabase {
  readonly inventory: InventoryRepository;
  readonly finance: FinanceRepository;
  readonly schedule: ScheduleRepository;
  readonly preferences: PreferencesRepository;
  readonly entities: EntityRepository;
  readonly events: EventRepository;
  readonly tasks: TaskRepository;
  queryLifeContext(companionId: string, queryText: string): Promise<LifeContextResult>;
  queryContext(companionId: string, query: string): Promise<string[]>;
}
