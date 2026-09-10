import { RequestContext, MemoryProposal, BehaviorProposal } from './index';

export interface ExtractedTeaching {
  claims: MemoryProposal[];
  behaviorProposals: BehaviorProposal[];
}

function cleanValue(value: string, limit: number = 160): string {
  return value.replace(/\s+/g, ' ').replace(/^[ .,!?:;"']+|[ .,!?:;"']+$/g, '').slice(0, limit);
}

/**
 * Deterministically extracts teaching candidates from user messages according to single-owner model.
 * 
 * Rules:
 * - Scoped to the requesting actor context (subject: `actor:${actorId}`), NEVER `primary_user`.
 * - Candidates are pending proposals only, never active/approved.
 * - In a single-owner companion, preferences apply across the companion instance without audience partitioning.
 * - Companion identity is isolated.
 */
export function extractDeterministicTeaching(
  message: string,
  context?: RequestContext,
  sourceEventId?: string
): ExtractedTeaching {
  const text = cleanValue(message, 1000);
  const claims: MemoryProposal[] = [];
  const behaviorProposals: BehaviorProposal[] = [];

  if (!text) {
    return { claims, behaviorProposals };
  }

  const actorId = context?.actor?.actorId;
  const actorSubject = actorId ? `actor:${actorId}` : 'actor:anonymous';
  const companionId = context?.companionId || 'default';
  const sensitivity = context?.conversation?.channel === 'public' ? 'public' : 'private';

  // 1. Companion's Name: "your name is X" / "you are called X"
  const companionNameMatch = text.match(/\b(?:your name is|you are called)\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
  if (companionNameMatch) {
    const name = cleanValue(companionNameMatch[1], 80);
    claims.push({
      subject: `companion:${companionId}`,
      predicate: 'name',
      value: name,
      content: `The companion's name is ${name}.`,
      claimType: 'semantic',
      provenance: 'deterministic_teaching',
      sensitivity: 'public',
      sourceEventId,
    });
    behaviorProposals.push({
      directive: `Acknowledge configured name as ${name}`,
      priority: 70,
      subject: `companion:${companionId}`,
      predicate: 'name',
      value: name,
      memoryClass: 'identity',
      sourceEventId,
    });
  }

  // 2. Actor's Name: "my name is X"
  const myNameMatch = text.match(/\bmy name is\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
  if (myNameMatch && !/\b(?:private|public|everywhere)\b/i.test(text)) {
    const name = cleanValue(myNameMatch[1], 80);
    claims.push({
      subject: actorSubject,
      predicate: 'name',
      value: name,
      content: `The actor's name is ${name}.`,
      claimType: 'preference',
      provenance: 'deterministic_teaching',
      sensitivity,
      sourceEventId,
    });
  }

  // 3. Preferred Address / Call me X: "call me X"
  const callMeMatch = text.match(/\b(?:(?:from now on|only),?\s*)?call me\s+(.+?)(?:\s+(?:in private|privately|in public|publicly|everywhere|in direct conversations))?(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
  if (callMeMatch) {
    const address = cleanValue(callMeMatch[1], 80);
    const directiveInstruction = `Address ${actorSubject} as ${address}`;

    claims.push({
      subject: actorSubject,
      predicate: 'preferred_address',
      value: address,
      content: `The actor's preferred address is ${address}.`,
      claimType: 'relationship',
      provenance: 'deterministic_teaching',
      sensitivity,
      sourceEventId,
    });

    behaviorProposals.push({
      directive: directiveInstruction,
      priority: 80,
      subject: actorSubject,
      predicate: 'preferred_address',
      value: address,
      memoryClass: 'behavioral',
      sourceEventId,
    });
  }

  // 4. Stated relationship: "I am your X" / "I'm your creator"
  const relMatch = text.match(/\b(?:i am|i'm)\s+your\s+([A-Za-z0-9_\s-]+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
  if (relMatch) {
    const relationship = cleanValue(relMatch[1], 60);
    claims.push({
      subject: actorSubject,
      predicate: 'stated_relationship',
      value: relationship,
      content: `The actor stated their relationship as ${relationship}.`,
      claimType: 'relationship',
      provenance: 'deterministic_teaching',
      sensitivity: 'private',
      sourceEventId,
    });
    behaviorProposals.push({
      directive: `Recognize ${actorSubject} stated relationship as ${relationship}`,
      priority: 75,
      subject: actorSubject,
      predicate: 'stated_relationship',
      value: relationship,
      memoryClass: 'relationship',
      sourceEventId,
    });
  }

  // 5. Explicit Domain / Preference fact: "my preferred X is Y" / "my X is Y"
  const prefMatch = text.match(/\bmy\s+preferred\s+([A-Za-z0-9_]+)\s+is\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
  if (prefMatch) {
    const predicate = cleanValue(prefMatch[1], 40);
    const val = cleanValue(prefMatch[2], 100);
    claims.push({
      subject: actorSubject,
      predicate: `preferred_${predicate}`,
      value: val,
      content: `The actor's preferred ${predicate} is ${val}.`,
      claimType: 'preference',
      provenance: 'deterministic_teaching',
      sensitivity,
      sourceEventId,
    });
  }

  return { claims, behaviorProposals };
}
