import { Synthesizer, readBoundedResponseBody, DEFAULT_MAX_VOICE_BYTES } from './synthesizer';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, unlink } from 'node:fs/promises';

export interface KokoroSynthesizerConfig {
  baseUrl?: string;
  voice?: string;
  speed?: number;
  timeoutMs?: number;
  maxResponseBytes?: number;
  cliBinary?: string;
}

export class KokoroSynthesizer implements Synthesizer {
  private baseUrl?: string;
  private voice: string;
  private speed: number;
  private timeoutMs: number;
  private maxResponseBytes: number;
  private cliBinary: string;

  constructor(config: KokoroSynthesizerConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.KOKORO_BASE_URL;
    this.voice = config.voice || 'af_bella';
    this.speed = config.speed ?? 1.0;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_VOICE_BYTES;
    this.cliBinary = config.cliBinary || process.env.KOKORO_CLI_PATH || 'kokoro-tts';
  }

  async synthesize(text: string): Promise<Uint8Array> {
    if (!text || text.trim().length === 0) {
      return new Uint8Array(0);
    }

    if (this.baseUrl) {
      return this.synthesizeHttp(text);
    }

    return this.synthesizeCli(text);
  }

  private async synthesizeHttp(text: string): Promise<Uint8Array> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = new URL('/v1/audio/speech', this.baseUrl);
      const res = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/wav, audio/mpeg, application/octet-stream',
        },
        body: JSON.stringify({
          input: text,
          voice: this.voice,
          speed: this.speed,
          response_format: 'wav',
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Kokoro HTTP synthesis failed: ${res.status} ${res.statusText}`);
      }

      return await readBoundedResponseBody(res as any, this.maxResponseBytes);
    } finally {
      clearTimeout(timer);
    }
  }

  private async synthesizeCli(text: string): Promise<Uint8Array> {
    const id = Math.random().toString(36).substring(2, 15);
    const outputFile = join(tmpdir(), `kokoro-${id}.wav`);

    return new Promise<Uint8Array>((resolve, reject) => {
      let child: any;
      const timer = setTimeout(() => {
        if (child) child.kill('SIGKILL');
        reject(new Error(`Kokoro CLI synthesis timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      const args = [
        '--voice', this.voice,
        '--speed', String(this.speed),
        '--output', outputFile,
        text,
      ];

      try {
        child = spawn(this.cliBinary, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err: any) {
        clearTimeout(timer);
        return reject(new Error(`Failed to spawn Kokoro CLI ('${this.cliBinary}'): ${err.message}. Please install 'kokoro-tts' or configure 'baseUrl' (e.g. http://localhost:8880) to use an HTTP speech server.`));
      }

      let stderr = '';
      child.stderr?.on('data', (chunk: any) => {
        stderr += chunk.toString();
      });

      child.on('error', (err: any) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn Kokoro CLI ('${this.cliBinary}'): ${err.message}. Please install 'kokoro-tts' or configure 'baseUrl' (e.g. http://localhost:8880) to use an HTTP speech server.`));
      });

      child.on('close', async (code: number | null) => {
        clearTimeout(timer);
        if (code !== 0) {
          await unlink(outputFile).catch(() => {});
          return reject(new Error(`Kokoro CLI exited with code ${code}: ${stderr.trim()}`));
        }

        try {
          const buffer = await readFile(outputFile);
          if (buffer.byteLength > this.maxResponseBytes) {
            throw new Error(`Kokoro output exceeds limit of ${this.maxResponseBytes} bytes`);
          }
          resolve(new Uint8Array(buffer));
        } catch (readErr) {
          reject(readErr);
        } finally {
          await unlink(outputFile).catch(() => {});
        }
      });
    });
  }
}
