import { Channel } from './context';
import { ResponseCitation, ResponseApprovalStatus } from './evidence';

export type ExperienceEventKind = 'voice' | 'caption' | 'avatar' | 'platform_action';
export type ExperienceEventLifecycle = 'STARTED' | 'PROGRESS' | 'COMPLETED' | 'FAILED';

export interface ExperienceEvent {
  eventId: string;
  companionId: string;
  responseId: string;
  correlationId: string;
  channel: Channel;
  audienceId: string;
  approval: 'APPROVED';
  kind: ExperienceEventKind;
  lifecycle: ExperienceEventLifecycle;
  evidenceIds: string[];
  citations?: ResponseCitation[];
  text?: string;
  language?: string;
  action?: string;
  expression?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface ExperienceAdapterResult {
  accepted: boolean;
  eventId: string;
  lifecycle: ExperienceEventLifecycle;
  error?: string;
  reason?: string;
  audioBuffer?: Uint8Array;
  metadata?: Record<string, unknown>;
}

export interface ExperienceAdapter {
  readonly kind: ExperienceEventKind;
  handleEvent(event: ExperienceEvent): Promise<ExperienceAdapterResult>;
}

function generateEventId(kind: string): string {
  return `evt-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateExperienceEventsOptions {
  responseId: string;
  companionId: string;
  correlationId: string;
  channel: Channel;
  audienceId: string;
  speech: string;
  language?: string;
  evidenceIds?: string[];
  citations?: ResponseCitation[];
  expression?: string;
  action?: string;
  expiresAt?: string;
  now?: string | Date;
}

export function createExperienceEvents(
  options: CreateExperienceEventsOptions
): ExperienceEvent[] {
  const nowStr = options.now
    ? new Date(options.now).toISOString()
    : new Date().toISOString();

  const events: ExperienceEvent[] = [];

  // 1. Voice event
  events.push({
    eventId: generateEventId('voice'),
    companionId: options.companionId,
    responseId: options.responseId,
    correlationId: options.correlationId,
    channel: options.channel,
    audienceId: options.audienceId,
    approval: 'APPROVED',
    kind: 'voice',
    lifecycle: 'STARTED',
    evidenceIds: options.evidenceIds ?? [],
    citations: options.citations,
    text: options.speech,
    language: options.language || 'ja',
    createdAt: nowStr,
    expiresAt: options.expiresAt,
  });

  // 2. Avatar/Body event
  events.push({
    eventId: generateEventId('avatar'),
    companionId: options.companionId,
    responseId: options.responseId,
    correlationId: options.correlationId,
    channel: options.channel,
    audienceId: options.audienceId,
    approval: 'APPROVED',
    kind: 'avatar',
    lifecycle: 'STARTED',
    evidenceIds: options.evidenceIds ?? [],
    text: options.speech,
    language: options.language || 'ja',
    expression: options.expression || 'neutral',
    action: options.action || 'talk',
    createdAt: nowStr,
    expiresAt: options.expiresAt,
  });

  return events;
}

export function validateExperienceEvent(event: unknown): { valid: boolean; error?: string } {
  if (!event || typeof event !== 'object') {
    return { valid: false, error: 'Event must be an object' };
  }

  const e = event as Partial<ExperienceEvent>;

  if (!e.eventId || typeof e.eventId !== 'string') return { valid: false, error: 'Missing or invalid eventId' };
  if (!e.companionId || typeof e.companionId !== 'string') return { valid: false, error: 'Missing or invalid companionId' };
  if (!e.responseId || typeof e.responseId !== 'string') return { valid: false, error: 'Missing or invalid responseId' };
  if (!e.correlationId || typeof e.correlationId !== 'string') return { valid: false, error: 'Missing or invalid correlationId' };
  if (!e.audienceId || typeof e.audienceId !== 'string') return { valid: false, error: 'Missing or invalid audienceId' };
  if (e.approval !== 'APPROVED') return { valid: false, error: 'Event approval must be APPROVED' };
  if (!['voice', 'caption', 'avatar', 'platform_action'].includes(e.kind as string)) {
    return { valid: false, error: `Invalid kind: ${e.kind}` };
  }
  if (!['STARTED', 'PROGRESS', 'COMPLETED', 'FAILED'].includes(e.lifecycle as string)) {
    return { valid: false, error: `Invalid lifecycle: ${e.lifecycle}` };
  }
  if (!Array.isArray(e.evidenceIds)) return { valid: false, error: 'Missing or invalid evidenceIds array' };

  return { valid: true };
}
