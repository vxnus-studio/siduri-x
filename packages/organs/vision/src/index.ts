import { VisionOrgan } from '@siduri-y/core';
import { spawnSync } from 'child_process';

export interface OpenRouterVisionConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export class OpenRouterVisionAdapter implements VisionOrgan {
  private config: Required<OpenRouterVisionConfig>;

  constructor(config: OpenRouterVisionConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'google/gemini-pro-vision',
      baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
    };
  }

  async analyze(imageUrl: string, prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error("OpenRouter API key is required");
    }

    const payload = {
      model: this.config.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ]
    };

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Vision API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from Vision API");
    }

    return data.choices[0].message.content || "";
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

export class CroppedVisionAdapter implements VisionOrgan {
  constructor(
    private provider: VisionOrgan,
    private region: ImageRegion,
    private topPartyIsActive: boolean = false
  ) {
    if (!region.name.trim() || Math.min(region.x, region.y, region.width, region.height) < 0 || !region.width || !region.height) {
      throw new Error("image region is invalid");
    }
  }

  async analyze(imageUrl: string, prompt: string): Promise<string> {
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const result = spawnSync('ffmpeg', [
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vf', `crop=${this.region.width}:${this.region.height}:${this.region.x}:${this.region.y}`,
      '-f', 'image2pipe',
      '-vcodec', 'png',
      'pipe:1'
    ], { input: buffer });

    if (result.error || result.status !== 0) {
      throw new Error("in-memory image crop unavailable");
    }
    if (!result.stdout || result.stdout.length === 0) {
      throw new Error("in-memory image crop was empty");
    }

    const croppedImageUrl = 'data:image/png;base64,' + result.stdout.toString('base64');
    const resultStr = await this.provider.analyze(croppedImageUrl, prompt);
    
    let readings: VisionReading[];
    try {
      readings = JSON.parse(resultStr);
    } catch {
      return resultStr;
    }

    readings = readings.map(r => ({ ...r, source_crop: this.region.name }));

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
        let readings: VisionReading[] = JSON.parse(resultStr);
        allReadings.push(...readings.slice(0, 16));
      } catch (e) {
        continue;
      }
    }
    
    const combined = expandPartyList(allReadings);
    const usable = combined.filter(item => !(item.entity === "scene" && item.confidence === 0.0));
    return JSON.stringify(usable.length > 0 ? usable : combined);
  }
}
