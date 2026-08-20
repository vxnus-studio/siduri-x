import request from 'supertest';

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn()
}));
jest.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: jest.fn()
}));

import { createGateway } from './index';

describe('Gateway Service', () => {
  it('exposes /chat stub', async () => {
    const app = createGateway();
    const response = await request(app).post('/chat').send({ message: "hello" });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("MCP Gateway Chat Placeholder");
  });
});
