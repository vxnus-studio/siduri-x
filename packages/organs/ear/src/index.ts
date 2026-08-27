import {
  EarOrgan,
  EarPerception,
  HardenedEarPerception,
  EarLimitsConfig,
  EarIngestOptions,
} from '@siduri-x/core';

export interface EarOrganConfig extends EarLimitsConfig {
  defaultSource?: string;
  transcriber?: (audio: Uint8Array, signal?: AbortSignal) => Promise<string>;
}

export function detectAudioSignature(bytes: Uint8Array): string | undefined {
  if (!bytes || bytes.length < 4) return undefined;

  // RIFF (WAV) - starts with 'RIFF' and at offset 8 has 'WAVE'
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
      return 'audio/wav';
    }
    return 'audio/wav';
  }

  // ID3 (MP3 with ID3 header) - starts with 'ID3'
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return 'audio/mpeg';
  }

  // MP3 Sync word (0xFF, 0xFB/0xF3/0xF2)
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }

  // OGG (OggS)
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return 'audio/ogg';
  }

  // FLAC (fLaC)
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return 'audio/flac';
  }

  // WebM / EBML (0x1A, 0x45, 0xDF, 0xA3)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'audio/webm';
  }

  return undefined;
}

export class DefaultEarOrgan implements EarOrgan {
  private readonly defaultSource: string;
  private readonly transcriber?: (audio: Uint8Array, signal?: AbortSignal) => Promise<string>;
  private readonly maxTextLength: number;
  private readonly maxAudioBytes: number;
  private readonly allowedAudioMimeTypes: string[];
  private readonly maxDurationSeconds: number;
  private readonly transcriptionTimeoutMs: number;

  constructor(config: EarOrganConfig = {}) {
    this.defaultSource = config.defaultSource || 'text_chat';
    this.transcriber = config.transcriber;
    this.maxTextLength = config.maxTextLength ?? 4000;
    this.maxAudioBytes = config.maxAudioBytes ?? 10 * 1024 * 1024; // 10MB default
    this.allowedAudioMimeTypes = config.allowedAudioMimeTypes ?? [
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/ogg',
      'audio/webm',
      'audio/flac',
    ];
    this.maxDurationSeconds = config.maxDurationSeconds ?? 300; // 5 mins
    this.transcriptionTimeoutMs = config.transcriptionTimeoutMs ?? 15_000;
  }

  async listen(
    source: string = this.defaultSource,
    payload: unknown,
    options?: EarIngestOptions
  ): Promise<HardenedEarPerception> {
    const id = `ear-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    const context = options?.context;

    // 1. Text payload validation & normalization
    if (typeof payload === 'string') {
      if (payload.length > this.maxTextLength) {
        throw new Error(
          `Ear text input exceeds maximum allowed length of ${this.maxTextLength} characters (received ${payload.length})`
        );
      }

      return {
        id,
        source: source || this.defaultSource,
        text: payload,
        timestamp,
        modality: 'text',
        rawConfidence: 1.0,
        metadata: {
          source: source || this.defaultSource,
          channel: context?.conversation.channel,
          actorId: context?.actor.actorId,
          sessionId: context?.actor.sessionId,
          correlationId: context?.conversation.correlationId,
          provenance: 'direct_input',
          byteSize: Buffer.byteLength(payload, 'utf8'),
        },
      };
    }

    // 2. Binary audio buffer validation & magic-byte signature inspection
    if (payload instanceof Uint8Array) {
      if (payload.byteLength > this.maxAudioBytes) {
        throw new Error(
          `Ear audio input exceeds maximum allowed size of ${this.maxAudioBytes} bytes (received ${payload.byteLength})`
        );
      }

      // Independently inspect audio signature
      const detectedMime = detectAudioSignature(payload);
      if (options?.mimeType) {
        const declaredMime = options.mimeType.toLowerCase();
        if (!this.allowedAudioMimeTypes.includes(declaredMime)) {
          throw new Error(
            `Ear audio input MIME type "${options.mimeType}" is not supported. Allowed: [${this.allowedAudioMimeTypes.join(', ')}]`
          );
        }
        if (detectedMime && !declaredMime.includes(detectedMime.replace('audio/', '')) && !detectedMime.includes(declaredMime.replace('audio/', ''))) {
          throw new Error(
            `Audio signature mismatch: declared MIME "${options.mimeType}" does not match detected format "${detectedMime}"`
          );
        }
      }

      if (options?.durationSeconds && options.durationSeconds > this.maxDurationSeconds) {
        throw new Error(
          `Ear audio duration ${options.durationSeconds}s exceeds limit of ${this.maxDurationSeconds}s`
        );
      }

      let transcribedText: string | undefined;
      let rawConfidence = 0.8;

      if (this.transcriber) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.transcriptionTimeoutMs);
          transcribedText = await this.transcriber(payload, controller.signal);
          clearTimeout(timeoutId);
          rawConfidence = 0.95;
        } catch (err: any) {
          transcribedText = undefined;
          rawConfidence = 0.0;
        }
      }

      return {
        id,
        source: source || 'microphone',
        audioBuffer: payload,
        text: transcribedText,
        timestamp,
        modality: 'audio',
        rawConfidence,
        metadata: {
          source: source || 'microphone',
          channel: context?.conversation.channel,
          actorId: context?.actor.actorId,
          sessionId: context?.actor.sessionId,
          correlationId: context?.conversation.correlationId,
          provenance: 'transcribed_audio',
          byteSize: payload.byteLength,
          declaredMimeType: options?.mimeType,
          verifiedMimeType: detectedMime,
          untrustedDurationSeconds: options?.durationSeconds,
        },
      };
    }

    // 3. Structured object payload validation
    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      const textVal = typeof obj.text === 'string' ? obj.text : undefined;

      if (textVal && textVal.length > this.maxTextLength) {
        throw new Error(
          `Ear text within payload exceeds limit of ${this.maxTextLength} characters (received ${textVal.length})`
        );
      }

      return {
        id,
        source,
        text: textVal,
        timestamp,
        modality: 'object',
        rawConfidence: 1.0,
        metadata: {
          source,
          channel: context?.conversation.channel,
          actorId: context?.actor.actorId,
          sessionId: context?.actor.sessionId,
          correlationId: context?.conversation.correlationId,
          provenance: 'structured_payload',
          ...obj,
        },
      };
    }

    // 4. Fallback/Null payload
    return {
      id,
      source,
      timestamp,
      modality: 'system',
      metadata: {
        source,
        channel: context?.conversation.channel,
        actorId: context?.actor.actorId,
        sessionId: context?.actor.sessionId,
        correlationId: context?.conversation.correlationId,
      },
    };
  }

  async transcribeAudio(audio: Uint8Array): Promise<string> {
    if (!this.transcriber) {
      throw new Error('No audio transcriber configured in Ear organ');
    }
    if (audio.byteLength > this.maxAudioBytes) {
      throw new Error(`Audio buffer size (${audio.byteLength} bytes) exceeds limit of ${this.maxAudioBytes}`);
    }
    return this.transcriber(audio);
  }
}
