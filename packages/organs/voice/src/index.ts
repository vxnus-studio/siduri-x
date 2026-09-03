import { VoiceOrgan, AudioEvent, ExperienceAdapter, ExperienceEvent, ExperienceAdapterResult, validateExperienceEvent } from '@siduri-x/core';
import { Synthesizer, EdgeTtsSynthesizer, VoicevoxSynthesizer, PiperSynthesizer, KokoroSynthesizer, RvcPostProcessor } from './synthesizers';
import { RvcPostProcessorConfig } from './synthesizers/rvc';

export interface VoiceConfig {
  provider: 'voicevox' | 'edge-tts' | 'kokoro' | 'piper' | 'none';
  baseUrl?: string;
  speakerId?: number;
  maxQueueDepth?: number;
  timeoutMs?: number;
  maxTextLength?: number;
  maxResponseBytes?: number;
  rvc?: RvcPostProcessorConfig;
}

const DEFAULT_MAX_VOICE_BYTES = 10 * 1024 * 1024; // 10MB limit

interface SpeechJob {
  id: string;
  text: string;
  language: string;
  priority: number;
  sequence: number;
}

export class VoiceAdapter implements VoiceOrgan, ExperienceAdapter {
  readonly kind = 'voice' as const;
  private queue: SpeechJob[] = [];
  private sequenceCounter = 0;
  private currentJob: string | undefined;
  private isProcessing = false;
  private callbacks: ((event: AudioEvent) => void)[] = [];
  
  private readonly maxQueueDepth: number;
  private readonly timeoutMs: number;
  private readonly maxTextLength: number;
  private readonly maxResponseBytes: number;
  private synthesizer: Synthesizer | null = null;

  constructor(private config: VoiceConfig) {
    this.maxQueueDepth = config.maxQueueDepth ?? 50;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.maxTextLength = config.maxTextLength ?? 4000;
    this.maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_VOICE_BYTES;
    this.initSynthesizer();
  }

  private initSynthesizer() {
    if (this.config.provider === 'none') {
      this.synthesizer = null;
      return;
    }

    let baseSynth: Synthesizer;
    
    switch (this.config.provider) {
      case 'edge-tts':
        baseSynth = new EdgeTtsSynthesizer();
        break;
      case 'piper':
        baseSynth = new PiperSynthesizer();
        break;
      case 'kokoro':
        baseSynth = new KokoroSynthesizer();
        break;
      case 'voicevox':
      default:
        baseSynth = new VoicevoxSynthesizer(
          this.config.baseUrl || 'http://localhost:50021',
          this.config.speakerId || 1,
          this.timeoutMs,
          this.maxResponseBytes
        );
        break;
    }

    // Wrap with RVC if enabled
    if (this.config.rvc?.enabled) {
      this.synthesizer = new RvcPostProcessor(
        baseSynth,
        this.config.rvc,
        this.timeoutMs,
        this.maxResponseBytes
      );
    } else {
      this.synthesizer = baseSynth;
    }
  }

  async handleEvent(event: ExperienceEvent): Promise<ExperienceAdapterResult> {
    if (this.config.provider === 'none') {
      return { accepted: false, eventId: event.eventId, lifecycle: 'FAILED', reason: 'PROVIDER_NONE' };
    }

    const validation = validateExperienceEvent(event);
    if (!validation.valid) {
      return { accepted: false, eventId: event?.eventId || '', lifecycle: 'FAILED', error: validation.error, reason: 'INVALID_EVENT_ENVELOPE' };
    }

    if (event.kind !== 'voice') {
      return { accepted: false, eventId: event.eventId, lifecycle: 'FAILED', reason: 'INCOMPATIBLE_EVENT_KIND' };
    }

    if (event.approval !== 'APPROVED') {
      return { accepted: false, eventId: event.eventId, lifecycle: 'FAILED', reason: 'APPROVAL_REQUIRED' };
    }

    if (this.queue.length >= this.maxQueueDepth) {
      return { accepted: false, eventId: event.eventId, lifecycle: 'FAILED', reason: 'QUEUE_CAPACITY_EXCEEDED' };
    }

    const text = (event.text ?? '').slice(0, this.maxTextLength);
    const language = event.language ?? 'ja';
    const speechId = this.enqueueSpeech(text, language, 1);

    return { accepted: true, eventId: event.eventId, lifecycle: 'STARTED', metadata: { speechId } };
  }

  enqueueSpeech(text: string, language: string, priority: number = 0): string {
    const boundedText = (text || '').slice(0, this.maxTextLength);
    const id = `job_${Math.random().toString(36).substr(2, 9)}`;
    this.queue.push({ id, text: boundedText, language, priority, sequence: this.sequenceCounter++ });
    this.queue.sort((a, b) => a.priority !== b.priority ? b.priority - a.priority : a.sequence - b.sequence);
    this.processQueue();
    return id;
  }

  onLifecycleEvent(callback: (event: AudioEvent) => void): void {
    this.callbacks.push(callback);
  }

  getQueueStatus(): { pending: number; current?: string } {
    return { pending: this.queue.length, current: this.currentJob };
  }

  private emit(event: AudioEvent) {
    for (const cb of this.callbacks) {
      try { cb(event); } catch (e) {}
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0 || !this.synthesizer) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.currentJob = job.id;
      this.emit({ type: 'STARTED', speechId: job.id, text: job.text, language: job.language });

      try {
        const audioBuffer = await this.synthesizer.synthesize(job.text);
        this.emit({ type: 'COMPLETED', speechId: job.id, text: job.text, language: job.language, audioBuffer });
      } catch (error) {
        this.emit({ type: 'FAILED', speechId: job.id, text: job.text, language: job.language });
      }
      this.currentJob = undefined;
    }

    this.isProcessing = false;
  }
}
