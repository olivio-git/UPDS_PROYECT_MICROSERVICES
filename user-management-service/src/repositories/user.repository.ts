import { Collection, Db, ObjectId, Filter, UpdateFilter, FindOptions } from 'mongodb';
import { connectMongoDB, getDatabase } from '../database/connections';
import { User, UserRole, UserStatus, PaginationParams, FilterParams } from '../types';
import { UserModel } from '../models/User';
import config from '../config';

export class UserRepository {
  private db: Db;
  private collection: Collection<User>;

  constructor() {
    // Initialize the database connection lazily
    this.db = getDatabase();
    this.collection = this.db.collection<User>(config.collections.users);
  }

  // ================================
  // STATISTICS AND COUNTING
  // ================================

  async count(filter?: Filter<User>): Promise<number> {
    try {
      return await this.collection.countDocuments(filter || {});
    } catch (error) {
      console.error('Error contando usuarios:', error);
      return 0;
    }
  }

  // ================================
  // CRUD OPERATIONS
  // ================================

  async create(userData: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<UserModel> {
    const user = new UserModel({
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const validation = user.validate();
    if (!validation.isValid) {
      throw new Error(`Datos de usuario inválidos: ${validation.errors.join(', ')}`);
    }

    const result = await this.collection.insertOne(user.toJSON());
    
    if (!result.insertedId) {
      throw new Error('Error creando usuario');
    }

    user._id = result.insertedId;
    return user;
  }

  async findById(id: string | ObjectId): Promise<UserModel | null> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      const userData = await this.collection.findOne({ _id: objectId });
      
      return userData ? UserModel.fromDatabase(userData) : null;
    } catch (error) {
      console.error('Error buscando usuario por ID:', error);
      return null;
    }
  }

  async findOne(filter: Filter<User>): Promise<UserModel | null> {
    try {
      const userData = await this.collection.findOne(filter);
      return userData ? UserModel.fromDatabase(userData) : null;
    } catch (error) {
      console.error('Error buscando usuario con filtro:', error);
      return null;
    }
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    try {
      const userData = await this.collection.findOne({ email: email.toLowerCase() });
      return userData ? UserModel.fromDatabase(userData) : null;
    } catch (error) {
      console.error('Error buscando usuario por email:', error);
      return null;
    }
  }

  async update(id: string | ObjectId, updates: UpdateFilter<User>): Promise<UserModel | null> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      
      const updateDoc = {
        ...updates,
        updatedAt: new Date(),
      };

      const result = await this.collection.findOneAndUpdate(
        { _id: objectId },
        { $set: updateDoc },
        { returnDocument: 'after' }
      );

      return result ? UserModel.fromDatabase(result) : null;
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  async delete(id: string | ObjectId): Promise<boolean> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      const result = await this.collection.deleteOne({ _id: objectId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      return false;
    }
  }

  // ================================
  // QUERY OPERATIONS
  // ================================

  async findAll(
    pagination: PaginationParams,
    filters: FilterParams = {}
  ): Promise<{ users: UserModel[]; total: number }> {
    try {
      const query = this.buildQuery(filters);
      const options = this.buildFindOptions(pagination);

      const [users, total] = await Promise.all([
        this.collection.find(query, options).toArray(),
        this.collection.countDocuments(query),
      ]);

      return {
        users: users.map(user => UserModel.fromDatabase(user)),
        total,
      };
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      throw error;
    }
  }

  async findByRole(role: UserRole): Promise<UserModel[]> {
    try {
      const users = await this.collection.find({ role }).toArray();
      return users.map(user => UserModel.fromDatabase(user));
    } catch (error) {
      console.error('Error buscando usuarios por rol:', error);
      return [];
    }
  }

  async findByStatus(status: UserStatus): Promise<UserModel[]> {
    try {
      const users = await this.collection.find({ status }).toArray();
      return users.map(user => UserModel.fromDatabase(user));
    } catch (error) {
      console.error('Error buscando usuarios por estado:', error);
      return [];
    }
  }

  async search(
    searchTerm: string,
    pagination: PaginationParams
  ): Promise<{ users: UserModel[]; total: number }> {
    try {
      const query = {
        $or: [
          { firstName: { $regex: searchTerm, $options: 'i' } },
          { lastName: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
        ],
      };

      const options = this.buildFindOptions(pagination);

      const [users, total] = await Promise.all([
        this.collection.find(query, options).toArray(),
        this.collection.countDocuments(query),
      ]);

      return {
        users: users.map(user => UserModel.fromDatabase(user)),
        total,
      };
    } catch (error) {
      console.error('Error en búsqueda de usuarios:', error);
      throw error;
    }
  }

  // ================================
  // SPECIALIZED OPERATIONS
  // ================================

  async updateLastLogin(id: string | ObjectId): Promise<void> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      await this.collection.updateOne(
        { _id: objectId },
        { 
          $set: { 
            lastLogin: new Date(),
            updatedAt: new Date(),
          }
        }
      );
    } catch (error) {
      console.error('Error actualizando último inicio de sesión:', error);
    }
  }

