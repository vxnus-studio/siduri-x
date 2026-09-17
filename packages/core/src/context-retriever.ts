import {
  KnowledgeOrgan,
  MemoryOrgan,
  KnowledgeItem,
  Claim,
  BehaviorDirective,
  EvidenceRecord,
  ResponseCitation,
  RequestContext,
  SelfRepository,
  LifeDatabase,
  EpisodicMemoryStore,
  EKnowledgeOrgan,
} from './index';

export interface ContextRetrievalParams {
  companionId: string;
  perceivedText: string;
  requestContext: RequestContext;
  role: 'OWNER' | 'VIEWER' | 'OPERATOR';
  isContextObject: boolean;
  shouldQueryKnowledge: boolean;
  isSelfIdentityRequest?: boolean;
  knowledge?: KnowledgeOrgan | LifeDatabase;
  memory?: MemoryOrgan | EpisodicMemoryStore;
  self?: SelfRepository;
  externalKnowledge?: EKnowledgeOrgan | KnowledgeOrgan;
}

export interface RetrievedContext {
  knowledgeData: KnowledgeItem[];
  memoryData: Claim[];
  activeDirectives: BehaviorDirective[];
  subsystemDiagnostics: Record<string, string>;
  collectedEvidence: EvidenceRecord[];
  citations: ResponseCitation[];
  lifeContext?: string[];
  selfIdentity?: any;
  selfRelationship?: any;
  personality?: any;
}

/**
 * Concurrently queries Self, Knowledge (Life DB), External Knowledge, and Memory
 * in a single parallel pass with graceful degradation.
 */
