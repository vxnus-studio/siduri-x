import {
  SiduriDatabase,
  SelfIdentity,
  PersonalityTraits,
  SelfDirective,
  SelfRelationship,
} from '@siduri-x/core';
import { SelfRepository } from './types';

export interface SqliteSelfRepositoryOptions {
  db?: SiduriDatabase;
  dbPath?: string;
}

export const DEFAULT_PERSONALITY_TRAITS: PersonalityTraits = {
  warmth: 0.5,
  formality: 0.5,
  sarcasm: 0.5,
  verbosity: 0.5,
  curiosity: 0.5,
};

export class SqliteSelfRepository implements SelfRepository {
  private db: SiduriDatabase;
  private ownsDb: boolean;

  constructor(options: SqliteSelfRepositoryOptions = {}) {
    if (options.db) {
      this.db = options.db;
      this.ownsDb = false;
    } else {
      this.db = new SiduriDatabase({ dbPath: options.dbPath });
      this.ownsDb = true;
    }
  }

  async getIdentity(companionId: string): Promise<SelfIdentity | undefined> {
    return this.db.getIdentity(companionId);
  }

  async setIdentity(identity: SelfIdentity): Promise<void> {
    this.db.setIdentity(identity);
  }

  async getPersonality(companionId: string): Promise<PersonalityTraits> {
    const traits = this.db.getPersonality(companionId);
    return traits || { ...DEFAULT_PERSONALITY_TRAITS };
  }

  async setPersonality(companionId: string, traits: PersonalityTraits): Promise<void> {
    this.db.setPersonality(companionId, traits);
  }

  async getActiveDirectives(companionId: string): Promise<SelfDirective[]> {
    return this.db.getActiveDirectives(companionId);
  }

  async commitDirectives(companionId: string, directives: SelfDirective[]): Promise<void> {
    for (const d of directives) {
      this.db.commitDirective({
        ...d,
        companionId,
      });
    }
  }

  async disableDirective(id: string): Promise<void> {
    this.db.disableDirective(id);
  }

  async getRelationship(companionId: string, entityId: string): Promise<SelfRelationship | null> {
    const rel = this.db.getRelationship(companionId, entityId);
    return rel ?? null;
  }

  async updateRelationship(companionId: string, rel: SelfRelationship): Promise<void> {
    this.db.upsertRelationship({
      ...rel,
      companionId,
    });
  }

  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }
}
