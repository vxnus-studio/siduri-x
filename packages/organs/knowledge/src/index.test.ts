import { EKnowledgeAdapter } from './index';

describe('EKnowledgeAdapter', () => {
  test('loads an E pack and preserves citations and revision', async () => {
    const adapter = new EKnowledgeAdapter({ packPath: process.env.E_TEST_PACK_PATH! });
    const results = await adapter.search('grounded facts');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ content: 'Siduri knowledge packs provide grounded facts.', revision: 'r1' });
    expect(results[0].citations[0]).toMatchObject({ sourceId: 'handbook', documentId: 'intro', chunkId: 'intro-1' });
  });

  test('does not retrieve for an empty query', async () => {
    const adapter = new EKnowledgeAdapter({ packPath: process.env.E_TEST_PACK_PATH! });
    expect(await adapter.search('   ')).toEqual([]);
  });
});
