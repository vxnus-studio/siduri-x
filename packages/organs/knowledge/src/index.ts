import { KnowledgeItem, KnowledgeOrgan } from '@siduri-y/core';
import type { LoadedPack } from '@vxnus/e-knowledge';
import type { RetrievalResult } from '@vxnus/e';

type EKnowledgeModule = typeof import('@vxnus/e-knowledge');
const loadEKnowledgeModule = (): Promise<EKnowledgeModule> =>
  new Function('specifier', 'return import(specifier)')('@vxnus/e-knowledge') as Promise<EKnowledgeModule>;

export interface EKnowledgeConfig { packPath: string; }

export class EKnowledgeAdapter implements KnowledgeOrgan {
  private loaded: Promise<LoadedPack>;

  constructor(config: EKnowledgeConfig) {
    if (!config.packPath) throw new Error('EKnowledgeAdapter requires packPath');
    this.loaded = loadEKnowledgeModule().then(({ loadPack }) => loadPack(config.packPath));
  }

  get currentRevision() { return this.loaded.then(pack => pack.revision.id); }

  async search(query: string): Promise<KnowledgeItem[]> {
    const pack = await this.loaded;
    if (!query.trim()) return [];
    const response = await pack.provider.retrieve({ query, mode: 'lexical', limit: 8 });
    return response.results.map((result: RetrievalResult) => ({
      content: result.content,
      revision: result.revision,
      citations: result.citations,
      provenance: result.citations[0]?.sourceId || pack.manifest.publisher
    }));
  }
}
