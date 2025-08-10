import { Collection, Db, ObjectId } from 'mongodb';
import { User, Session } from '../types';
import { config } from '../config';

export class UserRepository {
  private usersCollection: Collection<User>;
  private sessionsCollection: Collection<Session>;

  constructor(database: Db) {
    this.usersCollection = database.collection(config.database.collections.users);
    this.sessionsCollection = database.collection(config.database.collections.sessions);
    this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    try {
      // Índices para usuarios
      await this.usersCollection.createIndex({ email: 1 }, { unique: true });
      await this.usersCollection.createIndex({ role: 1 });
      await this.usersCollection.createIndex({ isActive: 1 });
      
      // Índices para sesiones
      await this.sessionsCollection.createIndex({ userId: 1 });
      await this.sessionsCollection.createIndex({ refreshToken: 1 }, { unique: true });
      await this.sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      
      console.log('✅ Índices de base de datos creados');
    } catch (error) {
      console.error('❌ Error creando índices:', error);
    }
  }

  // User operations
  async createUser(userData: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date();
    const user: User = {
      ...userData,
      createdAt: now,
      updatedAt: now
    };

    const result = await this.usersCollection.insertOne(user);
    return { ...user, _id: result.insertedId.toString() };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return await this.usersCollection.findOne({ email });
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<User | null> {
    const result = await this.usersCollection.findOneAndUpdate(
      { _id: userId as any },
      { $set: { password: newPassword, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    console.log(result, "User password updated");
    return result || null;
  }

  async findUserById(userId: string): Promise<User | null> {
    const id = new ObjectId(userId);
    return await this.usersCollection.findOne({ _id: id } as any);
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User | null> {
    const result = await this.usersCollection.findOneAndUpdate(
      { _id: userId as any },
      { 
        $set: { 
          ...updateData, 
          updatedAt: new Date() 
        } 
      },
      { returnDocument: 'after' }
    );
    return result;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersCollection.updateOne(
      { _id: userId as any },
      { 
        $set: { 
          lastLogin: new Date(),
          updatedAt: new Date()
        } 
      }
    );
  }

  async getUsersByRole(role: "admin" | "teacher" | "proctor" | "student"): Promise<User[]> {
    return await this.usersCollection.find({ role: role, isActive: true }).toArray();
  }

  // Session operations
  async createSession(sessionData: Omit<Session, '_id' | 'createdAt'>): Promise<Session> {
    const session: Session = {
      ...sessionData,
      createdAt: new Date()
    };

    const result = await this.sessionsCollection.insertOne(session);
    return { ...session, _id: result.insertedId.toString() };
  }

  async findSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    return await this.sessionsCollection.findOne({ refreshToken });
  }

  async deleteSession(refreshToken: string): Promise<boolean> {
    const result = await this.sessionsCollection.deleteOne({ refreshToken });
    return result.deletedCount > 0;
  }

  async deleteUserSessions(userId: string): Promise<number> {
    const result = await this.sessionsCollection.deleteMany({ userId });
    return result.deletedCount || 0;
  }

  async cleanExpiredSessions(): Promise<number> {
    const result = await this.sessionsCollection.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    return result.deletedCount || 0;
  }
}
