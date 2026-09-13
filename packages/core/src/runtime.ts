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
  MouthOrgan,
  SelfRepository,
  EKnowledgeOrgan,
  Message,
  RequestContext,
  MouthMedium,
  ResponseGatingEngine,
  ActionPolicyEngine,
  ExperienceDispatcher,
} from './index';
import { SessionHistoryManager } from './session-history';
import {
  CompanionPerception,
  PerceptionPipeline,
  PerceptionPipelineContext,
  createDefaultPerceptionPipeline,
} from './perception-pipeline';
import { CompanionContainer, RuntimeOrgans, SiduriRuntimeConfig } from './container';

export { CompanionPerception, RuntimeOrgans, SiduriRuntimeConfig };

/**
 * SiduriRuntime coordinates companion perception and cognition execution.
 * Lifecycle management and organ storage are handled by CompanionContainer.
 * The 12-stage perception cycle is executed via PerceptionPipeline.
 */
export class SiduriRuntime {
  public readonly id: string;
  public readonly config: SiduriRuntimeConfig;
  public readonly container: CompanionContainer;
  public readonly pipeline: PerceptionPipeline;

  constructor(
    id: string,
    config: SiduriRuntimeConfig,
    containerOrOrgans: CompanionContainer | RuntimeOrgans = {},
    pipeline?: PerceptionPipeline
  ) {
    this.id = id;
    this.config = config;
    if (containerOrOrgans instanceof CompanionContainer) {
      this.container = containerOrOrgans;
    } else {
      this.container = new CompanionContainer(id, config, containerOrOrgans);
    }
    this.pipeline = pipeline || createDefaultPerceptionPipeline();
  }

  // Direct organ accessors through container
  get organs(): RuntimeOrgans { return this.container.organs; }
  get brain(): BrainOrgan | undefined { return this.container.brain; }
  get memory(): MemoryOrgan | undefined { return this.container.memory; }
  get voice(): VoiceOrgan | undefined { return this.container.voice as any; }
  get knowledge(): KnowledgeOrgan | undefined { return this.container.knowledge; }
  get vision(): VisionOrgan | undefined { return this.container.vision; }
  get behavior(): BehaviorOrgan | undefined { return this.container.behavior; }
  get body(): BodyOrgan | undefined { return this.container.body as any; }
  get hands(): HandsOrgan | undefined { return this.container.hands; }
  get ear(): EarOrgan | undefined { return this.container.ear; }
  get observation(): ObservationOrgan | undefined { return this.container.observation; }
  set observation(org: ObservationOrgan | undefined) { this.container.observation = org; }
  get mouth(): MouthOrgan | undefined { return this.container.mouth; }
  get self(): SelfRepository | undefined { return this.container.self; }
  get externalKnowledge(): EKnowledgeOrgan | undefined { return this.container.externalKnowledge; }
  get gating(): ResponseGatingEngine { return this.container.gating; }
  get actionPolicy(): ActionPolicyEngine { return this.container.actionPolicy; }
  get dispatcher(): ExperienceDispatcher { return this.container.dispatcher; }
  get sessionHistory(): SessionHistoryManager { return this.container.sessionHistory; }

  // Conversation history accessors
  get conversationHistory(): Message[] {
    return this.container.sessionHistory.getHistory('default');
  }

  set conversationHistory(messages: Message[]) {
    this.container.sessionHistory.setHistory('default', messages);
  }

  async initialize(): Promise<void> {
    return this.container.initialize();
  }

  getSessionHistory(sessionKey: string): Message[] {
    return this.container.sessionHistory.getHistory(sessionKey);
  }

  clearHistory(sessionKey?: string): void {
    this.container.sessionHistory.clear(sessionKey);
  }

  /**
   * Processes an incoming perception (sensory audio, text, platform event, or observation alert)
   * through the decoupled PerceptionPipeline.
   */
  async processPerception(perception: CompanionPerception): Promise<any> {
    const context: PerceptionPipelineContext = {
      companionId: this.id,
      companionName: this.config.name,
      perception,
      organs: this.container.organs,
      gating: this.container.gating,
      actionPolicy: this.container.actionPolicy,
      dispatcher: this.container.dispatcher,
      sessionHistory: this.container.sessionHistory,
      rawText: perception.text || '',
    };
    return this.pipeline.execute(context);
  }

  /**
   * Primary entrypoint for text chat messages.
   */
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
