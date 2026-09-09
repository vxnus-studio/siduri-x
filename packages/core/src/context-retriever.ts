import {
  KnowledgeOrgan,
  MemoryOrgan,
  KnowledgeItem,
  Claim,
  BehaviorDirective,
  EvidenceRecord,
  ResponseCitation,
  RequestContext,
} from './index';

export interface ContextRetrievalParams {
  companionId: string;
  perceivedText: string;
  requestContext: RequestContext;
  role: 'OWNER' | 'VIEWER' | 'OPERATOR';
  isContextObject: boolean;
  shouldQueryKnowledge: boolean;
  knowledge?: KnowledgeOrgan;
  memory?: MemoryOrgan;
}

export interface RetrievedContext {
  knowledgeData: KnowledgeItem[];
  memoryData: Claim[];
  activeDirectives: BehaviorDirective[];
  subsystemDiagnostics: Record<string, string>;
  collectedEvidence: EvidenceRecord[];
  citations: ResponseCitation[];
}

/**
 * Concurrently queries Knowledge and Memory organs with graceful degradation,
 * collecting diagnostics and synthesizing evidence records and citations.
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
  } = params;

  const queryOptions = isContextObject
    ? {
        channel: requestContext.conversation.channel,
        audienceId: requestContext.conversation.audienceId,
        limit: 5,
      }
    : role;

  const subsystemDiagnostics: Record<string, string> = {};

  const [knowledgeData, memoryData, activeDirectives] = await Promise.all([
    knowledge && shouldQueryKnowledge && typeof knowledge.search === 'function'
      ? knowledge.search(perceivedText).catch((e: any) => {
          console.error('[SiduriRuntime] Knowledge search failed:', e.message);
          subsystemDiagnostics['knowledge'] = `UNAVAILABLE: ${e.message}`;
          return [];
        })
      : Promise.resolve([]),
    memory && typeof memory.searchClaims === 'function'
      ? memory.searchClaims(perceivedText, queryOptions, 5).catch((e: any) => {
          console.error('[SiduriRuntime] Memory search failed:', e.message);
          subsystemDiagnostics['memory_claims'] = `UNAVAILABLE: ${e.message}`;
          return [];
        })
      : Promise.resolve([]),
    memory && typeof memory.getDirectives === 'function'
      ? memory.getDirectives().catch((e: any) => {
          console.error('[SiduriRuntime] Memory directives failed:', e.message);
          subsystemDiagnostics['memory_directives'] = `UNAVAILABLE: ${e.message}`;
          return [];
        })
      : Promise.resolve([]),
  ]);

  // Build evidence records from retrieved knowledge context
  const collectedEvidence: EvidenceRecord[] = [];
  const citations: ResponseCitation[] = [];

  if (knowledgeData.length > 0) {
    for (const k of knowledgeData) {
      if (k.evidenceRecord) {
        const nativeRecord = {
          ...k.evidenceRecord,
          allowedAudiences:
            k.evidenceRecord.sensitivity === 'public' &&
            !k.evidenceRecord.allowedAudiences.includes(requestContext.conversation.audienceId)
              ? [...k.evidenceRecord.allowedAudiences, requestContext.conversation.audienceId]
              : k.evidenceRecord.allowedAudiences,
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
          allowedAudiences: ['audience-public', requestContext.conversation.audienceId],
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
  };
}
