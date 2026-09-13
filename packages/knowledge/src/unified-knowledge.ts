import { KnowledgeItem, KnowledgeOrgan } from '@siduri-x/core';
import {
  LifeDatabase,
  LifeContextResult,
  InventoryRepository,
  FinanceRepository,
  ScheduleRepository,
  PreferencesRepository,
} from './types';
import { SqliteLifeDatabase, SqliteLifeDatabaseOptions } from './life-database';
import { EKnowledgeAdapter, EKnowledgeConfig } from './eknowledge-adapter';

export interface UnifiedKnowledgeConfig {
  lifeDatabase?: boolean | SqliteLifeDatabaseOptions;
  dbPath?: string;
  pack?: EKnowledgeConfig;
  // Flat properties for direct compatibility
  provider?: string;
  packPath?: string;
  baseUrl?: string;
  registryUrl?: string;
  packId?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  preferredMode?: 'lexical' | 'semantic' | 'hybrid';
  [key: string]: unknown;
}

export class UnifiedKnowledgeOrgan implements KnowledgeOrgan, LifeDatabase {
  public readonly lifeDb?: SqliteLifeDatabase;
  public readonly eAdapter?: EKnowledgeAdapter;

  constructor(config: UnifiedKnowledgeConfig = {}) {
    // 1. Initialize sovereign Life Database unless explicitly disabled
    const lifeDbDisabled = config.lifeDatabase === false || config.provider === 'e-only';
    if (!lifeDbDisabled) {
      const lifeDbOpts = typeof config.lifeDatabase === 'object' ? config.lifeDatabase : {};
      this.lifeDb = new SqliteLifeDatabase({
        dbPath: config.dbPath || lifeDbOpts.dbPath,
        ...lifeDbOpts,
      });
    }

    // 2. Initialize portable E-Knowledge pack adapter if configured
    const eConfig = config.pack || (
      config.packPath || config.baseUrl || config.registryUrl || config.packId ||
      (config.provider && ['e-knowledge', 'e-remote', 'e-hub'].includes(config.provider))
        ? {
            provider: config.provider as any,
            packPath: config.packPath,
            baseUrl: config.baseUrl,
            registryUrl: config.registryUrl,
            packId: config.packId,
            timeoutMs: config.timeoutMs,
            maxResponseBytes: config.maxResponseBytes,
            preferredMode: config.preferredMode,
          }
        : undefined
    );

    if (eConfig && config.provider !== 'none') {
      try {
        this.eAdapter = new EKnowledgeAdapter(eConfig);
      } catch (err: any) {
        console.warn(`[UnifiedKnowledgeOrgan] Notice: E-Knowledge pack not initialized: ${err.message}`);
      }
    }
  }

  // --- LifeDatabase Interface Facades ---

  get inventory(): InventoryRepository {
    if (!this.lifeDb) throw new Error('LifeDatabase is not enabled in this Knowledge configuration');
    return this.lifeDb.inventory;
  }

  get finance(): FinanceRepository {
    if (!this.lifeDb) throw new Error('LifeDatabase is not enabled in this Knowledge configuration');
    return this.lifeDb.finance;
  }

  get schedule(): ScheduleRepository {
    if (!this.lifeDb) throw new Error('LifeDatabase is not enabled in this Knowledge configuration');
    return this.lifeDb.schedule;
  }

  get preferences(): PreferencesRepository {
    if (!this.lifeDb) throw new Error('LifeDatabase is not enabled in this Knowledge configuration');
    return this.lifeDb.preferences;
  }

  async queryLifeContext(companionId: string, queryText: string): Promise<LifeContextResult> {
    if (!this.lifeDb) {
      return {
        matchedInventory: [],
        recentFinances: [],
        upcomingSchedule: [],
        preferences: [],
        formattedContext: '',
      };
    }
    return this.lifeDb.queryLifeContext(companionId, queryText);
  }

  async queryContext(companionId: string, query: string): Promise<string[]> {
    if (!this.lifeDb) return [];
    return this.lifeDb.queryContext(companionId, query);
  }

  // --- KnowledgeOrgan Interface Facades ---

  async search(query: string): Promise<KnowledgeItem[]> {
    if (!this.eAdapter) return [];
    return this.eAdapter.search(query);
  }

  close(): void {
    if (this.lifeDb) {
      this.lifeDb.close();
    }
  }
}
