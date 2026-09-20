import {
  BrainOrgan,
  MemoryOrgan,
  ArchiveLedger,
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
import { SiduriDatabase, LogLevel, SystemLog } from './siduri-db';
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
  get archive(): ArchiveLedger | undefined { return this.container.archive; }
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
        if (found && this.container.knowledge) {
          await promoteApprovedClaimToKnowledge(found, this.container.knowledge, targetCompId);
        }
      };
    }

    // Sync any pre-existing approved claims to Knowledge / Life DB
    if (this.memory && this.container.knowledge) {
      try {
        const claims = typeof (this.memory as any).getAllClaims === 'function'
          ? await (this.memory as any).getAllClaims(500)
          : await this.memory.getClaims(500);
        const approvedClaims = (claims || []).filter((c: any) => (c.status || '').toLowerCase() === 'approved');
        for (const c of approvedClaims) {
          await promoteApprovedClaimToKnowledge(c, this.container.knowledge, this.id);
        }
      } catch {
        // non-blocking
      }
    }
  }

  get db(): SiduriDatabase | undefined {
    return (this.container as any).db || (this.memory as any)?.db || (this.self as any)?.db;
  }

  log(
    level: LogLevel | string,
    subsystem: string,
    message: string,
    metadata?: Record<string, unknown>
  ): SystemLog | void {
    if (this.db && typeof (this.db as any).insertLog === 'function') {
      return (this.db as any).insertLog({
        companionId: this.id,
        level,
        subsystem,
        message,
        metadata,
      });
    }
  }

  queryLogs(options?: {
    companionId?: string;
    level?: string;
    subsystem?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): SystemLog[] {
    if (this.db && typeof (this.db as any).queryLogs === 'function') {
      return (this.db as any).queryLogs({
        companionId: options?.companionId || this.id,
        ...options,
      });
    }
    return [];
  }

  clearLogs(companionId?: string): void {
    if (this.db && typeof (this.db as any).clearLogs === 'function') {
      (this.db as any).clearLogs(companionId || this.id);
    }
  }

  getSessionHistory(sessionKey: string): Message[] {
    return this.container.sessionHistory.getHistory(sessionKey);
  }

  clearHistory(sessionKey?: string): void {
    this.container.sessionHistory.clear(sessionKey);
  }

  /**
   * Approves a proposal using Direct Domain Routing (RFC VX-26-13):
   * - Behavioral & relational directives route directly to SelfRepository.
   * - Life state facts route directly to Knowledge / Life DB.
   * - Legacy memory claims are promoted as a backwards-compatibility fallback.
   */
  async approveProposal(
    proposalId: string,
    options?: { companionId?: string }
  ): Promise<{ success: boolean; target?: string; name?: string }> {
    const companionId = options?.companionId || this.id;

    // 1. Direct Domain Routing (RFC VX-26-13): If proposalId is explicitly a directive ID, route directly to Self
    if (proposalId.startsWith('dir-') && this.self && typeof (this.self as any).approveDirective === 'function') {
      try {
        const approved = await (this.self as any).approveDirective(proposalId, companionId);
        if (approved !== false) {
          if (this.memory && typeof (this.memory as any).approveDirective === 'function') {
            await (this.memory as any).approveDirective(proposalId, companionId).catch(() => {});
          }
          const identity = typeof this.self.getIdentity === 'function' ? await this.self.getIdentity(companionId) : null;
          this.log('info', 'truth_gate', `Approved behavioral directive proposal '${proposalId}' directly in Self`, {
            proposalId,
            companionId,
            target: 'self',
          });
          return { success: true, target: 'self', name: identity?.name };
        }
      } catch {
        // Fall through to claim check
      }
    }

    // 2. Approve claim in memory if present (legacy fallback)
    if (this.memory && typeof this.memory.approveClaim === 'function') {
      await this.memory.approveClaim(proposalId);
    }

    // 3. Fetch claim
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

    // 4. Promote to Knowledge / Life DB if claim is Knowledge-affecting
    if (claim && this.container.knowledge) {
      const promotedToKnowledge = await promoteApprovedClaimToKnowledge(
        claim,
        this.container.knowledge,
        companionId
      );
      if (promotedToKnowledge) {
        this.log('info', 'truth_gate', `Approved and promoted claim '${proposalId}' to Knowledge / Life DB`, {
          proposalId,
          companionId,
          target: 'knowledge',
          subject: claim.subject,
          predicate: claim.predicate,
        });
        return { success: true, target: 'knowledge' };
      }
    }

    // 5. Promote to SelfRepository if claim is Self-affecting
    if (claim && this.self) {
      await promoteApprovedClaimToSelf(claim, this.self, companionId);
      const identity = typeof this.self.getIdentity === 'function' ? await this.self.getIdentity(companionId) : null;
      this.log('info', 'truth_gate', `Approved and promoted claim '${proposalId}' to Self`, {
        proposalId,
        companionId,
        target: 'self',
        subject: claim.subject,
        predicate: claim.predicate,
      });
      return { success: true, target: 'self', name: identity?.name };
    }

    // 6. If not a claim, check if this proposal ID is a behavioral directive in Self
    if (this.self && typeof (this.self as any).approveDirective === 'function') {
      try {
        const approved = await (this.self as any).approveDirective(proposalId, companionId);
        if (approved !== false) {
          if (this.memory && typeof (this.memory as any).approveDirective === 'function') {
            await (this.memory as any).approveDirective(proposalId, companionId).catch(() => {});
          }
          const identity = typeof this.self.getIdentity === 'function' ? await this.self.getIdentity(companionId) : null;
          this.log('info', 'truth_gate', `Approved behavioral directive proposal '${proposalId}' directly in Self`, {
            proposalId,
            companionId,
            target: 'self',
          });
          return { success: true, target: 'self', name: identity?.name };
        }
      } catch {
        // Not a pending directive or already active
      }
    }

    const identity = this.self && typeof this.self.getIdentity === 'function' ? await this.self.getIdentity(companionId) : null;
    this.log('info', 'truth_gate', `Approved memory proposal '${proposalId}'`, {
      proposalId,
      companionId,
      target: 'memory',
    });
    return { success: true, target: 'memory', name: identity?.name };
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
    this.log('info', 'truth_gate', `Rejected proposal '${proposalId}'`, {
      proposalId,
      companionId,
    });
    return { success: true };
  }

  /**
   * Approves a behavioral directive in Self and Memory.
   */
  async approveDirective(
    directiveId: string,
    options?: { companionId?: string }
  ): Promise<{ success: boolean; name?: string }> {
    const companionId = options?.companionId || this.id;
    if (this.self && typeof (this.self as any).approveDirective === 'function') {
      await (this.self as any).approveDirective(directiveId, companionId);
    }
    if (this.memory && typeof (this.memory as any).approveDirective === 'function') {
      await (this.memory as any).approveDirective(directiveId, companionId);
    }

    // If directive pertains to companion name, ensure self identity reflects it
    if (this.self && typeof (this.self as any).getActiveDirectives === 'function') {
      try {
        const activeDirs = await (this.self as any).getActiveDirectives(companionId);
        const dir = activeDirs.find((d: any) => d.id === directiveId);
        if (dir?.directive) {
          const compNameMatch = dir.directive.match(
            /^(?:address\s+companion\s+as|your\s+name\s+is|call\s+yourself|acknowledge\s+name\s+as|companion\s+name\s+is)\s+["“']?([^"”'.]+)["”']?/i
          );
          if (compNameMatch) {
            const newName = compNameMatch[1].trim();
            if (newName) {
              const currentIdentity = (await this.self.getIdentity(companionId)) || {
                companionId,
                name: '',
                version: '1.0.0',
                updatedAt: new Date().toISOString(),
              };
              currentIdentity.name = newName;
              currentIdentity.updatedAt = new Date().toISOString();
              await this.self.setIdentity(currentIdentity);
            }
          }
        }
      } catch {
        // non-blocking
      }
    }

    const identity = this.self && typeof this.self.getIdentity === 'function' ? await this.self.getIdentity(companionId) : null;
    this.log('info', 'truth_gate', `Approved behavioral directive '${directiveId}'`, {
      directiveId,
      companionId,
    });
    return { success: true, name: identity?.name };
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
    this.log('info', 'truth_gate', `Rejected behavioral directive '${directiveId}'`, {
      directiveId,
      companionId,
    });
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
 * @deprecated RFC VX-26-13: Deconstructing Memory.
 * Prefer Direct Domain Routing: behavioral directives, identity mutations, and relational
 * stances should route directly to SelfRepository (`commitDirectives`, `setIdentity`, `updateRelationship`)
 * rather than being staged in memory_claims and promoted downstream.
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
  const isCompanionTarget =
    subject.startsWith('companion') ||
    subject === 'siduri' ||
    subject === 'self' ||
    subject === 'assistant' ||
    subject === 'persona' ||
    subject === 'ai' ||
    subject === 'me' ||
    ((predicate === 'name' || predicate === 'role' || predicate === 'archetype' || predicate === 'ethos' || predicate === 'origin') &&
      !subject.startsWith('actor:') &&
      subject !== 'user' &&
      subject !== 'primary_user' &&
      subject !== 'owner' &&
      subject !== 'creator');

  if (isCompanionTarget) {
    const existing: SelfIdentity = (await self.getIdentity(targetCompanionId)) || {
      companionId: targetCompanionId,
      name: '',
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
    predicate === 'relationship_to_companion' ||
    predicate === 'relationship_to_siduri' ||
    (predicate === 'name' && (subject.startsWith('actor:') || subject === 'user' || subject === 'primary_user')) ||
    predicate === 'preferred_address' ||
    predicate === 'affiliation'
  ) {
    const rawSubject = (claim.subject || 'actor:user').replace(/^actor:actor:/, 'actor:');
    const isCreator = value.toLowerCase().includes('creator');
    const isName = predicate === 'name' || predicate === 'preferred_address';
    const isAffil = predicate === 'affiliation';

    const existingRel = typeof self.getRelationship === 'function'
      ? await self.getRelationship(targetCompanionId, rawSubject)
      : null;

    const isPriorCreator = existingRel?.role === 'creator' || (existingRel?.stance === 'familiar_loyal' && existingRel.trustScore === 1.0);
    const role = isCreator
      ? 'creator'
      : (isPriorCreator ? 'creator' : (existingRel?.role && existingRel.role !== 'user' ? existingRel.role : (isName || isAffil ? existingRel?.role || 'user' : value)));
    const name = isName ? value : existingRel?.name;
    const affiliation = isAffil ? value : existingRel?.affiliation;
    const stance = isCreator || isPriorCreator ? 'familiar_loyal' : (existingRel?.stance || 'neutral');
    const trustScore = isCreator || isPriorCreator ? 1.0 : (existingRel?.trustScore ?? 0.8);
    const familiarity = isCreator || isPriorCreator ? 0.9 : (existingRel?.familiarity ?? 0.5);
    const interactionConventions = isCreator || isPriorCreator
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

    // Dual promotion: If this actor is established as creator, also populate companion's origin in self_identity
    if (isCreator || (isName && isPriorCreator)) {
      const existingIdentity: SelfIdentity = (await self.getIdentity(targetCompanionId)) || {
        companionId: targetCompanionId,
        name: 'Siduri',
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      };
      const creatorName = name || existingRel?.name || (rawSubject.startsWith('actor:') && rawSubject !== 'actor:user' && rawSubject !== 'actor:primary' ? rawSubject.slice(6) : value);
      existingIdentity.origin = creatorName !== 'user' && creatorName !== 'primary' ? creatorName : value;
      existingIdentity.updatedAt = new Date().toISOString();
      await self.setIdentity(existingIdentity);
    }

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

export function isSelfAffectingClaim(claim: any): boolean {
  if (!claim) return false;
  const subject = (claim.subject || '').toLowerCase();
  const predicate = (claim.predicate || '').toLowerCase();
  return (
    subject.startsWith('companion') ||
    subject === 'siduri' ||
    subject === 'self' ||
    subject === 'assistant' ||
    subject === 'persona' ||
    subject === 'ai' ||
    subject === 'me' ||
    claim.claimType === 'relationship' ||
    predicate === 'stated_relationship' ||
    predicate === 'relationship' ||
    predicate === 'relationship_to_companion' ||
    predicate === 'relationship_to_siduri' ||
    predicate === 'name' ||
    predicate === 'preferred_address' ||
    predicate === 'affiliation' ||
    predicate === 'role' ||
    predicate === 'archetype' ||
    predicate === 'origin' ||
    predicate === 'created_by' ||
    predicate === 'ethos' ||
    predicate === 'behavioral_rule' ||
    predicate === 'rule'
  );
}

export function isKnowledgeAffectingClaim(claim: any): boolean {
  if (!claim) return false;
  const subject = (claim.subject || '').toLowerCase();
  const predicate = (claim.predicate || '').toLowerCase();
  const claimType = (claim.claimType || '').toLowerCase();

  return (
    claim.target === 'knowledge' ||
    claimType === 'life_entity' ||
    claimType === 'entity' ||
    claimType === 'inventory' ||
    claimType === 'life_event' ||
    claimType === 'event' ||
    claimType === 'finance' ||
    claimType === 'life_task' ||
    claimType === 'task' ||
    claimType === 'life_schedule' ||
    claimType === 'schedule' ||
    claimType === 'preference' ||
    claimType === 'life_preference' ||
    subject.startsWith('inventory:') ||
    subject.startsWith('finance:') ||
    subject.startsWith('task:') ||
    subject.startsWith('todo:') ||
    subject.startsWith('schedule:') ||
    subject.startsWith('preference:') ||
    subject.startsWith('entity:') ||
    subject.startsWith('event:') ||
    predicate === 'owns' ||
    predicate === 'inventory' ||
    predicate === 'expense' ||
    predicate === 'income' ||
    predicate === 'spent' ||
    predicate === 'task' ||
    predicate === 'todo' ||
    predicate === 'goal' ||
    predicate === 'schedule' ||
    predicate === 'appointment' ||
    predicate === 'meeting' ||
    predicate === 'preference' ||
    predicate === 'favorite' ||
    predicate === 'prefers'
  );
}

/**
 * @deprecated RFC VX-26-13: Deconstructing Memory.
 * Prefer Direct Domain Routing: user life facts (entities, inventory, finances, schedule, preferences)
 * should route directly to Knowledge / LifeDatabase rather than being staged as generic memory claims.
 */
export async function promoteApprovedClaimToKnowledge(
  claim: any,
  knowledge: any,
  companionId?: string
): Promise<boolean> {
  if (!knowledge) return false;
  const targetCompanionId = companionId || claim.companionId || 'default';
  const subject = (claim.subject || '').toLowerCase();
  const predicate = (claim.predicate || '').toLowerCase();
  const claimType = (claim.claimType || '').toLowerCase();
  const value = claim.value || '';
  const evidenceObj = typeof claim.evidence === 'object' && claim.evidence ? claim.evidence : {};

  // 1. Entities / Inventory
  const isEntityClaim =
    claimType === 'life_entity' ||
    claimType === 'entity' ||
    claimType === 'inventory' ||
    subject.startsWith('inventory:') ||
    subject.startsWith('entity:') ||
    predicate === 'owns' ||
    predicate.startsWith('owns_') ||
    predicate.startsWith('owns ') ||
    predicate === 'inventory' ||
    predicate.includes('character') ||
    predicate.includes('account') ||
    predicate.includes('device') ||
    predicate.includes('hardware') ||
    predicate.includes('weapon') ||
    predicate.includes('item');

  if (isEntityClaim) {
    const rawName = subject.startsWith('inventory:')
      ? claim.subject.slice(10)
      : (subject.startsWith('entity:')
        ? claim.subject.slice(7)
        : ((predicate === 'owns' || predicate.startsWith('owns') || predicate.includes('character') || predicate.includes('account') || predicate.includes('item') || predicate.includes('weapon'))
          ? value
          : claim.subject));
    const entityName = rawName || 'Unnamed Entity';

    let inferredDomain = claim.domain || evidenceObj.domain || claim.knowledge_domain;
    if (!inferredDomain) {
      if (
        predicate.includes('game') ||
        predicate.includes('character') ||
        predicate.includes('weapon') ||
        predicate.includes('roster')
      ) {
        inferredDomain = 'gaming';
      } else if (
        claimType === 'inventory' ||
        subject.startsWith('inventory:') ||
        predicate.includes('device') ||
        predicate.includes('hardware')
      ) {
        inferredDomain = 'hardware';
      } else {
        inferredDomain = 'general';
      }
    }

    let inferredEntityType = claim.entityType || evidenceObj.entityType;
    if (!inferredEntityType) {
      if (predicate.includes('character')) {
        inferredEntityType = 'character';
      } else if (predicate.includes('account')) {
        inferredEntityType = 'game_account';
      } else if (predicate.includes('weapon')) {
        inferredEntityType = 'weapon';
      } else if (claimType === 'inventory' || subject.startsWith('inventory:') || predicate.includes('device') || predicate.includes('hardware')) {
        inferredEntityType = 'hardware';
      } else {
        inferredEntityType = 'entity';
      }
    }

    const properties = {
      description: value,
      predicate: claim.predicate,
      ...(typeof claim.properties === 'object' ? claim.properties : {}),
      ...(typeof evidenceObj.properties === 'object' ? evidenceObj.properties : {}),
      ...(typeof claim.metadata === 'object' ? claim.metadata : {}),
    };

    if (knowledge.entities && typeof knowledge.entities.saveEntity === 'function') {
      await knowledge.entities.saveEntity({
        id: claim.id || `ent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        companionId: targetCompanionId,
        entityType: inferredEntityType,
        domain: inferredDomain,
        name: entityName,
        properties,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } else if (knowledge.inventory && typeof knowledge.inventory.saveItem === 'function') {
      await knowledge.inventory.saveItem({
        id: claim.id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        companionId: targetCompanionId,
        domain: inferredDomain,
        entityName,
        properties,
        updatedAt: new Date().toISOString(),
      });
      return true;
    }
  }

  // 2. Events / Finance / Telemetry
  if (
    claimType === 'life_event' ||
    claimType === 'event' ||
    claimType === 'finance' ||
    subject.startsWith('finance:') ||
    subject.startsWith('event:') ||
    predicate === 'expense' ||
    predicate === 'income' ||
    predicate === 'spent'
  ) {
    const stream = claim.stream || evidenceObj.stream || (claimType === 'finance' || subject.startsWith('finance:') || predicate === 'expense' || predicate === 'income' ? 'finance' : 'telemetry');
    const parsedAmount = typeof claim.metricValue === 'number'
      ? claim.metricValue
      : (typeof evidenceObj.metricValue === 'number'
        ? evidenceObj.metricValue
        : (typeof claim.amount === 'number'
          ? claim.amount
          : (typeof evidenceObj.amount === 'number'
            ? evidenceObj.amount
            : parseFloat(value) || 0)));

    if (knowledge.events && typeof knowledge.events.addEvent === 'function') {
      await knowledge.events.addEvent({
        id: claim.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        companionId: targetCompanionId,
        stream,
        timestamp: claim.timestamp || evidenceObj.timestamp || new Date().toISOString(),
        metricValue: parsedAmount,
        metadata: {
          category: claim.category || evidenceObj.category || predicate,
          value,
          ...(typeof claim.metadata === 'object' ? claim.metadata : {}),
          ...(typeof evidenceObj.metadata === 'object' ? evidenceObj.metadata : {}),
        },
      });
      return true;
    } else if (knowledge.finance && typeof knowledge.finance.addEntry === 'function') {
      await knowledge.finance.addEntry({
        id: claim.id || `fin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        companionId: targetCompanionId,
        category: claim.category || evidenceObj.category || 'general',
        amount: parsedAmount,
        currency: claim.currency || evidenceObj.currency || 'USD',
        timestamp: claim.timestamp || evidenceObj.timestamp || new Date().toISOString(),
        metadata: typeof claim.metadata === 'object' ? claim.metadata : { detail: value },
      });
      return true;
    }
  }

  // 3. Tasks / To-dos / Goals
  if (
    claimType === 'life_task' ||
    claimType === 'task' ||
    subject.startsWith('task:') ||
    subject.startsWith('todo:') ||
    predicate === 'task' ||
    predicate === 'todo' ||
    predicate === 'goal' ||
    predicate.startsWith('task_') ||
    predicate.startsWith('todo_') ||
    predicate.includes('task') ||
    predicate.includes('todo')
  ) {
    const title = value || (subject.startsWith('task:') ? claim.subject.slice(5) : claim.subject);
    if (knowledge.tasks && typeof knowledge.tasks.saveTask === 'function') {
      await knowledge.tasks.saveTask({
        id: claim.id || `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        companionId: targetCompanionId,
        title,
        status: claim.taskStatus || evidenceObj.status || claim.metadata?.status || (claim.status && claim.status !== 'pending' && claim.status !== 'approved' ? claim.status : 'backlog'),
        priority: claim.priority || evidenceObj.priority || 0,
        targetDate: claim.targetDate || evidenceObj.targetDate || claim.dueDate,
        metadata: typeof claim.metadata === 'object' ? claim.metadata : (typeof evidenceObj.metadata === 'object' ? evidenceObj.metadata : undefined),
        updatedAt: new Date().toISOString(),
      });
      return true;
    }
  }

  // 4. Schedule / Deadlines
  if (
    claimType === 'life_schedule' ||
    claimType === 'schedule' ||
    subject.startsWith('schedule:') ||
    predicate === 'schedule' ||
    predicate === 'appointment' ||
    predicate === 'meeting' ||
    predicate.includes('schedule') ||
    predicate.includes('calendar')
  ) {
    const title = value || (subject.startsWith('schedule:') ? claim.subject.slice(9) : claim.subject);
    if (knowledge.schedule && typeof knowledge.schedule.saveItem === 'function') {
      await knowledge.schedule.saveItem({
        id: claim.id || `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        companionId: targetCompanionId,
        title,
        startTime: claim.startTime || claim.start_time || new Date().toISOString(),
        endTime: claim.endTime || claim.end_time,
        isRecurring: Boolean(claim.isRecurring || claim.is_recurring),
        status: claim.status || 'active',
      });
      return true;
    }
  }

  // 5. Preferences (e.g. food preference, theme)
  if (
    claimType === 'preference' ||
    claimType === 'life_preference' ||
    subject.startsWith('preference:') ||
    predicate === 'preference' ||
    predicate === 'favorite' ||
    predicate === 'prefers'
  ) {
    const prefKey = subject.startsWith('preference:')
      ? claim.subject.slice(11)
      : (predicate === 'favorite' || predicate === 'prefers' ? claim.subject : (claim.key || claim.preferenceKey || 'user_preference'));
    if (knowledge.preferences && typeof knowledge.preferences.setPreference === 'function') {
      await knowledge.preferences.setPreference({
        id: claim.id || `pref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        companionId: targetCompanionId,
        preferenceKey: prefKey,
        preferenceValue: value,
        category: claim.category || 'general',
        updatedAt: new Date().toISOString(),
      });
      return true;
    }
  }

  return false;
}
