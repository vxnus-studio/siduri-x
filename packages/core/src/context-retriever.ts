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

  // 2. Query all 4 streams in parallel
  const [knowledgeData, memoryData, selfOrMemoryDirectives, lifeContext] = await Promise.all([
    // Stream A: External Cited Lore / Documentation
    extKnowledge && shouldQueryKnowledge && typeof (extKnowledge as any).search === 'function'
      ? (extKnowledge as any).search(perceivedText).catch((e: any) => {
          console.error('[SiduriRuntime] Knowledge search failed:', e.message);
          subsystemDiagnostics['knowledge'] = `UNAVAILABLE: ${e.message}`;
          return [];
        })
      : Promise.resolve([]),

    // Stream B: Episodic Memory / Verified Claims (SQLite FTS5)
    memory && typeof (memory as any).searchClaims === 'function'
      ? (async () => {
          try {
            // Support both (companionId, query, limit) and (query, options, limit)
            const result = await (memory as any).searchClaims(perceivedText, queryOptions, 5);
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
  };
}
