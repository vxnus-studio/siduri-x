import { Synthesizer } from './synthesizer';

export class KokoroSynthesizer implements Synthesizer {
  async synthesize(text: string): Promise<Uint8Array> {
    throw new Error('KokoroSynthesizer is not yet fully implemented in this phase. Please use edge-tts or voicevox.');
  }
}
