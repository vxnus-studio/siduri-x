import { Synthesizer, readBoundedResponseBody, DEFAULT_MAX_VOICE_BYTES } from './synthesizer';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, unlink } from 'node:fs/promises';

export interface PiperSynthesizerConfig {
  baseUrl?: string;
  model?: string;
  speakerId?: number;
  lengthScale?: number;
  timeoutMs?: number;
  maxResponseBytes?: number;
  cliBinary?: string;
}

export class PiperSynthesizer implements Synthesizer {
  private baseUrl?: string;
  private model?: string;
  private speakerId?: number;
  private lengthScale: number;
  private timeoutMs: number;
  private maxResponseBytes: number;
  private cliBinary: string;

  constructor(config: PiperSynthesizerConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.PIPER_BASE_URL;
    this.model = config.model || process.env.PIPER_MODEL_PATH;
    this.speakerId = config.speakerId;
    this.lengthScale = config.lengthScale ?? 1.0;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_VOICE_BYTES;
    this.cliBinary = config.cliBinary || process.env.PIPER_CLI_PATH || 'piper';
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
      const endpoint = new URL('/api/tts', this.baseUrl);
      endpoint.searchParams.set('text', text);
      if (this.speakerId !== undefined) {
        endpoint.searchParams.set('speaker_id', String(this.speakerId));
      }
      if (this.model) {
        endpoint.searchParams.set('model', this.model);
      }
      if (this.lengthScale !== 1.0) {
        endpoint.searchParams.set('length_scale', String(this.lengthScale));
      }

      const res = await fetch(endpoint.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'audio/wav, audio/x-wav, application/octet-stream',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Piper HTTP synthesis failed: ${res.status} ${res.statusText}`);
      }

      return await readBoundedResponseBody(res as any, this.maxResponseBytes);
    } finally {
      clearTimeout(timer);
    }
  }

  private async synthesizeCli(text: string): Promise<Uint8Array> {
    const id = Math.random().toString(36).substring(2, 15);
    const outputFile = join(tmpdir(), `piper-${id}.wav`);

    return new Promise<Uint8Array>((resolve, reject) => {
      let child: any;
      const timer = setTimeout(() => {
        if (child) child.kill('SIGKILL');
        reject(new Error(`Piper CLI synthesis timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      const args = [
        '--output_file', outputFile,
        '--length_scale', String(this.lengthScale),
      ];

      if (this.model) {
        args.push('--model', this.model);
      }
      if (this.speakerId !== undefined) {
        args.push('--speaker', String(this.speakerId));
      }

      try {
        child = spawn(this.cliBinary, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err: any) {
        clearTimeout(timer);
        return reject(new Error(`Failed to spawn Piper CLI ('${this.cliBinary}'): ${err.message}. Please install 'piper' binary or configure 'baseUrl' (e.g. http://localhost:5000) to use a Piper HTTP server.`));
      }

      let stderr = '';
      child.stderr?.on('data', (chunk: any) => {
        stderr += chunk.toString();
      });

      child.on('error', (err: any) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn Piper CLI ('${this.cliBinary}'): ${err.message}. Please install 'piper' binary or configure 'baseUrl' (e.g. http://localhost:5000) to use a Piper HTTP server.`));
      });

      child.on('close', async (code: number | null) => {
        clearTimeout(timer);
        if (code !== 0) {
          await unlink(outputFile).catch(() => {});
          return reject(new Error(`Piper CLI exited with code ${code}: ${stderr.trim()}`));
        }

        try {
          const buffer = await readFile(outputFile);
          if (buffer.byteLength > this.maxResponseBytes) {
            throw new Error(`Piper output exceeds limit of ${this.maxResponseBytes} bytes`);
          }
          resolve(new Uint8Array(buffer));
        } catch (readErr) {
          reject(readErr);
        } finally {
          await unlink(outputFile).catch(() => {});
        }
      });

      try {
        child.stdin.write(text);
        child.stdin.end();
      } catch (writeErr: any) {
        clearTimeout(timer);
        reject(new Error(`Failed to pipe text to Piper: ${writeErr.message}`));
      }
    });
  }
}
