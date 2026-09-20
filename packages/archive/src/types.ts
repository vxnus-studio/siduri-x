import {
  ArchiveEvent,
  ArchiveLedger,
  ArchiveQueryOptions,
  SourceEvent,
} from '@sidurijs/core';

export type {
  ArchiveEvent,
  ArchiveLedger,
  ArchiveQueryOptions,
  SourceEvent,
};

export interface ArchiveEventInput {
  id?: string;
  companionId?: string;
  sourceType: string;
  occurredAt?: string;
  payload: Record<string, unknown>;
}

export interface SqliteArchiveLedgerOptions {
  db?: any;
  dbPath?: string;
  [key: string]: unknown;
}
