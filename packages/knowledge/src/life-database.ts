import { SiduriDatabase } from '@siduri-x/core';
import {
  LifeDatabase,
  LifeContextResult,
  InventoryRepository,
  FinanceRepository,
  ScheduleRepository,
  PreferencesRepository,
  EntityRepository,
  EventRepository,
  TaskRepository,
} from './types';
import {
  SqliteInventoryRepository,
  SqliteFinanceRepository,
  SqliteScheduleRepository,
  SqlitePreferencesRepository,
  SqliteEntityRepository,
  SqliteEventRepository,
  SqliteTaskRepository,
} from './repositories';

export interface SqliteLifeDatabaseOptions {
  db?: SiduriDatabase;
  dbPath?: string;
}

export class SqliteLifeDatabase implements LifeDatabase {
  private db: SiduriDatabase;
  private ownsDb: boolean;

  public readonly inventory: InventoryRepository;
  public readonly finance: FinanceRepository;
  public readonly schedule: ScheduleRepository;
  public readonly preferences: PreferencesRepository;
  public readonly entities: EntityRepository;
  public readonly events: EventRepository;
  public readonly tasks: TaskRepository;

  constructor(options: SqliteLifeDatabaseOptions = {}) {
    if (options.db) {
      this.db = options.db;
      this.ownsDb = false;
    } else {
      this.db = new SiduriDatabase({ dbPath: options.dbPath });
      this.ownsDb = true;
    }

    this.inventory = new SqliteInventoryRepository(this.db);
    this.finance = new SqliteFinanceRepository(this.db);
    this.schedule = new SqliteScheduleRepository(this.db);
    this.preferences = new SqlitePreferencesRepository(this.db);
    this.entities = new SqliteEntityRepository(this.db);
    this.events = new SqliteEventRepository(this.db);
    this.tasks = new SqliteTaskRepository(this.db);
  }

  async queryLifeContext(companionId: string, queryText: string): Promise<LifeContextResult> {
    const queryLower = queryText.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    // 1. Matched Inventory
    const allInventory = await this.inventory.getItems(companionId);
    const matchedInventory = allInventory.filter((item) => {
      const matchName = item.entityName.toLowerCase().includes(queryLower) ||
        queryTerms.some((t) => item.entityName.toLowerCase().includes(t));
      const matchDomain = item.domain.toLowerCase().includes(queryLower);
      const matchProps = JSON.stringify(item.properties).toLowerCase().includes(queryLower);
      return matchName || matchDomain || matchProps;
    });

    // 2. Recent Finances
    const recentFinances = await this.finance.getEntries(companionId, 5);

    // 3. Upcoming Schedule
    const upcomingSchedule = await this.schedule.getUpcoming(companionId);

    // 4. Preferences
    const allPreferences = await this.preferences.getPreferences(companionId);
    const matchedPreferences = allPreferences.filter((p) => {
      return (
        p.preferenceKey.toLowerCase().includes(queryLower) ||
        p.preferenceValue.toLowerCase().includes(queryLower) ||
        p.category.toLowerCase().includes(queryLower) ||
        queryTerms.some(
          (t) =>
            p.preferenceKey.toLowerCase().includes(t) ||
            p.preferenceValue.toLowerCase().includes(t)
        )
      );
    });

    // 5. Generic Life Entities (Contacts, Places, Bookmarks, Custom items)
    const allEntities = await this.entities.getEntities(companionId);
    const matchedEntities = allEntities.filter((entity) => {
      const matchName = entity.name.toLowerCase().includes(queryLower) ||
        queryTerms.some((t) => entity.name.toLowerCase().includes(t));
      const matchType = entity.entityType.toLowerCase().includes(queryLower);
      const matchDomain = entity.domain.toLowerCase().includes(queryLower);
      const matchProps = JSON.stringify(entity.properties).toLowerCase().includes(queryLower);
      return matchName || matchType || matchDomain || matchProps;
    });

    // 6. Recent Life Events (Workouts, Health, Habits, Telemetry)
    const recentEvents = await this.events.getEvents(companionId, undefined, 5);

    // 7. Active Tasks & Goals
    const allTasks = await this.tasks.getTasks(companionId);
    const activeTasks = allTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');

    // 8. Render formatted context block
    const lines: string[] = ['<life_context>'];

    if (matchedInventory.length > 0) {
      lines.push('Inventory:');
      for (const item of matchedInventory) {
        lines.push(`- ${item.entityName} (${item.domain}): ${JSON.stringify(item.properties)}`);
      }
    }

    if (matchedEntities.length > 0) {
      lines.push('Personal Entities & Contacts:');
      for (const entity of matchedEntities) {
        lines.push(`- [${entity.entityType}] ${entity.name} (${entity.domain}): ${JSON.stringify(entity.properties)}`);
      }
    }

    if (recentFinances.length > 0) {
      const summary = await this.finance.getSummary(companionId);
      lines.push(
        `Financial Summary: Balance: ${summary.netBalance >= 0 ? '+' : ''}${summary.netBalance.toFixed(2)} ${summary.currency} (Total income: ${summary.totalIncome.toFixed(2)}, expenses: ${summary.totalExpenses.toFixed(2)})`
      );
    }

    if (recentEvents.length > 0) {
      lines.push('Recent Life Events:');
      for (const ev of recentEvents.slice(0, 3)) {
        lines.push(`- [${ev.stream}] ${ev.timestamp}: ${ev.metricValue != null ? `${ev.metricValue} ` : ''}${JSON.stringify(ev.metadata || {})}`);
      }
    }

    if (upcomingSchedule.length > 0) {
      lines.push('Upcoming Schedule:');
      for (const item of upcomingSchedule.slice(0, 3)) {
        lines.push(`- ${item.startTime}: ${item.title}${item.endTime ? ` (until ${item.endTime})` : ''}`);
      }
    }

    if (activeTasks.length > 0) {
      lines.push('Active Tasks & Goals:');
      for (const task of activeTasks.slice(0, 5)) {
        lines.push(`- [${task.status}] ${task.title}${task.targetDate ? ` (due: ${task.targetDate})` : ''}`);
      }
    }

    if (matchedPreferences.length > 0) {
      lines.push('User Preferences:');
      for (const pref of matchedPreferences) {
        lines.push(`- ${pref.preferenceKey}: ${pref.preferenceValue} (${pref.category})`);
      }
    }

    lines.push('</life_context>');
    const formattedContext = lines.length > 2 ? lines.join('\n') : '';

    return {
      matchedInventory,
      recentFinances,
      upcomingSchedule,
      preferences: matchedPreferences.length > 0 ? matchedPreferences : allPreferences,
      matchedEntities,
      recentEvents,
      activeTasks,
      formattedContext,
    };
  }

  async queryContext(companionId: string, query: string): Promise<string[]> {
    const result = await this.queryLifeContext(companionId, query);
    if (!result.formattedContext) return [];
    return [result.formattedContext];
  }

  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }
}
