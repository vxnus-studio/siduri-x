import { EarOrgan, EarPerception } from '@siduri-y/core';

export interface EarOrganConfig {
  defaultSource?: string;
  transcriber?: (audio: Uint8Array) => Promise<string>;
}

export class DefaultEarOrgan implements EarOrgan {
  private readonly defaultSource: string;
  private readonly transcriber?: (audio: Uint8Array) => Promise<string>;

  constructor(config: EarOrganConfig = {}) {
    this.defaultSource = config.defaultSource || 'text_chat';
    this.transcriber = config.transcriber;
  }

  async listen(source: string = this.defaultSource, payload: unknown): Promise<EarPerception> {
    const id = `ear-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    if (typeof payload === 'string') {
      return {
        id,
        source,
        text: payload,
        timestamp,
      };
    }

    if (payload instanceof Uint8Array) {
      let transcribedText: string | undefined;
      if (this.transcriber) {
        try {
          transcribedText = await this.transcriber(payload);
        } catch {
          transcribedText = undefined;
        }
      }
      return {
        id,
        source: source || 'microphone',
        audioBuffer: payload,
        text: transcribedText,
        timestamp,
      };
    }

    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      return {
        id,
        source,
        text: typeof obj.text === 'string' ? obj.text : undefined,
        metadata: obj,
        timestamp,
      };
    }

    return {
      id,
      source,
      timestamp,
    };
  }

  async transcribeAudio(audio: Uint8Array): Promise<string> {
    if (!this.transcriber) {
      throw new Error('No audio transcriber configured in Ear organ');
    }
    return this.transcriber(audio);
  }
}
