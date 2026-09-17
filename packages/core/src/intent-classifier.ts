import { RequestContext, InteractionMode } from './index';
import { extractDeterministicTeaching } from './teaching';

export interface IntentClassification {
  normalizedMessage: string;
  explicitTeaching: ReturnType<typeof extractDeterministicTeaching>;
  isTeachingLike: boolean;
  isSelfIdentityRequest: boolean;
  isGreeting: boolean;
  shouldQueryKnowledge: boolean;
  effectiveMode: InteractionMode;
  confidence?: number;
  classifierOrigin?: 'heuristic' | 'cognitive' | 'ear';
}

export type CognitiveIntentClassifier = (
  text: string,
  context: RequestContext
) => Promise<Partial<IntentClassification>> | Partial<IntentClassification>;

/**
 * Evaluates domain heuristics and intent classification for user messages.
 * Determines if deterministic teaching is present, resolves the effective
 * interaction mode (casual, teach, hybrid), and determines if external knowledge
 * retrieval is appropriate.
 */
export function classifyInputIntent(
  text: string,
  context: RequestContext,
  overrides?: Partial<IntentClassification>
): IntentClassification {
  const normalizedMessage = text.replace(/\s+/g, ' ').trim().toLowerCase();
  const explicitTeaching = extractDeterministicTeaching(text, context);
  const isTeachingLike =
    overrides?.isTeachingLike ??
    (context.mode === 'teach' ||
      explicitTeaching.claims.length > 0 ||
      explicitTeaching.behaviorProposals.length > 0 ||
      /\b(?:remember that|remember:|my name is|call me)\b/i.test(normalizedMessage));
  const isSelfIdentityRequest =
    overrides?.isSelfIdentityRequest ??
    /\b(?:who|what) are you\b|\bwho is siduri\b|\b(?:your|my) name\b|\bdo you (?:know|remember|recognize) me\b|\bwho am i\b|\btell me about yourself\b|\bdescribe yourself\b|\bwhat is your origin\b|\bwho created you\b|\bwho made you\b|\bintroduce yourself\b/.test(
      normalizedMessage
    );
  const isGreeting =
    overrides?.isGreeting ??
    /^(?:hello|hi|hey|greetings|good morning|good afternoon|good evening|howdy|yo)[.!]?$/.test(
      normalizedMessage
    );
  const shouldQueryKnowledge =
    overrides?.shouldQueryKnowledge ??
    (!isTeachingLike && !isSelfIdentityRequest && !isGreeting);

  // Multi-tier Interaction Mode Resolution:
  // 1. Overrides / Cognitive Classifier
  // 2. Security Boundary: public channel or external source forces 'casual' (Zero Memory Drift)
  // 3. Explicit Request Mode (context.mode: 'casual' | 'teach' | 'hybrid')
  // 4. Default companion baseline: 'hybrid' (salience filtering)
  let effectiveMode: InteractionMode;
  if (overrides?.effectiveMode) {
    effectiveMode = overrides.effectiveMode;
  } else if (context.conversation?.channel === 'public' || context.source === 'external') {
    effectiveMode = 'casual';
  } else if (context.mode) {
    effectiveMode = context.mode;
  } else {
    effectiveMode = 'hybrid';
  }

  return {
    normalizedMessage,
    explicitTeaching,
    isTeachingLike,
    isSelfIdentityRequest,
    isGreeting,
    shouldQueryKnowledge,
    effectiveMode,
    confidence: overrides?.confidence ?? 0.95,
    classifierOrigin: overrides?.classifierOrigin ?? 'heuristic',
  };
}

/**
 * Asynchronously classifies intent, allowing an EarOrgan or cognitive model
 * to provide semantic classification before falling back to heuristics.
 */
export async function classifyInputIntentAsync(
  text: string,
  context: RequestContext,
  classifier?: CognitiveIntentClassifier
): Promise<IntentClassification> {
  if (!classifier) {
    return classifyInputIntent(text, context);
  }

  try {
    const cognitiveResult = await classifier(text, context);
    return classifyInputIntent(text, context, {
      ...cognitiveResult,
      classifierOrigin: cognitiveResult.classifierOrigin || 'cognitive',
    });
  } catch (err) {
    return classifyInputIntent(text, context);
  }
}
