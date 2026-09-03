import {
  AvatarAction,
  AvatarExpression,
  AvatarState,
  AvatarStateConfig,
} from './types';

/**
 * Maps semantic expressions to standard Cubism expression filenames or identifiers.
 */
export function mapSemanticExpression(expression?: AvatarExpression | string): string {
  if (!expression) return 'neutral';
  const normalized = expression.toLowerCase().trim();

  switch (normalized) {
    case 'surprised':
      return 'face_aozame.exp3.json';
    case 'concerned':
    case 'thinking':
      return 'eyes_zetubou.exp3.json';
    case 'happy':
      return 'hair_open.exp3.json';
    case 'neutral':
    default:
      return 'neutral';
  }
}

/**
 * Maps semantic actions to angle, pose, and movement parameter modifiers.
 */
export interface ActionPose {
  angleX: number;
  angleY: number;
  angleZ: number;
  bodyAngleX: number;
  eyeBallX: number;
  eyeBallY: number;
  speed: number;
}

export function mapSemanticAction(action?: AvatarAction | string): ActionPose {
  if (!action) {
    return { angleX: 0, angleY: 0, angleZ: 0, bodyAngleX: 0, eyeBallX: 0, eyeBallY: 0, speed: 1.0 };
  }
  const normalized = action.toLowerCase().trim();

  switch (normalized) {
    case 'nod':
      return { angleX: 0, angleY: -12, angleZ: 2, bodyAngleX: 0, eyeBallX: 0, eyeBallY: -0.2, speed: 2.5 };
    case 'wave':
      return { angleX: 8, angleY: 4, angleZ: -5, bodyAngleX: 5, eyeBallX: 0.2, eyeBallY: 0.1, speed: 1.8 };
    case 'listen':
      return { angleX: -5, angleY: 2, angleZ: 4, bodyAngleX: -2, eyeBallX: 0.1, eyeBallY: 0.1, speed: 1.0 };
    case 'talk':
      return { angleX: 2, angleY: -2, angleZ: 0, bodyAngleX: 0, eyeBallX: 0, eyeBallY: 0, speed: 1.5 };
    case 'idle':
    default:
      return { angleX: 0, angleY: 0, angleZ: 0, bodyAngleX: 0, eyeBallX: 0, eyeBallY: 0, speed: 1.0 };
  }
}

/**
 * Normalizes lip-sync value strictly to [0.0, 1.0].
 */
