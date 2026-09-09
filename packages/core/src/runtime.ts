import {
  BrainOrgan,
  MemoryOrgan,
  VoiceOrgan,
  KnowledgeOrgan,
  VisionOrgan,
  BehaviorOrgan,
  BodyOrgan,
  HandsOrgan,
  EarOrgan,
  ObservationOrgan,
  ObservationResult,
  Observation,
  Message,
  RequestContext,
  ActionPolicyEngine,
  ResponseGatingEngine,
  StageResponseOptions,
  ApproveResponseOptions,
  RejectResponseOptions,
  ExperienceDispatcher,
  ExperienceAdapter,
  OrganConfig,
  Claim,
  BehaviorDirective,
  StagedResponsePlan,
  ResponseGateEvaluation,
  EvidenceRecord,
  MouthOrgan,
  MouthUtterance,
  MouthMedium,
  FormattedMouthOutput,
  MouthStreamChunk,
  MouthChannel,
} from './index';
import { normalizeUserInput } from './input-normalizer';
import { classifyInputIntentAsync } from './intent-classifier';
import { retrieveRuntimeContext } from './context-retriever';
import { compilePrompts } from './prompt-compiler';
import { generateCognitionPlan } from './cognition-planner';
import { settleMemoryProposals } from './memory-settler';
import { executeActionIntents } from './action-executor';
import { emitExperienceEvents } from './experience-emitter';
import {
  createGateRejectionEnvelope,
  assembleResponseEnvelope,
} from './response-envelope';
import { SessionHistoryManager } from './session-history';

export interface SiduriRuntimeConfig {
  name: string;
  brain?: OrganConfig | Record<string, unknown>;
  voice?: OrganConfig | Record<string, unknown>;
  memory?: OrganConfig | Record<string, unknown>;
  knowledge?: OrganConfig | Record<string, unknown>;
  behavior?: OrganConfig | Record<string, unknown>;
  body?: OrganConfig | Record<string, unknown>;
  vision?: OrganConfig | Record<string, unknown>;
  hands?: OrganConfig | Record<string, unknown>;
  ear?: OrganConfig | Record<string, unknown>;
  observation?: OrganConfig | Record<string, unknown>;
  mouth?: OrganConfig | Record<string, unknown>;
  actionPolicy?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RuntimeOrgans {
  brain?: BrainOrgan;
  memory?: MemoryOrgan;
  voice?: VoiceOrgan | ExperienceAdapter;
  knowledge?: KnowledgeOrgan;
  vision?: VisionOrgan;
  behavior?: BehaviorOrgan;
  body?: BodyOrgan | ExperienceAdapter;
  hands?: HandsOrgan;
  ear?: EarOrgan;
  observation?: ObservationOrgan;
  mouth?: MouthOrgan;
  actionPolicy?: ActionPolicyEngine;
}

export interface CompanionPerception {
  source: string;
  text?: string;
  audioBuffer?: Uint8Array;
  roleOrContext?: 'OWNER' | 'VIEWER' | 'OPERATOR' | RequestContext | string;
  context?: RequestContext;
  history?: Message[];
  medium?: MouthMedium;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

/**
 * SiduriRuntime coordinates companion lifecycle, sensory perception,
 * context retrieval, cognition planning, safety gating, action execution,
 * and experience emission across decoupled organs.
 */
export class SiduriRuntime {
  public id: string;
  public config: SiduriRuntimeConfig;
  public brain?: BrainOrgan;
  public memory?: MemoryOrgan;
  public voice?: VoiceOrgan | ExperienceAdapter;
  public knowledge?: KnowledgeOrgan;
  public vision?: VisionOrgan;
  public behavior?: BehaviorOrgan;
  public body?: BodyOrgan | ExperienceAdapter;
  public hands?: HandsOrgan;
  public ear?: EarOrgan;
  public observation?: ObservationOrgan;
  public mouth?: MouthOrgan;
  public gating: ResponseGatingEngine;
  public actionPolicy: ActionPolicyEngine;
  public dispatcher: ExperienceDispatcher;
  private readonly sessionHistory = new SessionHistoryManager();

