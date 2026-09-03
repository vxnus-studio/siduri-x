import { VoiceAdapter } from './index';

// Mock fetch globally
global.fetch = jest.fn();

describe('VoiceAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('queue and synthesis works', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ mock: 'query' })
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        arrayBuffer: async () => new ArrayBuffer(8)
      });

    const adapter = new VoiceAdapter({
      provider: 'voicevox',
      baseUrl: 'http://localhost:50021',
      speakerId: 1
    });

    const events: any[] = [];
    adapter.onLifecycleEvent((e) => events.push(e));

    const id = adapter.enqueueSpeech('hello', 'ja');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].type).toBe('COMPLETED');
  });

  test('synthesize chains RVC post-processing when configured', async () => {
    // 1. audio_query
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ mock: 'query' })
    });
    // 2. synthesis (Voicevox base)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Map(),
      arrayBuffer: async () => new ArrayBuffer(8)
    });
    // 3. convert (RVC)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Map(),
      arrayBuffer: async () => new ArrayBuffer(16)
    });

    const adapter = new VoiceAdapter({
      provider: 'voicevox',
      baseUrl: 'http://localhost:50021',
      speakerId: 1,
      rvc: {
        enabled: true,
        serviceUrl: 'http://localhost:50055',
        modelName: 'test',
      }
    });

    const events: any[] = [];
    adapter.onLifecycleEvent((e) => events.push(e));
    adapter.enqueueSpeech('Hello with RVC', 'ja');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const rvcCall = (global.fetch as jest.Mock).mock.calls[2];
    expect(rvcCall[0]).toBe("http://localhost:50055/convert");
  });
});
