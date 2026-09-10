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

  test('Query maintains companion isolation in single-owner mode', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    await organ.searchClaims('hello', {
      limit: 10,
    });

    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE companion_id = $1 AND status = \'APPROVED\''),
      expect.arrayContaining(['companion-a'])
    );
  });

  test('Direct query allows memory retrieval in single-owner mode', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    await organ.searchClaims('hello');

    expect(poolQueryMock.mock.calls[0][0]).toContain("WHERE companion_id = $1 AND status = 'APPROVED'");
  });

  test('Sensitivity filter applies to query when specified', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    await organ.searchClaims('hello', {
      sensitivity: 'restricted',
    });

    expect(poolQueryMock.mock.calls[0][0]).toContain("(valid_from IS NULL OR valid_from <= NOW()) AND (valid_until IS NULL OR valid_until >= NOW())");
    expect(poolQueryMock.mock.calls[0][0]).toContain("sensitivity = $");
    expect(poolQueryMock.mock.calls[0][1]).toContain('restricted');
  });

  test('Temporal validity and confidence thresholds are enforced in SQL parameters', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    await organ.searchClaims('hello', {
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
    mClient.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 'dir-1', status: 'ACTIVE' }] });

    await organ.disableDirective('dir-1');
    expect(mClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'DISABLED'"),
      ['dir-1', 'companion-a']
    );

    await organ.expireDirective('dir-1');
    expect(mClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'EXPIRED'"),
      ['dir-1', 'companion-a']
    );

    await organ.revokeDirective('dir-1');
    expect(mClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'REVOKED'"),
      ['dir-1', 'companion-a']
    );
  });
});
