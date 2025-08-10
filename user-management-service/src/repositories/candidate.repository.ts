import { Collection, Db, ObjectId, Filter, UpdateFilter, FindOptions } from 'mongodb';
import { getDatabase } from '../database/connections';
import { 
  Candidate, 
  CandidateStatus, 
  MCERLevel, 
  PaginationParams, 
  FilterParams,
  BulkImportResult,
  ImportError
} from '../types';
import { CandidateModel } from '../models/Candidate';
import config from '../config';

export class CandidateRepository {
  private db: Db;
  private collection: Collection<Candidate>;

  constructor() {
    this.db = getDatabase();
    this.collection = this.db.collection<Candidate>(config.collections.candidates);
  }

  // ================================
  // CRUD OPERATIONS
  // ================================

  async create(candidateData: Omit<Candidate, '_id' | 'createdAt' | 'updatedAt'>): Promise<CandidateModel> {
    const candidate = new CandidateModel({
      ...candidateData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const validation = candidate.validate();
    if (!validation.isValid) {
      throw new Error(`Datos de candidato inválidos: ${validation.errors.join(', ')}`);
    }

    const result = await this.collection.insertOne(candidate.toJSON());
    
    if (!result.insertedId) {
      throw new Error('Error creando candidato');
    }

    candidate._id = result.insertedId;
    return candidate;
  }

  async findById(id: string | ObjectId): Promise<CandidateModel | null> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      const candidateData = await this.collection.findOne({ _id: objectId });
      
      return candidateData ? CandidateModel.fromDatabase(candidateData) : null;
    } catch (error) {
      console.error('Error buscando candidato por ID:', error);
      return null;
    }
  }

  async findByEmail(email: string): Promise<CandidateModel | null> {
    try {
      const candidateData = await this.collection.findOne({ 
        'personalInfo.email': email.toLowerCase() 
      });
      return candidateData ? CandidateModel.fromDatabase(candidateData) : null;
    } catch (error) {
      console.error('Error buscando candidato por email:', error);
      return null;
    }
  }

  async findByIdentification(type: string, number: string): Promise<CandidateModel | null> {
    try {
      const candidateData = await this.collection.findOne({
        'personalInfo.identification.type': type,
        'personalInfo.identification.number': number,
      });
      return candidateData ? CandidateModel.fromDatabase(candidateData) : null;
    } catch (error) {
      console.error('Error buscando candidato por identificación:', error);
      return null;
    }
  }

