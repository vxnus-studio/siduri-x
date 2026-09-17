import { RequestContext, InteractionMode } from './index';
import { extractDeterministicTeaching } from './teaching';

export interface IntentClassification {
  normalizedMessage: string;
  explicitTeaching: ReturnType<typeof extractDeterministicTeaching>;
  isTeachingLike: boolean;
  isSelfIdentityRequest: boolean;
  isGreeting: boolean;
  shouldQueryKnowledge: boolean;
  knowledgeQueries?: string[];
  primaryQuery?: string;
  memoryQueries?: string[];
  effectiveMode: InteractionMode;
  confidence?: number;
  classifierOrigin?: 'heuristic' | 'cognitive' | 'ear' | 'brain';
}

export type CognitiveIntentClassifier = (
  text: string,
  context: RequestContext
) => Promise<Partial<IntentClassification>> | Partial<IntentClassification>;

/**
 * Strips conversational syntax, companion invocations, and question carrier phrases
 * to extract targeted keyword search terms (e.g., "Siduri, who is Sandrone" -> ["Sandrone"]).
 */
export function extractSearchKeywords(
  text: string,
  companionName?: string,
  recentHistory?: { role: string; content: string }[]
): string[] {
  if (!text || !text.trim()) return [];

  let query = text.trim();

  // 1. Strip companion names (e.g. "Siduri", "Siduri:", "Hey Siduri,")
  const companionTokens = ['siduri'];
  if (typeof companionName === 'string' && companionName.trim()) {
    companionTokens.push(companionName.trim().toLowerCase());
  }
  for (const comp of companionTokens) {
    const compRegex = new RegExp(`^(?:hey|hi|hello)?\\s*${comp}\\b[,:]?\\s*`, 'i');
    query = query.replace(compRegex, '');
    const compEndRegex = new RegExp(`[,:]?\\s*${comp}\\s*[.!?]?$`, 'i');
    query = query.replace(compEndRegex, '');
  }

  // 2. Strip leading conversational intent carriers / question frames
  const prefixPatterns = [
    /^(?:can\s+you\s+)?(?:please\s+)?(?:tell\s+me\s+(?:all\s+)?about|explain|describe)\s+(?:the\s+)?/i,
    /^(?:do\s+you\s+know\s+(?:about|who|what)\s+(?:is\s+)?(?:the\s+)?)/i,
    /^(?:what\s+do\s+you\s+know\s+about\s+(?:the\s+)?)/i,
    /^(?:who\s+(?:is|was|are|were)\s+(?:the\s+)?)/i,
    /^(?:what\s+(?:is|was|are|were)\s+(?:the\s+)?)/i,
    /^(?:where\s+(?:is|was|are|were)\s+(?:the\s+)?)/i,
    /^(?:when\s+(?:is|was|are|were|will|does)\s+(?:the\s+)?)/i,
    /^(?:search\s+(?:for\s+)?(?:the\s+)?)/i,
    /^(?:look\s+up\s+(?:the\s+)?)/i,
    /^(?:give\s+me\s+(?:info|information|details)\s+(?:on|about)\s+(?:the\s+)?)/i,
  ];

  for (const pattern of prefixPatterns) {
    query = query.replace(pattern, '');
  }

  // 3. Strip trailing question marks, quotes, and punctuation
  query = query.replace(/[?.,!;:'"]+$/g, '').replace(/^[?.,!;:'"]+/g, '').trim();

  // 4. Resolve pronouns from conversation history if present
  const hasPronoun = /\b(?:she|he|they|her|him|it)\b/i.test(query);
  if (hasPronoun && Array.isArray(recentHistory) && recentHistory.length > 0) {
    for (let i = recentHistory.length - 1; i >= 0; i--) {
      const prevContent = recentHistory[i].content || '';
      const prevClean = prevContent.replace(/^(?:who\s+is|what\s+is|where\s+is)\s+/i, '').replace(/[?.,!;:'"]+$/g, '').trim();
      if (prevClean && !/\b(?:she|he|they|it)\b/i.test(prevClean)) {
        const firstToken = prevClean.split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '');
        if (firstToken && firstToken.length >= 3) {
          // Extract remaining qualifier keywords from current question (e.g. "banner", "build", "lore")
          const qualifiers = query.split(/\s+/).filter((w) => !/\b(?:she|he|they|her|him|it)\b/i.test(w) && w.length >= 3);
          if (qualifiers.length > 0) {
            return [`${firstToken} ${qualifiers.join(' ')}`, firstToken];
          }
          return [firstToken];
        }
      }
    }
  }

  // 5. Return clean keyword if valid
  if (query.length > 0) {
    return [query];
  }

  return [];
}

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
    typeof overrides?.shouldQueryKnowledge === 'boolean'
      ? overrides.shouldQueryKnowledge
      : (!isTeachingLike && !isSelfIdentityRequest && !isGreeting);

  const rawKeywords = extractSearchKeywords(text, context.companionId, (context as any).history);
  const aiKnowledgeQueries = (overrides?.knowledgeQueries || []).filter(Boolean);
  const knowledgeQueries =
    aiKnowledgeQueries.length > 0
      ? Array.from(new Set([...aiKnowledgeQueries, ...rawKeywords]))
      : (shouldQueryKnowledge ? rawKeywords : []);
  const primaryQuery = knowledgeQueries[0] || (shouldQueryKnowledge ? text.trim() : undefined);
  const memoryQueries =
    (overrides?.memoryQueries && overrides.memoryQueries.length > 0)
      ? overrides.memoryQueries
      : rawKeywords;

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
    knowledgeQueries,
    primaryQuery,
    memoryQueries,
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
