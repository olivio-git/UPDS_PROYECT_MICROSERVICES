import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Same signing contract every other service verifies (see
// identity-service/src/auth/services/jwt.service.ts): HS256, payload
// { userId, email, role, permissions }, issuer 'cba-auth-service', audience
// 'cba-platform', secret JWT_SECRET. Mirrors mcp-grading-server's
// middleware/auth.ts and this service's own socket.service.ts — same secret,
// same issuer/audience check, same SERVICE_TOKEN convention for
// service-to-service calls. Not inventing a new scheme here.
const SERVICE_TOKEN_HEADER = 'x-service-token';
const ADMIN_ROLES = ['admin'];

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  role?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      isServiceCall?: boolean;
    }
  }
}

function deny(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, message });
}

function isServiceCall(req: Request): boolean {
  const provided = req.header(SERVICE_TOKEN_HEADER);
  const expected = config.auth.serviceToken;
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on mismatched lengths, so compare those first.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  return null;
}

function verifyAccessToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: 'cba-auth-service',
      audience: 'cba-platform',
    }) as { userId?: string; email?: string; role?: string; exp?: unknown };

    // jwt.verify only enforces exp when present; a token minted without one
    // would never expire, so require it explicitly.
    if (!decoded?.userId || typeof decoded.exp !== 'number') return null;
    return { userId: decoded.userId, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}

export function isAdmin(user?: AuthenticatedUser): boolean {
  return !!user?.role && ADMIN_ROLES.includes(user.role);
}

/**
 * Only another trusted service (shared SERVICE_TOKEN header) may call this
 * route. Used for the internal fallback grading-service posts to when its
 * Kafka publish fails (see mcp-grading-server's notification.service.ts
 * sendInAppFallback).
 */
export function requireService(req: Request, res: Response, next: NextFunction): void {
  if (isServiceCall(req)) {
    req.isServiceCall = true;
    next();
    return;
  }
  deny(res, 401, 'Service token required');
}

/**
 * Any authenticated end user (staff or student), or another trusted service.
 * Populates req.user for end users; ownership checks happen downstream
 * (controller) since they depend on the specific resource being accessed.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isServiceCall(req)) {
    req.isServiceCall = true;
    next();
    return;
  }

  const token = extractToken(req);
  if (!token) {
    deny(res, 401, 'Autenticación requerida');
    return;
  }

  const user = verifyAccessToken(token);
  if (!user) {
    deny(res, 401, 'Token inválido o expirado');
    return;
  }

  req.user = user;
  next();
}

/** An admin, or another trusted service. */
export function requireAdminOrService(req: Request, res: Response, next: NextFunction): void {
  if (isServiceCall(req)) {
    req.isServiceCall = true;
    next();
    return;
  }

  const token = extractToken(req);
  if (!token) {
    deny(res, 401, 'Autenticación requerida');
    return;
  }

  const user = verifyAccessToken(token);
  if (!user) {
    deny(res, 401, 'Token inválido o expirado');
    return;
  }

  if (!isAdmin(user)) {
    deny(res, 403, 'Se requiere rol de administrador');
    return;
  }

  req.user = user;
  next();
}
