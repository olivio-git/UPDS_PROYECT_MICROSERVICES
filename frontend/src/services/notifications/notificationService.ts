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
  type: string;
  status: 'sent' | 'pending' | 'failed';
  createdAt: string;
  deliveredAt?: string;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

class NotificationService {
  private baseUrl = import.meta.env.VITE_NOTIFICATION_SERVICE_URL || 'http://localhost:3001';

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
  }): Promise<ApiResponse<EmailHistoryItem[]>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.email) queryParams.append('email', params.email);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.status) queryParams.append('status', params.status);

      const url = `${this.baseUrl}/notifications/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);
      return await response.json();
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