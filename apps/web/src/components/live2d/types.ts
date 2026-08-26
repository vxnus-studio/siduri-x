export type AvatarExpression =
  | 'neutral'
  | 'happy'
  | 'thinking'
  | 'surprised'
  | 'concerned';

export type AvatarAction =
  | 'idle'
  | 'talk'
  | 'nod'
  | 'wave'
  | 'listen';

export type AvatarState = 'idle' | 'speaking' | 'acting';

export type AvatarRendererStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AvatarStateConfig {
  expression?: AvatarExpression;
  action?: AvatarAction;
  state?: AvatarState;
  speechId?: string;
  lipSyncValue?: number;
  durationMs?: number;
  reducedMotion?: boolean;
}

export interface ActiveAvatarEvent {
  eventId?: string;
  expression: AvatarExpression;
  action: AvatarAction;
  state: AvatarState;
  speechId?: string;
  lipSyncValue?: number;
  durationMs?: number;
}

export interface Model3ExpressionRef {
  Name: string;
  File: string;
}

export interface Model3Json {
  Version: number;
  FileReferences: {
    Moc: string;
    Textures: string[];
    Physics?: string;
    DisplayInfo?: string;
    Expressions?: Model3ExpressionRef[];
    Motions?: Record<string, Array<{ File: string }>>;
  };
  Groups?: Array<{
    Target: string;
    Name: string;
    Ids: string[];
  }>;
}

export interface Expression3Parameter {
  Id: string;
  Value: number;
  Blend?: 'Add' | 'Multiply' | 'Overwrite';
}

export interface Expression3Json {
  Type?: string;
  FadeInTime?: number;
  FadeOutTime?: number;
  Parameters: Expression3Parameter[];
}

export interface ParameterSnapshot {
  id: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
}
