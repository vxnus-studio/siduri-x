// Config
export interface OrganConfig {
  provider: string;
  [key: string]: any;
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

export type ClaimType = 'semantic' | 'preference' | 'episodic' | 'relationship';
export type ClaimAuthority = 'user_explicit' | 'user_correction' | 'import' | 'repeated_dialogue' | 'inference' | 'observation';
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED' | 'REVOKED';

export interface SourceEvent {
  id: string;
  sourceType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  schemaVersion?: number;
}

export interface MemoryProposal {
  subject: string;
  predicate: string;
  value: string;
  content?: string;
  provenance?: string;
  claimType?: ClaimType;
  sensitivity?: string;
  allowedAudiences?: string[];
  sourceEventId?: string;
}

export interface BehaviorProposal {
  directive: string;
  priority: number;
  subject?: string;
  predicate?: string;
  value?: string;
  memoryClass?: 'identity' | 'relationship' | 'behavioral' | 'semantic' | 'episodic';
  sourceEventId?: string;
}

export interface ResponsePlan {
  speech: string;
  language: string;
  memoryProposals?: MemoryProposal[];
  behaviorProposals?: BehaviorProposal[];
  internalMonologue?: string;
}

export interface BrainOrgan {
  generatePlan(context: BrainContext): Promise<ResponsePlan>;
}

// Memory Isolation
export type MemoryScope = 'OWNER' | 'VIEWER' | 'OPERATOR' | 'PUBLIC';

export interface Claim {
  id: string;
  subject: string;
  predicate: string;
  value: string;
  status: ClaimStatus;
  evidence?: string[];
  scope: MemoryScope;
  companionId: string; // Strict isolation boundary
  provenance?: string;
  sourceEventId?: string;
  claimType?: ClaimType;
  authority?: ClaimAuthority;
  userConfirmation?: 'explicit' | 'implied' | 'none';
  sensitivity?: string;
  allowedAudiences?: string[];
  confidence?: number;
  assertedAt?: string;
  validFrom?: string;
  validUntil?: string;
  supersedes?: string;
  replaces?: string;
}

export interface BehaviorDirective {
  id: string;
  companionId: string; // Strict isolation boundary
  directive: string;
  scopeMatcher: string[]; // Generic role matching
  priority: number;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED' | 'SUPERSEDED';
  supersedesId?: string;
}

export interface MemoryOrgan {
  initialize(companionId: string): Promise<void>;
  proposeClaim(claim: Omit<Claim, 'id' | 'status' | 'companionId'>): Promise<Claim>;
  searchClaims(query: string, scope: MemoryScope, limit?: number): Promise<Claim[]>;
  getClaims(): Promise<Claim[]>;
  getPendingClaims(): Promise<Claim[]>;
  approveClaim(id: string): Promise<void>;
  rejectClaim(id: string): Promise<void>;

  getDirectives(): Promise<BehaviorDirective[]>;
  proposeDirective(directiveData: Omit<BehaviorDirective, 'id' | 'status' | 'companionId'>): Promise<BehaviorDirective>;
  approveDirective(id: string): Promise<void>;
  rejectDirective(id: string): Promise<void>;
  revokeDirective(id: string): Promise<void>;
  disableDirective(id: string): Promise<void>;
  supersedeClaim?(id: string, replacement: Omit<Claim, 'id' | 'status' | 'companionId'>): Promise<Claim>;
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
export interface BehaviorContext {
  activeRole: string;
  directives: BehaviorDirective[];
}

export interface BehaviorOrgan {
  compile(context: BehaviorContext): Promise<string>;
}

// Knowledge
export interface KnowledgeItem {
  content: string;
  provenance: string;
  revision: string;
  citations: KnowledgeCitation[];
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

// Body
export interface BodyOrgan {
  setExpression(expression: string): void;
  speak(speechId: string, text?: string, language?: string): void;
  act(action: string): void;
  completeAction?(): void;
}
