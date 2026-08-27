import { VisionOrgan } from '@siduri-y/core';
import { spawn } from 'child_process';

export interface OpenRouterVisionConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export class OpenRouterVisionAdapter implements VisionOrgan {
  private config: Required<Omit<OpenRouterVisionConfig, 'timeoutMs' | 'maxResponseBytes'>> & {
    timeoutMs: number;
    maxResponseBytes: number;
  };

  constructor(config: OpenRouterVisionConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'google/gemini-pro-vision',
      baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
      timeoutMs: config.timeoutMs || 15_000,
      maxResponseBytes: config.maxResponseBytes || 1024 * 1024,
    };
  }

  async analyze(imageUrl: string, prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error("OpenRouter API key is required");
    }

    if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
      throw new Error("imageUrl must be a non-empty string");
    }

    if (typeof prompt !== 'string' || prompt.length > 4000) {
      throw new Error("prompt must be a string of at most 4000 characters");
    }

    const payload = {
      model: this.config.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt.slice(0, 4000) },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ]
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = (await response.text()).slice(0, 1000);
        throw new Error(`Vision API error (${response.status}): ${errText}`);
      }

      const rawText = await response.text();
      if (rawText.length > this.config.maxResponseBytes) {
        throw new Error(`Vision API response size (${rawText.length} bytes) exceeds limit of ${this.config.maxResponseBytes} bytes`);
      }

      const data = JSON.parse(rawText);
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response format from Vision API");
      }

      return data.choices[0].message.content || "";
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface VisionReading {
  entity: string;
  value: string;
  confidence: number;
  source_crop?: string;
  ocr_text?: string;
  competing_interpretations?: string[];
}

export interface ImageRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CroppedVisionOptions {
  maxInputBytes?: number;
  timeoutMs?: number;
  maxDimension?: number;
}

const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_CROP_TIMEOUT_MS = 5000;
const MAX_DIMENSION = 8192;

export class CroppedVisionAdapter implements VisionOrgan {
  private readonly maxInputBytes: number;
  private readonly timeoutMs: number;
  private readonly maxDimension: number;

  constructor(
    private provider: VisionOrgan,
    private region: ImageRegion,
    private topPartyIsActive: boolean = false,
    options: CroppedVisionOptions = {}
  ) {
    this.maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_IMAGE_BYTES;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_CROP_TIMEOUT_MS;
    this.maxDimension = options.maxDimension ?? MAX_DIMENSION;

    if (
      !region ||
      typeof region.name !== 'string' ||
      !region.name.trim() ||
      !Number.isFinite(region.x) ||
      !Number.isFinite(region.y) ||
      !Number.isFinite(region.width) ||
      !Number.isFinite(region.height) ||
      Math.min(region.x, region.y, region.width, region.height) < 0 ||
      region.width <= 0 ||
      region.height <= 0 ||
      region.width > this.maxDimension ||
      region.height > this.maxDimension ||
      region.x > this.maxDimension ||
      region.y > this.maxDimension
    ) {
      throw new Error("image region is invalid or exceeds allowable dimensions");
    }
  }

  private async cropBufferAsync(buffer: Buffer): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      let resolved = false;
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      const ffmpeg = spawn('ffmpeg', [
        '-loglevel', 'error',
        '-i', 'pipe:0',
        '-vf', `crop=${Math.floor(this.region.width)}:${Math.floor(this.region.height)}:${Math.floor(this.region.x)}:${Math.floor(this.region.y)}`,
        '-f', 'image2pipe',
        '-vcodec', 'png',
        'pipe:1'
      ]);

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ffmpeg.kill('SIGKILL');
          reject(new Error(`in-memory image crop timed out after ${this.timeoutMs}ms`));
        }
      }, this.timeoutMs);

      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        totalBytes += chunk.length;
        if (totalBytes > this.maxInputBytes) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            ffmpeg.kill('SIGKILL');
            reject(new Error(`Cropped image output exceeded maximum allowed size of ${this.maxInputBytes} bytes`));
          }
        }
      });

      ffmpeg.stderr.on('data', () => {});

      ffmpeg.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          reject(new Error(`in-memory image crop unavailable: ${err.message}`));
        }
      });

      ffmpeg.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          if (code !== 0) {
            reject(new Error(`in-memory image crop failed with process exit code ${code}`));
          } else if (chunks.length === 0) {
            reject(new Error("in-memory image crop was empty"));
          } else {
            resolve(Buffer.concat(chunks));
          }
        }
      });

      ffmpeg.stdin.on('error', () => {});
      ffmpeg.stdin.write(buffer);
      ffmpeg.stdin.end();
    });
  }

  async analyze(imageUrl: string, prompt: string): Promise<string> {
    if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
      throw new Error("imageUrl must be a valid non-empty string");
    }

    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    if (base64Data.length > this.maxInputBytes * 1.5) {
      throw new Error(`Input image exceeds maximum allowed payload size of ${this.maxInputBytes} bytes`);
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0) {
      throw new Error("Input image buffer is empty");
    }
    if (buffer.length > this.maxInputBytes) {
      throw new Error(`Input image buffer (${buffer.length} bytes) exceeds limit of ${this.maxInputBytes} bytes`);
    }

    const croppedBuffer = await this.cropBufferAsync(buffer);
    const croppedImageUrl = 'data:image/png;base64,' + croppedBuffer.toString('base64');
    const resultStr = await this.provider.analyze(croppedImageUrl, prompt);
    
    let parsed: unknown;
    try {
      parsed = JSON.parse(resultStr);
    } catch {
      return resultStr;
    }

    if (!Array.isArray(parsed)) {
      return resultStr;
    }

    // Validate and sanitize readings schema
    let readings: VisionReading[] = parsed
      .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object' && typeof r.entity === 'string' && typeof r.value === 'string')
      .map((r) => ({
        entity: String(r.entity).slice(0, 96),
        value: String(r.value).slice(0, 512),
        confidence: typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.max(0, Math.min(1, r.confidence)) : 0,
        source_crop: this.region.name,
        ocr_text: typeof r.ocr_text === 'string' ? r.ocr_text.slice(0, 512) : undefined,
        competing_interpretations: Array.isArray(r.competing_interpretations)
          ? r.competing_interpretations.filter((v): v is string => typeof v === 'string').map(v => v.slice(0, 256)).slice(0, 4)
          : undefined,
      }));

    if (this.topPartyIsActive && !readings.some(r => r.entity === 'active_character')) {
      const party = readings.find(r => r.entity === 'party_member');
      if (party) {
        readings.unshift({
          entity: 'active_character',
          value: party.value,
          confidence: party.confidence,
          source_crop: this.region.name,
          ocr_text: party.ocr_text,
          competing_interpretations: party.competing_interpretations
        });
      }
    }

    return JSON.stringify(readings);
  }
}

