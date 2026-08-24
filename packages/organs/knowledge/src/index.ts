import { KnowledgeItem, KnowledgeOrgan } from '@siduri-y/core';
import type { LoadedPack } from '@vxnus/e-pack';
import type { RetrievalResult } from '@vxnus/e';

type EPackModule = typeof import('@vxnus/e-pack');
const loadEPackModule = (): Promise<EPackModule> =>
  new Function('specifier', 'return import(specifier)')('@vxnus/e-pack') as Promise<EPackModule>;

export interface EPackConfig { packPath: string; }

export class EPackAdapter implements KnowledgeOrgan {
  private loaded: Promise<LoadedPack>;

  constructor(config: EPackConfig) {
    if (!config.packPath) throw new Error('EPackAdapter requires packPath');
    this.loaded = loadEPackModule().then(({ loadPack }) => loadPack(config.packPath));
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
