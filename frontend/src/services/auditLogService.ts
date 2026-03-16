import axios from 'axios';
import { authSDK } from './sdk-simple-auth';

const baseURL = import.meta.env.VITE_USER_MANAGEMENT_URL || 'http://localhost:3002';

function getHeaders() {
  const token = authSDK.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AuditLogEntry {
  _id: string;
  timestamp: string;
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

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditFilters {
  page?: number;
  limit?: number;
  service?: string;
  action?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const auditLogService = {
  async getAuditLogs(filters: AuditFilters = {}): Promise<{ success: boolean; data?: AuditLogsResponse }> {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.service) params.append('service', filters.service);
    if (filters.action) params.append('action', filters.action);
    if (filters.actorEmail) params.append('actorEmail', filters.actorEmail);
    if (filters.targetType) params.append('targetType', filters.targetType);
    if (filters.targetId) params.append('targetId', filters.targetId);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);

    const qs = params.toString();
    const response = await axios.get(`${baseURL}/api/v1/audit-logs${qs ? `?${qs}` : ''}`, { headers: getHeaders() });
    const result = response.data;
    if (result?.success) return { success: true, data: result.data };
    return { success: false };
  },
};
