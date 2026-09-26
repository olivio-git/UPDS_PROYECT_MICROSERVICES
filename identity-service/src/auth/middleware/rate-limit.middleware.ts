// src/auth/middleware/rate-limit.middleware.ts
//
// Redis-backed rate limiter for login/OTP/reset endpoints, ported from
// auth-service's AuthMiddleware.rateLimiter. The host's in-memory
// middlewareStacks.basicRateLimit is per-process and resets on restart; this
// one is shared across replicas via Redis, matching what auth-service gave
// these specific endpoints before the merge.
//
// Lazily instantiates AuthCacheRepository on first request instead of at
// import time, because this module is required before database/connections'
// Redis client is connected (routes load only after connectDatabases()) but
// route *definitions* — including this middleware factory — are still
// evaluated eagerly when auth.routes.ts is imported.

import { NextFunction, Request, Response } from 'express';
import { AuthCacheRepository } from '../repositories/auth-cache.repository';
import { ApiResponse } from '../../types';

let cacheRepo: AuthCacheRepository | null = null;
function getCacheRepo(): AuthCacheRepository {
  if (!cacheRepo) cacheRepo = new AuthCacheRepository();
  return cacheRepo;
}

/**
 * @param perAccount cuenta por cuenta (email del cuerpo) en vez de por IP.
 *        Un laboratorio entero sale por una sola IP: contar por IP dejaba
 *        fuera al onceavo estudiante que intentaba entrar, aunque cada uno
 *        hubiera escrito bien su contraseña la primera vez.
 */
export const authRateLimiter = (
  maxRequests: number,
  windowSeconds: number,
  perAccount = false,
) => {
  return async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const identifier = (perAccount && email) || req.ip || 'unknown';
      // One counter per route: login, OTP and reset have different caps and must
      // not drain each other's budget.
      const key = `${req.baseUrl}${req.path}:${identifier}`;
      const result = await getCacheRepo().checkRateLimit(key, maxRequests, windowSeconds);

      if (!result.allowed) {
        res.status(429).json({
          success: false,
          message: 'Demasiadas solicitudes',
          error: 'Rate limit exceeded',
          data: { retryAfter: windowSeconds, remaining: result.remaining },
        });
        return;
      }

      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
      });

      next();
    } catch (error) {
      // Never let a Redis hiccup block login entirely.
      console.error('[authRateLimiter] Error checking rate limit:', error);
      next();
    }
  };
};