  // Backward-compatible getter/setter for conversation history
  get conversationHistory(): Message[] {
    return this.sessionHistory.getHistory('default');
  }

  set conversationHistory(messages: Message[]) {
    this.sessionHistory.setHistory('default', messages);
  }

  constructor(id: string, config: SiduriRuntimeConfig, organs: RuntimeOrgans = {}) {
    this.id = id;
    this.config = config;
    this.brain = organs.brain;
    this.memory = organs.memory;
    this.voice = organs.voice;
    this.knowledge = organs.knowledge;
    this.vision = organs.vision;
    this.behavior = organs.behavior;
    this.body = organs.body;
    this.hands = organs.hands;
    this.ear = organs.ear;
    this.observation = organs.observation;
    this.mouth = organs.mouth;
    this.gating = new ResponseGatingEngine();
    this.actionPolicy = organs.actionPolicy || new ActionPolicyEngine();
    this.dispatcher = new ExperienceDispatcher();

    if (this.voice && typeof (this.voice as any).handleEvent === 'function') {
      this.dispatcher.registerAdapter(this.voice as any as ExperienceAdapter);
    }
    if (this.body && typeof (this.body as any).handleEvent === 'function') {
      this.dispatcher.registerAdapter(this.body as any as ExperienceAdapter);
    }
    if (this.mouth && typeof (this.mouth as any).handleEvent === 'function') {
      this.dispatcher.registerAdapter(this.mouth as any as ExperienceAdapter);
    }
  }

  async initialize(): Promise<void> {
    if (this.memory && typeof this.memory.initialize === 'function') {
      await this.memory.initialize(this.id);
    }
    if (this.hands && typeof this.hands.listTools === 'function') {
      const tools = await this.hands.listTools();
      for (const tool of tools) {
        this.actionPolicy.registerToolDefinition(tool);
      }
    }
  }

  // --- Session History Accessors ---

  getSessionHistory(sessionKey: string): Message[] {
    return this.sessionHistory.getHistory(sessionKey);
  }

  clearHistory(sessionKey?: string): void {
    this.sessionHistory.clear(sessionKey);
  }

  // --- Observation & Vision Facades ---

  async analyzeVision(imageUrl: string, prompt: string): Promise<string> {
    if (!this.vision || typeof this.vision.analyze !== 'function') {
      throw new Error('Vision organ is not configured on this runtime');
    }
    return this.vision.analyze(imageUrl, prompt);
  }

  async ingestObservation(
    frame: Uint8Array,
    sourceName: string,
    providerId?: string
  ): Promise<ObservationResult> {
    if (!this.observation || typeof this.observation.ingest !== 'function') {
      return { duplicate: false, reason: 'provider_failure' };
    }
    return this.observation.ingest(frame, sourceName, providerId);
  }

  getCurrentObservations(now?: Date): Observation[] {
    if (!this.observation || typeof this.observation.current !== 'function') {
      return [];
    }
    return this.observation.current(now);
  }

  clearExpiredObservations(now?: Date): number {
    if (!this.observation || typeof this.observation.clearExpired !== 'function') {
      return 0;
    }
    return this.observation.clearExpired(now);
  }

  // --- Memory Facades ---

  async getClaims(limit?: number): Promise<Claim[]> {
    if (!this.memory || typeof this.memory.getClaims !== 'function') {
      return [];
    }
    return this.memory.getClaims(limit);
  }

  async getPendingClaims(limit?: number): Promise<Claim[]> {
    if (!this.memory || typeof this.memory.getPendingClaims !== 'function') {
      return [];
    }
    return this.memory.getPendingClaims(limit);
  }

  async getDirectives(): Promise<BehaviorDirective[]> {
    if (!this.memory || typeof this.memory.getDirectives !== 'function') {
      return [];
    }
    return this.memory.getDirectives();
  }

  async approveClaim(id: string): Promise<void> {
    if (!this.memory || typeof this.memory.approveClaim !== 'function') {
      throw new Error('Memory organ not configured');
    }
    return this.memory.approveClaim(id);
  }

