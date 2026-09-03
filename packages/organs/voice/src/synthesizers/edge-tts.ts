import { EdgeTTS } from 'node-edge-tts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, unlink } from 'node:fs/promises';
import { Synthesizer } from './synthesizer';

export class EdgeTtsSynthesizer implements Synthesizer {
  private tts: EdgeTTS;

  constructor(voice: string = 'ja-JP-NanamiNeural') {
    this.tts = new EdgeTTS({
      voice,
    });
  }

  async synthesize(text: string): Promise<Uint8Array> {
    const id = Math.random().toString(36).substring(2, 15);
    const tmpFile = join(tmpdir(), `edge-tts-${id}.mp3`);
    
    try {
      await this.tts.ttsPromise(text, tmpFile);
      const buffer = await readFile(tmpFile);
      return new Uint8Array(buffer);
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  }
}
