import {
  BodyOrgan,
  ExperienceAdapter,
  ExperienceEvent,
  ExperienceAdapterResult,
  validateExperienceEvent,
} from '@siduri/core';

export type BodyState = 'idle' | 'speaking' | 'acting';

export interface BodySnapshot {
  state: BodyState;
  currentExpression: string;
  lastSpeechId: string | null;
  lastAction: string | null;
  lastText?: string;
  lastLanguage?: string;
  updatedAt: number;
}

export interface NeutralBodyOrganConfig {
  initialExpression?: string;
  [key: string]: unknown;
}

export type Live2DAdapterConfig = NeutralBodyOrganConfig;

export class NeutralBodyOrgan implements BodyOrgan, ExperienceAdapter {
  readonly kind = 'avatar' as const;

  public currentExpression: string = 'neutral';
  public lastSpeechId: string | null = null;
  public lastAction: string | null = null;
  public lastText?: string;
  public lastLanguage?: string;
  public state: BodyState = 'idle';
  public lastEvent: ExperienceEvent | null = null;
  public updatedAt: number = Date.now();

  constructor(config: NeutralBodyOrganConfig = {}) {
    if (config.initialExpression) {
      this.currentExpression = config.initialExpression;
    }
  }

  setExpression(expression: string): void {
    this.currentExpression = expression;
    this.updatedAt = Date.now();
  }

  speak(speechId: string, text?: string, language?: string): void {
    this.lastSpeechId = speechId;
    this.lastText = text;
    this.lastLanguage = language;
    this.state = 'speaking';
    this.updatedAt = Date.now();
  }

  act(action: string): void {
    this.lastAction = action;
    this.state = 'acting';
    this.updatedAt = Date.now();
  }

  completeAction(): void {
    this.state = 'idle';
    this.updatedAt = Date.now();
  }

  getSnapshot(): BodySnapshot {
    return {
      state: this.state,
      currentExpression: this.currentExpression,
      lastSpeechId: this.lastSpeechId,
      lastAction: this.lastAction,
      lastText: this.lastText,
      lastLanguage: this.lastLanguage,
      updatedAt: this.updatedAt,
    };
  }

  async handleEvent(event: ExperienceEvent): Promise<ExperienceAdapterResult> {
    const validation = validateExperienceEvent(event);
    if (!validation.valid) {
      return {
        accepted: false,
        eventId: event?.eventId || '',
        lifecycle: 'FAILED',
        error: validation.error,
        reason: 'INVALID_EVENT_ENVELOPE',
      };
    }

    if (event.kind !== 'avatar') {
      return {
        accepted: false,
        eventId: event.eventId,
        lifecycle: 'FAILED',
        error: `Body adapter received incompatible event kind: ${event.kind}`,
        reason: 'INCOMPATIBLE_EVENT_KIND',
      };
    }

    if (event.approval !== 'APPROVED') {
      return {
        accepted: false,
        eventId: event.eventId,
        lifecycle: 'FAILED',
        error: 'Event is not APPROVED',
        reason: 'APPROVAL_REQUIRED',
      };
    }

    this.lastEvent = event;

    if (event.expression) {
      this.setExpression(event.expression);
    }
    if (event.action) {
      this.act(event.action);
    }
    if (event.text) {
      this.lastText = event.text;
      this.lastLanguage = event.language;
    }

    return {
      accepted: true,
      eventId: event.eventId,
      lifecycle: 'STARTED',
      metadata: {
        expression: this.currentExpression,
        action: this.lastAction,
        state: this.state,
        companionId: event.companionId,
        correlationId: event.correlationId,
      },
    };
  }

  cleanup(): void {
    this.state = 'idle';
    this.lastEvent = null;
    this.updatedAt = Date.now();
  }
}

// Backward-compatible alias
export const Live2DAdapter = NeutralBodyOrgan;
