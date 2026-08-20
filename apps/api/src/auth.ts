import { Request, Response, NextFunction } from 'express';

export type Role = 'OWNER' | 'OPERATOR' | 'VIEWER';

export interface Identity {
  role: Role;
}

export function resolveIdentity(req: Request): Identity {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  // 1. Explicit token matches
  if (process.env.OWNER_TOKEN && token === process.env.OWNER_TOKEN) {
    return { role: 'OWNER' };
  }
  if (process.env.OPERATOR_TOKEN && token === process.env.OPERATOR_TOKEN) {
    return { role: 'OPERATOR' };
  }

  // 2. Development fallback
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && process.env.DEV_LOCAL_AUTH_ROLE) {
    const fallbackRole = process.env.DEV_LOCAL_AUTH_ROLE.toUpperCase() as Role;
    if (['OWNER', 'OPERATOR', 'VIEWER'].includes(fallbackRole)) {
      return { role: fallbackRole };
    }
  }

  // Default
  return { role: 'VIEWER' };
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = resolveIdentity(req);
    (req as any).identity = identity;
    
    if (!allowedRoles.includes(identity.role)) {
      return res.status(403).json({ error: `Forbidden: requires one of ${allowedRoles.join(', ')}` });
    }
    next();
  };
}

export function attachIdentity(req: Request, res: Response, next: NextFunction) {
  (req as any).identity = resolveIdentity(req);
  next();
}
