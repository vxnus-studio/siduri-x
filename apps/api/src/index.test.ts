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
      expect.objectContaining({
        companionId: 'companion-a',
        conversation: expect.objectContaining({ channel: 'direct' }),
      }),
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
            correlationId: 'corr-route-1',
          },
        },
        message: 'Hello structured context',
        history: [],
      });

    expect(res.status).toBe(200);
    expect(fakeRuntime.handleUserMessage).toHaveBeenCalledWith(
      'Hello structured context',
      expect.objectContaining({
        companionId: 'companion-a',
        conversation: expect.objectContaining({ channel: 'public' }),
      }),
      []
    );
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

  test('streams response chunks via POST /chat/stream', async () => {
    fakeRuntime.mouth = {
      stream: async function* () {
        yield { utteranceId: 'utt-1', index: 1, deltaText: 'Hello', isComplete: false, medium: 'web' };
        yield { utteranceId: 'utt-1', index: 2, deltaText: ' world', isComplete: false, medium: 'web' };
        yield { utteranceId: 'utt-1', index: 3, deltaText: '', isComplete: true, medium: 'web' };
      },
    };

    const res = await request(app)
      .post('/chat/stream')
      .send({
        id: 'companion-a',
        message: 'Stream me',
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: staged');
    expect(res.text).toContain('event: chunk');
    expect(res.text).toContain('event: done');
  });

  test('handles barge-in interruption via POST /chat/interrupt', async () => {
    fakeRuntime.mouth = { interrupt: jest.fn() };

    const res = await request(app)
      .post('/chat/interrupt')
      .send({
        companionId: 'companion-a',
        reason: 'user_stop',
      });

    expect(res.status).toBe(200);
    expect(res.body.interrupted).toBe(true);
    expect(fakeRuntime.mouth.interrupt).toHaveBeenCalledWith('user_stop');
  });

  test('handles mouth interruption via POST /mouth/interrupt', async () => {
    fakeRuntime.mouth = { interrupt: jest.fn() };

    const res = await request(app)
      .post('/mouth/interrupt')
      .send({
        companionId: 'companion-a',
        reason: 'user_barge_in',
      });

    expect(res.status).toBe(200);
    expect(res.body.interrupted).toBe(true);
    expect(fakeRuntime.mouth.interrupt).toHaveBeenCalledWith('user_barge_in');
  });
});
