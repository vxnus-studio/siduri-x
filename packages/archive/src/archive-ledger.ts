import {
  SiduriDatabase,
  ArchiveEvent,
  ArchiveLedger,
  SourceEvent,
} from '@sidurijs/core';
import { ArchiveEventInput, SqliteArchiveLedgerOptions } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

/**
 * SqliteArchiveLedger provides cold, append-only interaction audit logging
 * and FTS5 full-text search (RFC VX-26-13).
 *
 * It is completely purged of personality directives and memory claims,
 * serving strictly as an immutable external audit trail.
 */
export class SqliteArchiveLedger implements ArchiveLedger {
  private db: SiduriDatabase;
  private ownsDb: boolean;

  constructor(options: SqliteArchiveLedgerOptions = {}) {
    if (options.db) {
      this.db = options.db;
      this.ownsDb = false;
    } else {
      this.db = new SiduriDatabase({ dbPath: options.dbPath });
      this.ownsDb = true;
    }
  }

  async recordEvent(event: ArchiveEventInput | SourceEvent): Promise<ArchiveEvent> {
    const rawPayload = (event as any).payload || {};
    const companionId = (event as any).companionId || rawPayload.companionId || 'default';
    const archiveEvent: ArchiveEvent = {
      id: event.id || crypto.randomUUID(),
      companionId,
      sourceType: event.sourceType || 'chat_turn',
      occurredAt: event.occurredAt || new Date().toISOString(),
      payload: rawPayload,
    };

    this.db.recordArchiveEvent(archiveEvent);
    return archiveEvent;
  }

  async getRecentEvents(companionId: string, limit: number = 50): Promise<ArchiveEvent[]> {
    return this.db.getRecentArchiveEvents(companionId, limit);
  }

  async getEvent(id: string): Promise<ArchiveEvent | undefined> {
    return this.db.getArchiveEvent(id);
  }

  async searchEvents(companionId: string, query: string, limit: number = 50): Promise<ArchiveEvent[]> {
    return this.db.searchArchiveEvents(companionId, query, limit);
  }

  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }
}

export type SqliteArchiveStore = SqliteArchiveLedger;
