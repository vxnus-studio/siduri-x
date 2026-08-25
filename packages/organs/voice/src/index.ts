import { VoiceOrgan, AudioEvent } from '@siduri-y/core';

export interface VoicevoxConfig {
  baseUrl: string;
  speakerId: number;
}

interface SpeechJob {
  id: string;
  text: string;
  language: string;
  priority: number;
  sequence: number;
}

export class VoicevoxAdapter implements VoiceOrgan {
  private queue: SpeechJob[] = [];
  private sequenceCounter = 0;
  private currentJob: string | undefined;
  private isProcessing = false;
  private callbacks: ((event: AudioEvent) => void)[] = [];

  constructor(private config: VoicevoxConfig) {}

  enqueueSpeech(text: string, language: string, priority: number = 0): string {
    const id = `job_${Math.random().toString(36).substr(2, 9)}`;
    this.queue.push({
      id,
      text,
      language,
      priority,
      sequence: this.sequenceCounter++
    });

    // Sort: highest priority first, then lowest sequence
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.sequence - b.sequence;
    });

    this.processQueue();
    return id;
  }

  onLifecycleEvent(callback: (event: AudioEvent) => void): void {
    this.callbacks.push(callback);
  }

  getQueueStatus(): { pending: number; current?: string } {
    return {
      pending: this.queue.length,
      current: this.currentJob
    };
  }

  private emit(event: AudioEvent) {
    for (const cb of this.callbacks) {
      try { cb(event); } catch (e) {}
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.currentJob = job.id;

      this.emit({ type: 'STARTED', speechId: job.id, text: job.text, language: job.language });

      try {
        const audioBuffer = await this.synthesize(job.text);
        this.emit({ type: 'COMPLETED', speechId: job.id, text: job.text, language: job.language, audioBuffer });
      } catch (error) {
        this.emit({ type: 'FAILED', speechId: job.id, text: job.text, language: job.language });
      }

      this.currentJob = undefined;
    }

    this.isProcessing = false;
  }

  async synthesize(text: string): Promise<Uint8Array> {
    // 1. /audio_query
    const queryUrl = new URL('/audio_query', this.config.baseUrl);
    queryUrl.searchParams.set('text', text);
    queryUrl.searchParams.set('speaker', this.config.speakerId.toString());

    const queryResponse = await fetch(queryUrl.toString(), {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    });

    if (!queryResponse.ok) {
      throw new Error(`Voicevox audio_query failed: ${queryResponse.statusText}`);
    }

    const queryJson = await queryResponse.json();

    // 2. /synthesis
    const synthUrl = new URL('/synthesis', this.config.baseUrl);
    synthUrl.searchParams.set('speaker', this.config.speakerId.toString());

    const synthResponse = await fetch(synthUrl.toString(), {
      method: 'POST',
      headers: {
        'Accept': 'audio/wav',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queryJson)
    });

    if (!synthResponse.ok) {
      throw new Error(`Voicevox synthesis failed: ${synthResponse.statusText}`);
    }

    const buffer = await synthResponse.arrayBuffer();
    return new Uint8Array(buffer);
  }
}
