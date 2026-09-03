import { Synthesizer, readBoundedResponseBody } from './synthesizer';
import { VoicevoxEngineManager } from '../engine-manager';

export class VoicevoxSynthesizer implements Synthesizer {
  private manager?: VoicevoxEngineManager;
  private initPromise?: Promise<void>;

  constructor(
    private baseUrl: string, 
    private speakerId: number, 
    private timeoutMs: number, 
    private maxResponseBytes: number,
    private autoDownload: boolean = true
  ) {
    if (this.autoDownload) {
      this.manager = new VoicevoxEngineManager();
      this.initPromise = this.ensureEngineRunning();
    }
  }

  private async ensureEngineRunning() {
    try {
      // Check if it's already responding
      const res = await fetch(new URL('/version', this.baseUrl).toString(), { method: 'GET' });
      if (res.ok) {
        return;
      }
    } catch (e) {
      // expected if not running
    }

    if (this.manager) {
      console.log("[Voicevox] Engine not found on port. Ensuring local runtime is installed...");
      try {
        const exe = await this.manager.ensureInstalled((msg) => console.log(`[Voicevox] ${msg}`));
        const port = new URL(this.baseUrl).port || 50021;
        await this.manager.startEngine(exe, Number(port));
        console.log(`[Voicevox] Engine started successfully on port ${port}.`);
      } catch (e: any) {
        console.error(`[Voicevox] Failed to start local engine: ${e.message}`);
      }
    }
  }

  async synthesize(text: string): Promise<Uint8Array> {
    if (this.initPromise) {
      await this.initPromise;
    }

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

      return await readBoundedResponseBody(synthResponse as any, this.maxResponseBytes);
    } finally {
      clearTimeout(timer);
    }
  }
}
