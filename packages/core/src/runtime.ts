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
  SelfIdentity,
  EKnowledgeOrgan,
  Claim,
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
    await this.container.initialize();
    if (this.memory && this.self && typeof this.memory.approveClaim === 'function') {
      const originalApproveClaim = this.memory.approveClaim.bind(this.memory);
      this.memory.approveClaim = async (id: string) => {
        await originalApproveClaim(id);
        const targetCompId = this.id;
        const claims = typeof (this.memory as any).getAllClaims === 'function'
          ? await (this.memory as any).getAllClaims(500)
          : await this.memory!.getClaims(500);
        let found = claims.find((c: any) => c.id === id);
        if (!found && typeof (this.memory as any).getPendingClaims === 'function') {
          const pending = await (this.memory as any).getPendingClaims(500);
          found = pending.find((c: any) => c.id === id);
        }
        if (found && this.self) {
          await promoteApprovedClaimToSelf(found, this.self, targetCompId);
        }
      };
    }
  }

  getSessionHistory(sessionKey: string): Message[] {
    return this.container.sessionHistory.getHistory(sessionKey);
  }

  clearHistory(sessionKey?: string): void {
    this.container.sessionHistory.clear(sessionKey);
  }

  /**
   * Approves a memory proposal or behavior proposal and canonically promotes
   * Self-affecting mutations to SelfRepository.
   */
  async approveProposal(
    proposalId: string,
    options?: { companionId?: string }
  ): Promise<{ success: boolean; target?: string }> {
    const companionId = options?.companionId || this.id;

    // 1. Approve claim in memory if present
    if (this.memory && typeof this.memory.approveClaim === 'function') {
      await this.memory.approveClaim(proposalId);
    }

    // 2. Fetch claim
    let claim: Claim | undefined;
    if (this.memory) {
      const claims = typeof (this.memory as any).getAllClaims === 'function'
        ? await (this.memory as any).getAllClaims(500)
        : await this.memory.getClaims(500);
      claim = claims.find((c: any) => c.id === proposalId);
      if (!claim && typeof (this.memory as any).getPendingClaims === 'function') {
        const pending = await (this.memory as any).getPendingClaims(500);
        claim = pending.find((c: any) => c.id === proposalId);
      }
    }

    // 3. Promote to Self if Self exists and claim is Self-affecting
    if (claim && this.self) {
      await promoteApprovedClaimToSelf(claim, this.self, companionId);
      return { success: true, target: 'self' };
    }

    // 4. Also check if proposalId is a directive ID
    if (this.self && typeof (this.self as any).approveDirective === 'function') {
      try {
        await (this.self as any).approveDirective(proposalId, companionId);
        return { success: true, target: 'self_directive' };
      } catch {
        // Not a pending directive or already active
      }
    }

    return { success: true, target: 'memory' };
  }

  /**
   * Rejects a memory or behavior proposal.
   */
  async rejectProposal(
    proposalId: string,
    options?: { companionId?: string }
  ): Promise<{ success: boolean }> {
    const companionId = options?.companionId || this.id;
    if (this.memory && typeof this.memory.rejectClaim === 'function') {
      await this.memory.rejectClaim(proposalId);
    }
    if (this.self && typeof (this.self as any).rejectDirective === 'function') {
      try {
        await (this.self as any).rejectDirective(proposalId, companionId);
      } catch {
        // ignore
      }
    }
    return { success: true };
  }

  /**
   * Approves a behavioral directive in Self and Memory.
   */
  async approveDirective(
    directiveId: string,
    options?: { companionId?: string }
  ): Promise<{ success: boolean }> {
    const companionId = options?.companionId || this.id;
    if (this.self && typeof (this.self as any).approveDirective === 'function') {
      await (this.self as any).approveDirective(directiveId, companionId);
    }
    if (this.memory && typeof (this.memory as any).approveDirective === 'function') {
      await (this.memory as any).approveDirective(directiveId, companionId);
    }
    return { success: true };
  }

  /**
   * Rejects a behavioral directive in Self and Memory.
   */
  async rejectDirective(
    directiveId: string,
    options?: { companionId?: string }
  ): Promise<{ success: boolean }> {
    const companionId = options?.companionId || this.id;
    if (this.self && typeof (this.self as any).rejectDirective === 'function') {
      await (this.self as any).rejectDirective(directiveId, companionId);
    }
    if (this.memory && typeof (this.memory as any).rejectDirective === 'function') {
      await (this.memory as any).rejectDirective(directiveId, companionId);
    }
    return { success: true };
  }

  /**
   * Revokes a behavioral directive in Self and Memory.
   */
  async revokeDirective(
    directiveId: string,
    options?: { companionId?: string }
  ): Promise<{ success: boolean }> {
    const companionId = options?.companionId || this.id;
    if (this.self && typeof (this.self as any).revokeDirective === 'function') {
      await (this.self as any).revokeDirective(directiveId, companionId);
    }
    if (this.memory && typeof (this.memory as any).revokeDirective === 'function') {
      await (this.memory as any).revokeDirective(directiveId, companionId);
    }
    return { success: true };
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
    subtitleLanguage?: string,
  ): Promise<any> {
    return this.processPerception({
      source: 'text_chat',
      text: message,
      roleOrContext,
      history,
      medium,
      signal,
      subtitleLanguage,
    });
  }
}