  async rejectClaim(id: string): Promise<void> {
    if (!this.memory || typeof this.memory.rejectClaim !== 'function') {
      throw new Error('Memory organ not configured');
    }
    return this.memory.rejectClaim(id);
  }

  async updateClaim(
    id: string,
    updates: Partial<Pick<Claim, 'subject' | 'predicate' | 'value' | 'scope' | 'sensitivity' | 'confidence' | 'validFrom' | 'validUntil' | 'allowedAudiences'>>
  ): Promise<Claim> {
    if (!this.memory || typeof this.memory.updateClaim !== 'function') {
      throw new Error('Memory organ updateClaim not supported');
    }
    return this.memory.updateClaim(id, updates);
  }

  async approveDirective(id: string): Promise<void> {
    if (!this.memory || typeof this.memory.approveDirective !== 'function') {
      throw new Error('Memory organ not configured');
    }
    return this.memory.approveDirective(id);
  }

  async rejectDirective(id: string): Promise<void> {
    if (!this.memory || typeof this.memory.rejectDirective !== 'function') {
      throw new Error('Memory organ not configured');
    }
    return this.memory.rejectDirective(id);
  }

  async revokeDirective(id: string): Promise<void> {
    if (!this.memory || typeof this.memory.revokeDirective !== 'function') {
      throw new Error('Memory organ not configured');
    }
    return this.memory.revokeDirective(id);
  }

  async disableDirective(id: string): Promise<void> {
    if (!this.memory || typeof this.memory.disableDirective !== 'function') {
      throw new Error('Memory organ not configured');
    }
    return this.memory.disableDirective(id);
  }

  async resetMemory(): Promise<void> {
    if (!this.memory || typeof this.memory.resetMemory !== 'function') {
      throw new Error('Memory organ does not support reset');
    }
    return this.memory.resetMemory();
  }

  // --- Response Gating Facades ---

  stageResponse(options: StageResponseOptions): StagedResponsePlan {
    return this.gating.stageResponse(options);
  }

  evaluateGate(plan: StagedResponsePlan, evidenceRecords?: EvidenceRecord[]): ResponseGateEvaluation {
    return this.gating.evaluateGate(plan, evidenceRecords);
  }

  approveResponse(options: ApproveResponseOptions): { success: boolean; reason?: string; plan?: StagedResponsePlan } {
    return this.gating.approveResponse(options);
  }

  rejectResponse(options: RejectResponseOptions): { success: boolean; reason?: string; plan?: StagedResponsePlan } {
    return this.gating.rejectResponse(options);
  }

  getStagedPlan(responseId: string): StagedResponsePlan | undefined {
    return this.gating.getStagedPlan(responseId);
  }

  findStagedPlanByCorrelation(companionId: string, correlationId: string): StagedResponsePlan | undefined {
    return this.gating.findStagedPlanByCorrelation(companionId, correlationId);
  }

  // --- Universal Perception & Cognition Cycle ---

