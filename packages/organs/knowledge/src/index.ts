import { KnowledgeItem, KnowledgeOrgan } from '@siduri-y/core';
import type { LoadedPack } from '@vxnus/e-knowledge';
import type { KnowledgeProvider, RetrievalResult } from '@vxnus/e';

type EKnowledgeModule = typeof import('@vxnus/e-knowledge');
const loadEKnowledgeModule = (): Promise<EKnowledgeModule> =>
  new Function('specifier', 'return import(specifier)')('@vxnus/e-knowledge') as Promise<EKnowledgeModule>;

export interface EKnowledgeConfig {
  provider?: 'e-knowledge' | 'e-remote' | 'e-hub';
  packPath?: string;
  baseUrl?: string;
  registryUrl?: string;
  packId?: string;
  timeoutMs?: number;
  preferredMode?: 'lexical' | 'semantic' | 'hybrid';
}

async function resolveHubProvider(config: EKnowledgeConfig, module: EKnowledgeModule): Promise<KnowledgeProvider> {
  if (!config.registryUrl || !config.packId) throw new Error('E Hub provider requires registryUrl and packId');
  const match = config.packId.match(/^@([^/]+)\/([^/]+)$/);
  if (!match) throw new Error('E Hub packId must use the @publisher/name format');
  const registryUrl = config.registryUrl.replace(/\/+$/, '');
  const response = await fetch(`${registryUrl}/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`);
  if (!response.ok) throw new Error(`E Hub registry returned HTTP ${response.status}`);
  const pack = await response.json() as { distribution?: { kind?: string; url?: string } };
  if (pack.distribution?.kind !== 'provider' || !pack.distribution.url) throw new Error(`E Hub pack ${config.packId} is not a remote provider`);
  return module.createRemoteProvider({ baseUrl: pack.distribution.url, timeoutMs: config.timeoutMs });
}

export class EKnowledgeAdapter implements KnowledgeOrgan {
  private loaded: Promise<LoadedPack | { provider: KnowledgeProvider; manifest: Awaited<ReturnType<KnowledgeProvider['manifest']>> }>;
  private readonly preferredMode: EKnowledgeConfig['preferredMode'];

  constructor(config: EKnowledgeConfig) {
    this.preferredMode = config.preferredMode ?? 'lexical';
    this.loaded = loadEKnowledgeModule().then(async (module) => {
      if (config.provider === 'e-hub') {
        const provider = await resolveHubProvider(config, module);
        return { provider, manifest: await provider.manifest() };
      }
      if (config.provider === 'e-remote' || config.baseUrl) {
        const provider = module.createRemoteProvider({ baseUrl: config.baseUrl || '', timeoutMs: config.timeoutMs });
        return { provider, manifest: await provider.manifest() };
      }
      if (!config.packPath) throw new Error('EKnowledgeAdapter requires packPath, baseUrl, or E Hub configuration');
      return module.loadPack(config.packPath);
    });
  }

  get currentRevision() { return this.loaded.then(pack => 'revision' in pack ? pack.revision.id : 'remote'); }

  async search(query: string): Promise<KnowledgeItem[]> {
    const pack = await this.loaded;
    if (!query.trim()) return [];
    const requestedMode = this.preferredMode;
    const manifest = pack.manifest;
    const modeSupported = requestedMode === 'lexical' || manifest.capabilities.semanticSearch;
    let response;
    try {
      response = await pack.provider.retrieve({ query, mode: modeSupported ? requestedMode : 'lexical', limit: 8 });
    } catch (error) {
      if (requestedMode === 'lexical') throw error;
      // Semantic infrastructure is optional: an outage must not remove the
      // provider's cited lexical path.
      response = await pack.provider.retrieve({ query, mode: 'lexical', limit: 8 });
    }
    return response.results.map((result: RetrievalResult) => ({
      content: result.content,
      revision: result.revision,
      citations: result.citations,
      provenance: result.citations[0]?.sourceId || pack.manifest.publisher
    }));
  }
}
