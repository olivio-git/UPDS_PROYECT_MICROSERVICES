import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
}

export interface ICandidate {
  _id: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: Date;
    nationality: string;
  };
  academicInfo: {
    currentLevel: string;
    targetLevel: string;
    previousExperience: string;
  };
  technicalSetup: {
    hasHeadphones: boolean;
    hasMicrophone: boolean;
    hasWebcam: boolean;
  };
  status: string;
  examHistory: any[];
}

export class UserManagementIntegration {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.USER_MANAGEMENT_SERVICE_URL || 'http://localhost:3002/api/v1',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getUser(userId: string, token: string): Promise<IUser | null> {
    try {
      const response = await this.client.get(`/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data.data;
    } catch (error) {
      logger.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  }

  async getCandidate(candidateId: string, token: string): Promise<ICandidate | null> {
    try {
      const response = await this.client.get(`/candidates/${candidateId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data.data;
    } catch (error) {
      logger.error(`Error fetching candidate ${candidateId}:`, error);
      return null;
    }
  }

  async getCandidateByUserId(userId: string, token?: string): Promise<ICandidate | null> {
    try {
      const response = await this.client.get(`/candidates/by-user/${userId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        }
      );
      return response.data.data || null;
    } catch (error: any) {
      // Avoid logging circular objects directly (axios error contains circular refs)
      const msg = error?.message || String(error);
      logger.error(`Error fetching candidate by userId ${userId}: ${msg}`);
      return null;
    }
  }

  async getCandidatesByIds(candidateIds: string[], token?: string): Promise<ICandidate[]> {
    try {
      if (candidateIds.length === 0) {
        return [];
      }

      // Usar el endpoint interno para llamadas entre servicios
      const response = await this.client.post('/candidates/internal/batch', {
        ids: candidateIds
      }, {
        headers: {
          'X-Service': 'exam-service' // Header para identificar llamadas internas
        }
      });

      if (response.data.success) {
        return response.data.data || [];
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching multiple candidates:', error);
      return [];
    }
  }

  async updateCandidateExamHistory(candidateId: string, examData: any, token: string): Promise<boolean> {
    try {
      const response = await this.client.post(
        `/candidates/${candidateId}/exam-history`,
        examData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      return response.data.success === true;
    } catch (error) {
      logger.error(`Error updating candidate exam history ${candidateId}:`, error);
      return false;
    }
  }

  async checkCandidateEligibility(candidateId: string, level: string, token: string): Promise<boolean> {
    try {
      const response = await this.client.get(
        `/candidates/${candidateId}/eligibility/${level}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      return response.data.data.isEligible === true;
    } catch (error) {
      logger.error(`Error checking candidate eligibility ${candidateId}:`, error);
      return false;
    }
  }

  async getTechnicalVerification(candidateId: string, token: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/candidates/${candidateId}/technical-exist`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data.data;
    } catch (error) {
      logger.error(`Error fetching technical verification for candidate ${candidateId}:`, error);
      return null;
    }
  } 
}
