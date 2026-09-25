import request from 'supertest';
import { createApp } from './app';
import { SiduriDatabase } from '@sidurijs/core';

describe('Conversations Persistence API (Multi-Machine Sync)', () => {
  let app: any;
  let db: SiduriDatabase;

  beforeEach(() => {
    db = new SiduriDatabase({ dbPath: ':memory:' });
    const fakeRuntime: any = {
      id: 'default',
      db,
    };
    const runtimes = new Map([['default', fakeRuntime]]);
    const created = createApp(runtimes);
    app = created.app;
  });

  test('GET /conversations returns empty array initially', async () => {
    const res = await request(app).get('/conversations');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('POST /conversations persists conversation and messages', async () => {
    const now = Date.now();
    const createRes = await request(app)
      .post('/conversations')
      .send({
        id: 'conv-101',
        title: 'First Chat',
        companionId: 'default',
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello from Machine A',
            createdAt: now,
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'Hello! I am Siduri',
            createdAt: now + 500,
            citations: [{ preview: 'citation 1' }],
          },
        ],
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body).toEqual({ success: true, id: 'conv-101' });

    // Retrieve via list
    const listRes = await request(app).get('/conversations');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe('conv-101');
    expect(listRes.body[0].title).toBe('First Chat');
    expect(listRes.body[0].messages).toHaveLength(2);
    expect(listRes.body[0].messages[0].content).toBe('Hello from Machine A');
    expect(listRes.body[0].messages[1].citations).toEqual([{ preview: 'citation 1' }]);

    // Retrieve via specific id
    const getRes = await request(app).get('/conversations/conv-101');
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe('conv-101');
    expect(getRes.body.messages).toHaveLength(2);

    // Delete conversation
    const deleteRes = await request(app).delete('/conversations/conv-101');
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({ success: true, id: 'conv-101' });

    const afterDeleteRes = await request(app).get('/conversations');
    expect(afterDeleteRes.body).toEqual([]);
  });

  test('GET /conversations/:id returns 404 for nonexistent conversation', async () => {
    const res = await request(app).get('/conversations/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Conversation not found');
  });
});
