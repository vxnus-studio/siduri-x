import {
  ArchiveLedger,
  SelfRepository,
  Claim,
  BehaviorDirective,
  SourceEvent,
  ResponsePlan,
  RequestContext,
  InteractionMode,
} from './index';
import { extractDeterministicTeaching } from './teaching';

export interface InteractionSettlementParams {
  companionId: string;
  perceivedText: string;
  role: 'OWNER' | 'VIEWER' | 'OPERATOR';
  requestContext: RequestContext;
  archive?: ArchiveLedger;
  self?: SelfRepository;
  explicitTeaching: ReturnType<typeof extractDeterministicTeaching>;
  plan: ResponsePlan;
  effectiveMode?: InteractionMode;
  /** @deprecated Legacy memory organ reference. Direct domain routing routes to self or archive directly. */
  memory?: any;
}

export interface ProposalReceipt {
  proposal_id: string;
  subject: string;
  predicate: string;
  value: string;
  status: string;
  claim_type?: string;
  content?: string;
}

export type MemoryProposalReceipt = ProposalReceipt;

export interface BehavioralProposalReceipt {
  directive_id: string;
  domain?: string;
  knowledge_domain?: string;
  memory_class?: string;
  runtime_effect?: string;
  subject?: string;
  predicate?: string;
  value?: string;
  status: string;
  behavior?: {
    instruction: string;
    frequency?: string;
    preferred_positions?: string[];
  };
}

export interface InteractionSettlementResult {
  createdMemoryProposals: Claim[];
  memoryProposalReceipts: ProposalReceipt[];
  createdBehavioralProposals?: BehaviorDirective[];
  behavioralProposalReceipts?: BehavioralProposalReceipt[];
}

export type MemorySettlementParams = InteractionSettlementParams;
export type MemorySettlementResult = InteractionSettlementResult;

/**
 * Persists source events to ArchiveLedger and behavioral directive proposals directly to SelfRepository.
 * Direct Domain Routing under RFC VX-26-13: Deconstructing Memory into Sovereign Primitives.
 */
