import { SessionHistoryManager } from './session-history';

describe('SessionHistoryManager', () => {
  test('isolates history across distinct sessions', () => {
    const manager = new SessionHistoryManager();

    manager.append('session-alice', { role: 'user', content: 'Alice message' });
    manager.append('session-bob', { role: 'user', content: 'Bob message' });

    expect(manager.getHistory('session-alice')).toEqual([
      { role: 'user', content: 'Alice message' },
    ]);
    expect(manager.getHistory('session-bob')).toEqual([
      { role: 'user', content: 'Bob message' },
    ]);
  });

  test('bounds messages per session to configured limit and strips null bytes', () => {
    const manager = new SessionHistoryManager({ maxMessagesPerSession: 3 });

    manager.append('sess-1', { role: 'user', content: 'm1\0' });
    manager.append('sess-1', { role: 'assistant', content: 'm2' });
    manager.append('sess-1', { role: 'user', content: 'm3' });
    manager.append('sess-1', { role: 'assistant', content: 'm4' });

    const history = manager.getHistory('sess-1');
    expect(history).toHaveLength(3);
    expect(history[0].content).toBe('m2');
    expect(history[2].content).toBe('m4');
  });

  test('bounds maximum active sessions with LRU eviction', () => {
    const manager = new SessionHistoryManager({ maxSessions: 2 });

    manager.append('sess-1', { role: 'user', content: 'm1' });
    manager.append('sess-2', { role: 'user', content: 'm2' });
    expect(manager.sessionCount()).toBe(2);

    manager.append('sess-3', { role: 'user', content: 'm3' });
    expect(manager.sessionCount()).toBe(2);
    expect(manager.getHistory('sess-1')).toEqual([]);
    expect(manager.getHistory('sess-2')).toHaveLength(1);
    expect(manager.getHistory('sess-3')).toHaveLength(1);
  });
});
