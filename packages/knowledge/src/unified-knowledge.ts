import { KnowledgeItem, KnowledgeOrgan } from '@sidurijs/core';
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

export interface KnowledgePackEntry extends EKnowledgeConfig {
  id?: string;
  name?: string;
  enabled?: boolean;
}

export interface UnifiedKnowledgeConfig {
  lifeDatabase?: boolean | SqliteLifeDatabaseOptions;
  dbPath?: string;
  pack?: (EKnowledgeConfig & { mode?: 'remote' | 'local'; [key: string]: unknown }) | Record<string, unknown>;
  packs?: KnowledgePackEntry[];
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
  private readonly packAdapters: Map<string, { adapter: EKnowledgeAdapter; entry: KnowledgePackEntry }> = new Map();

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

    // 2. Initialize portable E-Knowledge pack adapter(s)
    const packsList: KnowledgePackEntry[] = [];
    if (Array.isArray(config.packs) && config.packs.length > 0) {
      packsList.push(...config.packs);
    }

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
        if (packObj?.mode === 'remote') {
          provider = (registryUrl && packId) ? 'e-hub' : (baseUrl ? 'e-remote' : 'e-hub');
        } else if (registryUrl && packId) {
          provider = 'e-hub';
        } else if (packObj?.mode === 'local' || packPath) {
          provider = 'e-knowledge';
        } else if (baseUrl) {
          provider = 'e-remote';
        }
      }

      const primaryEntry: KnowledgePackEntry = {
        id: packId || 'default-pack',
        name: packId || 'default-pack',
        enabled: true,
        provider: provider as any,
        packPath,
        baseUrl,
        registryUrl,
        packId,
        timeoutMs: packObj?.timeoutMs ?? config.timeoutMs,
        maxResponseBytes: packObj?.maxResponseBytes ?? config.maxResponseBytes,
        preferredMode: (packObj?.preferredMode || config.preferredMode) as any,
      };

      if (!packsList.some(p => (p.id || p.packId) === primaryEntry.id)) {
        packsList.unshift(primaryEntry);
      }
    }

    for (const entry of packsList) {
      const id = entry.id || entry.packId || `pack-${this.packAdapters.size + 1}`;
      try {
        const adapter = new EKnowledgeAdapter(entry);
        this.packAdapters.set(id, {
          adapter,
          entry: {
            ...entry,
            id,
            enabled: entry.enabled !== false,
          },
        });
      } catch (err: any) {
        console.warn(`[UnifiedKnowledgeOrgan] Notice: E-Knowledge pack '${id}' not initialized: ${err.message}`);
      }
    }

    // Preserve backwards-compatible single eAdapter reference to first registered adapter
    const firstAdapter = this.packAdapters.values().next().value;
    if (firstAdapter) {
      this.eAdapter = firstAdapter.adapter;
    }
  }

  // --- Dynamic Knowledge Pack Toggle & Management Methods ---

  getPacks(): Array<{ id: string; name?: string; enabled: boolean; provider?: string }> {
    return Array.from(this.packAdapters.values()).map(({ entry }) => ({
      id: entry.id!,
      name: entry.name || entry.id,
      enabled: entry.enabled !== false,
      provider: entry.provider,
    }));
  }

  setPackEnabled(id: string, enabled: boolean): boolean {
    const record = this.packAdapters.get(id);
    if (!record) return false;
    record.entry.enabled = enabled;
    return true;
  }

  enablePack(id: string): boolean {
    return this.setPackEnabled(id, true);
  }

  disablePack(id: string): boolean {
    return this.setPackEnabled(id, false);
  }

  togglePack(id: string): boolean {
    const record = this.packAdapters.get(id);
    if (!record) return false;
    record.entry.enabled = !record.entry.enabled;
    return record.entry.enabled;
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
    if (this.packAdapters.size === 0) return [];

    const activeRecords = Array.from(this.packAdapters.values()).filter(
      ({ entry }) => entry.enabled !== false
    );
    if (activeRecords.length === 0) return [];

    const results: KnowledgeItem[] = [];
    const searchPromises = activeRecords.map(async ({ adapter, entry }) => {
      try {
        let packResults = await adapter.search(query);
        // If conversational phrasing like "Siduri, who is..." yielded 0 results, strip companion address
        if ((!packResults || packResults.length === 0) && /\b(?:siduri|hey|hi|hello|please|tell me|who is|what is|about)\b/i.test(query)) {
          const stripped = query
            .replace(/\b(?:siduri|hey|hi|hello|please|can you tell me|tell me|do you know|what do you know about)\b[,:]?/gi, '')
            .trim();
          if (stripped && stripped !== query) {
            packResults = await adapter.search(stripped);
          }
          if ((!packResults || packResults.length === 0)) {
            const subjectOnly = stripped.replace(/^(?:who|what|where|when|why|how)\s+(?:is|are|was|were)\s+/i, '').trim();
            if (subjectOnly && subjectOnly !== stripped) {
              packResults = await adapter.search(subjectOnly);
            }
          }
        }
        return packResults;
      } catch (err: any) {
        console.warn(`[UnifiedKnowledgeOrgan] Search on pack '${entry.id}' failed: ${err?.message || err}`);
        return [];
      }
    });

    const settled = await Promise.allSettled(searchPromises);
    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        results.push(...res.value);
      }
    }
    return results;
  }

  close(): void {
    if (this.lifeDb) {
      this.lifeDb.close();
    }
  }
}
