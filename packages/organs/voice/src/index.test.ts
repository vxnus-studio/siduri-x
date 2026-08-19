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
