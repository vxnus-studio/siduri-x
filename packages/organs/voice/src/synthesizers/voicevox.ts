import { Synthesizer, readBoundedResponseBody } from './synthesizer';

export class VoicevoxSynthesizer implements Synthesizer {
  constructor(
    private baseUrl: string, 
    private speakerId: number, 
    private timeoutMs: number, 
    private maxResponseBytes: number
  ) {}

  async synthesize(text: string): Promise<Uint8Array> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const queryUrl = new URL('/audio_query', this.baseUrl);
      queryUrl.searchParams.set('text', text);
      queryUrl.searchParams.set('speaker', this.speakerId.toString());

      const queryResponse = await fetch(queryUrl.toString(), {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      if (!queryResponse.ok) {
        throw new Error(`Voicevox audio_query failed: ${queryResponse.statusText}`);
      }

      const queryJson = await queryResponse.json();

      const synthUrl = new URL('/synthesis', this.baseUrl);
      synthUrl.searchParams.set('speaker', this.speakerId.toString());

      const synthResponse = await fetch(synthUrl.toString(), {
        method: 'POST',
        headers: {
          'Accept': 'audio/wav',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryJson),
        signal: controller.signal,
      });

      if (!synthResponse.ok) {
        throw new Error(`Voicevox synthesis failed: ${synthResponse.statusText}`);
      }

      return await readBoundedResponseBody(synthResponse, this.maxResponseBytes);
    } finally {
      clearTimeout(timer);
    }
  }
}
