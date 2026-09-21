// Export neutral context types and validator
export * from './context';
export * from './proposals';
export * from './evidence';
export * from './gating';
export * from './experience';
export * from './dispatcher';
export * from './action';
export * from './action-policy';
export * from './ear-types';
export * from './capability';
export * from './sqlite-action-store';
export * from './teaching';
export * from './runtime';
export * from './chat-contract';
export * from './input-normalizer';
export * from './intent-classifier';
export * from './context-retriever';
export * from './prompt-compiler';
export * from './cognition-planner';
export * from './interaction-settler';
export * from './memory-settler';
export * from './action-executor';
export * from './experience-emitter';
export * from './response-envelope';
export * from './session-history';
export * from './schema-validator';
export * from './siduri-db';
export * from './database';
export * from './container';
export * from './perception-pipeline';

import { EvidenceRecord } from './evidence';
import { ActionIntent } from './action';
import { RequestContext } from './context';
import { EarIngestOptions } from './ear-types';
import {
  ClaimType,
  ClaimAuthority,
  ClaimStatus,
  DirectiveStatus,
  SourceEvent,
  MemoryProposal,
  BehaviorProposal,
} from './proposals';

// Config
export interface OrganConfig {
  provider: string;
  [key: string]: unknown;
}

export interface CompanionConfig {
  id: string; // Unique isolation identifier
  name: string;
  brain: OrganConfig;
  voice: OrganConfig;
  archive: OrganConfig;
  knowledge: OrganConfig;
  behavior: OrganConfig;
  body: OrganConfig;
  vision: OrganConfig;
}

// Brain
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}

export interface BrainContext {
  systemPrompt: string;
  contextPrompt: string;
  recentMessages: Message[];
  recipient?: MemoryScope;
}

export interface ResponsePlan {
  speech: string;
  language: string;
  subtitle?: string;
  subtitles?: Record<string, string>;
  memoryProposals?: MemoryProposal[];
  behaviorProposals?: BehaviorProposal[];
  actionIntents?: ActionIntent[];
  internalMonologue?: string;
}

export interface RetrievalPlan {
  shouldQueryKnowledge: boolean;
  knowledgeQueries: string[];
  shouldQueryMemory?: boolean;
  memoryQueries?: string[];
  reasoning?: string;
}

export interface PersonaCompilationResult {
  isValid: boolean;
  manifest: {
    specVersion?: string;
    kind?: 'self';
    id?: string;
    name?: string;
    version?: string;
    author?: { name: string; url?: string; signature?: string };
    identity: {
      name: string;
      archetype?: string;
      origin?: string;
      ethos?: string;
    };
    personality?: PersonalityTraits;
    relationships?: Array<{
      entityId: string;
      role?: string;
      stance?: string;
      conventions?: string[];
    }>;
    directives: Array<{
      id?: string;
      directive: string;
      category?: 'guardrail' | 'relational' | 'behavioral';
      priority?: number;
      scopeActor?: string;
      supersedesId?: string;
    }>;
    dialogueExamples?: Array<{
      user: string;
      assistant: string;
    }>;
  };
  errors?: string[];
}

export interface BrainOrgan {
  generatePlan(context: BrainContext): Promise<ResponsePlan>;
  planRetrieval?(text: string, context?: RequestContext, recentHistory?: { role: string; content: string }[]): Promise<RetrievalPlan>;
  compilePersona?(content: string, options?: { companionId?: string }): Promise<PersonaCompilationResult>;
}


// Single-owner local companion memory scope
export type MemoryScope = 'companion' | 'user' | string;

export interface Claim {
  id: string;
  subject: string;
  predicate: string;
  value: string;
  status: ClaimStatus;
  evidence?: string[];
  scope?: MemoryScope;
  companionId: string; // Strict isolation boundary
  provenance?: string;
  sourceEventId?: string;
  claimType?: ClaimType;
  authority?: ClaimAuthority;
  userConfirmation?: 'explicit' | 'implied' | 'none';
  sensitivity?: string;
  confidence?: number;
  assertedAt?: string;
  validFrom?: string;
  validUntil?: string;
  supersedes?: string;
  replaces?: string;
  [key: string]: unknown;
}

export interface BehaviorDirective {
  id: string;
  companionId: string; // Strict isolation boundary
  directive: string;
  priority: number;
  status: DirectiveStatus;
  supersedesId?: string;
  memoryClass?: 'identity' | 'relationship' | 'behavioral';
  subject?: string;
  predicate?: string;
  value?: string;
  validFrom?: string;
  validUntil?: string;
  [key: string]: unknown;
}

