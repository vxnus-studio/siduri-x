import { KnowledgeItem, KnowledgeOrgan } from '@siduri-x/core';
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
import { SqliteLifeDatabase, SqliteLifeDatabaseOptions } from './life-database';
import { EKnowledgeAdapter, EKnowledgeConfig } from './eknowledge-adapter';

export interface UnifiedKnowledgeConfig {
  lifeDatabase?: boolean | SqliteLifeDatabaseOptions;
  dbPath?: string;
  pack?: (EKnowledgeConfig & { mode?: 'remote' | 'local'; [key: string]: unknown }) | Record<string, unknown>;
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
    const packObj = config.pack as (EKnowledgeConfig & { mode?: 'remote' | 'local' }) | undefined;
    const isEPack = Boolean(
      packObj ||
      config.packPath ||
      config.baseUrl ||
      config.registryUrl ||
      config.packId ||
      (config.provider && ['e-knowledge', 'e-remote', 'e-hub'].includes(config.provider))
    );

    if (isEPack && config.provider !== 'none') {
      const packId = packObj?.packId || config.packId;
      const registryUrl = packObj?.registryUrl || config.registryUrl;
      const baseUrl = packObj?.baseUrl || config.baseUrl;
      const packPath = packObj?.packPath || config.packPath;

      let provider = packObj?.provider || (config.provider && ['e-knowledge', 'e-remote', 'e-hub'].includes(config.provider) ? config.provider : undefined);
      if (!provider || provider === 'unified') {
        if (packObj?.mode === 'remote' || (registryUrl && packId)) {
          provider = 'e-hub';
        } else if (packObj?.mode === 'local' || packPath) {
          provider = 'e-knowledge';
        } else if (baseUrl) {
          provider = 'e-remote';
        }
      }

      const eConfig: EKnowledgeConfig = {
        provider: provider as any,
        packPath,
        baseUrl,
        registryUrl,
        packId,
        timeoutMs: packObj?.timeoutMs ?? config.timeoutMs,
        maxResponseBytes: packObj?.maxResponseBytes ?? config.maxResponseBytes,
        preferredMode: (packObj?.preferredMode || config.preferredMode) as any,
      };

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

  get entities(): EntityRepository {
    if (!this.lifeDb) throw new Error('LifeDatabase is not enabled in this Knowledge configuration');
    return this.lifeDb.entities;
  }

  get events(): EventRepository {
    if (!this.lifeDb) throw new Error('LifeDatabase is not enabled in this Knowledge configuration');
    return this.lifeDb.events;
  }

  get tasks(): TaskRepository {
    if (!this.lifeDb) throw new Error('LifeDatabase is not enabled in this Knowledge configuration');
    return this.lifeDb.tasks;
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
    try {
      return await this.eAdapter.search(query);
    } catch (err: any) {
      console.warn(`[UnifiedKnowledgeOrgan] External knowledge search failed: ${err?.message || err}`);
      return [];
    }
  }

  close(): void {
    if (this.lifeDb) {
      this.lifeDb.close();
    }
  }
}
