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
import { extractSearchKeywords } from './intent-classifier';

export interface ContextRetrievalParams {
  companionId: string;
  perceivedText: string;
  requestContext: RequestContext;
  role: 'OWNER' | 'VIEWER' | 'OPERATOR';
  isContextObject: boolean;
  shouldQueryKnowledge: boolean;
  knowledgeQueries?: string[];
  memoryQueries?: string[];
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
    knowledgeQueries,
    memoryQueries,
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

  // Formulate queries: combine AI/cognitive queries, entity keywords, and cleaned query variants
  const keywordQueries = extractSearchKeywords(perceivedText, companionId, (requestContext as any)?.history);
  const aiQueries = (knowledgeQueries || []).filter(Boolean);
  
  // Clean AI queries of conversational filler if present (e.g. 'what is the lore on Sandrone' -> 'Sandrone')
  const cleanedAiQueries = aiQueries.map((q) =>
    q.replace(/^(?:what(?:\s+is|\s+are)?|who(?:\s+is|\s+are)?|tell(?:\s+me)?(?:\s+about)?|search(?:\s+for)?|information(?:\s+on|\s+about)?|details(?:\s+on|\s+about)?|lore(?:\s+for|\s+on|\s+about)?)\s+/gi, '').trim()
  ).filter((q) => q.length > 0);

  const queryCandidateSet = new Set<string>();
  for (const q of [...keywordQueries, ...aiQueries, ...cleanedAiQueries]) {
    if (q && q.trim()) {
      queryCandidateSet.add(q.trim());
    }
  }
  if (queryCandidateSet.size === 0 && perceivedText && perceivedText.trim()) {
    queryCandidateSet.add(perceivedText.trim());
  }
  const finalKnowledgeQueries = Array.from(queryCandidateSet);

  const memoryQueryToRun = (memoryQueries && memoryQueries.length > 0 && memoryQueries[0])
    ? memoryQueries[0]
    : extractSearchKeywords(perceivedText, companionId)[0] || perceivedText;

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
      ? Promise.all(
          finalKnowledgeQueries.map((q) =>
            (extKnowledge as any).search(q).catch((e: any) => {
              console.error(`[SiduriRuntime] Knowledge search failed for "${q}":`, e.message);
              subsystemDiagnostics['knowledge'] = `UNAVAILABLE: ${e.message}`;
              return [];
            })
          )
        ).then((resultsArray) => {
          const merged: KnowledgeItem[] = [];
          const seen = new Set<string>();
          for (const list of resultsArray) {
            if (!Array.isArray(list)) continue;
            for (const item of list) {
              const key = item.id || item.content || (item as any).text || JSON.stringify(item.citations);
              if (!seen.has(key)) {
                seen.add(key);
                merged.push(item);
              }
            }
          }
          return merged;
        })
      : Promise.resolve([]),

    // Stream B: Episodic Memory / Verified Claims (SQLite FTS5 with Identity Fallback)
    memory && typeof (memory as any).searchClaims === 'function'
      ? (async () => {
          try {
            // Support both (companionId, query, limit) and (query, options, limit)
            let result = await (memory as any).searchClaims(memoryQueryToRun, queryOptions, 5);
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

  // Build evidence records from retrieved context streams
  const collectedEvidence: EvidenceRecord[] = [];
  const citations: ResponseCitation[] = [];

  // Stream A: External Knowledge
  if (knowledgeData.length > 0) {
    for (const k of knowledgeData) {
      const previewText = k.content || (k as any).text || (k as any).summary || (k as any).preview || '';
      if (k.evidenceRecord) {
        const nativeRecord = {
          ...k.evidenceRecord,
        };
        collectedEvidence.push(nativeRecord);
        citations.push({
          evidenceId: nativeRecord.evidenceId,
          provenance: k.provenance || nativeRecord.sourceId || 'knowledge',
          sourceId: nativeRecord.sourceId,
          revision: nativeRecord.revision,
          documentId: nativeRecord.documentId || k.citations?.[0]?.documentId,
          chunkId: nativeRecord.chunkId || k.citations?.[0]?.chunkId,
          locator: nativeRecord.locator || k.citations?.[0]?.locator,
          preview: previewText.slice(0, 300),
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
          evidenceId: evId,
          provenance: sourceId,
          sourceId,
          revision: k.revision,
          documentId: k.citations?.[0]?.documentId,
          chunkId: k.citations?.[0]?.chunkId,
          locator: k.citations?.[0]?.locator,
          preview: previewText.slice(0, 300),
        });
      }
    }
  }

  // Stream B: Episodic Memory Claims
  if (memoryData.length > 0) {
    for (const m of memoryData) {
      const claimId = (m as any).claim_id || (m as any).id || `claim-${Date.now()}`;
      const sourceId = (m as any).provenance || 'sqlite-memory';
      const evId = `ev-mem-${claimId}`;
      const claimPreview = (m as any).content || `${(m as any).subject || 'user'} ${(m as any).predicate || 'claims'}: ${(m as any).value || ''}`;
      collectedEvidence.push({
        evidenceId: evId,
        sourceId,
        documentId: claimId,
        chunkId: `${(m as any).subject || 'user'}:${(m as any).predicate || 'claim'}`,
        origin: 'memory',
        trust: 'configured',
        sensitivity: 'private',
        companionId,
        correlationId: requestContext.conversation.correlationId,
        createdAt: new Date().toISOString(),
      });
      citations.push({
        evidenceId: evId,
        provenance: 'memory',
        sourceId,
        documentId: claimId,
        chunkId: `${(m as any).subject || 'user'}.${(m as any).predicate || 'claim'}`,
        locator: `claim:${claimId}`,
        preview: claimPreview.slice(0, 300),
      });
    }
  }

  // Stream D: Life DB Context Items
  if (lifeContext && lifeContext.length > 0) {
    for (let i = 0; i < lifeContext.length; i++) {
      const item = lifeContext[i];
      const evId = `ev-life-${Date.now()}-${i}`;
      const sourceId = 'sqlite-lifedb';
      const itemPreview = (item as any).title || (item as any).name || (item as any).summary || JSON.stringify(item);
      collectedEvidence.push({
        evidenceId: evId,
        sourceId,
        documentId: `item-${i}`,
        origin: 'life',
        trust: 'configured',
        sensitivity: 'private',
        companionId,
        correlationId: requestContext.conversation.correlationId,
        createdAt: new Date().toISOString(),
      });
      citations.push({
        evidenceId: evId,
        provenance: 'life',
        sourceId,
        documentId: `item-${i}`,
        locator: `lifedb:item:${i}`,
        preview: itemPreview.slice(0, 300),
      });
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
