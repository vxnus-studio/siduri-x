import request from 'supertest';
import { createApp } from './app';

describe('API Boundary Context Validation (P2 Route Integration)', () => {
  const fakeRuntime: any = {
    handleUserMessage: jest.fn().mockResolvedValue({
      response: { subtitle_en: 'Hello there' },
      metadata: {},
    }),
  };

  let app: any;
  let runtimes: Map<string, any>;

  beforeEach(() => {
    runtimes = new Map([['companion-a', fakeRuntime]]);
    const created = createApp(runtimes);
    app = created.app;
    fakeRuntime.handleUserMessage.mockClear();
  });

  test('accepts valid anonymous chat request and maps through API boundary', async () => {
    const res = await request(app)
      .post('/chat')
      .send({
        id: 'companion-a',
        message: 'Hello neutral world',
        history: [],
      });

    expect(res.status).toBe(200);
    expect(fakeRuntime.handleUserMessage).toHaveBeenCalledWith(
      'Hello neutral world',
      'VIEWER',
      []
    );
  });

  test('accepts neutral context chat envelope at /chat route', async () => {
    const res = await request(app)
      .post('/chat')
      .send({
        companionId: 'companion-a',
        context: {
          actor: {
            actorId: 'actor-a',
            sessionId: 'session-a',
            authorizationRole: 'viewer',
            capabilities: ['chat:public'],
            authenticated: false,
          },
          conversation: {
            channel: 'public',
            audienceId: 'audience-public',
            correlationId: 'corr-route-1',
          },
        },
        message: 'Hello structured context',
        history: [],
      });

    expect(res.status).toBe(200);
    expect(fakeRuntime.handleUserMessage).toHaveBeenCalledWith(
      'Hello structured context',
      'VIEWER',
      []
    );
  });

  test('rejects MASTER_PRIVATE in public request with 400 and structured error', async () => {
    const res = await request(app)
      .post('/chat')
      .send({
        companionId: 'companion-a',
        context: {
          actor: {
            actorId: 'actor-a',
            sessionId: 'session-a',
            authorizationRole: 'viewer',
            capabilities: ['chat:public'],
            authenticated: false,
          },
          conversation: {
            channel: 'public',
            audienceId: 'MASTER_PRIVATE',
            correlationId: 'corr-err-1',
          },
        },
        message: 'Forbidden audience test',
      });

    expect(res.status).toBe(400);
    expect(res.body.accepted).toBe(false);
    expect(res.body.error.code).toBe('LEGACY_PERSONAL_AUDIENCE');
    expect(fakeRuntime.handleUserMessage).not.toHaveBeenCalled();
  });

  test('rejects global primary_user subject with 400 and structured error', async () => {
    const res = await request(app)
      .post('/chat')
      .send({
        companionId: 'companion-a',
        context: {
          actor: {
            actorId: 'actor-a',
            sessionId: 'session-a',
            authorizationRole: 'viewer',
            capabilities: ['chat:public'],
            authenticated: true,
          },
          conversation: {
            channel: 'public',
            audienceId: 'audience-public',
            correlationId: 'corr-err-2',
          },
          subject: {
            subjectId: 'primary_user',
            kind: 'actor',
          },
        },
        message: 'Forbidden primary user test',
      });

    expect(res.status).toBe(400);
    expect(res.body.accepted).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN_CONTEXT');
    expect(fakeRuntime.handleUserMessage).not.toHaveBeenCalled();
  });
});
