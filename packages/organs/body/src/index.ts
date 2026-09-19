import {
  BodyOrgan,
  ExperienceAdapter,
  ExperienceEvent,
  ExperienceAdapterResult,
  validateExperienceEvent,
} from '@sidurijs/core';

export * from './cubism-installer';

export type BodyState = 'idle' | 'speaking' | 'acting';

export type AvatarFormat = 'live2d' | 'vrm' | 'auto';

export interface VRMModelOptions {
  /** Target VRM standard specification version */
  specVersion?: '0.x' | '1.0' | 'auto';
  /** Default camera lookAt target behavior */
  lookAtMode?: 'camera' | 'cursor' | 'head' | 'none';
  /** Default resting humanoid pose identifier */
  defaultPose?: string;
  /** Custom blendshape preset map overrides */
  expressionMapping?: Record<string, string>;
}

export interface BodySnapshot {
  state: BodyState;
  currentExpression: string;
  format: 'live2d' | 'vrm' | 'unknown';
  modelPath?: string;
  modelUrl?: string;
  lastSpeechId: string | null;
  lastAction: string | null;
  lastText?: string;
  lastLanguage?: string;
  vrmOptions?: VRMModelOptions;
  updatedAt: number;
}

export interface NeutralBodyOrganConfig {
  /** Avatar rendering provider */
  provider?: 'live2d' | 'vrm' | 'none' | string;
  /** Explicit format override (defaults to auto-detection from modelUrl/modelPath extension) */
  format?: AvatarFormat;
  initialExpression?: string;
  modelPath?: string;
  modelUrl?: string;
  /** VRM-specific embodiment options */
  vrm?: VRMModelOptions;
  [key: string]: unknown;
}

export type Live2DAdapterConfig = NeutralBodyOrganConfig;

export class NeutralBodyOrgan implements BodyOrgan, ExperienceAdapter {
  readonly kind = 'avatar' as const;

  public currentExpression: string = 'neutral';
  public modelPath?: string;
  public modelUrl?: string;
  public format: 'live2d' | 'vrm' | 'unknown' = 'unknown';
  public vrmOptions?: VRMModelOptions;
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
    if (config.modelPath) {
      this.modelPath = config.modelPath;
    }
    if (config.modelUrl) {
      this.modelUrl = config.modelUrl;
    }
    if (config.vrm) {
      this.vrmOptions = { ...config.vrm };
    }

    // Resolve avatar format
    this.format = this.detectFormat(config);
  }

  private detectFormat(config: NeutralBodyOrganConfig): 'live2d' | 'vrm' | 'unknown' {
    if (config.format && config.format !== 'auto') {
      return config.format;
    }

    if (config.provider === 'vrm') {
      return 'vrm';
    }

    if (config.provider === 'live2d') {
      return 'live2d';
    }

    const ref = (this.modelPath || this.modelUrl || '').toLowerCase();
    if (ref.endsWith('.vrm')) {
      return 'vrm';
    }
    if (ref.endsWith('.model3.json') || ref.endsWith('.json')) {
      return 'live2d';
    }

    return 'unknown';
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
      format: this.format,
      modelPath: this.modelPath,
      modelUrl: this.modelUrl,
      lastSpeechId: this.lastSpeechId,
      lastAction: this.lastAction,
      lastText: this.lastText,
      lastLanguage: this.lastLanguage,
      vrmOptions: this.vrmOptions,
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
        format: this.format,
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

/** Specialized alias configured for VRM 3D humanoid models */
export class VRMAdapter extends NeutralBodyOrgan {
  constructor(config: NeutralBodyOrganConfig = {}) {
    super({
      provider: 'vrm',
      format: 'vrm',
      ...config,
    });
  }
}
