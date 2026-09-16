import {
  MemoryOrgan,
  SelfRepository,
  Claim,
  BehaviorDirective,
  SourceEvent,
  ResponsePlan,
  RequestContext,
  InteractionMode,
} from './index';
import { extractDeterministicTeaching } from './teaching';

export interface MemorySettlementParams {
  companionId: string;
  perceivedText: string;
  role: 'OWNER' | 'VIEWER' | 'OPERATOR';
  requestContext: RequestContext;
  memory?: MemoryOrgan;
  self?: SelfRepository;
  explicitTeaching: ReturnType<typeof extractDeterministicTeaching>;
  plan: ResponsePlan;
  effectiveMode?: InteractionMode;
}

export interface MemoryProposalReceipt {
  proposal_id: string;
  subject: string;
  predicate: string;
  value: string;
  status: string;
  claim_type?: string;
  content?: string;
}

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

export interface MemorySettlementResult {
  createdMemoryProposals: Claim[];
  memoryProposalReceipts: MemoryProposalReceipt[];
  createdBehavioralProposals?: BehaviorDirective[];
  behavioralProposalReceipts?: BehavioralProposalReceipt[];
}

/**
 * Persists source events, deterministic teaching claims, LLM memory proposals,
 * and LLM behavior proposals to the MemoryOrgan.
 */
export async function settleMemoryProposals(
  params: MemorySettlementParams
): Promise<MemorySettlementResult> {
  const {
    companionId,
    perceivedText,
    role,
    requestContext,
    memory,
    self,
    explicitTeaching,
    plan,
    effectiveMode,
  } = params;

  // Zero Memory Drift: Casual mode completely suppresses all proposal generation
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

  if (
    memory &&
    (hasTeaching || hasPlanProposals) &&
    typeof memory.addSourceEvent === 'function'
  ) {
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
    await memory.addSourceEvent(sourceEvent);
    sourceEventId = sourceEvent.id;
  }

  // Persist deterministic memory proposals as PENDING if memory is available
  if (memory && typeof memory.proposeClaim === 'function') {
    for (const claim of explicitTeaching.claims) {
      const proposal = await memory.proposeClaim({
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
      } as any);
      createdMemoryProposals.push(proposal);
    }

    // Also persist plan memory proposals if model returned structured proposals
    if (plan.memoryProposals && plan.memoryProposals.length > 0) {
      for (const p of plan.memoryProposals) {
        const proposal = await memory.proposeClaim({
          companionId,
          subject: p.subject || `actor:${requestContext.actor.actorId}`,
          predicate: p.predicate,
          value: p.value,
          scope: p.subject?.startsWith('companion:') ? 'companion' : 'user',
          provenance: p.provenance || 'llm_proposal',
          sourceEventId: sourceEventId || p.sourceEventId,
          claimType: p.claimType || 'semantic',
          sensitivity: p.sensitivity || 'private',
        } as any);
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
    let directive: BehaviorDirective | undefined;
    if (memory && typeof memory.proposeDirective === 'function') {
      directive = await memory.proposeDirective({
        companionId,
        directive: bp.directive,
        priority: bp.priority || 50,
        category: bp.category || 'behavioral',
        supersedesId: bp.supersedesId,
        scopeActor: bp.scopeActor || (bp.subject?.startsWith('actor:') ? bp.subject.slice(6) : undefined),
        memoryClass: bp.memoryClass,
        subject: bp.subject,
        predicate: bp.predicate,
        value: bp.value,
        sourceEventId: sourceEventId || bp.sourceEventId,
      } as any);
    }
    if (!directive || !directive.id) {
      directive = {
        id: directive?.id || `dir-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        companionId,
        directive: bp.directive,
        priority: bp.priority || 50,
        status: 'pending' as any,
        category: (bp.category || 'behavioral') as any,
        scopeActor: bp.scopeActor,
        supersedesId: bp.supersedesId,
        createdAt: new Date().toISOString(),
      };
    }
    createdBehavioralProposals.push(directive);

    if (self && typeof self.commitDirectives === 'function') {
      await self.commitDirectives(companionId, [{
        id: directive.id,
        companionId,
        directive: bp.directive,
        priority: bp.priority || 50,
        status: 'pending' as any,
        category: (bp.category || 'behavioral') as any,
        scopeActor: bp.scopeActor,
        supersedesId: bp.supersedesId,
        createdAt: new Date().toISOString(),
      }]);
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

  const memoryProposalReceipts: MemoryProposalReceipt[] = createdMemoryProposals.map(
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
