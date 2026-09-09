import { Message } from './index';

export interface SessionHistoryOptions {
  maxSessions?: number;
  maxMessagesPerSession?: number;
}

/**
 * Manages conversation history scoped by session key to prevent cross-session
 * and cross-channel memory/conversation leakage.
 */
export class SessionHistoryManager {
  private readonly sessions = new Map<string, Message[]>();
  private readonly maxSessions: number;
  private readonly maxMessagesPerSession: number;

  constructor(options: SessionHistoryOptions = {}) {
    this.maxSessions = options.maxSessions ?? 200;
    this.maxMessagesPerSession = options.maxMessagesPerSession ?? 20;
  }

  getHistory(sessionKey: string = 'default'): Message[] {
    return this.sessions.get(sessionKey) || [];
  }

  setHistory(sessionKey: string = 'default', history: Message[]): void {
    if (this.sessions.size >= this.maxSessions && !this.sessions.has(sessionKey)) {
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey) {
        this.sessions.delete(oldestKey);
      }
    }

    const bounded = history.slice(-this.maxMessagesPerSession).map((item) => ({
      role: item.role,
      content: item.content.slice(0, 2000).replace(/\0/g, ''),
    }));

    this.sessions.set(sessionKey, bounded);
  }

  append(sessionKey: string = 'default', message: Message): void {
    const current = this.getHistory(sessionKey);
    const updated = [
      ...current,
      {
        role: message.role,
        content: message.content.slice(0, 2000).replace(/\0/g, ''),
      },
    ].slice(-this.maxMessagesPerSession);

    this.setHistory(sessionKey, updated);
  }

  clear(sessionKey?: string): void {
    if (sessionKey) {
      this.sessions.delete(sessionKey);
    } else {
      this.sessions.clear();
    }
  }

  sessionCount(): number {
    return this.sessions.size;
  }
}