  async updateStatus(id: string | ObjectId, status: UserStatus): Promise<UserModel | null> {
    return this.update(id, { status });
  }

  async bulkUpdateStatus(ids: (string | ObjectId)[], status: UserStatus): Promise<number> {
    try {
      const objectIds = ids.map(id => typeof id === 'string' ? new ObjectId(id) : id);
      const result = await this.collection.updateMany(
        { _id: { $in: objectIds } },
        { 
          $set: { 
            status,
            updatedAt: new Date(),
          }
        }
      );
      return result.modifiedCount;
    } catch (error) {
      console.error('Error en actualización masiva de estado:', error);
      return 0;
    }
  }

  async bulkDelete(ids: (string | ObjectId)[]): Promise<number> {
    try {
      const objectIds = ids.map(id => typeof id === 'string' ? new ObjectId(id) : id);
      const result = await this.collection.deleteMany({ _id: { $in: objectIds } });
      return result.deletedCount;
    } catch (error) {
      console.error('Error en eliminación masiva:', error);
      return 0;
    }
  }

  // ================================
  // STATISTICS
  // ================================

  async getStatistics(): Promise<{
    total: number;
    byRole: Record<UserRole, number>;
    byStatus: Record<UserStatus, number>;
    recentlyActive: number;
  }> {
    try {
      const [total, roleStats, statusStats, recentlyActive] = await Promise.all([
        this.collection.countDocuments(),
        this.getStatsByRole(),
        this.getStatsByStatus(),
        this.getRecentlyActiveCount(),
      ]);

      return {
        total,
        byRole: roleStats,
        byStatus: statusStats,
        recentlyActive,
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  private async getStatsByRole(): Promise<Record<UserRole, number>> {
    const pipeline = [
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ];

    const results = await this.collection.aggregate(pipeline).toArray();
    
    const stats: Record<UserRole, number> = {
      admin: 0,
      teacher: 0,
      proctor: 0,
      student: 0,
    };

    results.forEach(result => {
      if (result._id && result._id in stats) {
        stats[result._id as UserRole] = result.count;
      }
    });

    return stats;
  }

  private async getStatsByStatus(): Promise<Record<UserStatus, number>> {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ];

    const results = await this.collection.aggregate(pipeline).toArray();
    
    const stats: Record<UserStatus, number> = {
      active: 0,
      inactive: 0,
      suspended: 0,
      pending: 0,
    };

    results.forEach(result => {
      if (result._id && result._id in stats) {
        stats[result._id as UserStatus] = result.count;
      }
    });

    return stats;
  }

  private async getRecentlyActiveCount(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.collection.countDocuments({
      lastLogin: { $gte: sevenDaysAgo }
    });
  }

  // ================================
  // HELPER METHODS
  // ================================

  private buildQuery(filters: FilterParams): Filter<User> {
    const query: Filter<User> = {};

    if (filters.search) {
      query.$or = [
        { firstName: { $regex: filters.search, $options: 'i' } },
        { lastName: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.role) {
      query.role = filters.role;
    }

    if (filters.status) {
      query.status = filters.status as UserStatus;
    }

    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        query.createdAt.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        query.createdAt.$lte = filters.dateTo;
      }
    }

    return query;
  }

  private buildFindOptions(pagination: PaginationParams): FindOptions<User> {
    const { page, limit, sortBy, sortOrder } = pagination;
    
    const options: FindOptions<User> = {
      skip: (page - 1) * limit,
      limit,
    };

    if (sortBy) {
      options.sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    } else {
      options.sort = { createdAt: -1 };
    }

    return options;
  }

  // ================================
  // VALIDATION HELPERS
  // ================================

  async emailExists(email: string, excludeId?: string | ObjectId): Promise<boolean> {
    try {
      const query: Filter<User> = { email: email.toLowerCase() };
      
      if (excludeId) {
        const objectId = typeof excludeId === 'string' ? new ObjectId(excludeId) : excludeId;
        query._id = { $ne: objectId };
      }

      const count = await this.collection.countDocuments(query);
      return count > 0;
    } catch (error) {
      console.error('Error verificando email existente:', error);
      return false;
    }
  }

  async getActiveTeachers(): Promise<UserModel[]> {
    try {
      const users = await this.collection.find({
        role: 'teacher',
        status: 'active',
      }).toArray();

      return users.map(user => UserModel.fromDatabase(user));
    } catch (error) {
      console.error('Error obteniendo profesores activos:', error);
      return [];
    }
  }

  async getActiveProctors(): Promise<UserModel[]> {
    try {
      const users = await this.collection.find({
        role: 'proctor',
        status: 'active',
      }).toArray();

      return users.map(user => UserModel.fromDatabase(user));
    } catch (error) {
      console.error('Error obteniendo supervisores activos:', error);
      return [];
    }
  }
}
