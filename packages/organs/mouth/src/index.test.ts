import { DefaultMouthOrgan } from './index';
import { MouthUtterance, MouthChannel, ExperienceEvent } from '@siduri-x/core';

describe('@siduri-x/mouth - DefaultMouthOrgan', () => {
  const sampleUtterance: MouthUtterance = {
    utteranceId: 'utt-100',
    companionId: 'test-companion',
    responseId: 'resp-100',
    correlationId: 'corr-100',
    text: '**Hello** world! *This* is a test.',
    language: 'en',
    subtitleJa: 'こんにちは',
    subtitleEn: 'Hello world! This is a test.',
    spokenJa: 'こんにちは',
    expression: 'happy',
    medium: 'web',
    citations: [{ sourceId: 'src-1' }],
    evidenceIds: ['ev-1'],
  };

  test('constructs with defaults and formats web medium correctly', () => {
    const mouth = new DefaultMouthOrgan();
    const output = mouth.format(sampleUtterance);

    expect(output.medium).toBe('web');
    expect(output.text).toBe(sampleUtterance.text);
    expect(output.displayText).toBe(sampleUtterance.text);
    expect(output.expression).toBe('happy');
    expect(output.subtitles?.ja).toBe('こんにちは');
    expect(output.subtitles?.en).toBe('Hello world! This is a test.');
    expect(output.richContent?.markdown).toBe(true);
    expect(output.richContent?.citations).toHaveLength(1);
    expect(output.timestamp).toBeDefined();
  });

  test('coordinates with VoiceOrgan when speech is enqueued', async () => {
    const mockVoice = {
      enqueueSpeech: jest.fn().mockReturnValue('speech-abc-123'),
      onLifecycleEvent: jest.fn(),
      getQueueStatus: jest.fn().mockReturnValue({ pending: 0 }),
    };

    const mouth = new DefaultMouthOrgan({ voice: mockVoice as any });
    const result = await mouth.speak(sampleUtterance);

    expect(mockVoice.enqueueSpeech).toHaveBeenCalledWith('こんにちは', 'en');
    expect(result.audioUrl).toBe('/voice/stream?id=speech-abc-123');
  });

  test('manages channel registry and delivers to web channels', async () => {
    const deliveredWeb: any[] = [];

    const webChannel: MouthChannel = {
      id: 'ws-1',
      name: 'WebSocket Web Client',
      medium: 'web',
      deliver: jest.fn(async (out) => { deliveredWeb.push(out); }),
    };

    const mouth = new DefaultMouthOrgan({ channels: [webChannel] });
    expect(mouth.getRegisteredChannels()).toHaveLength(1);

    await mouth.speak(sampleUtterance);
    expect(webChannel.deliver).toHaveBeenCalledTimes(1);
    expect(deliveredWeb[0].medium).toBe('web');

    mouth.unregisterChannel('ws-1');
    expect(mouth.getRegisteredChannels()).toHaveLength(0);
  });

  test('broadcasts to registered channels', async () => {
    const delivered: string[] = [];

    const webChannel1: MouthChannel = {
      id: 'web-1',
      name: 'Main Web View',
      medium: 'web',
      deliver: jest.fn(async (out) => { delivered.push(out.medium); }),
    };

    const webChannel2: MouthChannel = {
      id: 'web-2',
      name: 'Secondary Web View',
      medium: 'web',
      deliver: jest.fn(async (out) => { delivered.push(out.medium); }),
    };

    const mouth = new DefaultMouthOrgan({ channels: [webChannel1, webChannel2] });
    const results = await mouth.broadcast(sampleUtterance);

    expect(results).toHaveLength(2);
    expect(delivered).toEqual(['web', 'web']);
  });

  test('streams delta tokens asynchronously', async () => {
    const mouth = new DefaultMouthOrgan();
    const chunks: string[] = [];

    for await (const chunk of mouth.stream(sampleUtterance)) {
      if (!chunk.isComplete) {
        chunks.push(chunk.deltaText);
      }
    }

    const reconstructed = chunks.join('');
    expect(reconstructed).toBe(sampleUtterance.text);
  });

  test('strictly bounds streaming text length to maxTextLength', async () => {
    const mouth = new DefaultMouthOrgan({ maxTextLength: 10 });
    const longUtterance: MouthUtterance = {
      ...sampleUtterance,
      text: 'This is a very long response text that exceeds 10 characters',
    };

    const chunks: string[] = [];
    for await (const chunk of mouth.stream(longUtterance)) {
      if (!chunk.isComplete) {
        chunks.push(chunk.deltaText);
      }
    }

    const reconstructed = chunks.join('');
    expect(reconstructed.length).toBeLessThanOrEqual(10);
  });

  test('implements ExperienceAdapter interface and handles events', async () => {
    const mouth = new DefaultMouthOrgan();
    const approvedEvent: ExperienceEvent = {
      eventId: 'evt-1',
      companionId: 'test-companion',
      responseId: 'resp-1',
      correlationId: 'corr-1',
      channel: 'direct',
      approval: 'APPROVED',
      kind: 'caption',
      lifecycle: 'STARTED',
      evidenceIds: [],
      text: 'Experience speech',
      language: 'en',
      createdAt: new Date().toISOString(),
    };

    const result = await mouth.handleEvent(approvedEvent);
    expect(result.accepted).toBe(true);
    expect(result.lifecycle).toBe('COMPLETED');

    const unapprovedEvent: ExperienceEvent = {
      ...approvedEvent,
      approval: 'REJECTED' as any,
    };
    const failResult = await mouth.handleEvent(unapprovedEvent);
    expect(failResult.accepted).toBe(false);
    expect(failResult.lifecycle).toBe('FAILED');
  });

  test('generates Live2D viseme cues and SSML formatting', () => {
    const mouth = new DefaultMouthOrgan();
    const output = mouth.format({
      ...sampleUtterance,
      expression: 'excited',
    });

    expect(output.ssml).toContain('<speak version="1.0"');
    expect(output.ssml).toContain('rate="fast"');
    expect(output.ssml).toContain('pitch="+5%"');
    expect(output.visemes).toBeDefined();
    expect(output.visemes!.length).toBeGreaterThan(0);

    const firstCue = output.visemes![0];
    expect(firstCue.timeMs).toBe(0);
    expect(firstCue.durationMs).toBeGreaterThan(0);
    expect(typeof firstCue.mouthOpenY).toBe('number');
  });

  test('BufferedMouthChannel captures deliveries, streams, and tracks interruptions', async () => {
    const { BufferedMouthChannel } = await import('./channels');
    const channel = new BufferedMouthChannel({ maxBufferSize: 10 });

    const mouth = new DefaultMouthOrgan({ channels: [channel] });
    await mouth.speak(sampleUtterance);

    expect(channel.getItems()).toHaveLength(1);
    expect(channel.getItems()[0].text).toBe(sampleUtterance.text);

    await channel.deliverStream(mouth.stream(sampleUtterance));
    expect(channel.getStreamChunks().length).toBeGreaterThan(0);

    channel.interrupt('utt-100', 'User interrupted');
    expect(channel.isInterrupted('utt-100')).toBe(true);

    channel.clear();
    expect(channel.getItems()).toHaveLength(0);
    expect(channel.getStreamChunks()).toHaveLength(0);
  });

  test('EventEmitterMouthChannel emits lifecycle events', async () => {
    const { EventEmitterMouthChannel } = await import('./channels');
    const channel = new EventEmitterMouthChannel();
    const emittedOutputs: any[] = [];
    const emittedChunks: any[] = [];
    let completed = false;

    channel.on('output', (out) => emittedOutputs.push(out));
    channel.on('chunk', (chk) => emittedChunks.push(chk));
    channel.on('complete', () => { completed = true; });

    const mouth = new DefaultMouthOrgan({ channels: [channel] });
    await mouth.speak(sampleUtterance);
    expect(emittedOutputs).toHaveLength(1);

    await channel.deliverStream(mouth.stream(sampleUtterance));
    expect(emittedChunks.length).toBeGreaterThan(0);
    expect(completed).toBe(true);
  });

  test('handles stream interruption with AbortSignal', async () => {
    const mouth = new DefaultMouthOrgan();
    const abortController = new AbortController();

    const utteranceWithSignal: MouthUtterance = {
      ...sampleUtterance,
      utteranceId: 'utt-abort-test',
      signal: abortController.signal,
    };

    const chunks: any[] = [];
    abortController.abort('barge-in');

    for await (const chunk of mouth.stream(utteranceWithSignal)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.interrupted).toBe(true);
    expect(lastChunk.isComplete).toBe(true);
  });

  test('handles mouth.interrupt() correctly', async () => {
    const mouth = new DefaultMouthOrgan();
    const streamPromise = (async () => {
      const chunks: any[] = [];
      for await (const chunk of mouth.stream(sampleUtterance)) {
        chunks.push(chunk);
        mouth.interrupt('barge-in');
      }
      return chunks;
    })();

    const chunks = await streamPromise;
    expect(chunks.length).toBeGreaterThan(0);
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.interrupted).toBe(true);
  });
});
