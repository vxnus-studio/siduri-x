const mClient = {
  query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 'claim-1', status: 'PENDING' }] }),
  release: jest.fn(),
};
const mPool = {
  query: jest.fn(),
  end: jest.fn(),
  connect: jest.fn().mockResolvedValue(mClient),
};
jest.mock('pg', () => {
  return { Pool: jest.fn(() => mPool) };
});

import { PostgresMemoryOrgan } from './index';
import { Pool } from 'pg';

describe('T2 Memory Disclosure Matrix Contract Tests', () => {
  const connectionString = "postgresql://dummy";
  const organ = new PostgresMemoryOrgan({ connectionString });
  let poolQueryMock: jest.Mock;

  beforeEach(async () => {
    const pool = new Pool();
    poolQueryMock = pool.query as jest.Mock;
    poolQueryMock.mockClear();
    mClient.query.mockClear();
    mClient.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 'claim-1', status: 'PENDING' }] });
    await organ.initialize('companion-a');
  });

  test('Public request query includes public sensitivity / scope filter and companion isolation', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    await organ.searchClaims('hello', {
      channel: 'public',
      audienceId: 'audience-public',
    });

    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE companion_id = $1 AND status = \'APPROVED\''),
      expect.arrayContaining(['companion-a', JSON.stringify(['audience-public'])])
    );
    expect(poolQueryMock.mock.calls[0][0]).toContain("(sensitivity = 'public' OR scope = 'PUBLIC')");
  });

  test('Direct request query allows public and direct sensitivity', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    await organ.searchClaims('hello', {
      channel: 'direct',
      audienceId: 'audience-direct-a',
    });

    expect(poolQueryMock.mock.calls[0][0]).toContain("sensitivity IN ('public', 'private')");
    expect(poolQueryMock.mock.calls[0][1]).toContain(JSON.stringify(['audience-direct-a']));
  });

  test('Private request query allows restricted private claims for explicit private audience', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    await organ.searchClaims('hello', {
      channel: 'private',
      audienceId: 'audience-private-a',
    });

    expect(poolQueryMock.mock.calls[0][0]).toContain("(valid_from IS NULL OR valid_from <= NOW()) AND (valid_until IS NULL OR valid_until >= NOW())");
    expect(poolQueryMock.mock.calls[0][0]).toContain("confidence >= $");
  });

  test('Temporal validity and confidence thresholds are enforced in SQL parameters', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    await organ.searchClaims('hello', {
      channel: 'direct',
      audienceId: 'audience-direct-a',
      minConfidence: 0.8,
    });

    expect(poolQueryMock.mock.calls[0][0]).toContain("(valid_from IS NULL OR valid_from <= NOW()) AND (valid_until IS NULL OR valid_until >= NOW())");
    expect(poolQueryMock.mock.calls[0][1]).toContain(0.8);
  });

  test('Lifecycle methods: markClaimSessionOnly, expireClaim, revokeClaim update status atomically', async () => {
    await organ.markClaimSessionOnly('claim-1');
    expect(mClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'SESSION_ONLY'"),
      ['claim-1', 'companion-a']
    );

    await organ.expireClaim('claim-1');
    expect(mClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'EXPIRED'"),
      ['claim-1', 'companion-a']
    );

    mClient.query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'claim-1', status: 'APPROVED' }] });
    await organ.revokeClaim('claim-1', 'revoked_reason');
    expect(mClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'REVOKED'"),
      ['claim-1', 'companion-a']
    );
  });

  test('Directive lifecycle: disableDirective, expireDirective, revokeDirective update status', async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });

    await organ.disableDirective('dir-1');
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'DISABLED'"),
      ['dir-1', 'companion-a']
    );

    await organ.expireDirective('dir-1');
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'EXPIRED'"),
      ['dir-1', 'companion-a']
    );

    await organ.revokeDirective('dir-1');
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'REVOKED'"),
      ['dir-1', 'companion-a']
    );
  });
});
