import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SqliteArchiveLedger } from './archive-ledger';

describe('@sidurijs/archive Domain Package (RFC VX-26-13: Audited Interaction Ledger)', () => {
  let tmpDir: string;
  let dbPath: string;
  let ledger: SqliteArchiveLedger;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siduri-archive-test-'));
    dbPath = path.join(tmpDir, 'test-archive.db');
    ledger = new SqliteArchiveLedger({ dbPath });
  });

  afterEach(() => {
    try {
      ledger.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('records append-only interaction events with immutable timestamps', async () => {
    const recorded = await ledger.recordEvent({
      companionId: 'siduri-1',
      sourceType: 'user_chat_turn',
      payload: { message: 'Hello Siduri, let us configure your directives.' },
    });

    expect(recorded.id).toBeDefined();
    expect(recorded.companionId).toBe('siduri-1');
    expect(recorded.sourceType).toBe('user_chat_turn');
    expect(recorded.occurredAt).toBeDefined();

    const recent = await ledger.getRecentEvents('siduri-1');
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe(recorded.id);
    expect(recent[0].payload).toEqual({ message: 'Hello Siduri, let us configure your directives.' });
  });

  it('enforces strict companion isolation across audit logs', async () => {
    await ledger.recordEvent({
      companionId: 'comp-alpha',
      sourceType: 'tool_execution',
      payload: { tool: 'calculator', input: '2+2' },
    });

    await ledger.recordEvent({
      companionId: 'comp-beta',
      sourceType: 'tool_execution',
      payload: { tool: 'bash', input: 'ls' },
    });

    const alphaEvents = await ledger.getRecentEvents('comp-alpha');
    const betaEvents = await ledger.getRecentEvents('comp-beta');

    expect(alphaEvents).toHaveLength(1);
    expect(alphaEvents[0].payload).toEqual({ tool: 'calculator', input: '2+2' });

    expect(betaEvents).toHaveLength(1);
    expect(betaEvents[0].payload).toEqual({ tool: 'bash', input: 'ls' });
  });

  it('searches events using FTS5 full-text indexing', async () => {
    await ledger.recordEvent({
      companionId: 'comp-search',
      sourceType: 'chat_turn',
      payload: { text: 'Exploring the quantum teleportation algorithm in physics.' },
    });

    await ledger.recordEvent({
      companionId: 'comp-search',
      sourceType: 'chat_turn',
      payload: { text: 'A recipe for making homemade sourdough bread.' },
    });

    const results = await ledger.searchEvents('comp-search', 'teleportation');
    expect(results).toHaveLength(1);
    expect((results[0].payload as any).text).toContain('teleportation');

    const emptyResults = await ledger.searchEvents('comp-search', 'astrophysics');
    expect(emptyResults).toHaveLength(0);
  });

  it('retrieves single event by ID', async () => {
    const event = await ledger.recordEvent({
      id: 'custom-event-id-999',
      companionId: 'comp-lookup',
      sourceType: 'system_alert',
      payload: { code: 'ERR_TIMEOUT', severity: 'medium' },
    });

    const fetched = await ledger.getEvent('custom-event-id-999');
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(event.id);
    expect(fetched?.sourceType).toBe('system_alert');

    const notFound = await ledger.getEvent('non-existent-id');
    expect(notFound).toBeUndefined();
  });

  it('purged directives & memory claims by design (RFC VX-26-13 invariant)', () => {
    // The archive store is purely an audit ledger and must not expose directive management
    expect((ledger as any).proposeDirective).toBeUndefined();
    expect((ledger as any).getDirectives).toBeUndefined();
    expect((ledger as any).approveDirective).toBeUndefined();
    expect((ledger as any).proposeClaim).toBeUndefined();
    expect((ledger as any).approveClaim).toBeUndefined();
  });

  it('persists audit events durably across ledger restarts', async () => {
    await ledger.recordEvent({
      id: 'durable-evt-1',
      companionId: 'comp-durable',
      sourceType: 'migration',
      payload: { version: '2.0.0' },
    });

    ledger.close();

    const restartedLedger = new SqliteArchiveLedger({ dbPath });
    const events = await restartedLedger.getRecentEvents('comp-durable');
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('durable-evt-1');
    restartedLedger.close();
  });
});
