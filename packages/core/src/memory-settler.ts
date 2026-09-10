import {
  MemoryOrgan,
  Claim,
  SourceEvent,
  ResponsePlan,
  RequestContext,
} from './index';
import { extractDeterministicTeaching } from './teaching';

export interface MemorySettlementParams {
  companionId: string;
  perceivedText: string;
  role: 'OWNER' | 'VIEWER' | 'OPERATOR';
  requestContext: RequestContext;
  memory?: MemoryOrgan;
  explicitTeaching: ReturnType<typeof extractDeterministicTeaching>;
  plan: ResponsePlan;
}

export interface MemoryProposalReceipt {
  proposal_id: string;
  subject: string;
  predicate: string;
  value: string;
  status: string;
}

export interface MemorySettlementResult {
  createdMemoryProposals: Claim[];
  memoryProposalReceipts: MemoryProposalReceipt[];
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
    explicitTeaching,
    plan,
  } = params;

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
        actorId: requestContext.actor.actorId,
        channel: requestContext.conversation.channel,
        audienceId: requestContext.conversation.audienceId,
      },
    };
    await memory.addSourceEvent(sourceEvent);
    sourceEventId = sourceEvent.id;
  }

  // Persist deterministic memory proposals as PENDING if memory is available
  if (memory && typeof memory.proposeClaim === 'function') {
    for (const claim of explicitTeaching.claims) {
      const proposal = await memory.proposeClaim({
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
        allowedAudiences: claim.allowedAudiences || (requestContext.conversation?.audienceId ? [requestContext.conversation.audienceId] : undefined),
      });
      createdMemoryProposals.push(proposal);
    }

    // Also persist plan memory proposals if model returned structured proposals
    if (plan.memoryProposals && plan.memoryProposals.length > 0) {
      for (const p of plan.memoryProposals) {
        const proposal = await memory.proposeClaim({
          subject: p.subject || `actor:${requestContext.actor.actorId}`,
          predicate: p.predicate,
          value: p.value,
          scope: p.subject?.startsWith('companion:') ? 'companion' : 'user',
          provenance: p.provenance || 'llm_proposal',
          sourceEventId: sourceEventId || p.sourceEventId,
          claimType: p.claimType || 'semantic',
          sensitivity: p.sensitivity || 'private',
          allowedAudiences: p.allowedAudiences || (requestContext.conversation?.audienceId ? [requestContext.conversation.audienceId] : undefined),
        });
        createdMemoryProposals.push(proposal);
      }
    }
  }

  if (
    memory &&
    plan.behaviorProposals &&
    plan.behaviorProposals.length > 0 &&
    typeof memory.proposeDirective === 'function'
  ) {
    for (const bp of plan.behaviorProposals) {
      await memory.proposeDirective({
        directive: bp.directive,
        priority: bp.priority || 50,
        scopeMatcher: [role],
      });
    }
  }

  const memoryProposalReceipts: MemoryProposalReceipt[] = createdMemoryProposals.map(
    (p) => ({
      proposal_id: p.id,
      subject: p.subject,
      predicate: p.predicate,
      value: p.value,
      status: p.status,
    })
  );

  return {
    createdMemoryProposals,
    memoryProposalReceipts,
  };
}
