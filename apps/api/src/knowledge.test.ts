import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { SiduriRuntime } from './runtime';
import { UnifiedKnowledgeOrgan } from '@siduri-x/knowledge';

describe('Life Database & UnifiedKnowledgeOrgan API Integration', () => {
  const testDbPath = path.resolve(__dirname, '../test-api-knowledge.sqlite');
  let app: any;
  let runtime: SiduriRuntime;
  let knowledge: UnifiedKnowledgeOrgan;
  const mockAuthHeader = { 'Authorization': 'Bearer test-token' };

  const cleanDb = () => {
    for (const file of [testDbPath, `${testDbPath}-shm`, `${testDbPath}-wal`]) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch {}
      }
    }
  };

  beforeAll(async () => {
    process.env.AUTH_TOKEN = 'test-token';
    cleanDb();

    knowledge = new UnifiedKnowledgeOrgan({
      lifeDatabase: true,
      dbPath: testDbPath,
    });

    const mockBrain: any = {
      generatePlan: jest.fn().mockImplementation(async (ctx: any) => {
        return {
          speech: `I see context: ${ctx.contextPrompt || 'none'}`,
          language: 'en',
        };
      }),
    };

    runtime = new SiduriRuntime(
      'test-comp',
      { name: 'Test Companion', organs: { knowledge: { provider: 'unified', dbPath: testDbPath } } } as any,
      {
        brain: mockBrain,
        knowledge,
        externalKnowledge: knowledge.eAdapter ?? knowledge,
      }
    );
    await runtime.initialize();

    const runtimes = new Map([['test-comp', runtime]]);
    const instance = createApp(runtimes);
    app = instance.app;
  });

  afterAll(async () => {
    knowledge.close();
    delete process.env.AUTH_TOKEN;
    cleanDb();
  });

  test('seeds inventory item and queries via GET /knowledge/inventory', async () => {
    await knowledge.inventory.saveItem({
      id: 'inv-item-1',
      companionId: 'test-comp',
      entityName: 'Hydro Visor',
      domain: 'hardware',
      properties: { model: 'V1', resolution: '4K' },
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .get('/knowledge/inventory?id=test-comp')
      .set(mockAuthHeader);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].entityName).toBe('Hydro Visor');
    expect(res.body.items[0].domain).toBe('hardware');
  });

  test('seeds finance entry and queries via GET /knowledge/finance', async () => {
    await knowledge.finance.addEntry({
      id: 'fin-1',
      companionId: 'test-comp',
      category: 'subscription',
      amount: -15.99,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    });

    const res = await request(app)
      .get('/knowledge/finance?id=test-comp')
      .set(mockAuthHeader);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].category).toBe('subscription');
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totalExpenses).toBe(15.99);
  });

  test('queries life snapshot via GET /knowledge/life', async () => {
    const res = await request(app)
      .get('/knowledge/life?id=test-comp&q=Hydro')
      .set(mockAuthHeader);

    expect(res.status).toBe(200);
    expect(res.body.matchedInventory).toHaveLength(1);
    expect(res.body.matchedInventory[0].entityName).toBe('Hydro Visor');
    expect(res.body.formattedContext).toContain('<life_context>');
  });

  test('chat request triggers Stream D and injects Life DB context into cognition prompt', async () => {
    const res = await request(app)
      .post('/chat')
      .send({
        id: 'test-comp',
        message: 'Tell me about the Hydro Visor specs',
        history: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.response.subtitle_en).toContain('Hydro Visor');
  });

  test('boot endpoint instantiates UnifiedKnowledgeOrgan with Life DB enabled', async () => {
    const bootRes = await request(app)
      .post('/boot')
      .set(mockAuthHeader)
      .send({
        id: 'booted-comp',
        config: {
          name: 'Booted Companion',
          organs: {
            knowledge: {
              provider: 'unified',
              dbPath: testDbPath,
            },
          },
        },
      });

    expect(bootRes.status).toBe(200);
    expect(bootRes.body.success).toBe(true);

    // Verify the booted companion's knowledge organ is UnifiedKnowledgeOrgan with working Life DB
    const lifeRes = await request(app)
      .get('/knowledge/life?id=booted-comp')
      .set(mockAuthHeader);

    expect(lifeRes.status).toBe(200);
    expect(lifeRes.body.matchedInventory).toEqual([]);
  });
});
