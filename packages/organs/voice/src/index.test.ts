import { VoicevoxAdapter } from './index';

// Mock fetch
global.fetch = jest.fn();

describe('VoicevoxAdapter Queue Semantics', () => {
  let adapter: VoicevoxAdapter;

  beforeEach(() => {
    adapter = new VoicevoxAdapter({ baseUrl: 'http://localhost:50021', speakerId: 1 });
    (global.fetch as jest.Mock).mockClear();
  });

  test('queue preserves priority and sequence ordering', async () => {
    // We want to stop processQueue from consuming everything instantly so we can inspect it.
    // Let's mock synthesize to never resolve immediately, or just inspect the queue property.
    (adapter as any).isProcessing = true; // Block processing

    adapter.enqueueSpeech("Low 1", "en", 0);
    adapter.enqueueSpeech("High 1", "en", 100);
    adapter.enqueueSpeech("Low 2", "en", 0);
    adapter.enqueueSpeech("High 2", "en", 100);

    const queue = (adapter as any).queue;
    
    // High priority first, preserving insertion order among same priority
    expect(queue[0].text).toBe("High 1");
    expect(queue[1].text).toBe("High 2");
    expect(queue[2].text).toBe("Low 1");
    expect(queue[3].text).toBe("Low 2");
  });

  test('synthesize calls /audio_query and /synthesis', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ some: "query_data" })
    });
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    });

    const audio = await adapter.synthesize("Hello");
    expect(audio.length).toBe(8);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const [queryCall, synthCall] = (global.fetch as jest.Mock).mock.calls;
    expect(queryCall[0]).toContain("/audio_query?text=Hello&speaker=1");
    expect(synthCall[0]).toContain("/synthesis?speaker=1");
    expect(JSON.parse(synthCall[1].body).some).toBe("query_data");
  });

  test('synthesize chains RVC post-processing when configured', async () => {
    const rvcAdapter = new VoicevoxAdapter({
      baseUrl: 'http://localhost:50021',
      speakerId: 1,
      rvc: {
        enabled: true,
        serviceUrl: 'http://localhost:50055',
        modelName: 'sparkle',
      }
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ some: "query_data" })
    });
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16)
    });

    const audio = await rvcAdapter.synthesize("Hello with RVC");
    expect(audio.length).toBe(16);
    expect(global.fetch).toHaveBeenCalledTimes(3);

    const rvcCall = (global.fetch as jest.Mock).mock.calls[2];
    expect(rvcCall[0]).toBe("http://localhost:50055/convert");
  });
});

describe('VoicevoxAdapter T5 Experience Event Interface', () => {
  let adapter: VoicevoxAdapter;

  beforeEach(() => {
    adapter = new VoicevoxAdapter({ baseUrl: 'http://localhost:50021', speakerId: 1 });
  });

  test('handleEvent processes valid approved voice event', async () => {
    (adapter as any).isProcessing = true; // prevent live http calls
    const res = await adapter.handleEvent({
      eventId: 'evt-voice-1',
      companionId: 'companion-a',
      responseId: 'resp-1',
      correlationId: 'corr-1',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'APPROVED',
      kind: 'voice',
      lifecycle: 'STARTED',
      evidenceIds: [],
      text: 'Hello T5 voice',
      language: 'en',
      createdAt: new Date().toISOString(),
    });

    expect(res.accepted).toBe(true);
    expect(res.lifecycle).toBe('STARTED');
    expect(res.metadata?.speechId).toBeDefined();
  });

  test('handleEvent rejects unapproved event or incompatible kind', async () => {
    const unapprovedRes = await adapter.handleEvent({
      eventId: 'evt-voice-2',
      companionId: 'companion-a',
      responseId: 'resp-1',
      correlationId: 'corr-1',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'STAGED' as any,
      kind: 'voice',
      lifecycle: 'STARTED',
      evidenceIds: [],
      createdAt: new Date().toISOString(),
    });
    expect(unapprovedRes.accepted).toBe(false);

    const incompatibleRes = await adapter.handleEvent({
      eventId: 'evt-voice-3',
      companionId: 'companion-a',
      responseId: 'resp-1',
      correlationId: 'corr-1',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'APPROVED',
      kind: 'avatar',
      lifecycle: 'STARTED',
      evidenceIds: [],
      createdAt: new Date().toISOString(),
    });
    expect(incompatibleRes.accepted).toBe(false);
    expect(incompatibleRes.reason).toBe('INCOMPATIBLE_EVENT_KIND');
  });

  test('handleEvent enforces queue depth limits and applies backpressure', async () => {
    const smallQueueAdapter = new VoicevoxAdapter({
      baseUrl: 'http://localhost:50021',
      speakerId: 1,
      maxQueueDepth: 2,
    });
    (smallQueueAdapter as any).isProcessing = true; // hold queue

    // Fill queue to capacity
    smallQueueAdapter.enqueueSpeech('msg 1', 'en');
    smallQueueAdapter.enqueueSpeech('msg 2', 'en');

    // Attempting to enqueue when full via enqueueSpeech throws
    expect(() => smallQueueAdapter.enqueueSpeech('msg 3', 'en')).toThrow(/Voice queue capacity exceeded/);

    // Attempting via handleEvent returns structured failure with QUEUE_CAPACITY_EXCEEDED
    const eventRes = await smallQueueAdapter.handleEvent({
      eventId: 'evt-voice-overflow',
      companionId: 'companion-a',
      responseId: 'resp-1',
      correlationId: 'corr-1',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'APPROVED',
      kind: 'voice',
      lifecycle: 'STARTED',
      evidenceIds: [],
      text: 'overflow text',
      createdAt: new Date().toISOString(),
    });

    expect(eventRes.accepted).toBe(false);
    expect(eventRes.reason).toBe('QUEUE_CAPACITY_EXCEEDED');
  });

  test('synthesize rejects responses exceeding maxResponseBytes via Content-Length or stream read', async () => {
    const limitedAdapter = new VoicevoxAdapter({
      baseUrl: 'http://localhost:50021',
      speakerId: 1,
      maxResponseBytes: 1024, // 1KB limit for test
    });

    // 1. Content-Length header exceeding limit
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ some: "query_data" }),
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (h: string) => (h.toLowerCase() === 'content-length' ? '2048' : null),
      },
      arrayBuffer: async () => new ArrayBuffer(2048),
    });

    await expect(limitedAdapter.synthesize('hello')).rejects.toThrow(/exceeds limit/);

    // 2. Incremental stream body exceeding limit
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ some: "query_data" }),
    });

    const streamChunk = new Uint8Array(800);
    let chunksRead = 0;
    const mockReader = {
      read: jest.fn().mockImplementation(async () => {
        chunksRead++;
        if (chunksRead > 2) return { done: true, value: undefined };
        return { done: false, value: streamChunk };
      }),
      cancel: jest.fn(),
      releaseLock: jest.fn(),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => null, // No Content-Length
      },
      body: {
        getReader: () => mockReader,
      },
    });

    await expect(limitedAdapter.synthesize('hello stream')).rejects.toThrow(/stream exceeded maximum allowed size/);
    expect(mockReader.cancel).toHaveBeenCalled();
  });
});
