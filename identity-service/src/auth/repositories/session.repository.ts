// src/auth/repositories/session.repository.ts
//
// Refresh-token sessions, ported from the old auth-service's UserRepository
// session methods. Lives in the SAME database as the users collection now
// (config.mongoDbName), in its own `sessions` collection — no separate DB.

import { Collection, Db } from 'mongodb';
import config from '../../config';
import { getDatabase } from '../../database/connections';

export interface AuthSession {
  _id?: string;
  userId: string;
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  createdAt: Date;
}

export class SessionRepository {
  private db: Db;
  private collection: Collection<AuthSession>;

  constructor() {
    this.db = getDatabase();
    this.collection = this.db.collection<AuthSession>(config.collections.sessions);
    this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ userId: 1 });
      await this.collection.createIndex({ refreshToken: 1 }, { unique: true });
      await this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    } catch (error) {
      console.error('[SessionRepository] Error creando índices:', error);
    }
  }

  async createSession(sessionData: Omit<AuthSession, '_id' | 'createdAt'>): Promise<AuthSession> {
    const session: AuthSession = {
      ...sessionData,
      createdAt: new Date(),
    };

    const result = await this.collection.insertOne(session);
    return { ...session, _id: result.insertedId.toString() };
  }

  async findByRefreshToken(refreshToken: string): Promise<AuthSession | null> {
    return this.collection.findOne({ refreshToken });
  }

  async deleteByRefreshToken(refreshToken: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ refreshToken });
    return result.deletedCount > 0;
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const result = await this.collection.deleteMany({ userId });
    return result.deletedCount || 0;
  }

  async cleanExpired(): Promise<number> {
    const result = await this.collection.deleteMany({ expiresAt: { $lt: new Date() } });
    return result.deletedCount || 0;
  }
}
