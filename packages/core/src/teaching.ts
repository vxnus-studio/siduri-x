import { RequestContext, MemoryProposal, BehaviorProposal } from './index';

export interface ExtractedTeaching {
  claims: MemoryProposal[];
  behaviorProposals: BehaviorProposal[];
}

/**
 * Deterministic teaching extraction placeholder.
 * 
 * In Siduri-X, conversational memory and behavioral proposals are generated
 * directly by the Brain LLM via structured cognitive planning (e.g. `submitResponsePlan`).
 * Deterministic regex matching has been removed in favor of pure LLM comprehension,
 * as all candidates are quarantined in 'pending' status until explicitly approved by the user.
 */
export function extractDeterministicTeaching(
  _message: string,
  _context?: RequestContext,
  _sourceEventId?: string
): ExtractedTeaching {
  return { claims: [], behaviorProposals: [] };
}