export function clampLipSync(value?: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Computes procedural mouth opening if explicit audio lip-sync is not supplied.
 */
export function computeSpeakingMouthOpen(timeMs: number, explicitLipSync?: number): number {
  if (typeof explicitLipSync === 'number' && !isNaN(explicitLipSync) && explicitLipSync > 0) {
    return clampLipSync(explicitLipSync);
  }
  // Subtle multi-frequency sine wave simulating Japanese syllable cadences (3-5 Hz)
  const t = timeMs / 1000;
  const primary = Math.sin(t * 14) * 0.45;
  const secondary = Math.sin(t * 22) * 0.25;
  const tertiary = Math.sin(t * 8) * 0.2;
  const combined = primary + secondary + tertiary + 0.1;
  return clampLipSync(Math.max(0, combined));
}

/**
 * Controller managing model state, procedural animations, and parameter blending.
 */
export class Live2DStateController {
  public expression: AvatarExpression = 'neutral';
  public action: AvatarAction = 'idle';
  public state: AvatarState = 'idle';
  public speechId?: string;
  public lipSyncValue: number = 0;
  public reducedMotion: boolean = false;

  private actionStartTime: number = 0;
  private stateStartTime: number = 0;
  private lastUpdateTime: number = Date.now();

  constructor(initialConfig?: AvatarStateConfig) {
    if (initialConfig) {
      this.updateConfig(initialConfig);
    }
  }

  public updateConfig(config: AvatarStateConfig): void {
    if (config.expression && config.expression !== this.expression) {
      this.expression = config.expression;
    }
    if (config.action && config.action !== this.action) {
      this.action = config.action;
      this.actionStartTime = Date.now();
    }
    if (config.state && config.state !== this.state) {
      this.state = config.state;
      this.stateStartTime = Date.now();
    }
    if (config.speechId !== undefined) {
      this.speechId = config.speechId;
    }
    if (config.lipSyncValue !== undefined) {
      this.lipSyncValue = clampLipSync(config.lipSyncValue);
    }
    if (config.reducedMotion !== undefined) {
      this.reducedMotion = config.reducedMotion;
    }
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  public setExpression(expression: AvatarExpression): void {
    this.expression = expression;
  }

  public setAction(action: AvatarAction): void {
    this.action = action;
    this.actionStartTime = Date.now();
  }

  public setState(state: AvatarState): void {
    this.state = state;
    this.stateStartTime = Date.now();
  }

  public setLipSync(value: number): void {
    this.lipSyncValue = clampLipSync(value);
  }

  /**
   * Calculates animated parameter values for the current frame.
   */
  public calculateFrameParameters(nowMs: number = Date.now()): {
    mouthOpenY: number;
    angleX: number;
    angleY: number;
    angleZ: number;
    bodyAngleX: number;
    breath: number;
    eyeOpenL: number;
    eyeOpenR: number;
  } {
    const elapsedSeconds = (nowMs - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = nowMs;

    // 1. Breath animation (monastic slow breath: ~0.3 Hz)
    const breath = this.reducedMotion ? 0.2 : (Math.sin(nowMs / 1800) + 1) * 0.5;

    // 2. Idle subtle head sway (disabled in reduced motion)
    const idleAngleX = this.reducedMotion ? 0 : Math.sin(nowMs / 2400) * 2.5;
    const idleAngleY = this.reducedMotion ? 0 : Math.cos(nowMs / 3200) * 1.8;
    const idleAngleZ = this.reducedMotion ? 0 : Math.sin(nowMs / 4000) * 1.2;

    // 3. Action pose modifiers
    const pose = mapSemanticAction(this.action);
    const actionAge = (nowMs - this.actionStartTime) / 1000;

    let actionModX = 0;
    let actionModY = 0;
    let actionModZ = 0;
    let actionBodyModX = 0;

    if (this.reducedMotion) {
      // Static poses without rapid oscillating gestures
      if (this.action === 'nod') {
        actionModY = pose.angleY * 0.5;
      } else if (this.action === 'wave') {
        actionModX = pose.angleX * 0.5;
        actionBodyModX = pose.bodyAngleX * 0.5;
      } else if (this.action === 'listen') {
        actionModZ = pose.angleZ * 0.5;
        actionModX = pose.angleX * 0.5;
      }
    } else {
      if (this.action === 'nod') {
        actionModY = Math.sin(actionAge * Math.PI * 2 * 1.5) * pose.angleY;
      } else if (this.action === 'wave') {
        actionModZ = Math.sin(actionAge * Math.PI * 2 * 1.2) * pose.angleZ;
        actionModX = pose.angleX;
        actionBodyModX = pose.bodyAngleX;
      } else if (this.action === 'listen') {
        actionModZ = pose.angleZ;
        actionModX = pose.angleX;
      } else if (this.action === 'talk') {
        actionModY = Math.sin(actionAge * 4) * 2;
      }
    }

    // 4. Mouth opening
    let mouthOpenY = 0;
    if (this.state === 'speaking') {
      const rawMouth = computeSpeakingMouthOpen(nowMs, this.lipSyncValue);
      mouthOpenY = this.reducedMotion ? rawMouth * 0.6 : rawMouth;
    }

    // 5. Eye blinking (periodic natural blink: once every 3.5-5 seconds)
    const blinkCycle = (nowMs % 4000) / 4000;
    let eyeOpen = 1.0;
    if (blinkCycle > 0.95) {
      const blinkProgress = (blinkCycle - 0.95) / 0.05;
      eyeOpen = Math.abs(Math.sin(blinkProgress * Math.PI - Math.PI / 2));
    }

    return {
      mouthOpenY,
      angleX: idleAngleX + actionModX,
      angleY: idleAngleY + actionModY,
      angleZ: idleAngleZ + actionModZ,
      bodyAngleX: actionBodyModX,
      breath,
      eyeOpenL: eyeOpen,
      eyeOpenR: eyeOpen,
    };
  }

  public reset(): void {
    this.expression = 'neutral';
    this.action = 'idle';
    this.state = 'idle';
    this.lipSyncValue = 0;
    this.speechId = undefined;
  }
}
