import { authSDK } from "@/services/sdk-simple-auth";
import axios from "axios";

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
  private baseUrl = import.meta.env.VITE_NOTIFICATION_SERVICE_URL || 'http://localhost:3001';

  // In-app notification endpoints
  async getInAppNotifications(params?: { recipientId?: string; onlyUnread?: boolean; limit?: number; page?: number }) {
    try {

      const role = authSDK.getCurrentUser()?.role; 
      let finalRecipientId = params?.recipientId;
      if(role === 'student'){  
        const {data} = await axios.get(`${import.meta.env.VITE_USER_MANAGEMENT_URL}/api/v1/candidates/by-auth-user/${authSDK.getCurrentUser()?.id}`,{
          headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSDK.getAccessToken()}`
          }
        });
        if(!data.data._id) throw new Error('No se encontró el candidato asociado al usuario autenticado'); 
        finalRecipientId = data.data._id;
      }

      const query = new URLSearchParams();
      if (params?.recipientId) query.append('recipientId', finalRecipientId!);
      if (params?.onlyUnread !== undefined) query.append('onlyUnread', String(params.onlyUnread));
      if (params?.limit) query.append('limit', String(params.limit));
      if (params?.page) query.append('page', String(params.page));

      const url = `${this.baseUrl}/notifications/inapp?${query.toString()}`;
      const token = await (await import('@/services/sdk-simple-auth')).authSDK.getAccessToken();

      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(res.data,'res.data');
      return await res.data;
    } catch (error) {
      console.error('Error fetching in-app notifications', error);
      return { success: false, message: 'Network error', error };
    }
  }

  async markInAppNotificationAsRead(id: string) {
    try {
      const url = `${this.baseUrl}/notifications/inapp/${id}/read`;
      const token = await (await import('@/services/sdk-simple-auth')).authSDK.getAccessToken();

      const res = await axios.patch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('marcando como listo', res)
      return await res.data;
    } catch (error) {
      console.error('Error marking notification as read', error);
      return { success: false, message: 'Network error', error };
    }
  } 

  async deleteInAppNotification(id: string) {
    try {
      const url = `${this.baseUrl}/notifications/inapp/${id}`;
      const token = await (await import('@/services/sdk-simple-auth')).authSDK.getAccessToken();

      const res = await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

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
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${this.baseUrl}/notifications/stats`);
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
      const response = await axios.get(url);
        console.log(response.data)
      
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