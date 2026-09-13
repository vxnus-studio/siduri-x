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
  OrganConfig,
  ActionStore,
  SqliteActionStore,
  ActionPolicyEngine,
  ResponseGatingEngine,
  ExperienceDispatcher,
  ExperienceAdapter,
} from './index';
import { SessionHistoryManager } from './session-history';
import { PerceptionPipeline, createDefaultPerceptionPipeline } from './perception-pipeline';
import { SiduriRuntime } from './runtime';

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
  self?: OrganConfig | Record<string, unknown>;
  externalKnowledge?: OrganConfig | Record<string, unknown>;
  actionPolicy?: Record<string, unknown>;
  actionStore?: 'in-memory' | 'sqlite' | { type: 'sqlite' | 'in-memory'; dbPath?: string };
  actionStorePath?: string;
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
  self?: SelfRepository;
  externalKnowledge?: EKnowledgeOrgan;
  actionStore?: ActionStore;
  actionPolicy?: ActionPolicyEngine;
}

/**
 * CompanionContainer manages the lifecycle, discovery, wiring, and dependency injection
 * of organs and infrastructure for a companion instance.
 */
export class CompanionContainer {
  public readonly id: string;
  public readonly config: SiduriRuntimeConfig;
  public readonly organs: RuntimeOrgans;
  public readonly gating: ResponseGatingEngine;
  public readonly actionPolicy: ActionPolicyEngine;
  public readonly dispatcher: ExperienceDispatcher;
  public readonly sessionHistory: SessionHistoryManager;
  private _runtime?: SiduriRuntime;

  constructor(id: string, config: SiduriRuntimeConfig, organs: RuntimeOrgans = {}) {
    this.id = id;
    this.config = config;
    this.organs = organs;
    this.gating = new ResponseGatingEngine();

    let actionStore = organs.actionStore;
    if (!actionStore) {
      const storeOpt = config.actionStore;
      const storePath = config.actionStorePath || (typeof storeOpt === 'object' ? storeOpt.dbPath : undefined);
      if (storeOpt === 'sqlite' || (typeof storeOpt === 'object' && storeOpt.type === 'sqlite') || storePath) {
        actionStore = new SqliteActionStore({ dbPath: storePath });
      }
    }

    this.actionPolicy = organs.actionPolicy || new ActionPolicyEngine({
      store: actionStore,
    });
    this.dispatcher = new ExperienceDispatcher();

    if (this.organs.voice && typeof (this.organs.voice as any).handleEvent === 'function') {
      this.dispatcher.registerAdapter(this.organs.voice as any as ExperienceAdapter);
    }
    if (this.organs.body && typeof (this.organs.body as any).handleEvent === 'function') {
      this.dispatcher.registerAdapter(this.organs.body as any as ExperienceAdapter);
    }
    if (this.organs.mouth && typeof (this.organs.mouth as any).handleEvent === 'function') {
      this.dispatcher.registerAdapter(this.organs.mouth as any as ExperienceAdapter);
    }

    this.sessionHistory = new SessionHistoryManager();
  }

  // Direct organ accessors
  get brain() { return this.organs.brain; }
  get memory() { return this.organs.memory; }
  get voice() { return this.organs.voice; }
  get knowledge() { return this.organs.knowledge; }
  get vision() { return this.organs.vision; }
  get behavior() { return this.organs.behavior; }
  get body() { return this.organs.body; }
  get hands() { return this.organs.hands; }
  get ear() { return this.organs.ear; }
  get observation() { return this.organs.observation; }
  set observation(org: ObservationOrgan | undefined) { this.organs.observation = org; }
  get mouth() { return this.organs.mouth; }
  get self() { return this.organs.self; }
  get externalKnowledge() { return this.organs.externalKnowledge; }

  async initialize(): Promise<void> {
    if (this.organs.memory && typeof this.organs.memory.initialize === 'function') {
      await this.organs.memory.initialize(this.id);
    }
    if (this.organs.hands && typeof this.organs.hands.listTools === 'function') {
      const tools = await this.organs.hands.listTools();
      for (const tool of tools) {
        this.actionPolicy.registerToolDefinition(tool);
      }
    }
  }

  get runtime(): SiduriRuntime {
    if (!this._runtime) {
      this._runtime = new SiduriRuntime(this.id, this.config, this);
    }
    return this._runtime;
  }
}
