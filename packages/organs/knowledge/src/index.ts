import { KnowledgeOrgan, KnowledgeItem } from '@siduri-y/core';

export interface ETeyvatConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export class ETeyvatAdapter implements KnowledgeOrgan {
  private baseUrl: string;
  private timeoutMs: number;
  private revision: string | undefined;

  constructor(config?: ETeyvatConfig) {
    this.baseUrl = (config?.baseUrl || 'https://eteyvat.krzgn.xyz').replace(/\/$/, '');
    this.timeoutMs = config?.timeoutMs || 5000;
  }

  get currentRevision() {
    return this.revision;
  }

  async search(query: string): Promise<KnowledgeItem[]> {
    if (!query || !query.trim()) return [];

    const url = new URL('/api/knowledge/search', this.baseUrl);
    url.searchParams.set('q', query.substring(0, 200));
    url.searchParams.set('limit', '8');

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`E-Teyvat search failed: ${response.statusText}`);
      }

      const value = await response.json();
      if (!value || typeof value !== 'object') {
        throw new Error("E-Teyvat response was not an object");
      }

      if (value.revision) {
        this.revision = String(value.revision);
      }

      const results: KnowledgeItem[] = [];
      const items = Array.isArray(value.items) ? value.items : [];

      for (const item of items) {
        if (!item || typeof item !== 'object' || typeof item.content !== 'string') continue;

        const slug = item.slug || 'unknown';
        
        results.push({
          content: item.content,
          provenance: `${this.baseUrl}/api/entities/${item.kind || 'entities'}/${slug}`
        });
      }

      return results;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }
}
