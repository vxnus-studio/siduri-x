import request from 'supertest';

// Mock MCP SDK before importing index
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockImplementation(async (transport) => { transport._res.end(); })
  }))
}));
jest.mock('@modelcontextprotocol/sdk/server/sse.js', () => ({
  SSEServerTransport: jest.fn()
}));

jest.mock('@siduri/memory', () => {
  return {
    PostgresMemoryOrgan: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      getClaims: jest.fn().mockResolvedValue([{ id: '1', subject: 'I', predicate: 'am', value: 'test' }])
    }))
  };
});

import { createServer } from './index';

describe('Memory Service', () => {
  it('exposes GET /api/claims properly', async () => {
    const { app } = createServer({ connectionString: 'postgres://dummy' });
    const response = await request(app).get('/api/claims');
    expect(response.status).toBe(200);
    expect(response.body.claims).toHaveLength(1);
    expect(response.body.claims[0].subject).toBe('I');
  });

});
