import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export class AuthIntegration {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.AUTH_SERVICE_URL || 'http://localhost:3000/auth',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async validateToken(token: string): Promise<{ valid: boolean; user?: any }> {
    try {
      const response = await this.client.get('/validate', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return {
        valid: response.data.success === true,
        user: response.data.data?.user
      };
    } catch (error) {
      logger.error('Error validating token:', error);
      return { valid: false };
    }
  }

  async getUserPermissions(userId: string, token: string): Promise<string[]> {
    try {
      const response = await this.client.get(`/users/${userId}/permissions`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return response.data.data?.permissions || [];
    } catch (error) {
      logger.error(`Error fetching user permissions for ${userId}:`, error);
      return [];
    }
  }

  async checkPermission(userId: string, permission: string, token: string): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId, token);
      return permissions.includes(permission);
    } catch (error) {
      logger.error(`Error checking permission ${permission} for user ${userId}:`, error);
      return false;
    }
  }
}
