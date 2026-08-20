import { resolveIdentity } from './auth';

function testResolveIdentity() {
  console.log("Testing resolveIdentity...");

  // Mock Request object
  const mockReq = (token?: string) => ({
    headers: {
      authorization: token ? `Bearer ${token}` : undefined
    }
  } as any);

  // Set environment vars
  process.env.OWNER_TOKEN = 'owner-secret';
  process.env.OPERATOR_TOKEN = 'operator-secret';
  process.env.NODE_ENV = 'production';
  process.env.DEV_LOCAL_AUTH_ROLE = 'OWNER';

  // 1. Explicit Owner Token
  const ownerId = resolveIdentity(mockReq('owner-secret'));
  if (ownerId.role !== 'OWNER') throw new Error("Expected OWNER");

  // 2. Explicit Operator Token
  const opId = resolveIdentity(mockReq('operator-secret'));
  if (opId.role !== 'OPERATOR') throw new Error("Expected OPERATOR");

  // 3. No token (Production)
  const viewerId = resolveIdentity(mockReq());
  if (viewerId.role !== 'VIEWER') throw new Error("Expected VIEWER in prod");

  // 4. Invalid token
  const invalidId = resolveIdentity(mockReq('invalid-token'));
  if (invalidId.role !== 'VIEWER') throw new Error("Expected VIEWER for invalid token");

  // 5. Development Fallback
  process.env.NODE_ENV = 'development';
  const devId = resolveIdentity(mockReq());
  if (devId.role !== 'OWNER') throw new Error("Expected OWNER in dev fallback");

  console.log("SUCCESS: Identity resolution correctly handles tokens and environments.");
}

testResolveIdentity();
