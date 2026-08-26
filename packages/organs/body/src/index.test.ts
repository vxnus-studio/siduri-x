import { createVtsRequest, Live2DAdapter } from './index';
import WebSocket from 'ws';

describe('Live2DAdapter', () => {
  let adapter: Live2DAdapter;
  const port = 8089; // Use a specific port for testing

  beforeEach(() => {
    adapter = new Live2DAdapter({ port });
  });

  afterEach(() => {
    adapter.cleanup();
  });

  test('builds VTube Studio API requests', () => {
    expect(createVtsRequest('HotkeyTriggerRequest', { hotkeyID: 'happy' })).toMatchObject({
      apiName: 'VTubeStudioPublicAPI',
      apiVersion: '1.0',
      messageType: 'HotkeyTriggerRequest',
      data: { hotkeyID: 'happy' },
    });
  });

  test('tracks state correctly', () => {
    expect(adapter.currentExpression).toBe('neutral');
    expect(adapter.state).toBe('idle');

    adapter.setExpression('happy');
    expect(adapter.currentExpression).toBe('happy');

    adapter.speak('job_123');
    expect(adapter.lastSpeechId).toBe('job_123');
    expect(adapter.state).toBe('speaking');

    adapter.act('wave');
    expect(adapter.lastAction).toBe('wave');
    expect(adapter.state).toBe('acting');

    adapter.completeAction();
    expect(adapter.state).toBe('idle');
  });

  test('broadcasts events to connected websocket clients', (done) => {
    const client = new WebSocket(`ws://localhost:${port}`);
    const messages: any[] = [];

    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.length === 3) {
        // 1st is lifecycle (connected)
        expect(messages[0].type).toBe('lifecycle');
        expect(messages[0].event).toBe('connected');

        // 2nd is expression
        expect(messages[1].type).toBe('expression');
        expect(messages[1].expression).toBe('sad');

        // 3rd is speech
        expect(messages[2].type).toBe('speech');
        expect(messages[2].speechId).toBe('job_999');

        client.close();
        done();
      }
    });

    client.on('open', () => {
      // Simulate actions
      adapter.setExpression('sad');
      adapter.speak('job_999');
    });
  });
});

describe('Live2DAdapter T5 Experience Event Interface', () => {
  let adapter: Live2DAdapter;

  beforeEach(() => {
    adapter = new Live2DAdapter({ port: 8092 });
  });

  afterEach(() => {
    adapter.cleanup();
  });

  test('handleEvent processes valid approved avatar event', async () => {
    const res = await adapter.handleEvent({
      eventId: 'evt-avatar-1',
      companionId: 'companion-a',
      responseId: 'resp-1',
      correlationId: 'corr-1',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'APPROVED',
      kind: 'avatar',
      lifecycle: 'STARTED',
      evidenceIds: [],
      expression: 'happy',
      action: 'wave',
      createdAt: new Date().toISOString(),
    });

    expect(res.accepted).toBe(true);
    expect(res.lifecycle).toBe('STARTED');
    expect(adapter.currentExpression).toBe('happy');
    expect(adapter.lastAction).toBe('wave');
  });

  test('handleEvent rejects unapproved event or incompatible kind', async () => {
    const unapprovedRes = await adapter.handleEvent({
      eventId: 'evt-avatar-2',
      companionId: 'companion-a',
      responseId: 'resp-1',
      correlationId: 'corr-1',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'STAGED' as any,
      kind: 'avatar',
      lifecycle: 'STARTED',
      evidenceIds: [],
      createdAt: new Date().toISOString(),
    });
    expect(unapprovedRes.accepted).toBe(false);

    const incompatibleRes = await adapter.handleEvent({
      eventId: 'evt-avatar-3',
      companionId: 'companion-a',
      responseId: 'resp-1',
      correlationId: 'corr-1',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'APPROVED',
      kind: 'voice',
      lifecycle: 'STARTED',
      evidenceIds: [],
      createdAt: new Date().toISOString(),
    });
    expect(incompatibleRes.accepted).toBe(false);
    expect(incompatibleRes.reason).toBe('INCOMPATIBLE_EVENT_KIND');
  });
});
