import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { env } from './env';

let redisClient: RedisClientType;

export const connectRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      socket: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT
      },
      password: env.REDIS_PASSWORD || undefined
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // Don't exit, Redis is optional for caching
  }
};

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

// Cache helper functions
export const cache = {
  async get(key: string): Promise<any> {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  },

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error(`Error setting cache key ${key}:`, error);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error(`Error deleting cache key ${key}:`, error);
    }
  },

  async flush(): Promise<void> {
    try {
      await redisClient.flushAll();
    } catch (error) {
      logger.error('Error flushing cache:', error);
    }
  }
};