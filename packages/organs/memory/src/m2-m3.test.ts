import { extractDeterministicTeaching } from './teaching';
import { PostgresMemoryOrgan } from './index';
import { RequestContext } from '@siduri/core';
import { Pool } from 'pg';

jest.mock('pg', () => {
  const mClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const mPool = {
    query: jest.fn(),
    end: jest.fn(),
    connect: jest.fn().mockResolvedValue(mClient),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('T2 M2 & M3 Contract Suite (Teaching & Approval Lifecycle)', () => {
  const mockContext: RequestContext = {
    companionId: 'companion-a',
    actor: {
      actorId: 'actor-river',
      sessionId: 'session-a',
      authorizationRole: 'viewer',
      capabilities: ['chat:direct'],
      authenticated: true,
    },
    conversation: {
      channel: 'direct',
      audienceId: 'audience-direct-actor-river',
      correlationId: 'corr-teach-1',
    },
  };

  // M2: Deterministic Teaching Extraction
  describe('M2 — Deterministic Teaching Extraction', () => {
    test('explicit teaching generates actor-scoped pending candidate, not primary_user', () => {
      const res = extractDeterministicTeaching('Call me River in direct conversations.', mockContext, 'evt-1');
      expect(res.claims).toHaveLength(1);
      expect(res.claims[0].subject).toBe('actor:actor-river');
      expect(res.claims[0].predicate).toBe('preferred_address');
      expect(res.claims[0].value).toBe('River');
      expect(res.claims[0].sensitivity).toBe('private');
      expect(res.claims[0].allowedAudiences).toContain('audience-direct-actor-river');
      expect(res.claims[0].sourceEventId).toBe('evt-1');

      expect(res.behaviorProposals).toHaveLength(1);
      expect(res.behaviorProposals[0].directive).toContain('River in direct conversations');
    });

    test('ordinary conversation produces no candidates', () => {
      const res = extractDeterministicTeaching('What is the weather today?', mockContext);
      expect(res.claims).toHaveLength(0);
      expect(res.behaviorProposals).toHaveLength(0);
    });

    test('companion naming scopes subject to companionId, not generic global name', () => {
      const res = extractDeterministicTeaching('Your name is Lumina.', mockContext, 'evt-comp');
      expect(res.claims).toHaveLength(1);
      expect(res.claims[0].subject).toBe('companion:companion-a');
      expect(res.claims[0].predicate).toBe('name');
      expect(res.claims[0].value).toBe('Lumina');
      expect(res.claims[0].allowedAudiences).toEqual(['audience-public']);
    });
  });

  // M3: Approval & Revision State Machine
  describe('M3 — Approval & Revision Operations', () => {
    let organ: PostgresMemoryOrgan;
    let pool: any;
    let client: any;

    beforeEach(async () => {
      organ = new PostgresMemoryOrgan({ connectionString: 'postgresql://dummy' });
      await organ.initialize('companion-a');
      pool = new Pool();
      client = await pool.connect();
      client.query.mockClear();
    });

    test('approval transitions PENDING to APPROVED atomically and records history', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'claim-1', status: 'PENDING' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({}) // UPDATE
        .mockResolvedValueOnce({}) // INSERT history
        .mockResolvedValueOnce({}); // COMMIT

      await organ.approveClaim('claim-1');

      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE memory_claims'),
        ['claim-1', 'companion-a']
      );
      expect(client.query).toHaveBeenCalledWith('COMMIT');
    });

    test('approving an already APPROVED claim fails closed without mutation', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'claim-1', status: 'APPROVED' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(organ.approveClaim('claim-1')).rejects.toThrow(/already APPROVED/i);
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('rejection transitions PENDING to REJECTED atomically', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'claim-1', status: 'PENDING' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({}) // UPDATE
        .mockResolvedValueOnce({}) // INSERT history
        .mockResolvedValueOnce({}); // COMMIT

      await organ.rejectClaim('claim-1');

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'REJECTED'"),
        ['claim-1', 'companion-a']
      );
      expect(client.query).toHaveBeenCalledWith('COMMIT');
    });

    test('supersession creates linked pending candidate and marks old APPROVED claim SUPERSEDED', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'claim-1', status: 'APPROVED' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({}) // UPDATE old claim
        .mockResolvedValueOnce({}) // INSERT history
        .mockResolvedValueOnce({ rows: [{ id: 'claim-2', status: 'PENDING', subject: 'actor:actor-river', predicate: 'preferred_address', value: 'Sky', supersedes: 'claim-1' }] }) // INSERT new claim
        .mockResolvedValueOnce({}); // COMMIT

      const replacement = await organ.supersedeClaim('claim-1', {
        subject: 'actor:actor-river',
        predicate: 'preferred_address',
        value: 'Sky',
        scope: 'PUBLIC',
      });

      expect(replacement.id).toBe('claim-2');
      expect(replacement.status).toBe('PENDING');
      expect(client.query).toHaveBeenCalledWith('COMMIT');
    });

    test('cannot supersede an unapproved or already superseded claim', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'claim-1', status: 'SUPERSEDED' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(organ.supersedeClaim('claim-1', {
        subject: 'actor:actor-river',
        predicate: 'preferred_address',
        value: 'Sky',
        scope: 'PUBLIC',
      })).rejects.toThrow(/Cannot supersede claim in status SUPERSEDED/i);
    });
  });
});
