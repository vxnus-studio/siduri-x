import { EventEmitter } from 'node:events';
import {
  MouthChannel,
  MouthMedium,
  FormattedMouthOutput,
  MouthStreamChunk,
} from '@siduri-x/core';

export interface BufferedMouthChannelOptions {
  id?: string;
  name?: string;
  medium?: MouthMedium;
  maxBufferSize?: number;
}

/**
 * In-memory buffer sink for web output delivery and testing.
 */
export class BufferedMouthChannel implements MouthChannel {
  public readonly id: string;
  public readonly name: string;
  public readonly medium: MouthMedium;
  private readonly maxBufferSize: number;
  private buffer: FormattedMouthOutput[] = [];
  private streamChunks: MouthStreamChunk[] = [];
  private interruptedUtteranceIds: Set<string> = new Set();

  constructor(options: BufferedMouthChannelOptions = {}) {
    this.id = options.id || 'buffered-channel';
    this.name = options.name || 'Buffered Channel';
    this.medium = 'web';
    this.maxBufferSize = options.maxBufferSize ?? 100;
  }

  public async deliver(output: FormattedMouthOutput): Promise<void> {
    if (this.buffer.length >= this.maxBufferSize) {
      this.buffer.shift();
    }
    this.buffer.push(output);
  }

  public async deliverStream(stream: AsyncIterable<MouthStreamChunk>): Promise<void> {
    for await (const chunk of stream) {
      if (this.streamChunks.length >= this.maxBufferSize * 10) {
        this.streamChunks.shift();
      }
      this.streamChunks.push(chunk);
      if (chunk.interrupted) {
        this.interruptedUtteranceIds.add(chunk.utteranceId);
      }
    }
  }

  public interrupt(utteranceId?: string, _reason?: string): void {
    if (utteranceId) {
      this.interruptedUtteranceIds.add(utteranceId);
    }
  }

  public getItems(): FormattedMouthOutput[] {
    return [...this.buffer];
  }

  public getStreamChunks(): MouthStreamChunk[] {
    return [...this.streamChunks];
  }

  public isInterrupted(utteranceId: string): boolean {
    return this.interruptedUtteranceIds.has(utteranceId);
  }

  public clear(): void {
    this.buffer = [];
    this.streamChunks = [];
    this.interruptedUtteranceIds.clear();
  }
}

export interface EventEmitterMouthChannelOptions {
  id?: string;
  name?: string;
  medium?: MouthMedium;
}

/**
 * Event-driven sink emitting events for output, stream chunks, interruption, and completion.
 */
export class EventEmitterMouthChannel extends EventEmitter implements MouthChannel {
  public readonly id: string;
  public readonly name: string;
  public readonly medium: MouthMedium;

  constructor(options: EventEmitterMouthChannelOptions = {}) {
    super();
    this.id = options.id || 'event-emitter-channel';
    this.name = options.name || 'Event Emitter Channel';
    this.medium = 'web';
  }

  public async deliver(output: FormattedMouthOutput): Promise<void> {
    this.emit('output', output);
  }

  public async deliverStream(stream: AsyncIterable<MouthStreamChunk>): Promise<void> {
    for await (const chunk of stream) {
      this.emit('chunk', chunk);
      if (chunk.isComplete) {
        this.emit('complete', chunk);
      }
      if (chunk.interrupted) {
        this.emit('interrupted', { utteranceId: chunk.utteranceId });
      }
    }
  }

  public interrupt(utteranceId?: string, reason?: string): void {
    this.emit('interrupted', { utteranceId, reason });
  }
}
