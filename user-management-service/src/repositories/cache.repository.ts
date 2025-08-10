import Redis from 'ioredis';
import { getRedisClient } from '../database/connections';
import config from '../config';

export class CacheRepository {
  private redis: Redis;
  private cachePrefix: string;
  private sessionPrefix: string;

  constructor() {
    this.redis = getRedisClient();
    this.cachePrefix = config.redis.cachePrefix;
    this.sessionPrefix = config.redis.sessionPrefix;
  }

  // ================================
  // GENERIC CACHE OPERATIONS
  // ================================

  async get<T>(key: string): Promise<T | null> {
    try {
      const cachedData = await this.redis.get(this.getCacheKey(key));
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      console.error('Error obteniendo dato del cache:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      const result = await this.redis.setex(this.getCacheKey(key), ttlSeconds, serializedValue);
      return result === 'OK';
    } catch (error) {
      console.error('Error guardando en cache:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(this.getCacheKey(key));
      return result > 0;
    } catch (error) {
      console.error('Error eliminando del cache:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.getCacheKey(key));
      return result === 1;
    } catch (error) {
      console.error('Error verificando existencia en cache:', error);
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(this.getCacheKey(key), ttlSeconds);
      return result === 1;
    } catch (error) {
      console.error('Error configurando expiración:', error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(this.getCacheKey(key));
    } catch (error) {
      console.error('Error obteniendo TTL:', error);
      return -1;
    }
  }

  // ================================
  // PATTERN OPERATIONS
  // ================================

  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(this.getCacheKey(pattern));
      if (keys.length === 0) return 0;
      
      const result = await this.redis.del(...keys);
      return result;
    } catch (error) {
      console.error('Error eliminando patrón del cache:', error);
      return 0;
    }
  }

  async getKeysPattern(pattern: string): Promise<string[]> {
    try {
      const keys = await this.redis.keys(this.getCacheKey(pattern));
      return keys.map(key => key.replace(this.cachePrefix + ':', ''));
    } catch (error) {
      console.error('Error obteniendo claves por patrón:', error);
      return [];
    }
  }

  // ================================
  // USER CACHE OPERATIONS
  // ================================

  async getUserById(userId: string): Promise<any | null> {
    return this.get(`user:${userId}`);
  }

  async setUser(userId: string, userData: any, ttl: number = 1800): Promise<boolean> {
    return this.set(`user:${userId}`, userData, ttl);
  }

  async deleteUser(userId: string): Promise<boolean> {
    return this.del(`user:${userId}`);
  }

  async getUserByEmail(email: string): Promise<any | null> {
    return this.get(`user:email:${email.toLowerCase()}`);
  }

  async setUserByEmail(email: string, userData: any, ttl: number = 1800): Promise<boolean> {
    return this.set(`user:email:${email.toLowerCase()}`, userData, ttl);
  }

  async deleteUserByEmail(email: string): Promise<boolean> {
    return this.del(`user:email:${email.toLowerCase()}`);
  }

  async invalidateUserCache(userId: string, email?: string): Promise<void> {
    const promises: Promise<boolean>[] = [
      this.deleteUser(userId),
    ];

    if (email) {
      promises.push(this.deleteUserByEmail(email));
    }

    // También invalidar caches de estadísticas de usuarios
    promises.push(this.del('users:stats'));
    promises.push(this.deletePattern('users:list:*').then(result => result > 0));

    await Promise.all(promises);
  }

  // ================================
  // CANDIDATE CACHE OPERATIONS
  // ================================

  async getCandidateById(candidateId: string): Promise<any | null> {
    return this.get(`candidate:${candidateId}`);
  }

  async setCandidate(candidateId: string, candidateData: any, ttl: number = 1800): Promise<boolean> {
    return this.set(`candidate:${candidateId}`, candidateData, ttl);
  }

  async deleteCandidate(candidateId: string): Promise<boolean> {
    return this.del(`candidate:${candidateId}`);
  }

  async getCandidateByEmail(email: string): Promise<any | null> {
    return this.get(`candidate:email:${email.toLowerCase()}`);
  }

  async setCandidateByEmail(email: string, candidateData: any, ttl: number = 1800): Promise<boolean> {
    return this.set(`candidate:email:${email.toLowerCase()}`, candidateData, ttl);
  }

  async deleteCandidateByEmail(email: string): Promise<boolean> {
    return this.del(`candidate:email:${email.toLowerCase()}`);
  }

  async invalidateCandidateCache(candidateId: string, email?: string): Promise<void> {
    const promises: Promise<boolean>[] = [
      this.deleteCandidate(candidateId),
    ];

    if (email) {
      promises.push(this.deleteCandidateByEmail(email));
    }

    // También invalidar caches de estadísticas de candidatos
    promises.push(this.del('candidates:stats'));
    promises.push(this.deletePattern('candidates:list:*').then(result => result > 0));

    await Promise.all(promises);
  }

  // ================================
  // ROLE CACHE OPERATIONS
  // ================================

  async getRoleById(roleId: string): Promise<any | null> {
    return this.get(`role:${roleId}`);
  }

  async setRole(roleId: string, roleData: any, ttl: number = 3600): Promise<boolean> {
    return this.set(`role:${roleId}`, roleData, ttl);
  }

  async deleteRole(roleId: string): Promise<boolean> {
    return this.del(`role:${roleId}`);
  }

  async getRoleByName(name: string): Promise<any | null> {
    return this.get(`role:name:${name}`);
  }

  async setRoleByName(name: string, roleData: any, ttl: number = 3600): Promise<boolean> {
    return this.set(`role:name:${name}`, roleData, ttl);
  }

  async deleteRoleByName(name: string): Promise<boolean> {
    return this.del(`role:name:${name}`);
  }

  async getAllRoles(): Promise<any[] | null> {
    return this.get('roles:all');
  }

  async setAllRoles(rolesData: any[], ttl: number = 3600): Promise<boolean> {
    return this.set('roles:all', rolesData, ttl);
  }

  async invalidateRoleCache(roleId?: string, roleName?: string): Promise<void> {
    const promises: Promise<boolean>[] = [
      this.del('roles:all'),
      this.del('roles:default'),
      this.del('roles:stats'),
    ];

    if (roleId) {
      promises.push(this.deleteRole(roleId));
    }

    if (roleName) {
      promises.push(this.deleteRoleByName(roleName));
    }

    await Promise.all(promises);
  }

  // ================================
  // STATISTICS CACHE
  // ================================

  async getUserStats(): Promise<any | null> {
    return this.get('users:stats');
  }

  async setUserStats(stats: any, ttl: number = 600): Promise<boolean> {
    return this.set('users:stats', stats, ttl);
  }

  async getCandidateStats(): Promise<any | null> {
    return this.get('candidates:stats');
  }

  async setCandidateStats(stats: any, ttl: number = 600): Promise<boolean> {
    return this.set('candidates:stats', stats, ttl);
  }

  async getRoleStats(): Promise<any | null> {
    return this.get('roles:stats');
  }

  async setRoleStats(stats: any, ttl: number = 600): Promise<boolean> {
    return this.set('roles:stats', stats, ttl);
  }

  // ================================
  // LIST CACHE OPERATIONS
  // ================================

  async getUsersList(page: number, limit: number, filters: string = ''): Promise<any | null> {
    const key = `users:list:${page}:${limit}:${this.hashFilters(filters)}`;
    return this.get(key);
  }

  async setUsersList(page: number, limit: number, filters: string = '', data: any, ttl: number = 300): Promise<boolean> {
    const key = `users:list:${page}:${limit}:${this.hashFilters(filters)}`;
    return this.set(key, data, ttl);
  }

  async getCandidatesList(page: number, limit: number, filters: string = ''): Promise<any | null> {
    const key = `candidates:list:${page}:${limit}:${this.hashFilters(filters)}`;
    return this.get(key);
  }

  async setCandidatesList(page: number, limit: number, filters: string = '', data: any, ttl: number = 300): Promise<boolean> {
    const key = `candidates:list:${page}:${limit}:${this.hashFilters(filters)}`;
    return this.set(key, data, ttl);
  }

  // ================================
  // SESSION OPERATIONS
  // ================================

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const sessionData = await this.redis.get(this.getSessionKey(sessionId));
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      console.error('Error obteniendo sesión:', error);
      return null;
    }
  }

