import { AvatarExpression } from '../live2d/types';

export type VRMExpressionPresetName = 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised' | 'blink' | 'blinkLeft' | 'blinkRight' | 'aa' | 'ih' | 'ou' | 'ee' | 'oh';

/**
 * Maps Siduri canonical expressions to standard VRM expression presets.
 */
export function mapExpressionToVRMPreset(expression?: AvatarExpression | string): VRMExpressionPresetName | string {
  if (!expression) return 'neutral';
  const normalized = expression.toLowerCase().trim();

  switch (normalized) {
    case 'happy':
    case 'joy':
      return 'happy';
    case 'angry':
      return 'angry';
    case 'sad':
    case 'sorrow':
    case 'concerned':
      return 'sad';
    case 'relaxed':
    case 'thinking':
      return 'relaxed';
    case 'surprised':
      return 'surprised';
    case 'neutral':
    default:
      return 'neutral';
  }
}
