import { NextFunction, Request, Response } from 'express';
import { verifyUserToken, VerifiedUser } from '../db/supabase';
import { logger, requestId } from '../utils/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      user?: VerifiedUser;
      startedAt?: number;
    }
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  req.requestId = requestId();
  req.startedAt = Date.now();
  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    const duration = Date.now() - (req.startedAt ?? Date.now());
    logger.info('http', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      user: req.user?.id,
      status: res.statusCode,
      durationMs: duration,
    });
    return originalJson(body);
  }) as Response['json'];

  next();
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Requires a verified Supabase access token. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const user = await verifyUserToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }
  req.user = user;
  next();
}

/** Optional auth: attaches user if a valid token is present. */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  if (token) {
    const user = await verifyUserToken(token);
    if (user) req.user = user;
  }
  next();
}

/** Role-based authorization: only the listed roles may continue. */
export function requireRole(...roles: Array<'admin' | 'supervisor' | 'agent'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role as 'admin' | 'supervisor' | 'agent')) {
      res.status(403).json({ error: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}