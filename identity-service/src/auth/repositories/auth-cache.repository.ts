// src/auth/repositories/auth-cache.repository.ts
//
// Redis-backed cache for the auth module: access-token blacklist (logout),
// cached user snapshots (used by the host authenticate middleware to avoid a
// DB round trip on every request), OTP codes, and login rate limiting.
// Ported from the old auth-service's CacheRepository, reusing the shared
// Redis client from database/connections.ts instead of opening a second
// connection.

import Redis from 'ioredis';
import config from '../../config';
import { getRedisClient } from '../../database/connections';

export class AuthCacheRepository {
  private redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  // ================================
  // SESSION SNAPSHOT (per-user, short-lived)
  // ================================

  async setSession(userId: string, sessionData: any, ttlSeconds: number = 3600): Promise<void> {
    const key = `${config.redis.authSessionPrefix}:${userId}`;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(sessionData));
  }

  async deleteSession(userId: string): Promise<void> {
    const key = `${config.redis.authSessionPrefix}:${userId}`;
    await this.redis.del(key);
  }

  // ================================
  // ACCESS TOKEN BLACKLIST (explicit logout)
  // ================================

  async blacklistToken(tokenJti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    const key = `${config.redis.authBlacklistPrefix}:${tokenJti}`;
    await this.redis.setex(key, ttlSeconds, 'blacklisted');
  }

  async isTokenBlacklisted(tokenJti: string): Promise<boolean> {
    const key = `${config.redis.authBlacklistPrefix}:${tokenJti}`;
    const result = await this.redis.get(key);
    return result === 'blacklisted';
  }

  // ================================
  // USER SNAPSHOT CACHE (active-status check on every authenticated request)
  // ================================

  async cacheUser(userId: string, userData: any, ttlSeconds: number = 1800): Promise<void> {
    const key = `auth:user:${userId}`;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(userData));
  }

  async getCachedUser(userId: string): Promise<any | null> {
    const key = `auth:user:${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const key = `auth:user:${userId}`;
    await this.redis.del(key);
  }

  // ================================
  // RATE LIMITING (login, OTP)
  // ================================

  async checkRateLimit(identifier: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const key = `auth:ratelimit:${identifier}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - current);
    return { allowed: current <= limit, remaining };
  }

  // ================================
  // GENERIC (OTP codes)
  // ================================

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async get(key: string): Promise<any | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /** Atomically reads and deletes a key, so a value can be used exactly once. */
  async consume(key: string): Promise<any | null> {
    const results = await this.redis.multi().get(key).del(key).exec();
    const data = results?.[0]?.[1] as string | null | undefined;
    return data ? JSON.parse(data) : null;
  }
}
