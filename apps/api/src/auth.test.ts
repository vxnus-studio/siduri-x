import { resolveIdentity, requireAuth } from './auth';

describe('Auth Identity Resolution (Single-Owner External Boundary)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const mockReq = (token?: string, ip: string = '192.168.1.50') => ({
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
    },
    ip,
    socket: { remoteAddress: ip },
  } as any);

  test('authenticates external request when token matches configured AUTH_TOKEN', () => {
    process.env.AUTH_TOKEN = 'secret-auth-key';
    process.env.NODE_ENV = 'production';

    const identity = resolveIdentity(mockReq('secret-auth-key'));
    expect(identity.authenticated).toBe(true);
    expect(identity.source).toBe('external');
  });

  test('authenticates external request when token matches legacy OWNER_TOKEN', () => {
    process.env.OWNER_TOKEN = 'owner-secret';
    process.env.NODE_ENV = 'production';

    const identity = resolveIdentity(mockReq('owner-secret'));
    expect(identity.authenticated).toBe(true);
    expect(identity.source).toBe('external');
  });

  test('rejects external request when token is missing in production with configured token', () => {
    process.env.AUTH_TOKEN = 'secret-auth-key';
    process.env.NODE_ENV = 'production';

    const identity = resolveIdentity(mockReq());
    expect(identity.authenticated).toBe(false);
  });

  test('rejects external request for invalid token in production', () => {
    process.env.AUTH_TOKEN = 'secret-auth-key';
    process.env.NODE_ENV = 'production';

    const identity = resolveIdentity(mockReq('invalid-token'));
    expect(identity.authenticated).toBe(false);
  });

  test('authenticates local loopback request in development mode', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_LOCAL_AUTH_ROLE = 'OWNER';
    process.env.AUTH_TOKEN = 'secret-key';

    const devIdentity = resolveIdentity(mockReq(undefined, '127.0.0.1'));
    expect(devIdentity.authenticated).toBe(true);
    expect(devIdentity.source).toBe('local');
  });

  test('requireAuth middleware accepts authenticated request and rejects unauthenticated with 401', () => {
    process.env.AUTH_TOKEN = 'secret-key';
    process.env.NODE_ENV = 'production';

    const nextFn = jest.fn();
    const resUnauthorized = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    // Unauthorized call
    requireAuth(mockReq('wrong-token'), resUnauthorized, nextFn);
    expect(resUnauthorized.status).toHaveBeenCalledWith(401);
    expect(nextFn).not.toHaveBeenCalled();

    // Authorized call
    const resAuthorized = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;
    requireAuth(mockReq('secret-key'), resAuthorized, nextFn);
    expect(nextFn).toHaveBeenCalled();
  });
});
