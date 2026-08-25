import { EKnowledgeAdapter } from './index';
import path from 'node:path';

const testPackPath = process.env.E_TEST_PACK_PATH || path.resolve(__dirname, '../../../../../e/packages/knowledge/fixtures/sample');

describe('EKnowledgeAdapter', () => {
  test('loads an E pack and preserves citations and revision', async () => {
    const adapter = new EKnowledgeAdapter({ packPath: testPackPath });
    const results = await adapter.search('grounded facts');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ content: 'Siduri knowledge packs provide grounded facts.', revision: 'r1' });
    expect(results[0].citations[0]).toMatchObject({ sourceId: 'handbook', documentId: 'intro', chunkId: 'intro-1' });
  });

  test('does not retrieve for an empty query', async () => {
    const adapter = new EKnowledgeAdapter({ packPath: testPackPath });
    expect(await adapter.search('   ')).toEqual([]);
  });

  test('falls back to lexical when semantic capability is unavailable', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/manifest')) return { ok: true, status: 200, json: async () => ({ id: '@publisher/installed-pack', name: 'installed-pack', publisher: 'publisher', version: '1.0.0', schemaVersion: '1.0', sources: [{ id: 'source', title: 'Source', license: 'CC-BY-4.0' }], capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: true, relations: true, revisions: true } }) } as Response;
      expect(JSON.parse(String(init?.body)).mode).toBe('lexical');
      return { ok: true, status: 200, json: async () => ({ revision: 'r1', results: [{ id: 'c1', content: 'lexical fallback', revision: 'r1', citations: [{ sourceId: 'gi-data', chunkId: 'c1' }] }] }) } as Response;
    });
    const adapter = new EKnowledgeAdapter({ provider: 'e-remote', baseUrl: 'https://provider.example/api/e', preferredMode: 'semantic' });
    await expect(adapter.search('fallback')).resolves.toMatchObject([{ content: 'lexical fallback' }]);
    fetchMock.mockRestore();
  });

  test('loads an E remote provider and preserves its citation contract', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const body = url.endsWith('/manifest')
        ? { id: '@publisher/installed-pack', name: 'installed-pack', publisher: 'publisher', version: '1.0.0', schemaVersion: '1.0', sources: [{ id: 'source', title: 'Source', license: 'CC-BY-4.0' }], capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: true, relations: true, revisions: true } }
        : { revision: 'teyvat-r1', results: [{ id: 'chunk-1', content: 'Furina uses materials.', revision: 'teyvat-r1', citations: [{ sourceId: 'gi-data', documentId: 'doc-1', chunkId: 'chunk-1' }] }] };
      return { ok: true, status: 200, json: async () => body } as Response;
    });
    const adapter = new EKnowledgeAdapter({ provider: 'e-remote', baseUrl: 'https://provider.example/api/e' });
    await expect(adapter.search('Furina')).resolves.toMatchObject([{ revision: 'teyvat-r1', provenance: 'gi-data' }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/manifest'), expect.anything());
    fetchMock.mockRestore();
  });

  test('resolves a provider distribution through the E Hub', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const body = url.includes('/api/packs/publisher/installed-pack')
        ? { distribution: { kind: 'provider', url: 'https://provider.example/api/e' } }
        : url.endsWith('/manifest')
          ? { id: '@publisher/installed-pack', name: 'installed-pack', publisher: 'publisher', version: '1.0.0', schemaVersion: '1.0', sources: [{ id: 'source', title: 'Source', license: 'CC-BY-4.0' }], capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: true, relations: true, revisions: true } }
          : { revision: 'teyvat-r1', results: [{ id: 'chunk-1', content: 'hub fact', revision: 'teyvat-r1', citations: [{ sourceId: 'gi-data', documentId: 'doc-1', chunkId: 'chunk-1' }] }] };
      return { ok: true, status: 200, json: async () => body } as Response;
    });
    const adapter = new EKnowledgeAdapter({ provider: 'e-hub', registryUrl: 'https://hub.example/api/packs', packId: '@publisher/installed-pack' });
    await expect(adapter.search('hub')).resolves.toMatchObject([{ content: 'hub fact', revision: 'teyvat-r1' }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/packs/publisher/installed-pack'));
    fetchMock.mockRestore();
  });
});