const PARTY_MEMBER_PATTERN = /([^\,\(\)]+?)\s*\((\d+)\)/g;

export function expandPartyList(readings: VisionReading[]): VisionReading[] {
  const expanded = [...readings];
  if (readings.some(r => r.entity === 'active_character')) {
    return expanded;
  }
  
  for (const reading of readings) {
    if (!reading.entity.toLowerCase().includes('party') || !reading.entity.toLowerCase().includes('list')) {
      continue;
    }
    
    let members: {name: string, slot: number}[] = [];
    const matches = [...reading.value.matchAll(PARTY_MEMBER_PATTERN)];
    if (matches.length > 0) {
      members = matches.map(m => ({ name: m[1].trim(), slot: parseInt(m[2], 10) }));
    } else {
      members = reading.value.split(',').map((name, i) => ({ name: name.trim(), slot: i + 1 })).filter(m => m.name);
    }
    
    if (members.length < 2) continue;
    members.sort((a, b) => a.slot - b.slot);
    
    const partyReadings: VisionReading[] = members.map(m => ({
      entity: 'party_member',
      value: m.name,
      confidence: reading.confidence,
      source_crop: reading.source_crop,
      ocr_text: m.name,
      competing_interpretations: reading.competing_interpretations
    }));
    
    const active: VisionReading = {
      entity: 'active_character',
      value: members[0].name,
      confidence: reading.confidence,
      source_crop: reading.source_crop,
      ocr_text: members[0].name,
      competing_interpretations: reading.competing_interpretations
    };
    
    expanded.push(active, ...partyReadings);
    break;
  }
  return expanded;
}

export interface VisionPass {
  provider: VisionOrgan;
  prompt: string;
}

export class MultiPassVisionAdapter implements VisionOrgan {
  constructor(private passes: VisionPass[]) {
    if (!passes || passes.length === 0) {
      throw new Error("at least one vision pass is required");
    }
  }

  async analyze(imageUrl: string, _prompt: string): Promise<string> {
    const allReadings: VisionReading[] = [];
    
    for (const pass of this.passes.slice(0, 2)) {
      try {
        const resultStr = await pass.provider.analyze(imageUrl, pass.prompt);
        let parsed: unknown = JSON.parse(resultStr);
        if (Array.isArray(parsed)) {
          const valid = parsed
            .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object' && typeof r.entity === 'string' && typeof r.value === 'string')
            .map((r) => ({
              entity: String(r.entity).slice(0, 96),
              value: String(r.value).slice(0, 512),
              confidence: typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.max(0, Math.min(1, r.confidence)) : 0,
              source_crop: typeof r.source_crop === 'string' ? r.source_crop : undefined,
              ocr_text: typeof r.ocr_text === 'string' ? r.ocr_text.slice(0, 512) : undefined,
              competing_interpretations: Array.isArray(r.competing_interpretations)
                ? r.competing_interpretations.filter((v): v is string => typeof v === 'string').map(v => v.slice(0, 256)).slice(0, 4)
                : undefined,
            }));
          allReadings.push(...valid.slice(0, 16));
        }
      } catch (e) {
        continue;
      }
    }
    
    const combined = expandPartyList(allReadings);
    const usable = combined.filter(item => !(item.entity === "scene" && item.confidence === 0.0));
    return JSON.stringify(usable.length > 0 ? usable : combined);
  }
}