export async function settleInteractionProposals(
  params: InteractionSettlementParams
): Promise<InteractionSettlementResult> {
  const {
    companionId,
    perceivedText,
    role,
    requestContext,
    archive,
    self,
    explicitTeaching,
    plan,
    effectiveMode,
  } = params;

  // Zero Drift: Casual mode completely suppresses all proposal generation
  const mode = effectiveMode || requestContext.mode || 'hybrid';
  if (mode === 'casual') {
    return {
      createdMemoryProposals: [],
      memoryProposalReceipts: [],
    };
  }

  const createdMemoryProposals: Claim[] = [];
  let sourceEventId: string | undefined;

  const hasTeaching =
    explicitTeaching.claims.length > 0 ||
    explicitTeaching.behaviorProposals.length > 0;
  const hasPlanProposals =
    Boolean(plan.memoryProposals?.length) ||
    Boolean(plan.behaviorProposals?.length);

  if (archive && typeof archive.recordEvent === 'function') {
    if (hasTeaching || hasPlanProposals) {
      const sourceEvent: SourceEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sourceType: 'user_chat_explicit',
        occurredAt: new Date().toISOString(),
        payload: {
          message: perceivedText,
          role,
          companionId,
          actorId: requestContext.actor?.actorId || 'owner-user',
          channel: requestContext.conversation?.channel || 'direct',
        },
      };
      await archive.recordEvent(sourceEvent);
      sourceEventId = sourceEvent.id;
    }
  }

  for (const claim of explicitTeaching.claims) {
    let proposal: Claim | undefined;
    if ((params as any).memory && typeof (params as any).memory.proposeClaim === 'function') {
      proposal = await (params as any).memory.proposeClaim({
        companionId,
        subject: claim.subject,
        predicate: claim.predicate,
        value: claim.value,
        scope: claim.subject?.startsWith('companion:') ? 'companion' : 'user',
        provenance: claim.provenance || 'deterministic_teaching',
        sourceEventId,
        claimType: claim.claimType || 'preference',
        authority: 'user_explicit',
        userConfirmation: 'none',
        sensitivity:
          claim.sensitivity ||
          (requestContext.conversation?.channel === 'public' ? 'public' : 'private'),
      });
    }
    if (!proposal) {
      proposal = {
        id: `claim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        companionId,
        subject: claim.subject,
        predicate: claim.predicate,
        value: claim.value,
        scope: claim.subject?.startsWith('companion:') ? 'companion' : 'user',
        provenance: claim.provenance || 'deterministic_teaching',
        sourceEventId,
        claimType: claim.claimType || 'preference',
        authority: 'user_explicit',
        userConfirmation: 'none',
        status: 'pending',
        sensitivity:
          claim.sensitivity ||
          (requestContext.conversation?.channel === 'public' ? 'public' : 'private'),
      } as any;
    }
    if (proposal) {
      createdMemoryProposals.push(proposal);
    }
  }

  if (plan.memoryProposals && plan.memoryProposals.length > 0) {
    for (const p of plan.memoryProposals) {
      let proposal: Claim | undefined;
      if ((params as any).memory && typeof (params as any).memory.proposeClaim === 'function') {
        proposal = await (params as any).memory.proposeClaim({
          companionId,
          subject: p.subject || `actor:${requestContext.actor?.actorId || 'unknown'}`,
          predicate: p.predicate,
          value: p.value,
          scope: p.subject?.startsWith('companion:') ? 'companion' : 'user',
          provenance: p.provenance || 'llm_proposal',
          sourceEventId: sourceEventId || p.sourceEventId,
          claimType: p.claimType || 'semantic',
          sensitivity: p.sensitivity || 'private',
        });
      }
      if (!proposal) {
        proposal = {
          id: `claim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          companionId,
          subject: p.subject || `actor:${requestContext.actor?.actorId || 'unknown'}`,
          predicate: p.predicate,
          value: p.value,
          scope: p.subject?.startsWith('companion:') ? 'companion' : 'user',
          provenance: p.provenance || 'llm_proposal',
          sourceEventId: sourceEventId || p.sourceEventId,
          claimType: p.claimType || 'semantic',
          status: 'pending',
          sensitivity: p.sensitivity || 'private',
        } as any;
      }
      if (proposal) {
        createdMemoryProposals.push(proposal);
      }
    }
  }

  const createdBehavioralProposals: BehaviorDirective[] = [];
  const behavioralProposalReceipts: BehavioralProposalReceipt[] = [];

  const allBehaviorProposals = [
    ...explicitTeaching.behaviorProposals,
    ...(plan.behaviorProposals || []),
  ];

  for (const bp of allBehaviorProposals) {
    const directive: BehaviorDirective = {
      id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      companionId,
      directive: bp.directive,
      priority: bp.priority || 50,
      status: 'pending' as any,
      category: (bp.category || 'behavioral') as any,
      scopeActor: bp.scopeActor,
      supersedesId: bp.supersedesId,
      createdAt: new Date().toISOString(),
    };
    createdBehavioralProposals.push(directive);

    if (self && typeof self.commitDirectives === 'function') {
      await self.commitDirectives(companionId, [directive as any]);
    }

    behavioralProposalReceipts.push({
      directive_id: directive.id,
      domain: 'behavioral',
      knowledge_domain: 'behavioral',
      memory_class: bp.memoryClass || 'behavioral',
      runtime_effect: bp.memoryClass || 'behavioral',
      subject: bp.subject || `companion:${companionId}`,
      predicate: bp.predicate || 'rule',
      value: bp.value || bp.directive,
      status: 'pending',
      behavior: {
        instruction: bp.directive,
        frequency: 'continuous',
        preferred_positions: [],
      },
    });
  }

  const memoryProposalReceipts: ProposalReceipt[] = createdMemoryProposals.map(
    (p) => ({
      proposal_id: p.id,
      subject: p.subject,
      predicate: p.predicate,
      value: p.value,
      status: (p.status || 'pending').toLowerCase().replace(/_/g, '-') as any,
      claim_type: p.claimType,
      content: (p as any).content,
    })
  );

  return {
    createdMemoryProposals,
    memoryProposalReceipts,
    createdBehavioralProposals,
    behavioralProposalReceipts,
  };
}

/**
 * @deprecated Use `settleInteractionProposals` instead. RFC VX-26-13.
 */
export const settleMemoryProposals = settleInteractionProposals;