  /**
   * Processes an incoming perception (sensory audio, text, platform event, or observation alert)
   * through the perception -> retrieval -> cognition -> gating -> action -> experience cycle.
   */
  async processPerception(perception: CompanionPerception): Promise<any> {
    let rawText = perception.text || '';

    // If audio buffer is provided and Ear supports transcription, transcribe it
    if (!rawText && perception.audioBuffer && this.ear && typeof this.ear.transcribeAudio === 'function') {
      rawText = await this.ear.transcribeAudio(perception.audioBuffer);
    }

    const roleOrContext = perception.context || perception.roleOrContext || 'OWNER';
    const history = perception.history || [];

    // 1. Input validation, RequestContext synthesis, and Ear perception routing
    const input = await normalizeUserInput(
      rawText,
      roleOrContext,
      history,
      this.id,
      this.ear
    );

    const sessionKey =
      input.requestContext.actor.sessionId ||
      input.requestContext.conversation.audienceId ||
      'default';

    const currentMessage: Message = { role: 'user', content: input.perceivedText };
    const boundedSessionHistory = [...input.boundedHistory, currentMessage].slice(-20);
    this.sessionHistory.setHistory(sessionKey, boundedSessionHistory);
    this.sessionHistory.setHistory('default', boundedSessionHistory);

    // 2. Intent classification (delegating to Ear if available, else heuristics)
    const intent = await classifyInputIntentAsync(
      input.perceivedText,
      input.requestContext,
      this.ear?.classifyIntent
        ? (t, c) => this.ear!.classifyIntent!(t, c) as any
        : undefined
    );

    // 3. Concurrent Knowledge & Memory retrieval with diagnostics & evidence handling
    const contextRetrieval = await retrieveRuntimeContext({
      companionId: this.id,
      perceivedText: input.perceivedText,
      requestContext: input.requestContext,
      role: input.role,
      isContextObject: input.isContextObject,
      shouldQueryKnowledge: intent.shouldQueryKnowledge,
      knowledge: this.knowledge,
      memory: this.memory,
    });

    // 4. Neutral system prompt and contextual prompt compilation
    const prompts = await compilePrompts({
      companionName: this.config.name,
      companionId: this.id,
      role: input.role,
      requestContext: input.requestContext,
      behavior: this.behavior,
      activeDirectives: contextRetrieval.activeDirectives,
      subsystemDiagnostics: contextRetrieval.subsystemDiagnostics,
      knowledgeData: contextRetrieval.knowledgeData,
      memoryData: contextRetrieval.memoryData,
    });

    // 5. Cognition planning via BrainOrgan
    const plan = await generateCognitionPlan({
      companionName: this.config.name,
      brain: this.brain,
      systemPrompt: prompts.systemPrompt,
      contextPrompt: prompts.contextPrompt,
      recentMessages: this.sessionHistory.getHistory(sessionKey).slice(-10),
      recipient: input.role,
      perceivedText: input.perceivedText,
    });

    // 6. Stage response and evaluate safety gating boundary
    const stagedPlan = this.gating.stageResponse({
      requestContext: input.requestContext,
      candidateSpeech: plan.speech,
      candidateLanguage: plan.language || 'ja',
      internalMonologue: plan.internalMonologue,
      memoryProposals: plan.memoryProposals,
      behaviorProposals: plan.behaviorProposals,
      evidenceRecords: contextRetrieval.collectedEvidence,
      citations: contextRetrieval.citations,
    });

    const gateEval = this.gating.evaluateGate(
      stagedPlan,
      contextRetrieval.collectedEvidence
    );

    if (!gateEval.admissible) {
      return createGateRejectionEnvelope(stagedPlan, gateEval);
    }

    this.sessionHistory.append(sessionKey, { role: 'assistant', content: plan.speech });
    this.sessionHistory.append('default', { role: 'assistant', content: plan.speech });

    // 7. Settle memory proposals and persist source events
    const memorySettlement = await settleMemoryProposals({
      companionId: this.id,
      perceivedText: input.perceivedText,
      role: input.role,
      requestContext: input.requestContext,
      memory: this.memory,
      explicitTeaching: intent.explicitTeaching,
      plan,
    });

    // 8. Authorize and execute action intents under Primary Security Invariant
    const actionResults = await executeActionIntents({
      actionIntents: plan.actionIntents,
      requestContext: input.requestContext,
      actionPolicy: this.actionPolicy,
      hands: this.hands,
    });

    // 9. Dispatch ExperienceEvents to registered adapters
    const experienceEmission = await emitExperienceEvents({
      companionId: this.id,
      requestContext: input.requestContext,
      stagedPlan,
      gateEval,
      speech: plan.speech,
      language: plan.language || 'ja',
      dispatcher: this.dispatcher,
      voice: this.voice,
      body: this.body,
    });

    // 10. Deliver utterance via Mouth organ (UI / Output Channel Decoupling)
    let mouthDelivery: FormattedMouthOutput | undefined;
    if (this.mouth && typeof this.mouth.speak === 'function') {
      try {
        const avatarEvent = experienceEmission.experienceEvents.find(
          (e) => e.kind === 'avatar'
        );
        mouthDelivery = await this.mouth.speak({
          utteranceId: stagedPlan.responseId,
          companionId: this.id,
          responseId: stagedPlan.responseId,
          correlationId: stagedPlan.correlationId,
          text: plan.speech,
          language: plan.language || 'ja',
          subtitleJa: plan.speech,
          subtitleEn: plan.speech,
          spokenJa: plan.speech,
          expression: avatarEvent?.expression,
          medium: perception.medium,
          signal: perception.signal,
          audioUrl: experienceEmission.speechId
            ? `/voice/stream?id=${experienceEmission.speechId}`
            : undefined,
          metadata: {
            subsystemDiagnostics: contextRetrieval.subsystemDiagnostics,
            internalMonologue: plan.internalMonologue,
          },
          citations: gateEval.filteredCitations,
          evidenceIds: gateEval.filteredEvidenceIds,
        });
      } catch (e: any) {
        console.error('[SiduriRuntime] Mouth delivery failed:', e?.message || e);
      }
    }

    // 11. Assemble and return response envelope
    return assembleResponseEnvelope({
      stagedPlan,
      speech: plan.speech,
      language: plan.language,
      speechId: experienceEmission.speechId,
      createdMemoryProposals: memorySettlement.createdMemoryProposals,
      memoryProposalReceipts: memorySettlement.memoryProposalReceipts,
      actionResults,
      filteredEvidenceIds: gateEval.filteredEvidenceIds,
      filteredCitations: gateEval.filteredCitations,
      subsystemDiagnostics: contextRetrieval.subsystemDiagnostics,
      experienceEvents: experienceEmission.experienceEvents,
      mouthDelivery,
    });
  }