  async setSession(sessionId: string, sessionData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      const serializedData = JSON.stringify(sessionData);
      const result = await this.redis.setex(this.getSessionKey(sessionId), ttlSeconds, serializedData);
      return result === 'OK';
    } catch (error) {
      console.error('Error guardando sesión:', error);
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const result = await this.redis.del(this.getSessionKey(sessionId));
      return result > 0;
    } catch (error) {
      console.error('Error eliminando sesión:', error);
      return false;
    }
  }

  async extendSession(sessionId: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(this.getSessionKey(sessionId), ttlSeconds);
      return result === 1;
    } catch (error) {
      console.error('Error extendiendo sesión:', error);
      return false;
    }
  }

  // ================================
  // UTILITY METHODS
  // ================================

  async flushCache(): Promise<boolean> {
    try {
      const keys = await this.redis.keys(`${this.cachePrefix}:*`);
      if (keys.length === 0) return true;
      
      const result = await this.redis.del(...keys);
      return result > 0;
    } catch (error) {
      console.error('Error limpiando cache:', error);
      return false;
    }
  }

  async getCacheInfo(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate?: number;
  }> {
    try {
      const keys = await this.redis.keys(`${this.cachePrefix}:*`);
      const info = await this.redis.info('memory');
      
      // Extraer uso de memoria
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = (memoryMatch && memoryMatch[1]) ? memoryMatch[1].trim() : 'N/A';

      return {
        totalKeys: keys.length,
        memoryUsage,
      };
    } catch (error) {
      console.error('Error obteniendo información del cache:', error);
      return {
        totalKeys: 0,
        memoryUsage: 'Error',
      };
    }
  }

  // ================================
  // BULK OPERATIONS
  // ================================

  async mget(keys: string[]): Promise<(any | null)[]> {
    try {
      const cacheKeys = keys.map(key => this.getCacheKey(key));
      const results = await this.redis.mget(...cacheKeys);
      
      return results.map(result => {
        try {
          return result ? JSON.parse(result) : null;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error('Error en operación mget:', error);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      keyValuePairs.forEach(({ key, value, ttl = 3600 }) => {
        const cacheKey = this.getCacheKey(key);
        const serializedValue = JSON.stringify(value);
        pipeline.setex(cacheKey, ttl, serializedValue);
      });

      const results = await pipeline.exec();
      return results ? results.every(result => result[1] === 'OK') : false;
    } catch (error) {
      console.error('Error en operación mset:', error);
      return false;
    }
  }

  // ================================
  // PRIVATE HELPERS
  // ================================

  private getCacheKey(key: string): string {
    return `${this.cachePrefix}:${key}`;
  }

  private getSessionKey(sessionId: string): string {
    return `${this.sessionPrefix}:${sessionId}`;
  }

  private hashFilters(filters: string): string {
    // Simple hash para agrupar filtros similares
    if (!filters) return 'none';
    
    let hash = 0;
    for (let i = 0; i < filters.length; i++) {
      const char = filters.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  // ================================
  // HEALTH CHECK
  // ================================

  async healthCheck(): Promise<boolean> {
    try {
      const testKey = 'health:check';
      const testValue = { timestamp: Date.now() };
      
      await this.set(testKey, testValue, 10);
      const retrieved = await this.get<{ timestamp: number }>(testKey);
      await this.del(testKey);
      
      return retrieved !== null && retrieved.timestamp === testValue.timestamp;
    } catch (error) {
      console.error('Error en health check del cache:', error);
      return false;
    }
  }
}