/**
 * Canonically promotes an approved Claim into SelfRepository state.
 */
export async function promoteApprovedClaimToSelf(
  claim: any,
  self: SelfRepository,
  companionId?: string
): Promise<void> {
  const targetCompanionId = companionId || claim.companionId || 'default';
  const subject = (claim.subject || '').toLowerCase();
  const predicate = (claim.predicate || '').toLowerCase();
  const value = claim.value || '';

  if (!value) return;

  // 1. Identity mutations: companion identity/role/origin/name/ethos
  if (
    subject.startsWith('companion:') ||
    subject === 'companion' ||
    subject === 'siduri' ||
    subject === 'self'
  ) {
    const existing: SelfIdentity = (await self.getIdentity(targetCompanionId)) || {
      companionId: targetCompanionId,
      name: 'Siduri',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    };

    if (predicate === 'role' || predicate === 'archetype') {
      existing.archetype = value;
      (existing as any).role = value;
      existing.updatedAt = new Date().toISOString();
      await self.setIdentity(existing);
      await self.commitDirectives(targetCompanionId, [
        {
          id: `dir-role-${claim.id || Date.now()}`,
          companionId: targetCompanionId,
          priority: 70,
          directive: `Acknowledge role as ${value}`,
          status: 'active' as any,
          category: 'relational',
          createdAt: new Date().toISOString(),
        },
      ]);
    } else if (predicate === 'origin' || predicate === 'created_by') {
      existing.origin = value;
      existing.updatedAt = new Date().toISOString();
      await self.setIdentity(existing);
    } else if (predicate === 'name') {
      existing.name = value;
      existing.updatedAt = new Date().toISOString();
      await self.setIdentity(existing);
    } else if (predicate === 'ethos') {
      existing.ethos = value;
      existing.updatedAt = new Date().toISOString();
      await self.setIdentity(existing);
    }
    return;
  }

  // 2. Relationship mutations: creator or user stated relationship, name, or affiliation
  if (
    claim.claimType === 'relationship' ||
    predicate === 'stated_relationship' ||
    predicate === 'relationship' ||
    predicate === 'relationship_to_siduri' ||
    (predicate === 'name' && (subject.startsWith('actor:') || subject === 'user' || subject === 'primary_user')) ||
    predicate === 'preferred_address' ||
    predicate === 'affiliation'
  ) {
    const rawSubject = (claim.subject || 'actor:user').replace(/^actor:actor:/, 'actor:');
    const isCreator = value.toLowerCase() === 'creator';
    const isName = predicate === 'name' || predicate === 'preferred_address';
    const isAffil = predicate === 'affiliation';

    const existingRel = typeof self.getRelationship === 'function'
      ? await self.getRelationship(targetCompanionId, rawSubject)
      : null;

    const role = isCreator ? value : (existingRel?.role || (isName || isAffil ? existingRel?.role : value));
    const name = isName ? value : existingRel?.name;
    const affiliation = isAffil ? value : existingRel?.affiliation;
    const stance = isCreator ? 'familiar_loyal' : (existingRel?.stance || 'neutral');
    const trustScore = isCreator ? 1.0 : (existingRel?.trustScore ?? 0.8);
    const familiarity = isCreator ? 0.9 : (existingRel?.familiarity ?? 0.5);
    const interactionConventions = isCreator
      ? Array.from(new Set([...(existingRel?.interactionConventions || []), 'Direct communication', 'Highest administrative trust']))
      : (existingRel?.interactionConventions || []);

    await self.updateRelationship(targetCompanionId, {
      companionId: targetCompanionId,
      entityId: rawSubject,
      entityType: 'human',
      name,
      affiliation,
      role,
      stance,
      trustScore,
      familiarity,
      interactionConventions,
    });

    if (isName) {
      await self.commitDirectives(targetCompanionId, [
        {
          id: `dir-name-${claim.id || Date.now()}`,
          companionId: targetCompanionId,
          priority: 75,
          directive: `Address ${rawSubject} as ${value}`,
          status: 'active' as any,
          category: 'relational',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    return;
  }

  // 3. Behavioral rule claim
  if (predicate === 'behavioral_rule' || predicate === 'rule') {
    await self.commitDirectives(targetCompanionId, [
      {
        id: `dir-rule-${claim.id || Date.now()}`,
        companionId: targetCompanionId,
        priority: 60,
        directive: value,
        status: 'active' as any,
        category: 'behavioral',
        createdAt: new Date().toISOString(),
      },
    ]);
  }
}
