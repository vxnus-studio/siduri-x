import {
  MouthOrgan,
  MouthOrganConfig,
  MouthMedium,
  MouthUtterance,
  FormattedMouthOutput,
  MouthStreamChunk,
  MouthVisemeCue,
  MouthChannel,
  VoiceOrgan,
  ExperienceAdapter,
  ExperienceEvent,
  ExperienceAdapterResult,
} from '@siduri-x/core';

export * from './channels';

export interface DefaultMouthOrganConfig extends MouthOrganConfig {
  defaultMedium?: MouthMedium;
  maxTextLength?: number;
  voice?: VoiceOrgan;
  channels?: MouthChannel[];
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateSsml(text: string, language: string = 'ja', expression?: string): string {
  const clean = escapeXml(text);
  let rate = 'medium';
  let pitch = 'default';

  switch (expression) {
    case 'excited':
    case 'happy':
      rate = 'fast';
      pitch = '+5%';
      break;
    case 'sad':
      rate = 'slow';
      pitch = '-5%';
      break;
    case 'thinking':
      rate = 'slow';
      break;
    case 'surprised':
      pitch = '+8%';
      break;
  }

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}"><prosody rate="${rate}" pitch="${pitch}">${clean}</prosody></speak>`;
}

export function getCharViseme(char: string): { mouthOpenY: number; mouthForm: number; phoneme: string } {
  if (/[あかがさざただなはばぱまやらわアカガサザタダナハバパマヤラワaA]/.test(char)) {
    return { mouthOpenY: 0.8, mouthForm: 0.0, phoneme: 'a' };
  }
  if (/[いきぎしじちぢにひびぴみりイキギシジチヂニヒビピミリiI]/.test(char)) {
    return { mouthOpenY: 0.3, mouthForm: 0.8, phoneme: 'i' };
  }
  if (/[うくぐすずつづぬふぶぷむゆるウクグスズツヅヌフブプムユルuU]/.test(char)) {
    return { mouthOpenY: 0.4, mouthForm: -0.5, phoneme: 'u' };
  }
  if (/[えけげせぜてでねへべぺめれエケゲセゼテデネヘベペメレeE]/.test(char)) {
    return { mouthOpenY: 0.6, mouthForm: 0.5, phoneme: 'e' };
  }
  if (/[おこごそぞとどのほぼぽもよろをオコゴソゾトドノホボポモヨロヲoO]/.test(char)) {
    return { mouthOpenY: 0.7, mouthForm: -0.6, phoneme: 'o' };
  }
  if (/[んンnN]/.test(char)) {
    return { mouthOpenY: 0.1, mouthForm: 0.0, phoneme: 'n' };
  }
  if (/[\s,.!?;:()\[\]"'・ー〜-]/.test(char)) {
    return { mouthOpenY: 0.0, mouthForm: 0.0, phoneme: 'sil' };
  }
  return { mouthOpenY: 0.4, mouthForm: 0.1, phoneme: char.toLowerCase() };
}

export function generateVisemeCues(text: string, estimatedDurationMs?: number): MouthVisemeCue[] {
  if (!text || text.trim().length === 0) {
    return [{ timeMs: 0, durationMs: 100, mouthOpenY: 0, mouthForm: 0, phoneme: 'sil' }];
  }

  const chars = Array.from(text);
  const totalDuration = estimatedDurationMs ?? Math.max(500, Math.min(chars.length * 90, 10000));
  const charDuration = Math.max(30, Math.floor(totalDuration / chars.length));

  const cues: MouthVisemeCue[] = [];
  let currentTime = 0;

  for (const ch of chars) {
    const v = getCharViseme(ch);
    cues.push({
      timeMs: currentTime,
      durationMs: charDuration,
      mouthOpenY: v.mouthOpenY,
      mouthForm: v.mouthForm,
      phoneme: v.phoneme,
    });
    currentTime += charDuration;
  }

  cues.push({
    timeMs: currentTime,
    durationMs: 80,
    mouthOpenY: 0.0,
    mouthForm: 0.0,
    phoneme: 'sil',
  });

  return cues;
}

/**
 * DefaultMouthOrgan implements the Mouth organ in Siduri's 10-organ architecture.
 * It is responsible for communication output, adapting cognitive decisions from Brain
 * for the web interface, coordinating speech delivery with Voice, generating SSML and Live2D viseme cues,
 * handling barge-in/interruption, and routing to channels.
 */
export class DefaultMouthOrgan implements MouthOrgan, ExperienceAdapter {
  readonly kind = 'caption' as const;

  private readonly defaultMedium: MouthMedium = 'web';
  private readonly maxTextLength: number;
  private voice?: VoiceOrgan;
  private channels: Map<string, MouthChannel> = new Map();
  private activeAbortControllers: Map<string, AbortController> = new Map();

  constructor(config: DefaultMouthOrganConfig = {}) {
    this.defaultMedium = 'web';
    this.maxTextLength = config.maxTextLength ?? 8000;
    this.voice = config.voice;

    if (config.channels) {
      for (const channel of config.channels) {
        this.registerChannel(channel);
      }
    }
  }

  /**
   * Set or update the Voice organ for speech coordination.
   */
  public setVoiceOrgan(voice?: VoiceOrgan): void {
    this.voice = voice;
  }

  /**
   * Register a downstream delivery channel.
   */
  public registerChannel(channel: MouthChannel): void {
    if (!channel || !channel.id) {
      throw new Error('MouthChannel must have a valid id');
    }
    this.channels.set(channel.id, channel);
  }

  /**
   * Unregister a channel by id.
   */
  public unregisterChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  /**
   * Get all currently registered channels.
   */
  public getRegisteredChannels(): MouthChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Interrupts any ongoing streaming or speech delivery.
   */
  public interrupt(reason?: string): void {
    for (const [id, controller] of this.activeAbortControllers.entries()) {
      controller.abort(reason || 'Interrupted');
      for (const channel of this.channels.values()) {
        if (typeof channel.interrupt === 'function') {
          try {
            channel.interrupt(id, reason);
          } catch (err: any) {
            console.error(`[DefaultMouthOrgan] Channel ${channel.id} interrupt failed:`, err?.message || err);
          }
        }
      }
    }
    this.activeAbortControllers.clear();
  }

  /**
   * Formats an utterance for the web presentation medium, including SSML and Live2D viseme cues.
   */
  public format(utterance: MouthUtterance, _medium?: MouthMedium): FormattedMouthOutput {
    const rawText = utterance.text || utterance.subtitleJa || utterance.subtitleEn || '';
    const cleanText = rawText.slice(0, this.maxTextLength);
    const now = new Date().toISOString();

    const subtitleJa = utterance.subtitleJa || rawText;
    const subtitleEn = utterance.subtitleEn || rawText;
    const spokenJa = utterance.spokenJa || subtitleJa;
    const language = utterance.language || 'ja';

    const visemes = generateVisemeCues(spokenJa || cleanText);
    const ssml = generateSsml(spokenJa || cleanText, language, utterance.expression);

    return {
      medium: 'web',
      text: cleanText,
      displayText: cleanText,
      subtitles: {
        ja: subtitleJa,
        en: subtitleEn,
        spoken: spokenJa,
      },
      ssml,
      visemes,
      audioUrl: utterance.audioUrl,
      audioBuffer: utterance.audioBuffer,
      expression: utterance.expression || 'neutral',
      action: utterance.action,
      richContent: {
        markdown: true,
        citations: utterance.citations || [],
        evidenceIds: utterance.evidenceIds || [],
        action: utterance.action,
      },
      metadata: utterance.metadata,
      timestamp: now,
      interrupted: utterance.signal?.aborted || false,
    };
  }

  /**
   * Delivers an utterance by formatting it for web, optionally coordinating with Voice,
   * and delivering to registered web channels.
   */
  public async speak(utterance: MouthUtterance): Promise<FormattedMouthOutput> {
    let delivery = this.format(utterance, 'web');

    if (utterance.signal?.aborted) {
      delivery.interrupted = true;
      return delivery;
    }

    // Coordinate with Voice organ if audio is not already provided
    if (this.voice && !delivery.audioUrl && utterance.text) {
      try {
        const speechText = utterance.spokenJa || utterance.subtitleJa || utterance.text;
        const lang = utterance.language || 'ja';
        const speechId = this.voice.enqueueSpeech(speechText, lang);
        if (speechId) {
          delivery = {
            ...delivery,
            audioUrl: `/voice/stream?id=${speechId}`,
          };
        }
      } catch (err: any) {
        console.error('[DefaultMouthOrgan] Voice coordination failed:', err?.message || err);
      }
    }

    if (utterance.signal?.aborted) {
      delivery.interrupted = true;
      return delivery;
    }

    // Deliver to registered web channels
    const matchingChannels = Array.from(this.channels.values()).filter(
      (c) => c.medium === 'web'
    );
    for (const channel of matchingChannels) {
      try {
        await channel.deliver(delivery);
      } catch (err: any) {
        console.error(`[DefaultMouthOrgan] Delivery to channel ${channel.id} failed:`, err?.message || err);
      }
    }

    return delivery;
  }

  /**
   * Broadcasts the utterance across all registered channels.
   */
  public async broadcast(utterance: MouthUtterance): Promise<FormattedMouthOutput[]> {
    const deliveries: FormattedMouthOutput[] = [];

    for (const channel of this.channels.values()) {
      const formatted = this.format(utterance, channel.medium);
      try {
        await channel.deliver(formatted);
        deliveries.push(formatted);
      } catch (err: any) {
        console.error(`[DefaultMouthOrgan] Broadcast to channel ${channel.id} failed:`, err?.message || err);
      }
    }

    return deliveries;
  }

  /**
   * Generates a streaming delta sequence for token/word-by-word streaming delivery,
   * supporting interruption signals and Live2D visemes per chunk.
   */
  public async *stream(utterance: MouthUtterance): AsyncIterable<MouthStreamChunk> {
    const controller = new AbortController();
    this.activeAbortControllers.set(utterance.utteranceId, controller);

    const onAbort = () => controller.abort(utterance.signal?.reason);
    if (utterance.signal) {
      if (utterance.signal.aborted) {
        controller.abort(utterance.signal.reason);
      } else {
        utterance.signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    try {
      const text = utterance.text || '';
      const words = text.split(/(\s+)/);
      let index = 0;

      for (const token of words) {
        if (!token) continue;
        if (controller.signal.aborted) {
          yield {
            utteranceId: utterance.utteranceId,
            index: ++index,
            deltaText: '',
            isComplete: true,
            interrupted: true,
            medium: 'web',
          };
          return;
        }

        index++;
        const tokenVisemes = generateVisemeCues(token, Math.max(80, token.length * 50));
        yield {
          utteranceId: utterance.utteranceId,
          index,
          deltaText: token,
          isComplete: false,
          medium: 'web',
          visemes: tokenVisemes,
          expression: utterance.expression,
          action: utterance.action,
        };
      }

      if (controller.signal.aborted) {
        yield {
          utteranceId: utterance.utteranceId,
          index: ++index,
          deltaText: '',
          isComplete: true,
          interrupted: true,
          medium: 'web',
        };
        return;
      }

      yield {
        utteranceId: utterance.utteranceId,
        index: index + 1,
        deltaText: '',
        isComplete: true,
        medium: 'web',
        expression: utterance.expression,
        action: utterance.action,
      };
    } finally {
      if (utterance.signal) {
        utterance.signal.removeEventListener('abort', onAbort);
      }
      this.activeAbortControllers.delete(utterance.utteranceId);
    }
  }

  /**
   * Handles ExperienceDispatcher events as an ExperienceAdapter.
   */
  public async handleEvent(event: ExperienceEvent): Promise<ExperienceAdapterResult> {
    if (event.approval !== 'APPROVED') {
      return {
        accepted: false,
        eventId: event.eventId,
        lifecycle: 'FAILED',
        error: 'Event is not approved',
      };
    }

    if (event.text) {
      const utterance: MouthUtterance = {
        utteranceId: event.eventId,
        companionId: event.companionId,
        responseId: event.responseId,
        correlationId: event.correlationId,
        text: event.text,
        language: event.language,
        expression: event.expression,
        action: event.action,
        medium: 'web',
        citations: event.citations,
        evidenceIds: event.evidenceIds,
      };

      await this.speak(utterance);
    }

    return {
      accepted: true,
      eventId: event.eventId,
      lifecycle: 'COMPLETED',
    };
  }
}
