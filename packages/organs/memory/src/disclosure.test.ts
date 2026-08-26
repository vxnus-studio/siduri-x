jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    end: jest.fn(),
    connect: jest.fn(),
  };
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

    expect(poolQueryMock.mock.calls[0][0]).toContain("sensitivity IN ('public', 'private', 'restricted')");
    expect(poolQueryMock.mock.calls[0][1]).toContain(JSON.stringify(['audience-private-a']));
  });

  test('Lifecycle methods: markClaimSessionOnly, expireClaim, revokeClaim update status atomically', async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });

    await organ.markClaimSessionOnly('claim-1');
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'SESSION_ONLY'"),
      ['claim-1', 'companion-a']
    );

    await organ.expireClaim('claim-1');
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'EXPIRED'"),
      ['claim-1', 'companion-a']
    );

    await organ.revokeClaim('claim-1', 'revoked_reason');
    expect(poolQueryMock).toHaveBeenCalledWith(
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