export interface MemoryQueryOptions {
  sensitivity?: string;
  limit?: number;
  minConfidence?: number;
  now?: string | Date;
  [key: string]: unknown;
}

// --- Sovereign Archive Domain (RFC VX-26-13: Deconstructing Memory) ---

export interface ArchiveEvent {
  id: string;
  companionId: string;
  sourceType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface ArchiveQueryOptions {
  limit?: number;
  sourceType?: string;
  since?: string;
  until?: string;
  [key: string]: unknown;
}

/**
 * Sovereign interaction archive: cold, append-only interaction audit ledger and full-text search.
 * Replaces the overloaded 'Memory' metaphor for audit trails, past tool runs, and historical interaction logs.
 */
export interface ArchiveLedger {
  recordEvent(event: ArchiveEvent | SourceEvent): Promise<ArchiveEvent | SourceEvent>;
  getRecentEvents(companionId: string, limit?: number): Promise<ArchiveEvent[]>;
  getEvent?(id: string): Promise<ArchiveEvent | undefined>;
  searchEvents?(companionId: string, query: string, limit?: number): Promise<ArchiveEvent[]>;
  close?(): void;
}

export type ArchiveStore = ArchiveLedger;
export type EpisodicLedger = ArchiveLedger;

/**
 * Active dialogue continuity interface for working conversational context.
 */
export interface DialogueHistory {
  getHistory(sessionKey?: string): Message[];
  setHistory(sessionKey: string, history: Message[]): void;
  append(sessionKey: string, message: Message): void;
  clear(sessionKey?: string): void;
}




// Voice Queue
export interface AudioEvent {
  type: 'STARTED' | 'COMPLETED' | 'FAILED';
  speechId: string;
  text?: string;
  language?: string;
  audioBuffer?: Uint8Array;
}

export interface VoiceOrgan {
  enqueueSpeech(text: string, language: string, priority?: number): string;
  onLifecycleEvent(callback: (event: AudioEvent) => void): void;
  getQueueStatus(): { pending: number; current?: string };
}

// Vision
export interface VisionOrgan {
  analyze(imageUrl: string, prompt: string): Promise<string>;
}

// Behavior
export interface ActiveSelfProjection {
  identityFacts: string[];
  relationshipFacts: string[];
  behavioralRules: string[];
  activeIds: string[];
  excludedIds: string[];
  diagnostics: Record<string, string>;
  render(): string;
}

export interface BehaviorContext {
  directives: BehaviorDirective[];
  companionId?: string;
  actorId?: string;
  sessionId?: string;
  now?: string;
  [key: string]: unknown;
}

export interface BehaviorOrgan {
  compile(context: BehaviorContext): Promise<string>;
  compileProjection?(context: BehaviorContext): Promise<ActiveSelfProjection>;
}

// Knowledge
export interface KnowledgeItem {
  content: string;
  provenance: string;
  revision: string;
  citations: KnowledgeCitation[];
  evidenceRecord?: EvidenceRecord;
}

export interface KnowledgeCitation {
  sourceId: string;
  documentId?: string;
  chunkId?: string;
  locator?: string;
}

export interface KnowledgeOrgan {
  search(query: string): Promise<KnowledgeItem[]>;
}


// Ear (Perception)
export interface EarPerception {
  id: string;
  source: string; // 'microphone' | 'text_chat' | 'system_event' | 'platform_webhook'
  text?: string;
  audioBuffer?: Uint8Array;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface EarOrgan {
  listen(source: string, payload: unknown, options?: EarIngestOptions): Promise<EarPerception>;
  transcribeAudio?(audio: Uint8Array): Promise<string>;
  classifyIntent?(
    text: string,
    context?: RequestContext
  ): Promise<Record<string, unknown>> | Record<string, unknown>;
}

// Body
export interface BodyOrgan {
  setExpression(expression: string): void;
  speak(speechId: string, text?: string, language?: string): void;
  act(action: string): void;
  completeAction?(): void;
}

// Observation
export interface ObservationReading {
  entity: string;
  value: string;
  confidence: number;
  sourceCrop?: string;
  ocrText?: string;
  competingInterpretations?: string[];
}

export interface Observation {
  observationId: string;
  evidenceId: string;
  sourceName: string;
  providerId: string;
  readings: ObservationReading[];
  confidence: number;
  createdAt: string;
  expiresAt: string;
  frameDigest: string;
}

export interface ObservationResult {
  observation?: Observation;
  duplicate: boolean;
  reason?: 'empty_frame' | 'duplicate_frame' | 'invalid_reading' | 'provider_failure';
}

export interface ObservationOrgan {
  ingest(frame: Uint8Array, sourceName: string, providerId?: string): Promise<ObservationResult>;
  current(now?: Date): Observation[];
  clearExpired(now?: Date): number;
}

// Health Probe Contract
export interface HealthProbeContext {
  config: unknown;
  env: NodeJS.ProcessEnv | Record<string, string | undefined>;
}

export interface HealthProbeResult {
  ok: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export type HealthProbeFn = (context: HealthProbeContext) => Promise<HealthProbeResult> | HealthProbeResult;

// Mouth (Communication & Output Delivery)
export * from './mouth-types';

// Core Domain Substrates (Clean Architecture)
import type {
  SelfIdentity,
  PersonalityTraits,
  SelfDirective,
  SelfRelationship,
  SelfDialogueExample,
  LifeInventoryItem,
  LifeScheduleItem,
  LifePreference,
  LifeEntity,
  LifeEvent,
  LifeTask,
  MemoryClaim,
  EpisodicEvent,
} from './siduri-db';

export type {
  SelfIdentity,
  PersonalityTraits,
  SelfDirective,
  SelfRelationship,
  SelfDialogueExample,
  LifeInventoryItem,
  LifeScheduleItem,
  LifePreference,
  LifeEntity,
  LifeEvent,
  LifeTask,
  MemoryClaim,
  EpisodicEvent,
};

export interface SelfRepository {
  getIdentity(companionId: string): Promise<SelfIdentity | undefined>;
  setIdentity(identity: SelfIdentity): Promise<void>;
  getPersonality?(companionId: string): Promise<PersonalityTraits>;
  setPersonality?(companionId: string, traits: PersonalityTraits): Promise<void>;
  getActiveDirectives(companionId: string): Promise<SelfDirective[]>;
  getRelationship(companionId: string, entityId: string): Promise<SelfRelationship | null>;
  getRelationships?(companionId: string): Promise<SelfRelationship[]>;
  getExemplars?(companionId: string): Promise<SelfDialogueExample[]>;
  setExemplars?(companionId: string, exemplars: SelfDialogueExample[]): Promise<void>;
  commitDirectives(companionId: string, directives: SelfDirective[]): Promise<void>;
  updateRelationship(companionId: string, rel: SelfRelationship): Promise<void>;
  disableDirective?(id: string, companionId?: string): Promise<void>;
  approveDirective?(id: string, companionId?: string): Promise<void>;
  rejectDirective?(id: string, companionId?: string): Promise<void>;
  revokeDirective?(id: string, companionId?: string): Promise<void>;
  expireDirective?(id: string, companionId?: string): Promise<void>;
  getActiveSelf?(companionId: string): Promise<{
    identity?: SelfIdentity;
    personality?: PersonalityTraits;
    directives: SelfDirective[];
    relationships?: SelfRelationship[];
    exemplars?: SelfDialogueExample[];
  }>;
}

export interface LifeDatabase {
  getInventory(companionId: string, domain?: string): Promise<LifeInventoryItem[]>;
  getFinanceSummary?(companionId: string): Promise<any>;
  getSchedule?(companionId: string, windowStart?: Date, windowEnd?: Date): Promise<LifeScheduleItem[]>;
  getPreferences?(companionId: string): Promise<Record<string, string> | LifePreference[]>;
  getEntities?(companionId: string, entityType?: string, domain?: string): Promise<LifeEntity[]>;
  getEvents?(companionId: string, stream?: string, limit?: number): Promise<LifeEvent[]>;
  getTasks?(companionId: string, status?: string): Promise<LifeTask[]>;
  queryContext(companionId: string, query: string): Promise<string[]>;
  searchLifeContext?(queryText: string): Promise<string[]>;
}

export interface EpisodicMemoryStore {
  recordEvent(companionId: string, event: any): Promise<void>;
  searchClaims(companionId: string, query: string, limit?: number): Promise<MemoryClaim[]>;
  proposeClaim(claim: any): Promise<MemoryClaim>;
  approveClaim(claimId: string): Promise<void>;
  rejectClaim?(claimId: string): Promise<void>;
  getApprovedClaims?(companionId: string, limit?: number): Promise<MemoryClaim[]>;
  getRecentEvents?(companionId: string, limit?: number): Promise<EpisodicEvent[]>;
}

export interface EKnowledgeOrgan {
  search(query: string): Promise<KnowledgeItem[]>;
}

export {
  promoteApprovedClaimToSelf,
  promoteApprovedClaimToKnowledge,
  isSelfAffectingClaim,
  isKnowledgeAffectingClaim,
} from './runtime';

export {
  SiduriDatabase,
  type SiduriDatabaseOptions,
  type LogLevel,
  type SystemLog,
} from './siduri-db';

