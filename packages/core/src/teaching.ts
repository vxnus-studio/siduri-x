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

  const rawActorId = context?.actor?.actorId;
  const cleanActorId = rawActorId ? rawActorId.replace(/^actor:/, '') : undefined;
  const actorSubject = cleanActorId ? `actor:${cleanActorId}` : 'actor:anonymous';
  const companionId = context?.companionId || 'default';
  const sensitivity = context?.conversation?.channel === 'public' ? 'public' : 'private';

  // Strip leading companion addressing: "Siduri, you are...", "Hey Siduri: ..."
  const cleanText = text.replace(/^(?:(?:hey|hi|hello)\s+)?(?:siduri|companion|assistant)\s*[,:]\s*/i, '');

  const isTeachMode = context?.mode === 'teach' || /^(?:!teach|\/teach|\bteach mode\b|\blearn this rule\b)/i.test(text);
  const hasExplicitTeachingCue =
    isTeachMode ||
    /\b(?:remember that|remember this rule|remember this|from now on|learn this|rule:)\b/i.test(text);

  // Casual banter / hedged opinion filter to avoid mutating Self from generic conversation
  const isCasualBanter = /\b(?:probably|maybe|such a|so |very |really |just |not |the funniest|the best|the worst|the coolest|great|awesome|funny|nice|kind|crazy|wrong|right|silly)\b/i;

  // 1. Companion's Name: "your name is X" / "you are called X"
  const companionNameMatch = cleanText.match(/\b(?:your name is|you are called)\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
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
      category: 'relational',
      sourceEventId,
    });
  }

  // 2. Identity / Role Teaching:
  // "your role is X", "you work at X", "you were created by X", "you are from X",
  // or explicit "you are [an/a] X [at Y]" when in teach mode or with explicit teaching cues
  const roleMatch = cleanText.match(/\byour role is\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
  const workMatch = cleanText.match(/\byou work (?:at|for)\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
  const createdByMatch = cleanText.match(/\byou (?:were|are) created by\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
  const fromMatch = cleanText.match(/\byou are from\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);

  // Match "you are [an/a/the] X [at Y]" only when in Teach mode or explicit teaching cues, and not casual banter
  const youAreMatch =
    (isTeachMode || hasExplicitTeachingCue)
      ? cleanText.match(/\b(?:remember that\s+)?you are\s+(?:(?:an?|the)\s+)?(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i)
      : null;

  const validYouAreRole =
    youAreMatch &&
    !companionNameMatch &&
    !fromMatch &&
    !isCasualBanter.test(youAreMatch[1]) &&
    !/^(?:called|named)\b/i.test(youAreMatch[1])
      ? cleanValue(youAreMatch[1].replace(/^(?:an?|the)\s+/i, ''), 100)
      : undefined;

  const rawEffectiveRole = roleMatch ? cleanValue(roleMatch[1], 100) : validYouAreRole;
  const effectiveRole = rawEffectiveRole ? rawEffectiveRole.replace(/^(?:an?|the)\s+/i, '') : undefined;

  if (effectiveRole) {
    claims.push({
      subject: `companion:${companionId}`,
      predicate: 'role',
      value: effectiveRole,
      content: `The companion's role is ${effectiveRole}.`,
      claimType: 'semantic',
      provenance: 'deterministic_teaching',
      sensitivity: 'public',
      sourceEventId,
    });
    behaviorProposals.push({
      directive: `Acknowledge role as ${effectiveRole}`,
      priority: 70,
      subject: `companion:${companionId}`,
      predicate: 'role',
      value: effectiveRole,
      memoryClass: 'identity',
      category: 'relational',
      sourceEventId,
    });
  }

  if (workMatch) {
    const workplace = cleanValue(workMatch[1], 80);
    claims.push({
      subject: `companion:${companionId}`,
      predicate: 'origin',
      value: workplace,
      content: `The companion works at ${workplace}.`,
      claimType: 'semantic',
      provenance: 'deterministic_teaching',
      sensitivity: 'public',
      sourceEventId,
    });
    behaviorProposals.push({
      directive: `Acknowledge workplace as ${workplace}`,
      priority: 70,
      subject: `companion:${companionId}`,
      predicate: 'origin',
      value: workplace,
      memoryClass: 'identity',
      category: 'relational',
      sourceEventId,
    });
  }

  if (createdByMatch) {
    const creator = cleanValue(createdByMatch[1], 80);
    claims.push({
      subject: `companion:${companionId}`,
      predicate: 'created_by',
      value: creator,
      content: `The companion was created by ${creator}.`,
      claimType: 'semantic',
      provenance: 'deterministic_teaching',
      sensitivity: 'public',
      sourceEventId,
    });
    behaviorProposals.push({
      directive: `Acknowledge creator as ${creator}`,
      priority: 75,
      subject: `companion:${companionId}`,
      predicate: 'created_by',
      value: creator,
      memoryClass: 'identity',
      category: 'relational',
      sourceEventId,
    });
  }

  if (fromMatch) {
    const origin = cleanValue(fromMatch[1], 80);
    claims.push({
      subject: `companion:${companionId}`,
      predicate: 'origin',
      value: origin,
      content: `The companion is from ${origin}.`,
      claimType: 'semantic',
      provenance: 'deterministic_teaching',
      sensitivity: 'public',
      sourceEventId,
    });
    behaviorProposals.push({
      directive: `Acknowledge origin as ${origin}`,
      priority: 70,
      subject: `companion:${companionId}`,
      predicate: 'origin',
      value: origin,
      memoryClass: 'identity',
      category: 'relational',
      sourceEventId,
    });
  }

  // 3. Actor's Name: "my name is X"
  const myNameMatch = cleanText.match(/\bmy name is\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
  if (myNameMatch && !/\b(?:private|public|everywhere)\b/i.test(cleanText)) {
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

  // 4. Preferred Address / Call me X: "call me X"
  const callMeMatch = cleanText.match(/\b(?:(?:from now on|only),?\s*)?call me\s+(.+?)(?:\s+(?:in private|privately|in public|publicly|everywhere|in direct conversations))?(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
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
      category: 'behavioral',
      sourceEventId,
    });
  }

  // 5. Stated relationship: "I am your creator, Kur Zagin" / "I am your X" / "I'm your creator"
  const relMatch = cleanText.match(/\b(?:i am|i'm)\s+your\s+([A-Za-z0-9_-]+)(?:,\s*([A-Za-z0-9_\s-]+?))?(?=\s+and\s+(?:i\b|my\b|you\b)|[.;]|$)/i);
  if (relMatch) {
    const relationship = cleanValue(relMatch[1], 60);
    const actorName = relMatch[2] ? cleanValue(relMatch[2], 80) : undefined;
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
      category: 'relational',
      sourceEventId,
    });
    if (actorName) {
      claims.push({
        subject: actorSubject,
        predicate: 'name',
        value: actorName,
        content: `The actor's name is ${actorName}.`,
        claimType: 'preference',
        provenance: 'deterministic_teaching',
        sensitivity,
        sourceEventId,
      });
    }
  }

  // 6. Behavioral rule / directive: "Remember this rule: X" / "Remember that rule: X" / "Rule: X" / "From now on, always X"
  const ruleMatch = cleanText.match(/\b(?:remember\s+(?:this|that)\s+rule:\s*|rule:\s*|(?:from now on,?\s+)?always\s+)(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;]|$)/i);
  if (ruleMatch) {
    let instruction = cleanValue(ruleMatch[1], 160);
    if (instruction) {
      instruction = instruction.charAt(0).toUpperCase() + instruction.slice(1);
      behaviorProposals.push({
        directive: instruction,
        priority: 60,
        subject: actorSubject,
        predicate: 'rule',
        value: instruction,
        category: 'behavioral',
        memoryClass: 'behavioral',
        sourceEventId,
      });
      claims.push({
        subject: actorSubject,
        predicate: 'behavioral_rule',
        value: instruction,
        content: `Behavioral rule: ${instruction}`,
        claimType: 'preference',
        provenance: 'deterministic_teaching',
        sensitivity,
        sourceEventId,
      });
    }
  }

  // Preference: "I prefer concise answers"
  const prefAnswersMatch = cleanText.match(/\b(?:i prefer|my preference is)\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
  if (prefAnswersMatch && !cleanText.match(/\bmy\s+preferred\s+([A-Za-z0-9_]+)\s+is\b/i)) {
    const prefVal = cleanValue(prefAnswersMatch[1], 100);
    const directive = `Prefer ${prefVal}`;
    behaviorProposals.push({
      directive,
      priority: 60,
      subject: actorSubject,
      predicate: 'preference',
      value: prefVal,
      category: 'behavioral',
      memoryClass: 'behavioral',
      sourceEventId,
    });
    claims.push({
      subject: actorSubject,
      predicate: 'preference',
      value: prefVal,
      content: `The actor prefers ${prefVal}.`,
      claimType: 'preference',
      provenance: 'deterministic_teaching',
      sensitivity,
      sourceEventId,
    });
  }

  // 7. Explicit Domain / Preference fact: "my preferred X is Y" / "my X is Y"
  const prefMatch = cleanText.match(/\bmy\s+preferred\s+([A-Za-z0-9_]+)\s+is\s+(.+?)(?=\s+and\s+(?:i\b|my\b|you\b)|[.;,]|$)/i);
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
