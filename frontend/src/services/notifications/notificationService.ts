import { authSDK } from "@/services/sdk-simple-auth";
import axios from "axios";
import { NOTIFICATION_SERVICE_URL } from '@/lib/serviceUrls';

/**
 * notifications-service now requires a bearer token on every route except
 * /health (see notifications-service/src/middleware/auth.middleware.ts).
 * Every call below must send it — same token authSDK already keeps for the
 * other services (see api.service.ts's interceptor for the equivalent
 * pattern against exam-service).
 */
function authHeaders(): Record<string, string> {
  const token = authSDK.getAccessToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export interface NotificationStats {
  total: number;
  sent: number;
  pending: number;
  failed: number;
  today: number;
  successRate: string;
  recentFailures: any[];
  lastUpdated: string;
}

export interface EmailHistoryItem {
  _id: string;
  to: string;
  subject: string;
  template: string;
  templateData: any;
  status: 'sent' | 'pending' | 'failed';
  priority: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  messageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  error?: string;
}

export interface EmailHistoryResponse {
  email: string;
  history: EmailHistoryItem[];
  count: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

class NotificationService {
  private baseUrl = NOTIFICATION_SERVICE_URL;

  // In-app notification endpoints.
  // recipientId is no longer resolved client-side: the backend derives it
  // from the caller's JWT (student or teacher) and ignores/rejects a
  // mismatched one. The old per-request lookup against
  // /candidates/by-auth-user/ is gone too — since the "one person, one id"
  // merge, the JWT's userId already IS the candidate id for students, so
  // that extra round trip resolved to the same id anyway (see
  // notificationSocket.ts for the same observation on the socket side).
  // Only an admin passing an explicit recipientId still has any effect.
  async getInAppNotifications(params?: { recipientId?: string; onlyUnread?: boolean; limit?: number; page?: number }) {
    try {
      const query = new URLSearchParams();
      if (params?.recipientId) query.append('recipientId', params.recipientId);
      if (params?.onlyUnread !== undefined) query.append('onlyUnread', String(params.onlyUnread));
      if (params?.limit) query.append('limit', String(params.limit));
      if (params?.page) query.append('page', String(params.page));

      const url = `${this.baseUrl}/notifications/inapp?${query.toString()}`;
      const res = await axios.get(url, { headers: authHeaders() });
      return res.data;
    } catch (error) {
      console.error('Error fetching in-app notifications', error);
      return { success: false, message: 'Network error', error };
    }
  }

  async markInAppNotificationAsRead(id: string) {
    try {
      const url = `${this.baseUrl}/notifications/inapp/${id}/read`;
      const res = await axios.patch(url, {}, { headers: authHeaders() });
      return res.data;
    } catch (error) {
      console.error('Error marking notification as read', error);
      return { success: false, message: 'Network error', error };
    }
  }

  async deleteInAppNotification(id: string) {
    try {
      const url = `${this.baseUrl}/notifications/inapp/${id}`;
      const res = await axios.delete(url, { headers: authHeaders() });
      return res.data;
    } catch (error) {
      console.error('Error deleting in-app notification', error);
      return { success: false, message: 'Network error', error };
    }
  }

  // Enviar email de prueba
  async sendTestEmail(emailData: {
    to: string;
    type: 'welcome' | 'otp' | 'password_reset';
    data: any;
  }): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/notifications/send-test`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(emailData),
      });

      return await response.json();
    } catch (error) {
      console.error('Error sending test email:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Obtener estadísticas de emails
  async getEmailStats(): Promise<ApiResponse<NotificationStats>> {
    try {
      const response = await fetch(`${this.baseUrl}/notifications/stats`, { headers: authHeaders() });
      return await response.json();
    } catch (error) {
      console.error('Error getting email stats:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Obtener historial de emails
  async getEmailHistory(params?: {
    email?: string;
    limit?: number;
    offset?: number;
    status?: 'sent' | 'pending' | 'failed';
  }): Promise<ApiResponse<EmailHistoryResponse>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.email) queryParams.append('email', params.email);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.status) queryParams.append('status', params.status);

      const url = `${this.baseUrl}/notifications/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await axios.get(url, { headers: authHeaders() });

      // Handle the nested response structure
      if (response.data.data && response.data.data.data) {
        return {
          success: true,
          message: response.data.data.message || "Historial obtenido",
          data: response.data.data.data
        };
      }
      
      return response.data;
    } catch (error) {
      console.error('Error getting email history:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Procesar cola de emails
  async processEmailQueue(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/notifications/process-queue`, {
        method: 'POST',
        headers: authHeaders(),
      });

      return await response.json();
    } catch (error) {
      console.error('Error processing email queue:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Reintentar emails fallidos
  async retryFailedEmails(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/notifications/retry-failed`, {
        method: 'POST',
        headers: authHeaders(),
      });

      return await response.json();
    } catch (error) {
      console.error('Error retrying failed emails:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Verificar salud del servicio
  async checkHealth(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return await response.json();
    } catch (error) {
      console.error('Error checking notification service health:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }
}

export const notificationService = new NotificationService();