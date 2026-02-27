import { ActiveSessionModel, IIndividualSessionData } from '../models/ActiveSession';
import { logger } from '../utils/logger';

export interface ProgressData {
  candidateId: string;
  sessionId: string;
  subSessionId: string;
  responses: Array<{
    questionId: string;
    answer: any;
    timeSpent: number;
    timestamp: Date;
  }>;
  currentQuestionIndex: number;
  timeSpent: number;
  lastActivity: Date;
}

export class AutoSaveService {
  private static instance: AutoSaveService;
  private saveQueue: Map<string, ProgressData> = new Map();
  private processingQueue = false;
  private batchSize = 10;
  private maxRetries = 3;

  private constructor() {
    // Procesar cola cada 5 segundos
    setInterval(() => {
      this.processBatch();
    }, 5000);
  }

  public static getInstance(): AutoSaveService {
    if (!AutoSaveService.instance) {
      AutoSaveService.instance = new AutoSaveService();
    }
    return AutoSaveService.instance;
  }

  /**
   * Guardar progreso de un candidato (llamado desde DualTimingManager)
   */
  async saveProgress(data: ProgressData): Promise<void> {
    try {
      // Agregar a la cola para procesamiento en lotes
      this.saveQueue.set(data.candidateId, data);
      
      // Log para debugging
      logger.debug(`💾 Progreso agregado a cola para candidato: ${data.candidateId}`);
      
    } catch (error) {
      logger.error(`❌ Error agregando progreso a cola para ${data.candidateId}:`, error);
    }
  }

  /**
   * Procesar lote de auto-saves
   */
  private async processBatch(): Promise<void> {
    if (this.processingQueue || this.saveQueue.size === 0) {
      return;
    }

    this.processingQueue = true;
    
    try {
      const batch = Array.from(this.saveQueue.entries()).slice(0, this.batchSize);
      const promises: Promise<void>[] = [];

      for (const [candidateId, data] of batch) {
        promises.push(this.saveIndividualProgress(data));
        this.saveQueue.delete(candidateId);
      }

      await Promise.allSettled(promises);
      
      if (batch.length > 0) {
        logger.info(`💾 Procesado lote de auto-save: ${batch.length} candidatos`);
      }

    } catch (error) {
      logger.error('❌ Error procesando lote de auto-save:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Guardar progreso individual con reintentos
   */
  private async saveIndividualProgress(data: ProgressData, retries = 0): Promise<void> {
    try {
      const session = await ActiveSessionModel.findOne({ sessionId: data.sessionId });
      
      if (!session) {
        logger.warn(`⚠️ Sesión no encontrada para auto-save: ${data.sessionId}`);
        return;
      }

      if (!session.individualSessions?.has(data.candidateId)) {
        logger.warn(`⚠️ Sesión individual no encontrada: ${data.subSessionId}`);
        return;
      }

      // Actualizar datos de la sesión individual
      const individualSession = session.individualSessions.get(data.candidateId)!;
      individualSession.lastAutoSave = new Date();
      individualSession.lastActivity = data.lastActivity;
      
      // Si el candidato se desconectó y reconectó, incrementar contador
      if (data.lastActivity.getTime() - (individualSession.lastActivity?.getTime() || 0) > 60000) {
        individualSession.disconnections += 1;
      }

      session.individualSessions.set(data.candidateId, individualSession);

      // Actualizar respuestas en la sesión principal (opcional - podría ser en otra colección)
      if (data.responses.length > 0) {
        session.questions.responses.push(...data.responses.map(r => ({
          questionId: r.questionId,
          candidateId: data.candidateId,
          response: r.answer,
          timeSpent: r.timeSpent,
          timestamp: r.timestamp,
          evaluation: {
            isCorrect: false, // Se evaluará después
            score: 0,
            maxScore: 0,
            feedback: '',
            evaluatedBy: 'auto' as const,
            evaluatedAt: new Date()
          }
        })));
      }

      await session.save();

      logger.debug(`✅ Progreso guardado para candidato: ${data.candidateId}`);

    } catch (error) {
      if (retries < this.maxRetries) {
        logger.warn(`⚠️ Reintentando auto-save para ${data.candidateId} (intento ${retries + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
        return this.saveIndividualProgress(data, retries + 1);
      } else {
        logger.error(`❌ Error guardando progreso para ${data.candidateId} después de ${this.maxRetries} intentos:`, error);
      }
    }
  }

  /**
   * Forzar guardado inmediato (para desconexiones críticas)
   */
  async forceSave(candidateId: string): Promise<void> {
    const data = this.saveQueue.get(candidateId);
    if (data) {
      await this.saveIndividualProgress(data);
      this.saveQueue.delete(candidateId);
      logger.info(`🚨 Guardado forzado completado para candidato: ${candidateId}`);
    }
  }

  /**
   * Recuperar progreso de un candidato
   */
  async recoverProgress(candidateId: string, sessionId: string): Promise<{
    responses: any[];
    currentQuestionIndex: number;
    timeSpent: number;
    lastActivity: Date;
  } | null> {
    try {
      const session = await ActiveSessionModel.findOne({ sessionId });
      
      if (!session || !session.individualSessions?.has(candidateId)) {
        return null;
      }

      const individualSession = session.individualSessions.get(candidateId)!;
      const candidateResponses = session.questions.responses.filter(
        r => r.candidateId === candidateId
      );

      return {
        responses: candidateResponses,
        currentQuestionIndex: 0, // Se debería calcular basado en respuestas
        timeSpent: individualSession.timeAllowed - this.calculateRemainingTime(individualSession),
        lastActivity: individualSession.lastActivity
      };

    } catch (error) {
      logger.error(`❌ Error recuperando progreso para ${candidateId}:`, error);
      return null;
    }
  }

  /**
   * Calcular tiempo restante de una sesión individual
   */
  private calculateRemainingTime(session: IIndividualSessionData): number {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);
    return Math.max(0, session.timeAllowed - elapsed);
  }

  /**
   * Limpiar datos de auto-save para sesiones completadas
   */
  async cleanup(): Promise<void> {
    const expired: string[] = [];
    
    for (const [candidateId, data] of this.saveQueue) {
      // Limpiar datos de más de 2 horas
      if (Date.now() - data.lastActivity.getTime() > 2 * 60 * 60 * 1000) {
        expired.push(candidateId);
      }
    }

    expired.forEach(candidateId => {
      this.saveQueue.delete(candidateId);
    });

    if (expired.length > 0) {
      logger.info(`🧹 Limpieza de auto-save: ${expired.length} entradas eliminadas`);
    }
  }

  /**
   * Obtener estadísticas de auto-save
   */
  getStats(): {
    queueSize: number;
    processing: boolean;
    batchSize: number;
  } {
    return {
      queueSize: this.saveQueue.size,
      processing: this.processingQueue,
      batchSize: this.batchSize
    };
  }
}