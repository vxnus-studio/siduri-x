import { RequestContext } from './context';
import { EarPerception, EarOrgan } from './index';

export interface EarLimitsConfig {
  maxTextLength?: number;
  maxAudioBytes?: number;
  allowedAudioMimeTypes?: string[];
  maxDurationSeconds?: number;
  transcriptionTimeoutMs?: number;
}

export interface EarPerceptionMetadata extends Record<string, unknown> {
  source?: string;
  channel?: string;
  modality?: 'text' | 'audio' | 'object' | 'system';
  confidence?: number;
  provenance?: string;
  actorId?: string;
  sessionId?: string;
  correlationId?: string;
  byteSize?: number;
  durationSeconds?: number;
  mimeType?: string;
}

export interface HardenedEarPerception extends EarPerception {
  modality: 'text' | 'audio' | 'object' | 'system';
  metadata?: EarPerceptionMetadata;
  rawConfidence?: number;
}

export interface EarIngestOptions {
  source?: string;
  context?: RequestContext;
  mimeType?: string;
  durationSeconds?: number;
}
