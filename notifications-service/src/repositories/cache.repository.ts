import Redis from 'ioredis';
import { config } from '../config';

export class CacheRepository {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  // Email cache operations
  async cacheEmailTemplate(templateName: string, template: any, ttl: number = 3600): Promise<void> {
    const key = `${config.redis.cachePrefix}template:${templateName}`;
    await this.redis.setex(key, ttl, JSON.stringify(template));
  }

  async getCachedEmailTemplate(templateName: string): Promise<any | null> {
    const key = `${config.redis.cachePrefix}template:${templateName}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateTemplateCache(templateName: string): Promise<void> {
    const key = `${config.redis.cachePrefix}template:${templateName}`;
    await this.redis.del(key);
  }

  // Queue management
  async addToQueue(queueName: string, item: any, priority: number = 0): Promise<void> {
    const key = `${config.redis.queuePrefix}${queueName}`;
    await this.redis.zadd(key, priority, JSON.stringify(item));
  }

  async getFromQueue(queueName: string, count: number = 1): Promise<any[]> {
    const key = `${config.redis.queuePrefix}${queueName}`;
    const items = await this.redis.zrevrange(key, 0, count - 1);
    return items.map(item => JSON.parse(item));
  }

  async removeFromQueue(queueName: string, item: any): Promise<void> {
    const key = `${config.redis.queuePrefix}${queueName}`;
    await this.redis.zrem(key, JSON.stringify(item));
  }

  async getQueueLength(queueName: string): Promise<number> {
    const key = `${config.redis.queuePrefix}${queueName}`;
    return await this.redis.zcard(key);
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

  // Email delivery tracking
  async trackEmailDelivery(emailId: string, status: string, details?: any): Promise<void> {
    const key = `email:delivery:${emailId}`;
    const data = {
      status,
      timestamp: new Date().toISOString(),
      details: details || {}
    };
    await this.redis.setex(key, 7 * 24 * 3600, JSON.stringify(data)); // 7 días
  }

  async getEmailDeliveryStatus(emailId: string): Promise<any | null> {
    const key = `email:delivery:${emailId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Failed email tracking
  async addFailedEmail(emailId: string, error: string, retryAfter?: Date): Promise<void> {
    const key = `failed:emails`;
    const data = {
      emailId,
      error,
      failedAt: new Date().toISOString(),
      retryAfter: retryAfter?.toISOString()
    };
    await this.redis.lpush(key, JSON.stringify(data));
    await this.redis.ltrim(key, 0, 999); // Mantener solo los últimos 1000
  }

  async getFailedEmails(count: number = 100): Promise<any[]> {
    const key = `failed:emails`;
    const items = await this.redis.lrange(key, 0, count - 1);
    return items.map(item => JSON.parse(item));
  }

  // Statistics cache
  async cacheStats(stats: any, ttl: number = 300): Promise<void> {
    const key = `${config.redis.cachePrefix}stats`;
    await this.redis.setex(key, ttl, JSON.stringify(stats));
  }

  async getCachedStats(): Promise<any | null> {
    const key = `${config.redis.cachePrefix}stats`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  // General cache operations
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const fullKey = `${config.redis.cachePrefix}${key}`;
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(fullKey, ttl, serializedValue);
    } else {
      await this.redis.set(fullKey, serializedValue);
    }
  }

  async get(key: string): Promise<any | null> {
    const fullKey = `${config.redis.cachePrefix}${key}`;
    const data = await this.redis.get(fullKey);
    return data ? JSON.parse(data) : null;
  }

  async delete(key: string): Promise<void> {
    const fullKey = `${config.redis.cachePrefix}${key}`;
    await this.redis.del(fullKey);
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = `${config.redis.cachePrefix}${key}`;
    const result = await this.redis.exists(fullKey);
    return result === 1;
  }

  // Cleanup methods
  async cleanupExpiredItems(): Promise<void> {
    const patterns = [
      `${config.redis.cachePrefix}*`,
      `${config.redis.queuePrefix}*`
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        // Remove keys that don't have TTL (shouldn't happen but safety check)
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) { // No TTL set
            console.log(`Setting TTL for key without expiration: ${key}`);
            await this.redis.expire(key, 24 * 3600); // 24 hours default
          }
        }
      }
    }
  }
}
