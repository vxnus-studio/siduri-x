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
});
