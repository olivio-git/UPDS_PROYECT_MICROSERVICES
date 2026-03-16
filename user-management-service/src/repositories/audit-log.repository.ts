import { Collection, ObjectId } from 'mongodb';
import { getDatabase } from '../database/connections';

export interface AuditLog {
  _id?: ObjectId;
  timestamp: Date;
  service: string;
  action: string;
  actor: {
    userId?: string;
    email?: string;
    role?: string;
    ip?: string;
  };
  target: {
    type: string;
    id?: string;
    name?: string;
  };
  details?: Record<string, any>;
  status: 'success' | 'failure';
}

export class AuditLogRepository {
  private get collection(): Collection<AuditLog> {
    return getDatabase().collection<AuditLog>('audit_logs');
  }

  async create(log: Omit<AuditLog, '_id'>): Promise<void> {
    await this.collection.insertOne({ ...log, timestamp: log.timestamp || new Date() });
  }

  async findAll(
    filters: {
      service?: string;
      action?: string;
      actorEmail?: string;
      targetType?: string;
      targetId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    pagination: { page: number; limit: number }
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const query: Record<string, any> = {};

    if (filters.service) query.service = filters.service;
    if (filters.action) query.action = new RegExp(filters.action, 'i');
    if (filters.actorEmail) query['actor.email'] = new RegExp(filters.actorEmail, 'i');
    if (filters.targetType) query['target.type'] = filters.targetType;
    if (filters.targetId) query['target.id'] = filters.targetId;

    if (filters.dateFrom || filters.dateTo) {
      query.timestamp = {};
      if (filters.dateFrom) query.timestamp.$gte = filters.dateFrom;
      if (filters.dateTo) query.timestamp.$lte = filters.dateTo;
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [logs, total] = await Promise.all([
      this.collection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .toArray(),
      this.collection.countDocuments(query),
    ]);

    return { logs, total };
  }
}
