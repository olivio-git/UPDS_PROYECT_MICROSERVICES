import axios, { type AxiosInstance } from 'axios';
// @ts-ignore
import type {
  ApiQuestionResponse,
  ApiResponse,
  Exam,
  ExamFilters,
  ExamResult,
  ExamSession,
  PaginatedResponse,
  PaginationParams,
  Question,
  QuestionFilters
} from '@/modules/exams/types';
import { authSDK } from './sdk-simple-auth';

class ExamService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_EXAM_SERVICE_URL || 'http://localhost:3003';
    
    this.api = axios.create({
      baseURL: `${this.baseURL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authSDK.getAccessToken(), // Inicialmente vacío, se actualizará en el interceptor
      },
    });

    // Interceptor para agregar token de autenticación
    this.api.interceptors.request.use(
      async (config) => {
        const token = await authSDK.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor para manejar errores
    // this.api.interceptors.response.use(
    //   (response) => response,
    //   async (error) => {
    //     if (error.response?.status === 401) {
    //       // Token expirado, intentar renovar
    //       const refreshed = await authSDK.refreshToken();
    //       if (refreshed) {
    //         // Reintentar la petición original
    //         const originalRequest = error.config;
    //         const token = await authSDK.getAccessToken();
    //         originalRequest.headers.Authorization = `Bearer ${token}`;
    //         return this.api(originalRequest);
    //       }
    //     }
    //     return Promise.reject(error);
    //   }
    // );
  }

  // Público getter para acceder a la API
  get apiClient() {
    return this.api;
  }

  // ==================== QUESTIONS ====================

  // Obtener todas las preguntas con filtros y paginación
  async getQuestions(
  filters?: QuestionFilters,
  pagination?: PaginationParams
): Promise<ApiResponse<ApiQuestionResponse>> {
  try {
    const params = {
      ...filters,
      page: pagination?.page || 1,
      limit: pagination?.limit || 10,
      sortBy: pagination?.sortBy,
      sortOrder: pagination?.sortOrder,
    };
    
    const { data } = await axios.get(`${this.baseURL}/api/v1/questions`, {
      params,
      headers: {
        'Authorization': `Bearer ${authSDK.getAccessToken()}`,
      },
    } as any);

    // Devuelve la respuesta tal cual viene de la API, encapsulada en ApiResponse
    return {
      success: true,
      data: data.data,
    };
  } catch (error) {
    console.error('Error fetching questions:', error);
    throw error;
  }
}

  // Obtener pregunta por ID
  async getQuestionById(id: string): Promise<ApiResponse<Question>> {
    try {
      const response = await this.api.get(`/questions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching question:', error);
      throw error;
    }
  }

  // Crear nueva pregunta
  async createQuestion(question: Partial<Question>): Promise<ApiResponse<Question>> {
    try {
      const response = await this.api.post('/questions', question);
      return response.data;
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  }

  // Crear pregunta con multimedia en una sola petición
  async createQuestionWithMedia(
    question: Partial<Question>,
    mediaFile?: File,
    mediaType?: 'audio' | 'image'
  ): Promise<ApiResponse<Question>> {
    try {
      const formData = new FormData();
      
      // Agregar los datos de la pregunta como JSON string
      formData.append('question', JSON.stringify(question));
      
      // Agregar el archivo multimedia si existe
      if (mediaFile) {
        // Usar el nombre del campo según el tipo de media
        const fieldName = mediaType || (mediaFile.type.startsWith('audio/') ? 'audio' : 'image');
        formData.append(fieldName, mediaFile);
      }

      const response = await this.api.post(
        '/questions/create-with-media',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating question with media:', error);
      throw error;
    }
  }
  // Crear pregunta con múltiples archivos multimedia (para matching, etc.)
  async createQuestionWithMultipleMedia(
    question: Partial<Question>,
    mediaFiles?: { [itemIndex: number]: { audio?: File, image?: File } },
    mainMediaFile?: File,
    mainMediaType?: 'audio' | 'image'
  ): Promise<ApiResponse<Question>> {
    try {
      const formData = new FormData();
      
      // Agregar los datos de la pregunta como JSON string
      formData.append('question', JSON.stringify(question));
      
      // Agregar archivo multimedia principal si existe
      if (mainMediaFile) {
        const fieldName = mainMediaType || (mainMediaFile.type.startsWith('audio/') ? 'audio' : 'image');
        formData.append(fieldName, mainMediaFile);
      }

      // Agregar archivos de elementos individuales
      if (mediaFiles) {
        Object.entries(mediaFiles).forEach(([itemIndex, files]) => {
          if (files.audio) {
            formData.append(`item_audio_${itemIndex}`, files.audio);
          }
          if (files.image) {
            formData.append(`item_image_${itemIndex}`, files.image);
          }
        });
      }

      const response = await this.api.post(
        '/questions/create-with-multiple-media',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error creating question with multiple media:', error);
      throw error;
    }
  }

  // Actualizar pregunta
  async updateQuestion(id: string, updates: Partial<Question>): Promise<ApiResponse<Question>> {
    try {
      const response = await this.api.put(`/questions/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating question:', error);
      throw error;
    }
  }

  // Eliminar pregunta
  async deleteQuestion(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/questions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting question:', error);
      throw error;
    }
  }

  // Obtener estadísticas de preguntas por competencia y nivel
  async getQuestionStats(filters?: { level?: string; competency?: string }): Promise<ApiResponse<{
    byCompetency: Record<string, Record<string, number>>;
    summary: any[];
  }>> {
    try {
      const params = new URLSearchParams();
      if (filters?.level) params.append('level', filters.level);
      if (filters?.competency) params.append('competency', filters.competency);

      const response = await this.api.get(`/questions/stats?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching question stats:', error);
      throw error;
    }
  }

  // Subir audio para pregunta
  async uploadQuestionAudio(questionId: string, file: File): Promise<ApiResponse<{ url: string; key: string }>> {
    try {
      const formData = new FormData();
      formData.append('audio', file);

      const response = await this.api.post(
        `/questions/${questionId}/audio`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error uploading audio:', error);
      throw error;
    }
  }

  // Subir imagen para pregunta
  async uploadQuestionImage(questionId: string, file: File): Promise<ApiResponse<{ url: string; key: string }>> {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await this.api.post(
        `/questions/${questionId}/image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  // Importar preguntas desde Excel/CSV
  async importQuestions(file: File): Promise<ApiResponse<{ success: number; failed: number; errors: any[] }>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.api.post(
        '/questions/import',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error importing questions:', error);
      throw error;
    }
  }

  // Descargar plantilla de importación
  async downloadImportTemplate(format: 'xlsx' | 'csv' = 'xlsx'): Promise<Blob> {
    try {
      const response = await this.api.get('/questions/import/template', {
        params: { format },
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading template:', error);
      throw error;
    }
  }

  // ==================== EXAMS ====================

  // Obtener todos los exámenes
  async getExams(
    filters?: ExamFilters,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<Exam>>> {
    try {
      const params = {
        ...filters,
        page: pagination?.page || 1,
        limit: pagination?.limit || 10,
        sortBy: pagination?.sortBy,
        sortOrder: pagination?.sortOrder,
      };
      
      const response = await this.api.get('/exams', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching exams:', error);
      throw error;
    }
  }

  // Obtener examen por ID
  async getExamById(id: string): Promise<ApiResponse<Exam>> {
    try {
      const response = await this.api.get(`/exams/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching exam:', error);
      throw error;
    }
  }

  // Crear nuevo examen
  async createExam(exam: Partial<Exam>): Promise<ApiResponse<Exam>> {
    try {
      const response = await this.api.post('/exams', exam);
      return response.data;
    } catch (error) {
      console.error('Error creating exam:', error);
      throw error;
    }
  }

  // Actualizar examen
  async updateExam(id: string, updates: Partial<Exam>): Promise<ApiResponse<Exam>> {
    try {
      const response = await this.api.put(`/exams/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating exam:', error);
      throw error;
    }
  }

  // Eliminar examen
  async deleteExam(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/exams/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting exam:', error);
      throw error;
    }
  }

  // Asignar preguntas a examen
  async assignQuestionsToExam(examId: string, questionIds: string[]): Promise<ApiResponse<Exam>> {
    try {
      const response = await this.api.post(`/exams/${examId}/questions`, { questionIds });
      return response.data;
    } catch (error) {
      console.error('Error assigning questions:', error);
      throw error;
    }
  }

  // Duplicar examen
  async duplicateExam(examId: string): Promise<ApiResponse<Exam>> {
    try {
      const response = await this.api.post(`/exams/${examId}/duplicate`);
      return response.data;
    } catch (error) {
      console.error('Error duplicating exam:', error);
      throw error;
    }
  }

  // ==================== SESSIONS ====================

  // Obtener todas las sesiones
  async getSessions(
    filters?: any,
    pagination?: PaginationParams
  ): Promise<any> {
    try {
      const params = {
        ...filters,
        page: pagination?.page || 1,
        limit: pagination?.limit || 10,
        sortBy: filters?.sortBy,
        sortOrder: filters?.sortOrder,
      };
      
      const response = await this.api.get('/sessions', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching sessions:', error);
      throw error;
    }
  }

  // Progreso en tiempo real de una sesión (para el visor del profesor)
  async getSessionProgress(sessionId: string): Promise<any> {
    try {
      const response = await this.api.get(`/sessions/${sessionId}/progress`);
      return response.data;
    } catch (error) {
      console.error('Error fetching session progress:', error);
      throw error;
    }
  }

  async regradeSession(sessionId: string): Promise<any> {
    try {
      const response = await this.api.post(`/sessions/${sessionId}/regrade`);
      return response.data;
    } catch (error) {
      console.error('Error regrading session:', error);
      throw error;
    }
  }

  async endSession(sessionId: string): Promise<any> {
    try {
      const response = await this.api.post(`/sessions/${sessionId}/end`);
      return response.data;
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  async kickCandidate(sessionId: string, candidateId: string): Promise<any> {
    try {
      const response = await this.api.post(`/sessions/${sessionId}/candidates/${candidateId}/kick`);
      return response.data;
    } catch (error) {
      console.error('Error kicking candidate:', error);
      throw error;
    }
  }

  // Obtener sesión por ID
  async getSessionById(id: string): Promise<ApiResponse<ExamSession>> {
    try {
      const response = await this.api.get(`/sessions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching session:', error);
      throw error;
    }
  }

  // Crear nueva sesión
  async createSession(session: Partial<ExamSession>): Promise<ApiResponse<ExamSession>> {
    try {
      const response = await this.api.post('/sessions', session);
      return response.data;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  // Actualizar sesión
  async updateSession(id: string, updates: Partial<ExamSession>): Promise<ApiResponse<ExamSession>> {
    try {
      const response = await this.api.put(`/sessions/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  // Iniciar sesión de examen
  async startSession(sessionId: string): Promise<ApiResponse<ExamSession>> {
    try {
      const response = await this.api.post(`/sessions/${sessionId}/start`);
      return response.data;
    } catch (error) {
      console.error('Error starting session:', error);
      throw error;
    }
  }

  // Finalizar sesión de examen
  async endSession(sessionId: string): Promise<ApiResponse<ExamSession>> {
    try {
      const response = await this.api.post(`/sessions/${sessionId}/end`);
      return response.data;
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  // Agregar candidatos a sesión
  async addCandidatesToSession(sessionId: string, candidateIds: string[]): Promise<ApiResponse<ExamSession>> {
    try {
      // El backend espera candidateId en singular, así que enviamos uno por uno
      const promises = candidateIds.map(candidateId => 
        this.api.post(`/sessions/${sessionId}/candidates`, { candidateId })
      );
      
      await Promise.all(promises);
      
      // Retornar la sesión actualizada
      return await this.getSessionById(sessionId);
    } catch (error) {
      console.error('Error adding candidates:', error);
      throw error;
    }
  }
  // Remover candidatos de sesión
  async removeCandidatesFromSession(sessionId: string, candidateIds: string[]): Promise<ApiResponse<ExamSession>> {
    try {
      // El backend espera candidateId en singular, así que enviamos uno por uno
      const promises = candidateIds.map(candidateId => 
        this.api.delete(`/sessions/${sessionId}/candidates`,{
          data: { candidateId }
        })
      );

      await Promise.all(promises);

      // Retornar la sesión actualizada
      return await this.getSessionById(sessionId);
    } catch (error) {
      console.error('Error removing candidates:', error);
      throw error;
    }
  } 
  // ==================== RESULTS ====================

  // Obtener resultados por sesión
  async getSessionResults(sessionId: string): Promise<ApiResponse<ExamResult[]>> {
    try {
      const response = await this.api.get(`/sessions/${sessionId}/results`);
      return response.data;
    } catch (error) {
      console.error('Error fetching results:', error);
      throw error;
    }
  }

  // Obtener resultado específico
  async getResultById(resultId: string): Promise<ApiResponse<ExamResult>> {
    try {
      const response = await this.api.get(`/results/${resultId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching result:', error);
      throw error;
    }
  }

  // Obtener resultados de candidato
  async getCandidateResults(candidateId: string): Promise<ApiResponse<ExamResult[]>> {
    try {
      const response = await this.api.get(`/candidates/${candidateId}/results`);
      return response.data;
    } catch (error) {
      console.error('Error fetching candidate results:', error);
      throw error;
    }
  }

  // Exportar resultados
  async exportResults(sessionId: string, format: 'pdf' | 'excel' | 'csv' = 'pdf'): Promise<Blob> {
    try {
      const response = await this.api.get(`/sessions/${sessionId}/export`, {
        params: { format },
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting results:', error);
      throw error;
    }
  }

  // // ==================== SESSIONS ====================

  // // Obtener todas las sesiones
  // async getSessions(
  //   filters?: any,
  //   pagination?: PaginationParams
  // ): Promise<ApiResponse<PaginatedResponse<ExamSession>>> {
  //   try {
  //     const params = {
  //       ...filters,
  //       page: pagination?.page || 1,
  //       limit: pagination?.limit || 10,
  //       sortBy: pagination?.sortBy,
  //       sortOrder: pagination?.sortOrder,
  //     };
      
  //     const response = await this.api.get('/sessions', { params });
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error fetching sessions:', error);
  //     throw error;
  //   }
  // }

  // // Obtener sesión por ID
  // async getSessionById(id: string): Promise<ApiResponse<ExamSession>> {
  //   try {
  //     const response = await this.api.get(`/sessions/${id}`);
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error fetching session:', error);
  //     throw error;
  //   }
  // }

  // // Crear nueva sesión
  // async createSession(session: Partial<ExamSession>): Promise<ApiResponse<ExamSession>> {
  //   try {
  //     const response = await this.api.post('/sessions', session);
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error creating session:', error);
  //     throw error;
  //   }
  // }

  // // Actualizar sesión
  // async updateSession(id: string, updates: Partial<ExamSession>): Promise<ApiResponse<ExamSession>> {
  //   try {
  //     const response = await this.api.put(`/sessions/${id}`, updates);
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error updating session:', error);
  //     throw error;
  //   }
  // }

  // // Iniciar sesión de examen
  // async startSession(sessionId: string): Promise<ApiResponse<ExamSession>> {
  //   try {
  //     const response = await this.api.post(`/sessions/${sessionId}/start`);
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error starting session:', error);
  //     throw error;
  //   }
  // }

  // // Finalizar sesión de examen
  // async endSession(sessionId: string): Promise<ApiResponse<ExamSession>> {
  //   try {
  //     const response = await this.api.post(`/sessions/${sessionId}/end`);
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error ending session:', error);
  //     throw error;
  //   }
  // }

  // Cancelar sesión
  async cancelSession(sessionId: string): Promise<ApiResponse<ExamSession>> {
    try {
      const response = await this.api.post(`/sessions/${sessionId}/cancel`);
      return response.data;
    } catch (error) {
      console.error('Error cancelling session:', error);
      throw error;
    }
  }

  // Agregar candidatos a sesión
  // async addCandidatesToSession(sessionId: string, candidateIds: string[]): Promise<ApiResponse<ExamSession>> {
  //   try {
  //     // El backend espera candidateId en singular, así que enviamos uno por uno
  //     const promises = candidateIds.map(candidateId => 
  //       this.api.post(`/sessions/${sessionId}/candidates`, { candidateId })
  //     );
      
  //     await Promise.all(promises);
      
  //     // Retornar la sesión actualizada
  //     return await this.getSessionById(sessionId);
  //   } catch (error) {
  //     console.error('Error adding candidates:', error);
  //     throw error;
  //   }
  // }

  // Remover candidato de sesión
  async removeCandidateFromSession(sessionId: string, candidateId: string): Promise<ApiResponse<ExamSession>> {
    try {
      const response = await this.api.delete(`/sessions/${sessionId}/candidates`, {
        data: { candidateId }
      });
      return response.data;
    } catch (error) {
      console.error('Error removing candidate:', error);
      throw error;
    }
  }

  // Agregar proctor a sesión
  async addProctorToSession(sessionId: string, proctorId: string): Promise<ApiResponse<ExamSession>> {
    try {
      const response = await this.api.post(`/sessions/${sessionId}/proctors`, { proctorId });
      return response.data;
    } catch (error) {
      console.error('Error adding proctor:', error);
      throw error;
    }
  }

  // Agregar candidatos a sesión (múltiples)
  // async addCandidatesToSession(sessionId: string, candidateIds: string[]): Promise<ApiResponse<ExamSession>> {
  //   try {
  //     const response = await this.api.post(`/sessions/${sessionId}/candidates`, { candidateIds });
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error adding candidates:', error);
  //     throw error;
  //   }
  // }

  // // Remover candidatos de sesión (múltiples)
  // async removeCandidatesFromSession(sessionId: string, candidateIds: string[]): Promise<ApiResponse<ExamSession>> {
  //   try {
  //     const response = await this.api.delete(`/sessions/${sessionId}/candidates`, {
  //       data: { candidateIds }
  //     });
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error removing candidates:', error);
  //     throw error;
  //   }
  // }

  // Agregar proctors a sesión (múltiples)
  async addProctorsToSession(sessionId: string, proctorIds: string[]): Promise<ApiResponse<ExamSession>> {
    try {
      const promises = proctorIds.map(proctorId => this.api.post(`/sessions/${sessionId}/proctors`, { proctorId }));
      await Promise.all(promises);
      return await this.getSessionById(sessionId);
    } catch (error) {
      console.error('Error adding proctors:', error);
      throw error;
    }
  }

  // Remover proctors de sesión (múltiples)
  async removeProctorsFromSession(sessionId: string, proctorIds: string[]): Promise<ApiResponse<ExamSession>> {
    try {
      const promises = proctorIds.map(proctorId => this.api.delete(`/sessions/${sessionId}/proctors`, {
        data: { proctorId }
      }));
      await Promise.all(promises);
      return await this.getSessionById(sessionId);
    } catch (error) {
      console.error('Error removing proctors:', error);
      throw error;
    }
  }

  // Obtener estadísticas de sesión
  async getSessionStats(sessionId: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.get(`/sessions/${sessionId}/stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching session stats:', error);
      throw error;
    }
  }

  // ==================== EXAM TAKING ====================

  // Iniciar examen (como candidato)
  async startExam(sessionId: string): Promise<ApiResponse<{ examId: string; questions: Question[]; timeAllowedSeconds: number; attemptId: string }>> {
    try {
      const response = await this.api.post(`/exam-taking/${sessionId}/start`);
      return response.data;
    } catch (error) {
      console.error('Error starting exam:', error);
      throw error;
    }
  }

  // Enviar respuesta
  async submitAnswer(
    sessionId: string,
    questionId: string,
    answer: any
  ): Promise<ApiResponse<{ saved: boolean }>> {
    try {
      const response = await this.api.post(`/exam-taking/${sessionId}/answer`, {
        questionId,
        answer,
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting answer:', error);
      throw error;
    }
  }

  // Subir audio de respuesta (para preguntas de tipo audio_response)
  async uploadResponseAudio(
    sessionId: string,
    questionId: string,
    audioBlob: Blob
  ): Promise<string> {
    const formData = new FormData();
    const rawExt = audioBlob.type.split(';')[0].split('/')[1] ?? 'webm';
    const ext = ['webm', 'ogg', 'mp4', 'wav', 'aac', 'flac'].includes(rawExt) ? rawExt : 'webm';
    formData.append('audio', audioBlob, `response_${Date.now()}.${ext}`);
    formData.append('questionId', questionId);

    const response = await this.api.post(
      `/exam-taking/${sessionId}/response-audio`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data.audioUrl as string;
  }

  // Finalizar examen
  async finishExam(sessionId: string): Promise<ApiResponse<ExamResult>> {
    try {
      const response = await this.api.post(`/exam-taking/${sessionId}/finish`);
      return response.data;
    } catch (error) {
      console.error('Error finishing exam:', error);
      throw error;
    }
  }

  // Obtener tiempo restante
  async getTimeRemaining(sessionId: string): Promise<ApiResponse<{ timeRemaining: number }>> {
    try {
      const response = await this.api.get(`/exam-taking/${sessionId}/time`);
      return response.data;
    } catch (error) {
      console.error('Error getting time:', error);
      throw error;
    }
  }

  // Obtener preguntas de una sesión específica
  async getSessionQuestions(sessionId: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.get(`/sessions/${sessionId}/questions`);
      return response.data;
    } catch (error) {
      console.error('Error getting session questions:', error);
      throw error;
    }
  }

  // ==================== NEW HTTP-BASED EXAM METHODS ====================

  // Obtener respuestas guardadas del usuario
  async getMyAnswers(sessionId: string): Promise<ApiResponse<{ answers: Record<string, any>, totalAnswered: number }>> {
    try {
      const response = await this.api.get(`/exam-taking/${sessionId}/answers`);
      return response.data;
    } catch (error) {
      console.error('Error getting my answers:', error);
      throw error;
    }
  }

  // Verificar si hay una sesión activa
  async getActiveSession(): Promise<ApiResponse<{
    sessionId: string;
    attemptId: string;
    startedAt: Date;
    timeRemaining: number;
    status: string;
  } | null>> {
    try {
      const response = await this.api.get(`/exam-taking/active-session`);
      return response.data;
    } catch (error) {
      console.error('Error getting active session:', error);
      throw error;
    }
  }

  // ==================== ADAPTIVE EXAM (CAT) ====================

  async startAdaptiveExam(sessionId: string): Promise<ApiResponse<{
    question: any;
    attemptId: string;
    adaptiveState: {
      currentLevel: string;
      questionsAnswered: number;
      maxQuestions: number;
      consecutiveWrongThreshold: number;
      isFinished: boolean;
    };
  }>> {
    try {
      const response = await this.api.post(`/exam-taking/${sessionId}/adaptive/start`);
      return response.data;
    } catch (error) {
      console.error('Error starting adaptive exam:', error);
      throw error;
    }
  }

  async submitAdaptiveAnswer(
    sessionId: string,
    questionId: string,
    answer: any
  ): Promise<ApiResponse<{
    finished: boolean;
    stopReason?: string;
    gradeResult: { isCorrect: boolean; score: number; maxScore: number; feedback: string };
    nextQuestion?: any;
    adaptiveState: {
      currentLevel: string;
      questionsAnswered: number;
      maxQuestions: number;
      consecutiveWrongThreshold: number;
      consecutiveWrong: number;
      isFinished: boolean;
      stopReason?: string;
    };
  }>> {
    try {
      const response = await this.api.post(`/exam-taking/${sessionId}/adaptive/answer`, {
        questionId,
        answer,
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting adaptive answer:', error);
      throw error;
    }
  }

  async resumeAdaptiveExam(sessionId: string): Promise<ApiResponse<{
    finished: boolean;
    question?: any;
    attemptId?: string;
    adaptiveState?: any;
  }>> {
    try {
      const response = await this.api.get(`/exam-taking/${sessionId}/adaptive/resume`);
      return response.data;
    } catch (error) {
      console.error('Error resuming adaptive exam:', error);
      throw error;
    }
  }

  // Resumir examen (recuperación completa)
  async resumeExam(sessionId: string): Promise<ApiResponse<{
    examId: string;
    questions: Question[];
    answers: Record<string, any>;
    currentQuestionIndex: number;
    timeRemaining: number;
    attemptId: string;
    progress: { answered: number; total: number };
  }>> {
    try {
      const response = await this.api.get(`/exam-taking/${sessionId}/resume`);
      return response.data;
    } catch (error) {
      console.error('Error resuming exam:', error);
      throw error;
    }
  }
}

// Exportar instancia única del servicio
export const examService = new ExamService();
