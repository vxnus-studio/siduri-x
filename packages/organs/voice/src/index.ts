import { VoiceOrgan, AudioEvent, ExperienceAdapter, ExperienceEvent, ExperienceAdapterResult, validateExperienceEvent } from '@siduri-x/core';

export interface RvcPostProcessorConfig {
  enabled?: boolean;
  serviceUrl?: string;
  modelName?: string;
  modelPath?: string;
  indexPath?: string;
  pitchShift?: number;
  f0Method?: 'rmvpe' | 'pm' | 'harvest' | 'crepe';
  indexRate?: number;
  filterRadius?: number;
  protect?: number;
}

export interface VoicevoxConfig {
  baseUrl: string;
  speakerId: number;
  maxQueueDepth?: number;
  timeoutMs?: number;
  maxTextLength?: number;
  rvc?: RvcPostProcessorConfig;
}

interface SpeechJob {
  id: string;
  text: string;
  language: string;
  priority: number;
  sequence: number;
}

export class VoicevoxAdapter implements VoiceOrgan, ExperienceAdapter {
  readonly kind = 'voice' as const;
  private queue: SpeechJob[] = [];
  private sequenceCounter = 0;
  private currentJob: string | undefined;
  private isProcessing = false;
  private callbacks: ((event: AudioEvent) => void)[] = [];
  private readonly maxQueueDepth: number;
  private readonly timeoutMs: number;
  private readonly maxTextLength: number;

  constructor(private config: VoicevoxConfig) {
    this.maxQueueDepth = config.maxQueueDepth ?? 50;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.maxTextLength = config.maxTextLength ?? 4000;
  }

  async handleEvent(event: ExperienceEvent): Promise<ExperienceAdapterResult> {
    const validation = validateExperienceEvent(event);
    if (!validation.valid) {
      return {
        accepted: false,
        eventId: event?.eventId || '',
        lifecycle: 'FAILED',
        error: validation.error,
        reason: 'INVALID_EVENT_ENVELOPE',
      };
    }

    if (event.kind !== 'voice') {
      return {
        accepted: false,
        eventId: event.eventId,
        lifecycle: 'FAILED',
        error: `Voice adapter received incompatible event kind: ${event.kind}`,
        reason: 'INCOMPATIBLE_EVENT_KIND',
      };
    }

    if (event.approval !== 'APPROVED') {
      return {
        accepted: false,
        eventId: event.eventId,
        lifecycle: 'FAILED',
        error: 'Event is not APPROVED',
        reason: 'APPROVAL_REQUIRED',
      };
    }

    if (this.queue.length >= this.maxQueueDepth) {
      return {
        accepted: false,
        eventId: event.eventId,
        lifecycle: 'FAILED',
        error: `Voice queue capacity exceeded (current depth: ${this.queue.length}, max: ${this.maxQueueDepth})`,
        reason: 'QUEUE_CAPACITY_EXCEEDED',
      };
    }

    const text = (event.text ?? '').slice(0, this.maxTextLength);
    const language = event.language ?? 'ja';
    const speechId = this.enqueueSpeech(text, language, 1);

    return {
      accepted: true,
      eventId: event.eventId,
      lifecycle: 'STARTED',
      metadata: {
        speechId,
        companionId: event.companionId,
        correlationId: event.correlationId,
      },
    };
  }

  enqueueSpeech(text: string, language: string, priority: number = 0): string {
    if (this.queue.length >= this.maxQueueDepth) {
      throw new Error(`Voice queue capacity exceeded (current depth: ${this.queue.length}, max: ${this.maxQueueDepth})`);
    }

    const boundedText = (text || '').slice(0, this.maxTextLength);
    const id = `job_${Math.random().toString(36).substr(2, 9)}`;
    this.queue.push({
      id,
      text: boundedText,
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // 1. /audio_query
      const queryUrl = new URL('/audio_query', this.config.baseUrl);
      queryUrl.searchParams.set('text', text);
      queryUrl.searchParams.set('speaker', this.config.speakerId.toString());

      const queryResponse = await fetch(queryUrl.toString(), {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
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
        body: JSON.stringify(queryJson),
        signal: controller.signal,
      });

      if (!synthResponse.ok) {
        throw new Error(`Voicevox synthesis failed: ${synthResponse.statusText}`);
      }

      const buffer = await synthResponse.arrayBuffer();
      const rawWav = new Uint8Array(buffer);

      if (this.config.rvc?.enabled && (this.config.rvc?.serviceUrl || process.env.RVC_SERVICE_URL || this.config.rvc?.modelName || this.config.rvc?.modelPath)) {
        return await this.applyRvc(rawWav);
      }

      return rawWav;
    } finally {
      clearTimeout(timer);
    }
  }

  async applyRvc(inputWav: Uint8Array): Promise<Uint8Array> {
    const rvcConfig = this.config.rvc || {};
    const serviceUrl = rvcConfig.serviceUrl || process.env.RVC_SERVICE_URL || 'http://localhost:50055';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const formData = new FormData();
      const blob = new Blob([inputWav.buffer as ArrayBuffer], { type: 'audio/wav' });
      formData.append('audio', blob, 'input.wav');
      if (rvcConfig.modelName) formData.append('model', rvcConfig.modelName);
      if (rvcConfig.modelPath) formData.append('model_path', rvcConfig.modelPath);
      if (rvcConfig.indexPath) formData.append('index_path', rvcConfig.indexPath);
      formData.append('pitch_shift', String(rvcConfig.pitchShift ?? 0));
      formData.append('f0_method', rvcConfig.f0Method ?? 'rmvpe');
      formData.append('index_rate', String(rvcConfig.indexRate ?? 0.75));

      const convertUrl = new URL('/convert', serviceUrl);
      const res = await fetch(convertUrl.toString(), {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn(`[VoicevoxAdapter] RVC conversion failed (${res.status}): fallback to base audio.`);
        return inputWav;
      }

      const convertedBuffer = await res.arrayBuffer();
      return new Uint8Array(convertedBuffer);
    } catch (e: any) {
      console.warn(`[VoicevoxAdapter] RVC service error (${e.message}): fallback to base audio.`);
      return inputWav;
    } finally {
      clearTimeout(timer);
    }
  }
}
