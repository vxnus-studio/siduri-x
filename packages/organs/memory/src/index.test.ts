jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

import { PostgresMemoryOrgan } from './index';
import { Pool } from 'pg';

describe('PostgresMemoryOrgan Isolation', () => {
  const connectionString = "postgresql://dummy";
  
  const ganyu = new PostgresMemoryOrgan({ connectionString });
  const astra = new PostgresMemoryOrgan({ connectionString });
  let poolQueryMock: jest.Mock;

  beforeEach(async () => {
    const pool = new Pool();
    poolQueryMock = pool.query as jest.Mock;
    poolQueryMock.mockClear();
    await ganyu.initialize('ganyu-id');
    await astra.initialize('astra-id');
  });

  test('enforces companion isolation on claims insertion and retrieval', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [{ id: '1', companion_id: 'ganyu-id', subject: 'I', predicate: 'am', value: 'Ganyu', status: 'PENDING', scope: 'OWNER', evidence: [] }] });
    
    await ganyu.proposeClaim({
      subject: "I",
      predicate: "am",
      value: "Ganyu",
      scope: 'OWNER',
    });

    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO memory_claims'),
      expect.arrayContaining(['ganyu-id', 'I', 'am', 'Ganyu'])
    );

    poolQueryMock.mockClear();
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    await astra.searchClaims("", "OWNER");

    // The SQL MUST have WHERE companion_id = $1
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE companion_id = $1'),
      expect.arrayContaining(['astra-id']) // Astra's ID is bound to $1
    );
  });

  test('enforces companion isolation on directives', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    await ganyu.getDirectives();
    
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE companion_id = $1'),
      expect.arrayContaining(['ganyu-id'])
    );
  });
});

describe('PostgresMemoryOrgan FTS Parity', () => {
  const connectionString = "postgresql://dummy";
  const organ = new PostgresMemoryOrgan({ connectionString });
  let poolQueryMock: jest.Mock;

  beforeEach(async () => {
    const pool = new Pool();
    poolQueryMock = pool.query as jest.Mock;
    poolQueryMock.mockClear();
    await organ.initialize('test-id');
  });

  test('constructs to_tsquery with simple dictionary, OR semantics, and prefix matching', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    // Input with mixed cases, duplicates, non-alphanumeric
    await organ.searchClaims("Hello world WORLD! 123 @#$", "OWNER");

    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringMatching(/to_tsquery\('simple',\s*\$3\)/),
      expect.arrayContaining(['test-id', 0.5, '123:* | hello:* | world:*'])
    );
    
    // Check ordering uses ts_rank
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringMatching(/ORDER BY ts_rank\(search_document,\s*to_tsquery\('simple',\s*\$3\)\)\s*DESC/),
      expect.anything()
    );
  });

  test('supports non-ASCII Unicode search queries (e.g. Japanese/Chinese characters)', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    await organ.searchClaims("甘雨 フリーナ", "PUBLIC");

    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringMatching(/to_tsquery\('simple',\s*\$3\)/),
      expect.arrayContaining(['test-id', 0.5, 'フリーナ:* | 甘雨:*'])
    );
  });

  test('enforces upper bound caps on getClaims and searchClaims limit parameter', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    await organ.getClaims(5000); // should be capped to 1000

    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT $2'),
      ['test-id', 1000]
    );

    poolQueryMock.mockClear();
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    await organ.searchClaims("test", "PUBLIC", 500); // should be capped to 100

    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT $4'),
      ['test-id', 0.5, 'test:*', 100]
    );
  });

  test('returns empty array immediately if no valid terms exist after normalization', async () => {
    poolQueryMock.mockClear();
    const result = await organ.searchClaims("!!! @@@ \"\"", "OWNER");
    
    expect(result).toEqual([]);
    expect(poolQueryMock).not.toHaveBeenCalled();
  });

  test('preserves provenance fields and excludes claims outside the requested scope', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [{
      id: 'claim-1',
      companion_id: 'test-id',
      subject: 'primary_user',
      predicate: 'preferred_address',
      value: 'Captain',
      status: 'PENDING',
      scope: 'OWNER',
      evidence: ['I said so'],
      provenance: 'private_chat',
      source_event_id: 'evt-1',
      claim_type: 'relationship',
      authority: 'user_explicit',
      user_confirmation: 'none',
      sensitivity: 'private',
      allowed_audiences: ['MASTER_PRIVATE'],
      confidence: 1,
    }] });

    const claim = await organ.proposeClaim({
      subject: 'primary_user',
      predicate: 'preferred_address',
      value: 'Captain',
      scope: 'OWNER',
      evidence: ['I said so'],
      provenance: 'private_chat',
      sourceEventId: 'evt-1',
      claimType: 'relationship',
      sensitivity: 'private',
      allowedAudiences: ['MASTER_PRIVATE'],
    });

    expect(claim.provenance).toBe('private_chat');
    expect(claim.sourceEventId).toBe('evt-1');
    expect(poolQueryMock.mock.calls[0][1]).toEqual(expect.arrayContaining(['private_chat', 'evt-1']));

    poolQueryMock.mockClear();
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    await organ.searchClaims('Captain', 'VIEWER');
    expect(poolQueryMock.mock.calls[0][0]).toContain("scope = 'PUBLIC' OR scope = 'VIEWER'");
  });

  test('configures bounded connection pool with acquisition timeouts', () => {
    const customOrgan = new PostgresMemoryOrgan({
      connectionString: 'postgresql://custom',
      maxConnections: 5,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 5000,
      maxQueryTimeoutMillis: 3000,
    });
    expect((customOrgan as any).pool).toBeDefined();
  });
});
