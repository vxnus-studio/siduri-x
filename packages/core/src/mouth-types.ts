import { ResponseCitation } from './evidence';

export type MouthMedium = 'web';

export interface MouthVisemeCue {
  timeMs: number;
  durationMs: number;
  mouthOpenY: number; // 0.0 (closed) to 1.0 (open)
  mouthForm?: number; // -1.0 (narrow/frown) to 1.0 (wide/smile)
  phoneme?: string;   // e.g., 'a', 'i', 'u', 'e', 'o', 'sil'
}

export interface MouthUtterance {
  utteranceId: string;
  companionId: string;
  responseId?: string;
  correlationId?: string;
  text: string;
  language?: string;
  subtitleJa?: string;
  subtitleEn?: string;
  spokenJa?: string;
  expression?: string;
  action?: string;
  medium?: MouthMedium;
  metadata?: Record<string, unknown>;
  audioUrl?: string;
  audioBuffer?: Uint8Array;
  citations?: ResponseCitation[];
  evidenceIds?: string[];
  signal?: AbortSignal;
}

export interface FormattedMouthOutput {
  medium: MouthMedium;
  text: string;
  displayText: string;
  richContent?: Record<string, unknown>;
  ssml?: string;
  visemes?: MouthVisemeCue[];
  subtitles?: {
    ja: string;
    en: string;
    spoken?: string;
  };
  audioUrl?: string;
  audioBuffer?: Uint8Array;
  expression?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  interrupted?: boolean;
}

export interface MouthStreamChunk {
  utteranceId: string;
  index: number;
  deltaText: string;
  isComplete: boolean;
  audioChunk?: Uint8Array;
  medium?: MouthMedium;
  visemes?: MouthVisemeCue[];
  expression?: string;
  action?: string;
  interrupted?: boolean;
}

export interface MouthChannel {
  id: string;
  name: string;
  medium: MouthMedium;
  deliver(output: FormattedMouthOutput): Promise<void>;
  deliverStream?(stream: AsyncIterable<MouthStreamChunk>): Promise<void>;
  interrupt?(utteranceId?: string, reason?: string): Promise<void> | void;
}

export interface MouthOrganConfig {
  defaultMedium?: MouthMedium;
  supportedMedia?: MouthMedium[];
  [key: string]: unknown;
}

export interface MouthOrgan {
  readonly kind?: string;
  speak(utterance: MouthUtterance): Promise<FormattedMouthOutput>;
  format(utterance: MouthUtterance, medium?: MouthMedium): FormattedMouthOutput;
  stream?(utterance: MouthUtterance): AsyncIterable<MouthStreamChunk>;
  interrupt?(reason?: string): void;
  registerChannel?(channel: MouthChannel): void;
  unregisterChannel?(channelId: string): void;
  broadcast?(utterance: MouthUtterance): Promise<FormattedMouthOutput[]>;
  getRegisteredChannels?(): MouthChannel[];
}
