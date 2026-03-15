import Redis from 'ioredis';
import { config } from '../config';

export class CacheRepository {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  // Session management
  async setSession(userId: string, sessionData: any, ttl: number = 3600): Promise<void> {
    const key = `${config.redis.sessionPrefix}${userId}`;
    await this.redis.setex(key, ttl, JSON.stringify(sessionData));
  }

  async getSession(userId: string): Promise<any | null> {
    const key = `${config.redis.sessionPrefix}${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(userId: string): Promise<void> {
    const key = `${config.redis.sessionPrefix}${userId}`;
    await this.redis.del(key);
  }

  // Token blacklist
  async blacklistToken(tokenJti: string, ttl: number): Promise<void> {
    const key = `${config.redis.blacklistPrefix}${tokenJti}`;
    await this.redis.setex(key, ttl, 'blacklisted');
  }

  async isTokenBlacklisted(tokenJti: string): Promise<boolean> {
    const key = `${config.redis.blacklistPrefix}${tokenJti}`;
    const result = await this.redis.get(key);
    return result === 'blacklisted';
  }

  // User cache
  async cacheUser(userId: string, userData: any, ttl: number = 1800): Promise<void> {
    const key = `user:${userId}`;
    await this.redis.setex(key, ttl, JSON.stringify(userData));
  }

  async getCachedUser(userId: string): Promise<any | null> {
    const key = `user:${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const key = `user:${userId}`;
    await this.redis.del(key);
  }

  // Rate limiting
  async checkRateLimit(identifier: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number }> {
    const key = `ratelimit:${identifier}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }
    
    const remaining = Math.max(0, limit - current);
    return {
      allowed: current <= limit,
      remaining
    };
  }

  // General cache operations
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serializedValue);
    } else {
      await this.redis.set(key, serializedValue);
    }
  }

  async get(key: string): Promise<any | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }
}
