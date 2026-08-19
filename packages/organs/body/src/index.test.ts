import { Live2DAdapter } from './index';
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
