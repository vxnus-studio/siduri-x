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
export * from './memory-settler';
export * from './action-executor';
export * from './experience-emitter';
export * from './response-envelope';
export * from './session-history';

import { EvidenceRecord } from './evidence';
import { ActionIntent } from './action';
import { RequestContext } from './context';
import { EarIngestOptions } from './ear-types';
import {
  ClaimType,
  ClaimAuthority,
  ClaimStatus,
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
  memory: OrganConfig;
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
  memoryProposals?: MemoryProposal[];
  behaviorProposals?: BehaviorProposal[];
  actionIntents?: ActionIntent[];
  internalMonologue?: string;
}

export interface BrainOrgan {
  generatePlan(context: BrainContext): Promise<ResponsePlan>;
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
  status: 'PENDING' | 'ACTIVE' | 'DISABLED' | 'SUPERSEDED' | 'REJECTED' | 'REVOKED' | 'EXPIRED';
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

export interface MemoryOrgan {
  initialize(companionId: string): Promise<void>;
  proposeClaim(claim: Omit<Claim, 'id' | 'status' | 'companionId'>): Promise<Claim>;
  searchClaims(query: string, scopeOrOptions?: MemoryScope | MemoryQueryOptions, limit?: number): Promise<Claim[]>;
  getClaims(limit?: number): Promise<Claim[]>;
  getPendingClaims(limit?: number): Promise<Claim[]>;
  approveClaim(id: string): Promise<void>;
  rejectClaim(id: string): Promise<void>;
  markClaimSessionOnly?(id: string): Promise<void>;
  expireClaim?(id: string): Promise<void>;
  revokeClaim?(id: string, reason?: string): Promise<void>;

  getDirectives(): Promise<BehaviorDirective[]>;
  proposeDirective(directiveData: Omit<BehaviorDirective, 'id' | 'status' | 'companionId'>): Promise<BehaviorDirective>;
  approveDirective(id: string): Promise<void>;
  rejectDirective(id: string): Promise<void>;
  revokeDirective(id: string): Promise<void>;
  disableDirective(id: string): Promise<void>;
  expireDirective?(id: string): Promise<void>;
  supersedeClaim?(id: string, replacement: Omit<Claim, 'id' | 'status' | 'companionId'>): Promise<Claim>;
  updateClaim?(
    id: string,
    updates: Partial<Pick<Claim, 'subject' | 'predicate' | 'value' | 'scope' | 'sensitivity' | 'confidence' | 'validFrom' | 'validUntil'>>
  ): Promise<Claim>;
  resetMemory?(): Promise<void>;
  addSourceEvent?(event: SourceEvent): Promise<SourceEvent>;
  getSourceEvent?(id: string): Promise<SourceEvent | undefined>;
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



