import { VoiceAdapter } from './index';

// Mock fetch globally
global.fetch = jest.fn();

// Mock EngineManager
jest.mock('./engine-manager', () => {
  return {
    VoicevoxEngineManager: jest.fn().mockImplementation(() => {
      return {
        ensureInstalled: jest.fn().mockResolvedValue('/mock/path/run'),
        startEngine: jest.fn().mockResolvedValue(undefined),
        stopEngine: jest.fn()
      };
    })
  };
});

describe('VoiceAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('queue and synthesis works', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
      }) // Mock the ensureEngineRunning fetch check (ok = true avoids download mock calls)
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
    // 1. health check
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    // 2. audio_query
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ mock: 'query' })
    });
    // 3. synthesis (Voicevox base)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Map(),
      arrayBuffer: async () => new ArrayBuffer(8)
    });
    // 4. convert (RVC)
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

    const rvcCall = (global.fetch as jest.Mock).mock.calls[3];
    expect(rvcCall[0]).toBe("http://localhost:50055/convert");
  });

  test('synthesizes speech using Kokoro HTTP provider', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Map(),
      arrayBuffer: async () => new ArrayBuffer(24),
    });

    const adapter = new VoiceAdapter({
      provider: 'kokoro',
      baseUrl: 'http://localhost:8880',
      voice: 'af_heart',
      speed: 1.1,
    });

    const events: any[] = [];
    adapter.onLifecycleEvent((e) => events.push(e));

    adapter.enqueueSpeech('Hello Kokoro', 'en');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].type).toBe('COMPLETED');
    expect(events[events.length - 1].audioBuffer?.byteLength).toBe(24);

    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('http://localhost:8880/v1/audio/speech');
    const body = JSON.parse(call[1].body);
    expect(body.input).toBe('Hello Kokoro');
    expect(body.voice).toBe('af_heart');
    expect(body.speed).toBe(1.1);
  });

  test('synthesizes speech using Piper HTTP provider', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Map(),
      arrayBuffer: async () => new ArrayBuffer(32),
    });

    const adapter = new VoiceAdapter({
      provider: 'piper',
      baseUrl: 'http://localhost:5000',
      model: 'en_US-lessac-medium',
      speakerId: 0,
      lengthScale: 1.05,
    });

    const events: any[] = [];
    adapter.onLifecycleEvent((e) => events.push(e));

    adapter.enqueueSpeech('Hello Piper', 'en');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].type).toBe('COMPLETED');
    expect(events[events.length - 1].audioBuffer?.byteLength).toBe(32);

    const call = (global.fetch as jest.Mock).mock.calls[0];
    const url = new URL(call[0]);
    expect(url.origin).toBe('http://localhost:5000');
    expect(url.pathname).toBe('/api/tts');
    expect(url.searchParams.get('text')).toBe('Hello Piper');
    expect(url.searchParams.get('model')).toBe('en_US-lessac-medium');
    expect(url.searchParams.get('speaker_id')).toBe('0');
    expect(url.searchParams.get('length_scale')).toBe('1.05');
  });
});
