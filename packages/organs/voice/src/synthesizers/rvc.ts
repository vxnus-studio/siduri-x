import { Synthesizer, readBoundedResponseBody } from './synthesizer';

export interface RvcPostProcessorConfig {
  enabled?: boolean;
  serviceUrl?: string;
  modelName?: string;
  modelPath?: string;
  indexPath?: string;
  pitchShift?: number;
  f0Method?: 'rmvpe' | 'pm' | 'harvest' | 'crepe';
  indexRate?: number;
}

export class RvcPostProcessor implements Synthesizer {
  constructor(
    private baseSynthesizer: Synthesizer,
    private config: RvcPostProcessorConfig,
    private timeoutMs: number,
    private maxResponseBytes: number
  ) {}

  async synthesize(text: string): Promise<Uint8Array> {
    // 1. Generate base audio from the underlying TTS engine
    const baseWav = await this.baseSynthesizer.synthesize(text);

    // 2. If RVC is not enabled or lacks config, just return the base audio
    if (!this.config.enabled || (!this.config.serviceUrl && !process.env.RVC_SERVICE_URL && !this.config.modelName && !this.config.modelPath)) {
      return baseWav;
    }

    // 3. Apply RVC post-processing
    return await this.applyRvc(baseWav);
  }

  private async applyRvc(inputWav: Uint8Array): Promise<Uint8Array> {
    const serviceUrl = this.config.serviceUrl || process.env.RVC_SERVICE_URL || 'http://localhost:50055';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const formData = new FormData();
      const blob = new Blob([inputWav.buffer as ArrayBuffer], { type: 'audio/wav' });
      formData.append('audio', blob, 'input.wav');
      if (this.config.modelName) formData.append('model', this.config.modelName);
      if (this.config.modelPath) formData.append('model_path', this.config.modelPath);
      if (this.config.indexPath) formData.append('index_path', this.config.indexPath);
      formData.append('pitch_shift', String(this.config.pitchShift ?? 0));
      formData.append('f0_method', this.config.f0Method ?? 'rmvpe');
      formData.append('index_rate', String(this.config.indexRate ?? 0.75));

      const convertUrl = new URL('/convert', serviceUrl);
      const res = await fetch(convertUrl.toString(), {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn(`[RvcPostProcessor] RVC conversion failed (${res.status}): fallback to base audio.`);
        return inputWav;
      }

      return await readBoundedResponseBody(res, this.maxResponseBytes);
    } catch (e: any) {
      console.warn(`[RvcPostProcessor] RVC service error (${e.message}): fallback to base audio.`);
      return inputWav;
    } finally {
      clearTimeout(timer);
    }
  }
}