  async update(id: string | ObjectId, updates: UpdateFilter<Candidate>): Promise<CandidateModel | null> {
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

      return result ? CandidateModel.fromDatabase(result) : null;
    } catch (error) {
      console.error('Error actualizando candidato:', error);
      throw error;
    }
  }

  async delete(id: string | ObjectId): Promise<boolean> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      const result = await this.collection.deleteOne({ _id: objectId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error eliminando candidato:', error);
      return false;
    }
  }

  // ================================
  // QUERY OPERATIONS
  // ================================

  async findAll(
    pagination: PaginationParams,
    filters: FilterParams = {}
  ): Promise<{ candidates: CandidateModel[]; total: number }> {
    try {
      const query = this.buildQuery(filters);
      const options = this.buildFindOptions(pagination);

      const [candidates, total] = await Promise.all([
        this.collection.find(query, options).toArray(),
        this.collection.countDocuments(query),
      ]);

      return {
        candidates: candidates.map(candidate => CandidateModel.fromDatabase(candidate)),
        total,
      };
    } catch (error) {
      console.error('Error obteniendo candidatos:', error);
      throw error;
    }
  }

  async findByStatus(status: CandidateStatus): Promise<CandidateModel[]> {
    try {
      const candidates = await this.collection.find({ status }).toArray();
      return candidates.map(candidate => CandidateModel.fromDatabase(candidate));
    } catch (error) {
      console.error('Error buscando candidatos por estado:', error);
      return [];
    }
  }

  async findByLevel(level: MCERLevel): Promise<CandidateModel[]> {
    try {
      const candidates = await this.collection.find({ 
        'academicInfo.currentLevel': level 
      }).toArray();
      return candidates.map(candidate => CandidateModel.fromDatabase(candidate));
    } catch (error) {
      console.error('Error buscando candidatos por nivel:', error);
      return [];
    }
  }

  async findByRegisteredBy(userId: string | ObjectId): Promise<CandidateModel[]> {
    try {
      const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
      const candidates = await this.collection.find({ registeredBy: objectId }).toArray();
      return candidates.map(candidate => CandidateModel.fromDatabase(candidate));
    } catch (error) {
      console.error('Error buscando candidatos por registrador:', error);
      return [];
    }
  }

  async search(
    searchTerm: string,
    pagination: PaginationParams
  ): Promise<{ candidates: CandidateModel[]; total: number }> {
    try {
      const query = {
        $or: [
          { 'personalInfo.firstName': { $regex: searchTerm, $options: 'i' } },
          { 'personalInfo.lastName': { $regex: searchTerm, $options: 'i' } },
          { 'personalInfo.email': { $regex: searchTerm, $options: 'i' } },
          { 'personalInfo.identification.number': { $regex: searchTerm, $options: 'i' } },
        ],
      };

      const options = this.buildFindOptions(pagination);

      const [candidates, total] = await Promise.all([
        this.collection.find(query, options).toArray(),
        this.collection.countDocuments(query),
      ]);

      return {
        candidates: candidates.map(candidate => CandidateModel.fromDatabase(candidate)),
        total,
      };
    } catch (error) {
      console.error('Error en búsqueda de candidatos:', error);
      throw error;
    }
  }

  // ================================
  // BULK OPERATIONS
  // ================================

  async bulkCreate(candidatesData: any[], registeredBy: ObjectId): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      total: candidatesData.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < candidatesData.length; i++) {
      try {
        const candidateData = candidatesData[i];
        const candidate = CandidateModel.fromExcelRow(candidateData, registeredBy);
        
        // Validar antes de insertar
        const validation = candidate.validate();
        if (!validation.isValid) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            field: 'validation',
            message: validation.errors.join(', '),
            data: candidateData,
          });
          continue;
        }

        // Verificar duplicados
        const existingByEmail = await this.findByEmail(candidate.personalInfo.email);
        if (existingByEmail) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            field: 'email',
            message: 'Email ya existe',
            data: candidateData,
          });
          continue;
        }

        let existingByCI: CandidateModel | null = null;
        if (
          candidate.personalInfo.identification &&
          candidate.personalInfo.identification.type &&
          candidate.personalInfo.identification.number
        ) {
          existingByCI = await this.findByIdentification(
            candidate.personalInfo.identification.type,
            candidate.personalInfo.identification.number
          );
        }
        if (existingByCI) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            field: 'identification',
            message: 'Identificación ya existe',
            data: candidateData,
          });
          continue;
        }

        // Insertar candidato
        await this.collection.insertOne(candidate.toJSON());
        result.successful++;

      } catch (error) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          field: 'system',
          message: `Error del sistema: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          data: candidatesData[i],
        });
      }
    }

    return result;
  }

  async bulkUpdateStatus(ids: (string | ObjectId)[], status: CandidateStatus): Promise<number> {
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
  // SPECIALIZED OPERATIONS
  // ================================

  async updateStatus(id: string | ObjectId, status: CandidateStatus): Promise<CandidateModel | null> {
    return this.update(id, { status });
  }

  async addExamResult(id: string | ObjectId, examResult: any): Promise<CandidateModel | null> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      
      const result = await this.collection.findOneAndUpdate(
        { _id: objectId },
        { 
          $push: { examHistory: examResult },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );

      return result ? CandidateModel.fromDatabase(result) : null;
    } catch (error) {
      console.error('Error agregando resultado de examen:', error);
      return null;
    }
  }

  async updateTechnicalSetup(id: string | ObjectId, techSetup: any): Promise<CandidateModel | null> {
    return this.update(id, { technicalSetup: techSetup });
  }

  // ================================
  // STATISTICS
  // ================================

  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<CandidateStatus, number>;
    byLevel: Record<MCERLevel, number>;
    byPurpose: Record<string, number>;
    recentRegistrations: number;
  }> {
    try {
      const [total, statusStats, levelStats, purposeStats, recentRegistrations] = await Promise.all([
        this.collection.countDocuments(),
        this.getStatsByStatus(),
        this.getStatsByLevel(),
        this.getStatsByPurpose(),
        this.getRecentRegistrationsCount(),
      ]);

      return {
        total,
        byStatus: statusStats,
        byLevel: levelStats,
        byPurpose: purposeStats,
        recentRegistrations,
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de candidatos:', error);
      throw error;
    }
  }

  private async getStatsByStatus(): Promise<Record<CandidateStatus, number>> {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ];

    const results = await this.collection.aggregate(pipeline).toArray();
    
    const stats: Record<CandidateStatus, number> = {
      registered: 0,
      verified: 0,
      active: 0,
      inactive: 0,
      graduated: 0,
    };

    results.forEach(result => {
      if (result._id && result._id in stats) {
        stats[result._id as CandidateStatus] = result.count;
      }
    });

    return stats;
  }

  private async getStatsByLevel(): Promise<Record<MCERLevel, number>> {
    const pipeline = [
      { $group: { _id: '$academicInfo.currentLevel', count: { $sum: 1 } } }
    ];

    const results = await this.collection.aggregate(pipeline).toArray();
    
    const stats: Record<MCERLevel, number> = {
      A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0,
    };

    results.forEach(result => {
      if (result._id && result._id in stats) {
        stats[result._id as MCERLevel] = result.count;
      }
    });

    return stats;
  }

  private async getStatsByPurpose(): Promise<Record<string, number>> {
    const pipeline = [
      { $group: { _id: '$academicInfo.studyPurpose', count: { $sum: 1 } } }
    ];

    const results = await this.collection.aggregate(pipeline).toArray();
    
    const stats: Record<string, number> = {};
    results.forEach(result => {
      if (result._id) {
        stats[result._id] = result.count;
      }
    });

    return stats;
  }

  private async getRecentRegistrationsCount(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.collection.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
  }

  // ================================
  // HELPER METHODS
  // ================================

  private buildQuery(filters: FilterParams): Filter<Candidate> {
    const query: Filter<Candidate> = {};

    if (filters.search) {
      query.$or = [
        { 'personalInfo.firstName': { $regex: filters.search, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: filters.search, $options: 'i' } },
        { 'personalInfo.email': { $regex: filters.search, $options: 'i' } },
        { 'personalInfo.identification.number': { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.status) {
      query.status = filters.status as CandidateStatus;
    }

    if (filters.level) {
      query['academicInfo.currentLevel'] = filters.level;
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

  private buildFindOptions(pagination: PaginationParams): FindOptions<Candidate> {
    const { page, limit, sortBy, sortOrder } = pagination;
    
    const options: FindOptions<Candidate> = {
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
      const query: Filter<Candidate> = { 'personalInfo.email': email.toLowerCase() };
      
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

  async identificationExists(
    type: string, 
    number: string, 
    excludeId?: string | ObjectId
  ): Promise<boolean> {
    try {
      const query: Filter<Candidate> = {
        'personalInfo.identification.type': type,
        'personalInfo.identification.number': number,
      };
      
      if (excludeId) {
        const objectId = typeof excludeId === 'string' ? new ObjectId(excludeId) : excludeId;
        query._id = { $ne: objectId };
      }

      const count = await this.collection.countDocuments(query);
      return count > 0;
    } catch (error) {
      console.error('Error verificando identificación existente:', error);
      return false;
    }
  }

  // ================================
  // REPORTING HELPERS
  // ================================

  async getCandidatesForLevel(level: MCERLevel): Promise<CandidateModel[]> {
    try {
      const candidates = await this.collection.find({
        'academicInfo.targetLevel': level,
        status: { $in: ['active', 'verified'] },
      }).toArray();

      return candidates.map(candidate => CandidateModel.fromDatabase(candidate));
    } catch (error) {
      console.error('Error obteniendo candidatos para nivel:', error);
      return [];
    }
  }

  async getCandidatesReadyForExam(): Promise<CandidateModel[]> {
    try {
      const candidates = await this.collection.find({
        status: 'active',
        'technicalSetup.hasCamera': true,
        'technicalSetup.hasMicrophone': true,
        'technicalSetup.hasStableInternet': true,
      }).toArray();

      return candidates.map(candidate => CandidateModel.fromDatabase(candidate));
    } catch (error) {
      console.error('Error obteniendo candidatos listos para examen:', error);
      return [];
    }
  }
}
