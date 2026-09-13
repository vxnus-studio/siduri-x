import {
  SiduriDatabase,
  SelfIdentity,
  PersonalityTraits,
  SelfDirective,
  SelfRelationship,
  SelfDialogueExample,
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

  async approveDirective(id: string, companionId?: string): Promise<void> {
    this.db.approveDirective(id, companionId);
  }

  async rejectDirective(id: string, companionId?: string): Promise<void> {
    this.db.rejectDirective(id, companionId);
  }

  async revokeDirective(id: string, companionId?: string): Promise<void> {
    this.db.revokeDirective(id, companionId);
  }

  async expireDirective(id: string, companionId?: string): Promise<void> {
    this.db.expireDirective(id, companionId);
  }

  async disableDirective(id: string, companionId?: string): Promise<void> {
    this.db.disableDirective(id, companionId);
  }

  async getRelationships(companionId: string): Promise<SelfRelationship[]> {
    return this.db.getRelationships(companionId);
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

  async getExemplars(companionId: string): Promise<SelfDialogueExample[]> {
    return this.db.getExemplars(companionId);
  }

  async setExemplars(companionId: string, exemplars: SelfDialogueExample[]): Promise<void> {
    this.db.setExemplars(companionId, exemplars);
  }

  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }
}