  // --- Mouth Facades ---

  async speakMouth(utterance: MouthUtterance): Promise<FormattedMouthOutput | undefined> {
    if (!this.mouth || typeof this.mouth.speak !== 'function') return undefined;
    return this.mouth.speak(utterance);
  }

  formatMouth(utterance: MouthUtterance, medium?: MouthMedium): FormattedMouthOutput | undefined {
    if (!this.mouth || typeof this.mouth.format !== 'function') return undefined;
    return this.mouth.format(utterance, medium);
  }

  registerMouthChannel(channel: MouthChannel): void {
    if (this.mouth && typeof this.mouth.registerChannel === 'function') {
      this.mouth.registerChannel(channel);
    }
  }

  unregisterMouthChannel(channelId: string): void {
    if (this.mouth && typeof this.mouth.unregisterChannel === 'function') {
      this.mouth.unregisterChannel(channelId);
    }
  }

  async broadcastMouth(utterance: MouthUtterance): Promise<FormattedMouthOutput[]> {
    if (!this.mouth || typeof this.mouth.broadcast !== 'function') return [];
    return this.mouth.broadcast(utterance);
  }

  interruptMouth(reason?: string): void {
    if (this.mouth && typeof this.mouth.interrupt === 'function') {
      this.mouth.interrupt(reason);
    }
  }

  streamMouth(utterance: MouthUtterance): AsyncIterable<MouthStreamChunk> {
    if (!this.mouth || typeof this.mouth.stream !== 'function') {
      return (async function* () {
        yield {
          utteranceId: utterance.utteranceId,
          index: 0,
          deltaText: utterance.text,
          isComplete: true,
          medium: 'web',
        };
      })();
    }
    return this.mouth.stream(utterance);
  }

  // --- Backward-Compatible Chat Adapter ---

  async handleUserMessage(
    message: string,
    roleOrContext: 'OWNER' | 'VIEWER' | 'OPERATOR' | RequestContext | string = 'OWNER',
    history: Message[] = [],
    medium?: MouthMedium,
    signal?: AbortSignal,
  ): Promise<any> {
    return this.processPerception({
      source: 'text_chat',
      text: message,
      roleOrContext,
      history,
      medium,
      signal,
    });
  }
}
