import { Synthesizer } from './synthesizer';

export class PiperSynthesizer implements Synthesizer {
  async synthesize(text: string): Promise<Uint8Array> {
    throw new Error('PiperSynthesizer is not yet fully implemented in this phase. Please use edge-tts or voicevox.');
  }
}
