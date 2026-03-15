import Bull from 'bull';
import Redis from 'ioredis';
import { ActiveSessionModel, ITimingConfig } from '../models/ActiveSession';
import { logger } from '../utils/logger';
import { AutoSaveService, ProgressData } from './AutoSaveService';
import { MemoryLeakGuard } from './MemoryLeakGuard';

export interface GroupSessionConfig {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  autoStart: boolean;
}

export interface FlexibleSessionConfig {
  sessionId: string;
  sessionWindow: { start: Date; end: Date };
  examDuration: number; // en minutos
  lateJoinPolicy: 'guaranteed' | 'remaining' | 'sliding';
  maxLateness: number; // en minutos
  autoSaveInterval: number; // en segundos
}

export class DualTimingManager {
  private sessionQueue: Bull.Queue;
  private autoSaveQueue: Bull.Queue;
  private memoryCleanupQueue: Bull.Queue;
  private redisClient: Redis;
  private processorsInitialized = false;
  private autoSaveService: AutoSaveService;
  private memoryGuard: MemoryLeakGuard;

  // Tracking para prevenir memory leaks
  private activeJobs: Map<string, Set<string>> = new Map(); // sessionId -> jobIds
  private autoSaveJobs: Map<string, string> = new Map(); // candidateId -> jobId
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Inicializar Redis
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    // Inicializar colas Bull
    this.sessionQueue = new Bull('dual-session-manager', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        removeOnComplete: 50, // Mantener solo 50 jobs completados
        removeOnFail: 50,     // Mantener solo 50 jobs fallidos
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      }
    });

    this.autoSaveQueue = new Bull('auto-save-manager', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 10,
        attempts: 2
      }
    });

    this.memoryCleanupQueue = new Bull('memory-cleanup', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        removeOnComplete: 5,
        removeOnFail: 5,
        attempts: 1
      }
    });

    // Inicializar servicios auxiliares
    this.autoSaveService = AutoSaveService.getInstance();
    this.memoryGuard = MemoryLeakGuard.getInstance();
    
    // Registrar colas en el guardian de memoria
    this.memoryGuard.registerQueue(this.sessionQueue);
    this.memoryGuard.registerQueue(this.autoSaveQueue);
    this.memoryGuard.registerQueue(this.memoryCleanupQueue);

    this.initializeProcessors();
    this.schedulePeriodicCleanup();

    logger.info('🔄 DualTimingManager initialized with memory leak prevention');
  }

  /**
   * Programar sesión grupal sincronizada
   */
  async scheduleGroupSession(config: GroupSessionConfig): Promise<void> {
    try {
      const now = new Date();
      const startDelay = config.startTime.getTime() - now.getTime();
      const endDelay = config.endTime.getTime() - now.getTime();

      // Limpiar jobs existentes
      await this.cleanupSessionJobs(config.sessionId);

      const sessionJobIds = new Set<string>();

      // Programar inicio si es futuro y autoStart está habilitado
      if (config.autoStart && startDelay > 0) {
        const startJobId = `group-start-${config.sessionId}`;
        await this.sessionQueue.add('group-start', {
          sessionId: config.sessionId,
          scheduledFor: config.startTime.toISOString()
        }, {
          delay: startDelay,
          jobId: startJobId
        });
        sessionJobIds.add(startJobId);

        logger.info(`📅 Sesión grupal ${config.sessionId} programada para iniciar: ${config.startTime.toISOString()}`);
      }

      // Programar fin si es futuro
      if (endDelay > 0) {
        const endJobId = `group-end-${config.sessionId}`;
        await this.sessionQueue.add('group-end', {
          sessionId: config.sessionId,
          scheduledFor: config.endTime.toISOString()
        }, {
          delay: endDelay,
          jobId: endJobId
        });
        sessionJobIds.add(endJobId);

        logger.info(`📅 Sesión grupal ${config.sessionId} programada para finalizar: ${config.endTime.toISOString()}`);
      }

      // Rastrear jobs para prevenir leaks
      this.activeJobs.set(config.sessionId, sessionJobIds);

    } catch (error:any) {
      logger.error(`❌ Error programando sesión grupal ${config.sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Crear sesión individual flexible cuando un candidato se conecta
   */
  async createIndividualSession(candidateId: string, config: FlexibleSessionConfig): Promise<string> {
    try {
      const session = await ActiveSessionModel.findOne({ sessionId: config.sessionId });
      if (!session) {
        throw new Error(`Sesión ${config.sessionId} no encontrada`);
      }

      // Verificar si puede entrar según la política
      const canJoin = this.canJoinFlexibleSession(config);
      if (!canJoin.allowed) {
        throw new Error(canJoin.reason);
      }

      // Calcular tiempo permitido según política
      const timeAllowed = this.calculateAllowedTime(config, new Date());
      
      // Crear configuración de timing individual
      const timingConfig: ITimingConfig = {
        sessionWindow: config.sessionWindow,
        examDuration: timeAllowed.duration,
        guaranteedTime: config.lateJoinPolicy === 'guaranteed',
        lateJoinPolicy: config.lateJoinPolicy,
        maxLateness: config.maxLateness,
        autoSaveInterval: config.autoSaveInterval
      };

      // Crear sub-sesión en el modelo
      const subSessionId = session.createIndividualSession(candidateId, timingConfig);
      await session.save();

      // Programar finalización individual
      const endDelay = timeAllowed.duration * 60 * 1000; // convertir a ms
      const endJobId = `individual-end-${subSessionId}`;
      
      await this.sessionQueue.add('individual-end', {
        sessionId: config.sessionId,
        subSessionId,
        candidateId,
        scheduledFor: new Date(Date.now() + endDelay).toISOString()
      }, {
        delay: endDelay,
        jobId: endJobId
      });

      // Programar auto-save recurrente
      await this.scheduleAutoSave(candidateId, config.sessionId, config.autoSaveInterval);

      // Rastrear job para prevenir leaks
      const sessionJobs = this.activeJobs.get(config.sessionId) || new Set();
      sessionJobs.add(endJobId);
      this.activeJobs.set(config.sessionId, sessionJobs);

      logger.info(`🎯 Sesión individual creada: ${subSessionId} para candidato ${candidateId}`);
      logger.info(`⏱️ Tiempo permitido: ${timeAllowed.duration} minutos (${timeAllowed.reason})`);

      return subSessionId;

    } catch (error:any) {
      logger.error(`❌ Error creando sesión individual para ${candidateId}:`, error);
      throw error;
    }
  }

  /**
   * Programar auto-save recurrente para un candidato
   */
  private async scheduleAutoSave(candidateId: string, sessionId: string, intervalSeconds: number): Promise<void> {
    // Cancelar auto-save existente si lo hay
    const existingJobId = this.autoSaveJobs.get(candidateId);
    if (existingJobId) {
      const existingJob = await this.autoSaveQueue.getJob(existingJobId);
      if (existingJob) {
        await existingJob.remove();
      }
    }

    const autoSaveJobId = `autosave-${candidateId}`;
    
    await this.autoSaveQueue.add('auto-save', {
      candidateId,
      sessionId
    }, {
      jobId: autoSaveJobId,
      repeat: { every: intervalSeconds * 1000 }, // convertir a ms
      removeOnComplete: 1, // Solo mantener el último
      removeOnFail: 1
    });

    this.autoSaveJobs.set(candidateId, autoSaveJobId);

    logger.info(`💾 Auto-save programado para ${candidateId} cada ${intervalSeconds}s`);
  }

  /**
   * Verificar si un candidato puede unirse a una sesión flexible
   */
  private canJoinFlexibleSession(config: FlexibleSessionConfig): { allowed: boolean; reason?: string } {
    const now = new Date();
    const sessionStart = config.sessionWindow.start;
    const sessionEnd = config.sessionWindow.end;
    const maxLateTime = new Date(sessionStart.getTime() + config.maxLateness * 60 * 1000);

    if (now < sessionStart) {
      return { allowed: false, reason: 'La sesión aún no ha comenzado' };
    }

    if (now > sessionEnd) {
      return { allowed: false, reason: 'La sesión ya ha terminado' };
    }

    if (now > maxLateTime && config.lateJoinPolicy !== 'guaranteed') {
      return { allowed: false, reason: `Tiempo máximo de retraso excedido (${config.maxLateness} min)` };
    }

    return { allowed: true };
  }

  /**
   * Calcular tiempo permitido según la política de late join
   */
  private calculateAllowedTime(config: FlexibleSessionConfig, joinTime: Date): { duration: number; reason: string } {
    const examDurationMs = config.examDuration * 60 * 1000;
    const sessionEndTime = config.sessionWindow.end;
    const remainingSessionTime = sessionEndTime.getTime() - joinTime.getTime();

    switch (config.lateJoinPolicy) {
      case 'guaranteed':
        return {
          duration: config.examDuration,
          reason: 'Tiempo completo garantizado'
        };

      case 'remaining':
        const remainingMinutes = Math.max(0, Math.floor(remainingSessionTime / (60 * 1000)));
        return {
          duration: Math.min(config.examDuration, remainingMinutes),
          reason: `Tiempo restante de la sesión: ${remainingMinutes} min`
        };

      case 'sliding':
        // Si hay suficiente tiempo en la sesión, dar tiempo completo
        if (remainingSessionTime >= examDurationMs) {
          return {
            duration: config.examDuration,
            reason: 'Ventana deslizante - tiempo completo disponible'
          };
        } else {
          const availableMinutes = Math.floor(remainingSessionTime / (60 * 1000));
          return {
            duration: availableMinutes,
            reason: `Ventana deslizante - tiempo ajustado: ${availableMinutes} min`
          };
        }

      default:
        return {
          duration: config.examDuration,
          reason: 'Política por defecto'
        };
    }
  }

  /**
   * Cancelar todos los trabajos de una sesión
   */
  async cancelSessionJobs(sessionId: string): Promise<void> {
    try {
      await this.cleanupSessionJobs(sessionId);
      
      // Actualizar estado de la sesión
      await ActiveSessionModel.findOneAndUpdate(
        { sessionId },
        { 
          status: 'cancelled',
          $unset: { individualSessions: 1 }
        }
      );

      logger.info(`🚫 Todos los trabajos de la sesión ${sessionId} han sido cancelados`);
    } catch (error:any) {
      logger.error(`❌ Error cancelando trabajos de sesión ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Limpiar trabajos de una sesión específica
   */
  private async cleanupSessionJobs(sessionId: string): Promise<void> {
    const jobIds = this.activeJobs.get(sessionId);
    if (!jobIds) return;

    const cleanupPromises: Promise<void>[] = [];

    for (const jobId of jobIds) {
      cleanupPromises.push(this.removeJobSafely(jobId));
    }

    await Promise.allSettled(cleanupPromises);
    this.activeJobs.delete(sessionId);
  }

  /**
   * Remover un job de manera segura
   */
  private async removeJobSafely(jobId: string): Promise<void> {
    try {
      // Intentar en sessionQueue
      let job = await this.sessionQueue.getJob(jobId);
      if (job) {
        await job.remove();
        return;
      }

      // Intentar en autoSaveQueue
      job = await this.autoSaveQueue.getJob(jobId);
      if (job) {
        await job.remove();
        return;
      }

      // Intentar en memoryCleanupQueue
      job = await this.memoryCleanupQueue.getJob(jobId);
      if (job) {
        await job.remove();
        return;
      }
    } catch (error:any) {
      // Ignorar errores de jobs que ya no existen
      if (!error.message?.includes('job not found')) {
        logger.warn(`⚠️ Error removiendo job ${jobId}:`, error.message);
      }
    }
  }

  /**
   * Programar limpieza periódica de memoria
   */
  private schedulePeriodicCleanup(): void {
    // Limpieza cada 15 minutos
    const cleanupInterval = 15 * 60 * 1000;
    
    const timer = setInterval(async () => {
      try {
        await this.performMemoryCleanup();
      } catch (error:any) {
        logger.error('❌ Error en limpieza periódica:', error);
      }
    }, cleanupInterval);

    this.cleanupTimers.set('periodic-cleanup', timer);

    // Programar limpieza en Bull queue también
    this.memoryCleanupQueue.add('periodic-cleanup', {}, {
      repeat: { every: cleanupInterval },
      jobId: 'periodic-cleanup'
    });

    logger.info('🧹 Limpieza periódica de memoria programada cada 15 minutos');
  }

  /**
   * Realizar limpieza de memoria
   */
  private async performMemoryCleanup(): Promise<void> {
    try {
      logger.info('🧹 Iniciando limpieza de memoria...');

      // 1. Limpiar sesiones individuales expiradas
      await ActiveSessionModel.cleanupAllExpiredSessions();

      // 2. Limpiar jobs de sesiones completadas/canceladas hace más de 1 hora
      const expiredSessions = await ActiveSessionModel.find({
        status: { $in: ['completed', 'cancelled'] },
        updatedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) }
      }).select('sessionId');

      for (const session of expiredSessions) {
        await this.cleanupSessionJobs(session.sessionId);
      }

      // 3. Obtener estadísticas de memoria
      const memoryStats = await ActiveSessionModel.getMemoryStats();
      logger.info('📊 Estadísticas de memoria:', memoryStats[0] || { totalSessions: 0 });

      // 4. Limpiar mapas internos de jobs antiguos
      const activeSessionIds = new Set(
        (await ActiveSessionModel.find({ status: 'active' }).select('sessionId'))
          .map(s => s.sessionId)
      );

      // Limpiar activeJobs que ya no están activos
      for (const [sessionId] of this.activeJobs) {
        if (!activeSessionIds.has(sessionId)) {
          this.activeJobs.delete(sessionId);
        }
      }

      // Limpiar autoSaveJobs de candidatos inactivos
      const activeCandidates = new Set(
        (await ActiveSessionModel.find({ 
          sessionType: 'individual_flexible',
          status: 'active' 
        }))
        .flatMap(s => Array.from(s.individualSessions?.keys() || []))
      );

      for (const [candidateId, jobId] of this.autoSaveJobs) {
        if (!activeCandidates.has(candidateId)) {
          await this.removeJobSafely(jobId);
          this.autoSaveJobs.delete(candidateId);
        }
      }

      logger.info('✅ Limpieza de memoria completada');

    } catch (error:any) {
      logger.error('❌ Error en limpieza de memoria:', error);
    }
  }

  /**
   * Inicializar procesadores de Bull
   */
  private initializeProcessors(): void {
    if (this.processorsInitialized) return;

    // Procesador para inicio de sesión grupal
    this.sessionQueue.process('group-start', 1, async (job: Bull.Job) => {
      const { sessionId, scheduledFor } = job.data;
      
      try {
        logger.info(`🚀 Iniciando sesión grupal: ${sessionId}`);
        
        await ActiveSessionModel.findOneAndUpdate(
          { sessionId },
          { 
            status: 'active',
            startedAt: new Date()
          }
        );

        // Emitir evento via WebSocket si es necesario
        // this.io.to(`session-${sessionId}`).emit('session-started', { sessionId });

      } catch (error:any) {
        logger.error(`❌ Error iniciando sesión grupal ${sessionId}:`, error);
        throw error;
      }
    });

    // Procesador para fin de sesión grupal
    this.sessionQueue.process('group-end', 1, async (job: Bull.Job) => {
      const { sessionId } = job.data;
      
      try {
        logger.info(`🏁 Finalizando sesión grupal: ${sessionId}`);
        
        await ActiveSessionModel.findOneAndUpdate(
          { sessionId },
          { 
            status: 'completed',
            endedAt: new Date()
          }
        );

        // Limpiar jobs relacionados
        await this.cleanupSessionJobs(sessionId);

      } catch (error:any) {
        logger.error(`❌ Error finalizando sesión grupal ${sessionId}:`, error);
        throw error;
      }
    });

    // Procesador para fin de sesión individual
    this.sessionQueue.process('individual-end', 1, async (job: Bull.Job) => {
      const { sessionId, subSessionId, candidateId } = job.data;
      
      try {
        logger.info(`⏹️ Finalizando sesión individual: ${subSessionId}`);
        
        const session = await ActiveSessionModel.findOne({ sessionId });
        if (session && session.individualSessions) {
          const individualSession = session.individualSessions.get(candidateId);
          if (individualSession) {
            individualSession.status = 'completed';
            session.individualSessions.set(candidateId, individualSession);
            await session.save();
          }
        }

        // Cancelar auto-save del candidato
        const autoSaveJobId = this.autoSaveJobs.get(candidateId);
        if (autoSaveJobId) {
          await this.removeJobSafely(autoSaveJobId);
          this.autoSaveJobs.delete(candidateId);
        }

      } catch (error:any) {
        logger.error(`❌ Error finalizando sesión individual ${subSessionId}:`, error);
        throw error;
      }
    });

    // Procesador para auto-save
    this.autoSaveQueue.process('auto-save', async (job: Bull.Job) => {
      const { candidateId, sessionId } = job.data;
      
      try {
        // Actualizar lastAutoSave y lastActivity
        const session = await ActiveSessionModel.findOne({ sessionId });
        if (session?.individualSessions?.has(candidateId)) {
          const individualSession = session.individualSessions.get(candidateId)!;
          individualSession.lastAutoSave = new Date();
          individualSession.lastActivity = new Date();
          session.individualSessions.set(candidateId, individualSession);
          await session.save();
        }

        // Crear datos de progreso simulados (en producción vendrían del frontend)
        const progressData: ProgressData = {
          candidateId,
          sessionId,
          subSessionId: `${sessionId}.${candidateId}`,
          responses: [], // Se llenarían con respuestas reales
          currentQuestionIndex: 0,
          timeSpent: 0,
          lastActivity: new Date()
        };

        // Usar AutoSaveService para guardar progreso
        await this.autoSaveService.saveProgress(progressData);
        
      } catch (error:any) {
        logger.error(`❌ Error en auto-save para candidato ${candidateId}:`, error);
        // No lanzar error para evitar que se cancele el auto-save recurrente
      }
    });

    // Procesador para limpieza de memoria
    this.memoryCleanupQueue.process('periodic-cleanup', async () => {
      await this.performMemoryCleanup();
    });

    this.processorsInitialized = true;
    logger.info('✅ Procesadores de DualTimingManager inicializados');
  }

  /**
   * Obtener estadísticas del sistema
   */
  async getSystemStats(): Promise<{
    sessions: any;
    activeJobs: number;
    autoSaveJobs: number;
    queueStats: any;
  }> {
    try {
      const [sessionStats] = await ActiveSessionModel.getMemoryStats();
      const queueStats = {
        session: {
          waiting: await this.sessionQueue.getWaiting(),
          active: await this.sessionQueue.getActive(),
          completed: await this.sessionQueue.getCompleted(),
          failed: await this.sessionQueue.getFailed()
        },
        autoSave: {
          waiting: await this.autoSaveQueue.getWaiting(),
          active: await this.autoSaveQueue.getActive()
        }
      };

      return {
        sessions: sessionStats || { totalSessions: 0 },
        activeJobs: this.activeJobs.size,
        autoSaveJobs: this.autoSaveJobs.size,
        queueStats
      };
    } catch (error:any) {
      logger.error('❌ Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Cleanup cuando se cierre la aplicación
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 Cerrando DualTimingManager...');

    // Limpiar timers
    for (const [id, timer] of this.cleanupTimers) {
      clearInterval(timer);
    }
    this.cleanupTimers.clear();

    // Cerrar colas
    await Promise.allSettled([
      this.sessionQueue.close(),
      this.autoSaveQueue.close(),
      this.memoryCleanupQueue.close()
    ]);

    // Cerrar Redis
    await this.redisClient.quit();

    logger.info('✅ DualTimingManager cerrado correctamente');
  }
}