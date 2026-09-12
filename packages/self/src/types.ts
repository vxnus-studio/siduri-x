import {
  SelfIdentity,
  PersonalityTraits,
  SelfDirective,
  SelfRelationship,
} from '@siduri-x/core';

export type {
  SelfIdentity,
  PersonalityTraits,
  SelfDirective,
  SelfRelationship,
};

export interface SelfRepository {
  getIdentity(companionId: string): Promise<SelfIdentity | undefined>;
  setIdentity(identity: SelfIdentity): Promise<void>;
  getPersonality(companionId: string): Promise<PersonalityTraits>;
  setPersonality(companionId: string, traits: PersonalityTraits): Promise<void>;
  getActiveDirectives(companionId: string): Promise<SelfDirective[]>;
  commitDirectives(companionId: string, directives: SelfDirective[]): Promise<void>;
  disableDirective(id: string): Promise<void>;
  approveDirective?(id: string): Promise<void>;
  rejectDirective?(id: string): Promise<void>;
  revokeDirective?(id: string): Promise<void>;
  expireDirective?(id: string): Promise<void>;
  getRelationship(companionId: string, entityId: string): Promise<SelfRelationship | null>;
  updateRelationship(companionId: string, rel: SelfRelationship): Promise<void>;
}

export interface SelfPackageAuthor {
  name: string;
  url?: string;
  signature?: string;
}

export interface SelfPackageDirective {
  id: string;
  priority: number;
  directive: string;
  category?: 'behavioral' | 'guardrail' | 'relational';
}

export interface SelfDialogueExample {
  user: string;
  assistant: string;
}

export interface SelfPackageManifest {
  specVersion: string;
  kind: 'self';
  id: string;
  name: string;
  version: string;
  author: SelfPackageAuthor;
  license?: string;
  identity: {
    name: string;
    archetype?: string;
    origin?: string;
  };
  personality: PersonalityTraits;
  directives: SelfPackageDirective[];
  guardrails?: string[];
  dialogueExamples?: SelfDialogueExample[];
}

export interface ScanResult {
  safe: boolean;
  reason?: string;
}

export interface ScannedDirective extends SelfPackageDirective {
  scanResult: ScanResult;
  approvedByDefault: boolean;
}

export interface SelfPackageParseResult {
  manifest?: SelfPackageManifest;
  scannedDirectives: ScannedDirective[];
  isValid: boolean;
  errors: string[];
}

export interface SelfCompilationContext {
  companionId: string;
  identity?: SelfIdentity;
  personality?: PersonalityTraits;
  directives: SelfDirective[];
  interlocutorEntityId?: string;
  relationship?: SelfRelationship | null;
  guardrails?: string[];
  now?: string;
}

export interface ActiveSelfProjection {
  identityBlock?: string;
  personalityBlock?: string;
  winningDirectives: SelfDirective[];
  relationshipBlock?: string;
  guardrailsBlock?: string;
  identityFacts: string[];
  relationshipFacts: string[];
  behavioralRules: string[];
  activeIds: string[];
  excludedIds: string[];
  diagnostics: Record<string, string>;
  render(): string;
}
