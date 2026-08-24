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

  test('loads an E remote provider and preserves its citation contract', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const body = url.endsWith('/manifest')
        ? { id: '@vxnus/teyvat', name: 'Teyvat', publisher: 'vxnuslabs', version: '1.0.0', schemaVersion: '1.0', sources: [{ id: 'gi-data', title: 'gi-data', license: 'MIT' }], capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: true, relations: true, revisions: true } }
        : { revision: 'teyvat-r1', results: [{ id: 'chunk-1', content: 'Furina uses materials.', revision: 'teyvat-r1', citations: [{ sourceId: 'gi-data', documentId: 'doc-1', chunkId: 'chunk-1' }] }] };
      return { ok: true, status: 200, json: async () => body } as Response;
    });
    const adapter = new EKnowledgeAdapter({ provider: 'e-remote', baseUrl: 'https://eteyvat.example/api/knowledge' });
    await expect(adapter.search('Furina')).resolves.toMatchObject([{ revision: 'teyvat-r1', provenance: 'gi-data' }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/manifest'), expect.anything());
    fetchMock.mockRestore();
  });

  test('resolves a provider distribution through the E Hub', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const body = url.includes('/api/packs/vxnus/teyvat')
        ? { distribution: { kind: 'provider', url: 'https://eteyvat.example/api/knowledge' } }
        : url.endsWith('/manifest')
          ? { id: '@vxnus/teyvat', name: 'Teyvat', publisher: 'vxnuslabs', version: '1.0.0', schemaVersion: '1.0', sources: [{ id: 'gi-data', title: 'gi-data', license: 'MIT' }], capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: true, relations: true, revisions: true } }
          : { revision: 'teyvat-r1', results: [{ id: 'chunk-1', content: 'hub fact', revision: 'teyvat-r1', citations: [{ sourceId: 'gi-data', documentId: 'doc-1', chunkId: 'chunk-1' }] }] };
      return { ok: true, status: 200, json: async () => body } as Response;
    });
    const adapter = new EKnowledgeAdapter({ provider: 'e-hub', registryUrl: 'https://e.example/api/packs', packId: '@vxnus/teyvat' });
    await expect(adapter.search('hub')).resolves.toMatchObject([{ content: 'hub fact', revision: 'teyvat-r1' }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/packs/vxnus/teyvat'));
    fetchMock.mockRestore();
  });
});
