import { resolveIdentity } from './auth';

describe('Auth Identity Resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const mockReq = (token?: string) => ({
    headers: {
      authorization: token ? `Bearer ${token}` : undefined
    }
  } as any);

  test('resolves explicit owner token', () => {
    process.env.OWNER_TOKEN = 'owner-secret';
    process.env.OPERATOR_TOKEN = 'operator-secret';
    process.env.NODE_ENV = 'production';

    const ownerId = resolveIdentity(mockReq('owner-secret'));
    expect(ownerId.role).toBe('OWNER');
  });

  test('resolves explicit operator token', () => {
    process.env.OWNER_TOKEN = 'owner-secret';
    process.env.OPERATOR_TOKEN = 'operator-secret';
    process.env.NODE_ENV = 'production';

    const opId = resolveIdentity(mockReq('operator-secret'));
    expect(opId.role).toBe('OPERATOR');
  });

  test('defaults to viewer when no token is present in production', () => {
    process.env.NODE_ENV = 'production';
    const viewerId = resolveIdentity(mockReq());
    expect(viewerId.role).toBe('VIEWER');
  });

  test('defaults to viewer for invalid token in production', () => {
    process.env.NODE_ENV = 'production';
    const invalidId = resolveIdentity(mockReq('invalid-token'));
    expect(invalidId.role).toBe('VIEWER');
  });

  test('resolves development fallback role', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_LOCAL_AUTH_ROLE = 'OWNER';
    const devId = resolveIdentity(mockReq());
    expect(devId.role).toBe('OWNER');
  });
});
