import { Request, Response, NextFunction } from 'express';

export type Role = 'OWNER' | 'OPERATOR' | 'VIEWER' | 'user' | string;

export interface Identity {
  authenticated: boolean;
  source: 'local' | 'external';
  actorId?: string;
  role?: Role;
  [key: string]: unknown;
}

/**
 * Checks whether an incoming request originates from the local machine loopback interface.
 */
export function isLocalRequest(req: Request): boolean {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('127.0.0.1') ||
    ip === 'localhost'
  );
}

/**
 * Resolves request identity according to the single-owner external machine boundary security model.
 * 
 * - Security is enforced at the external machine boundary, NOT internally.
 * - External network requests require a matching token (AUTH_TOKEN / OWNER_TOKEN).
 * - There are no internal viewer/operator/owner role privileges inside the machine.
 */
export function resolveIdentity(req: Request): Identity {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  const ownerToken = process.env.AUTH_TOKEN || process.env.API_TOKEN || process.env.OWNER_TOKEN;
  const operatorToken = process.env.OPERATOR_TOKEN;
  const configuredToken = ownerToken || operatorToken;

  const local = isLocalRequest(req);

  // 1. Explicit token matches
  if (ownerToken && token === ownerToken) {
    return { authenticated: true, source: local ? 'local' : 'external', role: 'OWNER' };
  }
  if (operatorToken && token === operatorToken) {
    return { authenticated: true, source: local ? 'local' : 'external', role: 'OPERATOR' };
  }

  // 2. Dev local auth role fallback
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && process.env.DEV_LOCAL_AUTH_ROLE) {
    const fallbackRole = process.env.DEV_LOCAL_AUTH_ROLE.toUpperCase() as Role;
    return {
      authenticated: fallbackRole === 'OWNER' || fallbackRole === 'OPERATOR',
      source: 'local',
      role: fallbackRole,
    };
  }

  // 3. Default unauthenticated / visitor
  return { authenticated: false, source: local ? 'local' : 'external', role: 'VIEWER' };
}

/**
 * External boundary authentication middleware.
 * Verifies that requests crossing the external boundary are authorized.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const identity = resolveIdentity(req);
  (req as any).identity = identity;

  if (!identity.authenticated) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid authentication token' });
  }
  next();
}

/**
 * Attaches the resolved machine identity to the request.
 */
export function attachIdentity(req: Request, res: Response, next: NextFunction) {
  (req as any).identity = resolveIdentity(req);
  next();
}

/**
 * Compatibility alias: in single-owner model, all authenticated callers have full access.
 */
export function requireRole(allowedRoles?: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = resolveIdentity(req);
    (req as any).identity = identity;

    if (!identity.authenticated) {
      return res.status(403).json({ error: `Forbidden: requires one of ${(allowedRoles || []).join(', ')}` });
    }
    next();
  };
}
