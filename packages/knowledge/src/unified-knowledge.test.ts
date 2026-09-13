import fs from 'node:fs';
import path from 'node:path';
import { UnifiedKnowledgeOrgan } from './unified-knowledge';

describe('UnifiedKnowledgeOrgan Unit Tests', () => {
  const testDbPath = path.resolve(__dirname, '../test-unified-knowledge.sqlite');

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  test('initializes LifeDatabase and queries life context successfully', async () => {
    const organ = new UnifiedKnowledgeOrgan({
      lifeDatabase: true,
      dbPath: testDbPath,
    });

    // Seed some inventory
    await organ.inventory.saveItem({
      id: 'inv-1',
      companionId: 'test-comp',
      entityName: 'Furina',
      domain: 'game_character',
      properties: { game: 'Genshin Impact', element: 'Hydro' },
      updatedAt: new Date().toISOString(),
    });

    const context = await organ.queryContext('test-comp', 'Furina');
    expect(context).toHaveLength(1);
    expect(context[0]).toContain('Furina (game_character)');

    organ.close();
  });

  test('gracefully returns empty array for search when no E-pack is configured', async () => {
    const organ = new UnifiedKnowledgeOrgan({
      lifeDatabase: true,
      dbPath: testDbPath,
    });

    const results = await organ.search('anything');
    expect(results).toEqual([]);

    organ.close();
  });
});
