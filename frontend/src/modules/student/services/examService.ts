import { examService as globalExamService } from '@/services/examService';

export interface NextExamData {
  id: string;
  name: string;
  date: string;
  time: string;
  duration: string;
  level: string;
  examId: string;
  sessionId: string;
  status: string;
  myAttemptStatus?: string | null; // 'in_progress' | 'completed' | null
  rawStartDate: string;
  rawEndDate: string;
  allowLateEntry: boolean;
  lateEntryMinutes: number;
  examDurationMinutes: number;
  browserLockdown: boolean;
  exam?: {
    name: string;
    type: string;
    targetLevel: string;
    placementConfig?: {
      mode: 'static' | 'adaptive';
      startingLevel?: string;
      maxQuestions?: number;
      consecutiveWrongThreshold?: number;
      levelPassingThreshold?: number;
    };
  };
  createdBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    teacherData?: {
      department: string;
      specialization: string[];
      experience: number;
    };
  };
}

class StudentExamService {
  /**
   * Obtiene las próximas sesiones de examen para el candidato actual
   */
  async getNextExams(justLast = true): Promise<NextExamData[]> {
    try {
      const response = await globalExamService.apiClient.get('/sessions/my-sessions', {
        params: {
          status: 'scheduled,in_progress',
          limit: 10,
          page: 1,
          justLast,
        }
      });
      
      console.log(response, "<--- response");
      
      // Extraer los datos según la estructura real
      let sessionsData = [];
      
      if (response.data.success && response.data.data?.sessions) {
        sessionsData = Array.isArray(response.data.data.sessions) 
          ? response.data.data.sessions 
          : [response.data.data.sessions];
      } else if (Array.isArray(response.data)) {
        sessionsData = response.data;
      } else if (response.data && typeof response.data === 'object' && response.data._id) {
        sessionsData = [response.data];
      }
      
      console.log(sessionsData, "<--- sessionsData processed");
      
      // Mapear directamente sin validaciones ya que el backend ya filtró
      const mappedSessions = sessionsData.map((session:any) => this.mapBackendSessionToNextExam(session));
      
      console.log(mappedSessions, "<--- mappedSessions");
      return mappedSessions;
      
    } catch (error) {
      console.error('Error fetching next exams:', error);
      throw new Error('No se pudieron cargar los exámenes próximos');
    }
  }

  /**
   * Mapea una sesión del backend al formato esperado por NextExam
   */
  private mapBackendSessionToNextExam(session: any): NextExamData {
    console.log('Mapeando sesión:', session);
    
    const startDate = new Date(session.scheduling?.startDate || new Date());
    
    const mapped = {
      id: session._id || 'unknown',
      sessionId: session._id || 'unknown',
      examId: session.examId || session.exam?._id || 'unknown',
      name: session.sessionName || session.exam?.name || 'Examen sin nombre',
      date: startDate.toISOString().split('T')[0],
      time: startDate.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      duration: this.formatDuration(session.exam?.structure?.totalDuration || 60),
      rawStartDate: session.scheduling?.startDate || new Date().toISOString(),
      rawEndDate: session.scheduling?.endDate || new Date().toISOString(),
      allowLateEntry: session.settings?.allowLateEntry ?? false,
      lateEntryMinutes: session.settings?.lateEntryMinutes ?? 0,
      browserLockdown: session.settings?.browserLockdown ?? false,
      examDurationMinutes: session.exam?.structure?.totalDuration ?? 60,
      level: session.exam?.targetLevel || 'N/A',
      status: session.status || 'scheduled',
      myAttemptStatus: session.myAttemptStatus ?? null,
      exam: session.exam ? {
        name: session.exam.name || 'Sin nombre',
        type: session.exam.type || 'evaluation',
        targetLevel: session.exam.targetLevel || 'N/A',
        placementConfig: session.exam.placementConfig ?? undefined,
      } : undefined,
      createdBy: session.createdBy ? {
        _id: session.createdBy._id,
        firstName: session.createdBy.firstName,
        lastName: session.createdBy.lastName,
        email: session.createdBy.email,
        role: session.createdBy.role,
        avatarUrl: session.createdBy.profile?.avatarUrl,
        teacherData: session.createdBy.teacherData ? {
          department: session.createdBy.teacherData.department,
          specialization: session.createdBy.teacherData.specialization,
          experience: session.createdBy.teacherData.experience
        } : undefined
      } : undefined
    };
    
    console.log('Sesión mapeada:', mapped);
    return mapped;
  }

  /**
   * Obtiene el próximo examen del candidato
   */
  async getNextExam(): Promise<NextExamData | null> {
    try {
      const exams = await this.getNextExams();
      return exams.length > 0 ? exams[0] : null;
    } catch (error) {
      console.error('Error fetching next exam:', error);
      throw error;
    }
  }

  /**
   * Inicia una sesión de examen
   */
  async startExam(sessionId: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await globalExamService.startExam(sessionId);
      return {
        success: true,
        message: 'Sesión iniciada correctamente',
        data: response.data
      };
    } catch (error: any) {
      console.error('Error starting exam:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al iniciar el examen'
      };
    }
  }

  /**
   * Formatea la duración en minutos a un texto legible
   */
  private formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}min`;
  }
}

export const studentExamService = new StudentExamService();
