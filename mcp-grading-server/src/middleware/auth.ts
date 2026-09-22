import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// This service is reachable through the API gateway (nginx proxies
// /api/v1/grading), and it spends GROQ credits on every grading call, so no
// route may be anonymous. Two kinds of caller are allowed:
//   - other services (exam-service), with the shared SERVICE_TOKEN header,
//   - staff (teacher/admin) from the frontend, with their access token.

const SERVICE_TOKEN_HEADER = 'x-service-token';
const STAFF_ROLES = ['admin', 'teacher'];

function deny(res: Response, message: string): void {
  res.status(401).json({ success: false, error: message });
}

function isServiceCall(req: Request): boolean {
  const provided = req.header(SERVICE_TOKEN_HEADER);
  const expected = config.auth.serviceToken;
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on different lengths, so compare those first.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface StaffToken {
  userId?: string;
  id?: string;
  role?: string;
}

function verifyStaffToken(req: Request): StaffToken | null {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    // Same signing contract identity-service uses (see its jwt.service.ts).
    return jwt.verify(token, config.auth.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'cba-auth-service',
      audience: 'cba-platform',
    }) as StaffToken;
  } catch {
    return null;
  }
}

/** Only another service may call this route. */
export function requireService(req: Request, res: Response, next: NextFunction): void {
  if (isServiceCall(req)) return next();
  deny(res, 'Service token required');
}

/** A teacher or an admin, or another service, may call this route. */
export function requireStaffOrService(req: Request, res: Response, next: NextFunction): void {
  if (isServiceCall(req)) return next();

  const payload = verifyStaffToken(req);
  if (!payload) {
    deny(res, 'Authentication required');
    return;
  }
  if (!payload.role || !STAFF_ROLES.includes(payload.role)) {
    res.status(403).json({ success: false, error: 'Teacher or admin role required' });
    return;
  }
  next();
}