export async function retrieveRuntimeContext(
  params: ContextRetrievalParams
): Promise<RetrievedContext> {
  const {
    companionId,
    perceivedText,
    requestContext,
    role,
    isContextObject,
    shouldQueryKnowledge,
    isSelfIdentityRequest,
    knowledge,
    memory,
    self,
    externalKnowledge,
  } = params;

  const queryOptions = isContextObject
    ? {
        limit: 5,
      }
    : role;

  const subsystemDiagnostics: Record<string, string> = {};

  // 1. Resolve External Knowledge organ (either explicitly passed or from legacy knowledge with .search)
  const extKnowledge = externalKnowledge || (knowledge && typeof (knowledge as any).search === 'function' ? knowledge : undefined);

  // 2. Query streams in parallel
  const [
    knowledgeData,
    memoryData,
    selfOrMemoryDirectives,
    lifeContext,
    selfIdentity,
    selfRelationship,
    personality,
  ] = await Promise.all([
    // Stream A: External Cited Lore / Documentation
    extKnowledge && shouldQueryKnowledge && typeof (extKnowledge as any).search === 'function'
      ? (extKnowledge as any).search(perceivedText).catch((e: any) => {
          console.error('[SiduriRuntime] Knowledge search failed:', e.message);
          subsystemDiagnostics['knowledge'] = `UNAVAILABLE: ${e.message}`;
          return [];
        })
      : Promise.resolve([]),

    // Stream B: Episodic Memory / Verified Claims (SQLite FTS5 with Identity Fallback)
    memory && typeof (memory as any).searchClaims === 'function'
      ? (async () => {
          try {
            // Support both (companionId, query, limit) and (query, options, limit)
            let result = await (memory as any).searchClaims(perceivedText, queryOptions, 5);
            if ((!result || result.length === 0) && isSelfIdentityRequest) {
              if (typeof (memory as any).getApprovedClaims === 'function') {
                const approved = await (memory as any).getApprovedClaims(companionId, 10);
                const identityClaims = approved.filter((c: any) => {
                  const pred = (c.predicate || '').toLowerCase();
                  const subj = (c.subject || '').toLowerCase();
                  return (
                    ['name', 'role', 'stated_relationship', 'relationship', 'origin', 'created_by', 'preferred_address', 'title', 'identity', 'creator', 'archetype', 'affiliation'].includes(pred) ||
                    subj.startsWith('companion') ||
                    subj === 'self' ||
                    subj === 'siduri' ||
                    subj.startsWith('actor:')
                  );
                });
                result = identityClaims.length > 0 ? identityClaims.slice(0, 5) : approved.slice(0, 5);
              } else if (typeof (memory as any).getClaims === 'function') {
                const all = await (memory as any).getClaims(50);
                const approved = all.filter((c: any) => (c.status || '').toLowerCase() === 'approved');
                result = approved.slice(0, 5);
              }
            }
            return result || [];
          } catch (e: any) {
            console.error('[SiduriRuntime] Memory search failed:', e.message);
            subsystemDiagnostics['memory_claims'] = `UNAVAILABLE: ${e.message}`;
            return [];
          }
        })()
      : Promise.resolve([]),

    // Stream C: Active Directives from Self (or fallback Memory)
    self && typeof self.getActiveDirectives === 'function'
      ? self.getActiveDirectives(companionId).catch((e: any) => {
          console.error('[SiduriRuntime] Self directives failed:', e.message);
          subsystemDiagnostics['self_directives'] = `UNAVAILABLE: ${e.message}`;
          return [];
        })
      : memory && typeof (memory as any).getDirectives === 'function'
      ? (memory as any).getDirectives().catch((e: any) => {
          console.error('[SiduriRuntime] Memory directives failed:', e.message);
          subsystemDiagnostics['memory_directives'] = `UNAVAILABLE: ${e.message}`;
          return [];
        })
      : Promise.resolve([]),

    // Stream D: Sovereign Life DB Context (Finances, Inventory, Schedule, Preferences)
    knowledge && typeof (knowledge as any).queryContext === 'function'
      ? (knowledge as any).queryContext(companionId, perceivedText).catch((e: any) => {
          console.error('[SiduriRuntime] Life DB context failed:', e.message);
          subsystemDiagnostics['life_db'] = `UNAVAILABLE: ${e.message}`;
          return [];
        })
      : Promise.resolve([]),

    // Stream E: Self Identity
    self && typeof self.getIdentity === 'function'
      ? self.getIdentity(companionId).catch((e: any) => {
          console.error('[SiduriRuntime] Self identity failed:', e.message);
          return undefined;
        })
      : Promise.resolve(undefined),

    // Stream F: Self Relationship toward interacting actor
    self && typeof self.getRelationship === 'function' && requestContext.actor?.actorId
      ? self.getRelationship(companionId, requestContext.actor.actorId).catch((e: any) => {
          console.error('[SiduriRuntime] Self relationship failed:', e.message);
          return null;
        })
      : Promise.resolve(null),

    // Stream G: Self Personality
    self && typeof self.getPersonality === 'function'
      ? self.getPersonality(companionId).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  const activeDirectives: BehaviorDirective[] = (selfOrMemoryDirectives || []) as BehaviorDirective[];

  // Build evidence records from retrieved external knowledge context
  const collectedEvidence: EvidenceRecord[] = [];
  const citations: ResponseCitation[] = [];

  if (knowledgeData.length > 0) {
    for (const k of knowledgeData) {
      if (k.evidenceRecord) {
        const nativeRecord = {
          ...k.evidenceRecord,
        };
        collectedEvidence.push(nativeRecord);
        citations.push({
          sourceId: nativeRecord.sourceId,
          revision: nativeRecord.revision,
          documentId: nativeRecord.documentId || k.citations?.[0]?.documentId,
          chunkId: nativeRecord.chunkId || k.citations?.[0]?.chunkId,
          locator: nativeRecord.locator || k.citations?.[0]?.locator,
        });
      } else {
        // Synthesize fallback evidence record with provenance
        const evId = `ev-know-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const sourceId = k.provenance || 'configured-knowledge';
        collectedEvidence.push({
          evidenceId: evId,
          sourceId,
          revision: k.revision,
          origin: 'knowledge',
          trust: 'configured',
          sensitivity: 'public',
          companionId,
          correlationId: requestContext.conversation.correlationId,
          createdAt: new Date().toISOString(),
        });
        citations.push({
          sourceId,
          revision: k.revision,
          documentId: k.citations?.[0]?.documentId,
          chunkId: k.citations?.[0]?.chunkId,
          locator: k.citations?.[0]?.locator,
        });
      }
    }
  }

  return {
    knowledgeData,
    memoryData,
    activeDirectives,
    subsystemDiagnostics,
    collectedEvidence,
    citations,
    lifeContext,
    selfIdentity,
    selfRelationship,
    personality,
  };
}
