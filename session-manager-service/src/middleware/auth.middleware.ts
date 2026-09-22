import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { technicalVerificationService } from '../services/TechnicalVerificationService';
import { logger } from '../utils/logger';

// Same access token identity-service issues (jwt.service.ts): HS256, payload
// field `userId`, issuer 'cba-auth-service', audience 'cba-platform'. This
// mirrors the pattern notifications-service/src/services/socket.service.ts
// uses to verify the same tokens.
export interface AuthTokenPayload {
  userId: string;
  email?: string;
  role?: string;
  permissions?: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
const SERVICE_TOKEN = process.env.SERVICE_TOKEN;

// Roles allowed to READ (never write) any user's technical verification, for
// proctor/teacher/admin monitoring dashboards.
const READ_ANY_ROLES = ['admin', 'teacher', 'proctor'];

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  return null;
}

/**
 * All /api/v1/technical/* routes had no authentication at all before this
 * middleware (removed along with the rest of the JWT stack in c3e7349) —
 * anyone could read or write any user's verification by id. This restores
 * it using the same secret/issuer/audience every other service verifies
 * identity-service tokens with.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  if (!JWT_SECRET) {
    logger.error('JWT_SECRET is not configured; refusing to authenticate request');
    res.status(500).json({ success: false, message: 'Server misconfiguration' });
    return;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'cba-auth-service',
      audience: 'cba-platform',
    }) as AuthTokenPayload;

    if (!decoded?.userId) {
      res.status(401).json({ success: false, message: 'Invalid token payload' });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Ownership gate for routes shaped /user/:userId[...]. A user may only act
 * on their own verification. admin/teacher/proctor may READ (GET) any
 * user's verification for monitoring, but never write on someone's behalf.
 */
export const requireOwnershipOrReadRole = (req: Request, res: Response, next: NextFunction): void => {
  const routeUserId = req.params.userId;
  const caller = req.user;
  if (!caller) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  if (caller.userId === routeUserId) {
    next();
    return;
  }

  if (req.method === 'GET' && caller.role && READ_ANY_ROLES.includes(caller.role)) {
    next();
    return;
  }

  res.status(403).json({ success: false, message: 'Forbidden: not your verification' });
};

/**
 * Ownership gate for routes shaped /:verificationId[...] — these carry no
 * userId in the path, so the record has to be loaded to compare its stored
 * userId against the caller. Used for browser/permissions/devices/
 * network-test/microphone-test/camera-test/audio-test/finalize/mark-used
 * and the GET-by-id route.
 */
export const requireVerificationOwnership = (mode: 'read' | 'write') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { verificationId } = req.params;
    if (!verificationId) {
      res.status(400).json({ success: false, message: 'verificationId is required' });
      return;
    }

    const verification = await technicalVerificationService.getVerification(verificationId);
    if (!verification) {
      res.status(404).json({ success: false, message: 'Verificación no encontrada' });
      return;
    }

    if (verification.userId === caller.userId) {
      next();
      return;
    }

    if (mode === 'read' && caller.role && READ_ANY_ROLES.includes(caller.role)) {
      next();
      return;
    }

    res.status(403).json({ success: false, message: 'Forbidden: not your verification' });
  };
};

/**
 * Restricts a route to admins only — used for /stats, an aggregate view
 * across every user's verifications (not any single user's record, so the
 * ownership-based gates above don't apply).
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const caller = req.user;
  if (!caller) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  if (caller.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Forbidden: admin only' });
    return;
  }
  next();
};

/**
 * Guards the /internal/technical/* routes used by exam-service to enforce
 * the technical-verification gate server-side. NOT proxied by nginx (only
 * /api/v1/technical is — see nginx/nginx.conf), so this is only reachable
 * from inside the Docker network, and still requires this token on top of
 * that. Timing-safe compare to avoid leaking the secret via response-time
 * side channel.
 */
export const verifyServiceToken = (req: Request, res: Response, next: NextFunction): void => {
  if (!SERVICE_TOKEN) {
    logger.error('SERVICE_TOKEN is not configured; refusing internal request');
    res.status(500).json({ success: false, message: 'Server misconfiguration' });
    return;
  }

  const provided = req.headers['x-service-token'];
  if (typeof provided !== 'string' || !provided) {
    res.status(401).json({ success: false, message: 'Missing service token' });
    return;
  }

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(SERVICE_TOKEN);
  const isValid = providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!isValid) {
    res.status(401).json({ success: false, message: 'Invalid service token' });
    return;
  }

  next();
};
