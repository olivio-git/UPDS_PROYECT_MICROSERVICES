import { authSDK } from '@/services/sdk-simple-auth';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

export interface AvailableSession {
  sessionId: string;
  examId: string;
  examName: string;
  sessionName: string;
  scheduledAt: Date;
  duration: number;
  status: 'scheduled' | 'active' | 'finished'; // <-- added 'finished'
  hasLobby: boolean;
  lobbyStatus?: 'waiting' | 'starting' | 'in_progress' | 'finished';
  maxParticipants?: number;
  currentParticipants?: number;
  requiresTechnicalVerification?: boolean;
  registrationDeadline?: Date;
  competencies?: string[];
}

export interface CandidateInfo {
  _id: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
  };
  status: string;
  examHistory?: any[];
}

class StudentSessionService {
  private axiosInstance: AxiosInstance;
  private candidateInfo: CandidateInfo | null = null;

  constructor() {
    const baseURL = import.meta.env.VITE_SESSION_MANAGER_URL || 'http://localhost:3004';
    
    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para agregar el token a todas las peticiones
    this.axiosInstance.interceptors.request.use((config) => {
      const token = authSDK.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Obtener información del candidato actual
   */
  // ...existing code...
  async getCurrentCandidate(): Promise<CandidateInfo> {
      if (this.candidateInfo) {
        return this.candidateInfo;
      }

      try {
        const authUser = authSDK.getCurrentUser();
        if (!authUser?.id) {
          throw new Error('No se encontró usuario autenticado');
        }

        const response = await axios.get(
          `${import.meta.env.VITE_USER_MANAGEMENT_URL || 'http://localhost:3002'}/api/v1/candidates/by-auth-user/${authUser.id}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authSDK.getAccessToken()}`
            }
          }
        );

        const candidate = response.data.data as CandidateInfo | null;
        if (!candidate || !candidate._id) {
          throw new Error('No se encontró candidato asociado al usuario');
        }

        this.candidateInfo = candidate;
        return this.candidateInfo;

      } catch (error) {
        console.error('Error obteniendo información del candidato:', error);
        throw error;
      }
    } 

  /**
   * Obtener sesiones disponibles para el estudiante
   */
  async getAvailableSessions(): Promise<AvailableSession[]> {
    try {
      const candidate = await this.getCurrentCandidate();
      
      const response = await this.axiosInstance.get(
        `/api/v1/sessions/available-for-candidate/${candidate._id}`
      );

      if (response.data.success) {
        // Convertir fechas de string a Date
        return response.data.data.map((session: any) => ({
          ...session,
          scheduledAt: new Date(session.scheduledAt),
          registrationDeadline: session.registrationDeadline ? new Date(session.registrationDeadline) : undefined
        }));
      }

      return [];

    } catch (error) {
      console.error('Error obteniendo sesiones disponibles:', error);
      throw error;
    }
  }

  /**
   * Obtener detalle de una sesión específica
   */
  async getSessionDetails(sessionId: string): Promise<AvailableSession | null> {
    try {
      const sessions = await this.getAvailableSessions();
      return sessions.find(s => s.sessionId === sessionId) || null;
    } catch (error) {
      console.error('Error obteniendo detalles de la sesión:', error);
      return null;
    }
  }

  /**
   * Verificar si el estudiante puede unirse a una sesión
   */
  async canJoinSession(sessionId: string): Promise<{ canJoin: boolean; reason?: string }> {
    try {
      const session = await this.getSessionDetails(sessionId);
      
      if (!session) {
        return { canJoin: false, reason: 'Sesión no encontrada' };
      }

      if (session.status === 'finished') {
        return { canJoin: false, reason: 'La sesión ya ha finalizado' };
      }

      if (!session.hasLobby && session.status === 'scheduled') {
        return { canJoin: false, reason: 'El lobby aún no está disponible' };
      }

      if (session.currentParticipants && session.maxParticipants && 
          session.currentParticipants >= session.maxParticipants) {
        return { canJoin: false, reason: 'La sesión está llena' };
      }

      if (session.registrationDeadline && new Date(session.registrationDeadline) < new Date()) {
        return { canJoin: false, reason: 'El período de registro ha finalizado' };
      }

      return { canJoin: true };

    } catch (error) {
      console.error('Error verificando acceso a la sesión:', error);
      return { canJoin: false, reason: 'Error al verificar acceso' };
    }
  }

  /**
   * Limpiar caché del candidato
   */
  clearCandidateCache(): void {
    this.candidateInfo = null;
  }
}

// Instancia singleton
export const studentSessionService = new StudentSessionService();

export default studentSessionService;
