import { VisionOrgan } from '@siduri-y/core';

export interface ObservationReading {
  entity: string;
  value: string;
  confidence: number;
  sourceCrop?: string;
  ocrText?: string;
  competingInterpretations?: string[];
}

export interface Observation {
  observationId: string;
  evidenceId: string;
  sourceName: string;
  providerId: string;
  readings: ObservationReading[];
  confidence: number;
  createdAt: string;
  expiresAt: string;
  frameDigest: string;
}

export interface ObservationResult {
  observation?: Observation;
  duplicate: boolean;
  reason?: 'empty_frame' | 'duplicate_frame' | 'invalid_reading' | 'provider_failure';
}

export interface ObservationOrgan {
  ingest(frame: Uint8Array, sourceName: string, providerId?: string): Promise<ObservationResult>;
  current(now?: Date): Observation[];
  clearExpired(now?: Date): number;
}

function digestFrame(frame: Uint8Array): string {
  // A stable, dependency-free digest is sufficient for the bounded local
  // duplicate guard. Raw frame bytes are never retained after provider use.
  let hash = 2166136261;
  for (const byte of frame) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function frameDataUrl(frame: Uint8Array): string {
  let binary = '';
  for (const byte of frame) binary += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(binary)}`;
}

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function clampConfidence(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

function parseReadings(value: string): ObservationReading[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  const raw = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).readings) ? (parsed as any).readings : undefined);
  if (!raw) return undefined;
  const readings = raw.filter((item: any) => item && typeof item.entity === 'string' && typeof item.value === 'string')
    .map((item: any) => ({
      entity: item.entity.slice(0, 96),
      value: item.value.slice(0, 512),
      confidence: clampConfidence(item.confidence),
      sourceCrop: typeof item.source_crop === 'string' ? item.source_crop : undefined,
      ocrText: typeof item.ocr_text === 'string' ? item.ocr_text.slice(0, 512) : undefined,
      competingInterpretations: Array.isArray(item.competing_interpretations)
        ? item.competing_interpretations.filter((v: unknown): v is string => typeof v === 'string').slice(0, 4)
        : undefined,
    }));
  return readings.length === raw.length ? readings : undefined;
}

export class FixtureObservationOrgan implements ObservationOrgan {
  private readonly observations: Observation[] = [];
  private readonly digests = new Set<string>();

  constructor(
    private readonly vision: VisionOrgan,
    private readonly ttlMs = 30_000,
    private readonly maxFrames = 8,
  ) {
    if (ttlMs <= 0 || maxFrames <= 0) throw new Error('observation limits must be positive');
  }

  async ingest(frame: Uint8Array, sourceName: string, providerId = 'vision'): Promise<ObservationResult> {
    if (!frame.length) return { duplicate: false, reason: 'empty_frame' };
    this.clearExpired();
    const frameDigest = digestFrame(frame);
    if (this.digests.has(frameDigest)) return { duplicate: true, reason: 'duplicate_frame' };

    let readings: ObservationReading[] | undefined;
    try {
      // The frame is converted only for the provider call and is never stored.
      const imageUrl = frameDataUrl(frame);
      readings = parseReadings(await this.vision.analyze(imageUrl, 'Return only visible readings as JSON with entity, value, and confidence.'));
    } catch {
      return { duplicate: false, reason: 'provider_failure' };
    }
    if (!readings) return { duplicate: false, reason: 'invalid_reading' };

    const now = Date.now();
    const observation: Observation = {
      observationId: id('obs'),
      evidenceId: id('evidence'),
      sourceName: sourceName.slice(0, 96),
      providerId: providerId.slice(0, 96),
      readings,
      confidence: readings.length ? readings.reduce((sum, item) => sum + item.confidence, 0) / readings.length : 0,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString(),
      frameDigest,
    };
    this.observations.push(observation);
    this.digests.add(frameDigest);
    while (this.observations.length > this.maxFrames) {
      const removed = this.observations.shift();
      if (removed) this.digests.delete(removed.frameDigest);
    }
    return { observation, duplicate: false };
  }

  current(now = new Date()): Observation[] {
    this.clearExpired(now);
    return this.observations.map((item) => ({ ...item, readings: item.readings.map((reading) => ({ ...reading })) }));
  }

  clearExpired(now = new Date()): number {
    const before = this.observations.length;
    const current = now.getTime();
    const retained = this.observations.filter((item) => new Date(item.expiresAt).getTime() > current);
    this.observations.splice(0, this.observations.length, ...retained);
    this.digests.clear();
    for (const item of retained) this.digests.add(item.frameDigest);
    return before - retained.length;
  }
}
