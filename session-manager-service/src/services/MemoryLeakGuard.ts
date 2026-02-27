import { ActiveSessionModel } from '../models/ActiveSession';
import { logger } from '../utils/logger';
import Bull from 'bull';

export interface MemoryStats {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  totalSubSessions: number;
  activeSubSessions: number;
  totalBullJobs: number;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
}

export class MemoryLeakGuard {
  private static instance: MemoryLeakGuard;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private queues: Bull.Queue[] = [];
  private activeConnections: Map<string, any> = new Map();
  private memoryThreshold = 500 * 1024 * 1024; // 500MB
  private lastMemoryWarning = 0;

  private constructor() {
    this.startMonitoring();
    this.scheduleCleanup();
  }

  public static getInstance(): MemoryLeakGuard {
    if (!MemoryLeakGuard.instance) {
      MemoryLeakGuard.instance = new MemoryLeakGuard();
    }
    return MemoryLeakGuard.instance;
  }

  /**
   * Registrar una cola Bull para monitoreo
   */
  registerQueue(queue: Bull.Queue): void {
    this.queues.push(queue);
    logger.info(`📊 Cola Bull registrada para monitoreo: ${queue.name}`);
  }

  /**
   * Registrar conexión activa
   */
  registerConnection(id: string, connection: any): void {
    this.activeConnections.set(id, connection);
  }

  /**
   * Desregistrar conexión
   */
  unregisterConnection(id: string): void {
    this.activeConnections.delete(id);
  }

  /**
   * Iniciar monitoreo de memoria
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkMemoryUsage();
      } catch (error) {
        logger.error('❌ Error en monitoreo de memoria:', error);
      }
    }, 30000); // Cada 30 segundos

    logger.info('🔍 Monitoreo de memoria iniciado');
  }

  /**
   * Verificar uso de memoria
   */
  private async checkMemoryUsage(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const stats = await this.getMemoryStats();

    // Log estadísticas cada 5 minutos
    if (Date.now() % (5 * 60 * 1000) < 30000) {
      logger.info('📊 Estadísticas de memoria:', {
        sessions: `${stats.activeSessions}/${stats.totalSessions}`,
        subSessions: `${stats.activeSubSessions}/${stats.totalSubSessions}`,
        memory: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        connections: stats.activeConnections
      });
    }

    // Advertencia si se supera el umbral de memoria
    if (memoryUsage.heapUsed > this.memoryThreshold) {
      const now = Date.now();
      if (now - this.lastMemoryWarning > 60000) { // Máximo una advertencia por minuto
        logger.warn(`⚠️ Uso de memoria alto: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
        this.lastMemoryWarning = now;
        
        // Forzar limpieza si la memoria está muy alta
        if (memoryUsage.heapUsed > this.memoryThreshold * 1.5) {
          logger.warn('🚨 Memoria crítica - Forzando limpieza inmediata');
          await this.forceCleanup();
        }
      }
    }

    // Detectar posibles memory leaks
    await this.detectMemoryLeaks(stats);
  }

  /**
   * Detectar posibles memory leaks
   */
  private async detectMemoryLeaks(stats: MemoryStats): Promise<void> {
    const warnings: string[] = [];

    // Muchas sesiones inactivas
    if (stats.expiredSessions > 50) {
      warnings.push(`${stats.expiredSessions} sesiones expiradas sin limpiar`);
    }

    // Muchas sub-sesiones inactivas
    if (stats.totalSubSessions - stats.activeSubSessions > 100) {
      warnings.push(`${stats.totalSubSessions - stats.activeSubSessions} sub-sesiones inactivas`);
    }

    // Demasiados jobs en Bull
    if (stats.totalBullJobs > 1000) {
      warnings.push(`${stats.totalBullJobs} jobs en colas Bull`);
    }

    // Conexiones fantasma
    const sessionConnections = stats.activeSessions * 2; // Estimado: 2 conexiones por sesión activa
    if (stats.activeConnections > sessionConnections * 1.5) {
      warnings.push(`Posibles conexiones fantasma: ${stats.activeConnections} vs ${sessionConnections} esperadas`);
    }

    if (warnings.length > 0) {
      logger.warn('🔍 Posibles memory leaks detectados:', warnings);
    }
  }

  /**
   * Programar limpieza periódica
   */
  private scheduleCleanup(): void {
    // Limpieza cada 10 minutos
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        logger.error('❌ Error en limpieza periódica:', error);
      }
    }, 10 * 60 * 1000);

    logger.info('🧹 Limpieza periódica programada cada 10 minutos');
  }

  /**
   * Realizar limpieza estándar
   */
  private async performCleanup(): Promise<void> {
    const startTime = Date.now();
    let cleaned = 0;

    try {
      // 1. Limpiar sesiones expiradas
      const expiredSessions = await this.cleanupExpiredSessions();
      cleaned += expiredSessions;

      // 2. Limpiar jobs de Bull
      const expiredJobs = await this.cleanupBullJobs();
      cleaned += expiredJobs;

      // 3. Limpiar conexiones muertas
      const deadConnections = await this.cleanupDeadConnections();
      cleaned += deadConnections;

      // 4. Forzar garbage collection si es necesario
      if (cleaned > 50) {
        if (global.gc) {
          global.gc();
          logger.info('♻️ Garbage collection forzado');
        }
      }

      const duration = Date.now() - startTime;
      if (cleaned > 0) {
        logger.info(`✅ Limpieza completada: ${cleaned} elementos en ${duration}ms`);
      }

    } catch (error) {
      logger.error('❌ Error en limpieza:', error);
    }
  }

  /**
   * Limpiar sesiones expiradas
   */
  private async cleanupExpiredSessions(): Promise<number> {
    const cutoffTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 horas

    const result = await ActiveSessionModel.deleteMany({
      $or: [
        {
          status: { $in: ['completed', 'cancelled'] },
          updatedAt: { $lt: cutoffTime }
        },
        {
          sessionType: 'individual_flexible',
          'memoryStats.lastCleanup': { $lt: new Date(Date.now() - 60 * 60 * 1000) },
          'memoryStats.activeSubSessions': 0
        }
      ]
    });

    if (result.deletedCount > 0) {
      logger.info(`🗑️ ${result.deletedCount} sesiones expiradas eliminadas`);
    }

    return result.deletedCount;
  }

  /**
   * Limpiar jobs de Bull
   */
  private async cleanupBullJobs(): Promise<number> {
    let cleanedJobs = 0;

    for (const queue of this.queues) {
      try {
        // Limpiar jobs completados antiguos (más de 1 hora)
        const completed = await queue.getCompleted(0, 1000);
        const old = completed.filter(job => 
          Date.now() - job.finishedOn! > 60 * 60 * 1000
        );

        for (const job of old) {
          await job.remove();
        }

        // Limpiar jobs fallidos antiguos
        const failed = await queue.getFailed(0, 500);
        const oldFailed = failed.filter(job => 
          Date.now() - (job.failedReason?.length ? job.processedOn! : job.timestamp) > 60 * 60 * 1000
        );

        for (const job of oldFailed) {
          await job.remove();
        }

        cleanedJobs += old.length + oldFailed.length;

        if (old.length + oldFailed.length > 0) {
          logger.info(`🧹 ${old.length + oldFailed.length} jobs limpiados en cola ${queue.name}`);
        }

      } catch (error) {
        logger.warn(`⚠️ Error limpiando cola ${queue.name}:`, error);
      }
    }

    return cleanedJobs;
  }

  /**
   * Limpiar conexiones muertas
   */
  private async cleanupDeadConnections(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();

    for (const [id, connection] of this.activeConnections) {
      // Verificar si la conexión está realmente activa
      if (connection.disconnected || !connection.connected) {
        this.activeConnections.delete(id);
        cleaned++;
      }
      // Limpiar conexiones muy antiguas sin actividad
      else if (connection.lastActivity && now - connection.lastActivity > 30 * 60 * 1000) {
        this.activeConnections.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`🔗 ${cleaned} conexiones muertas limpiadas`);
    }

    return cleaned;
  }

  /**
   * Forzar limpieza inmediata (para situaciones críticas)
   */
  async forceCleanup(): Promise<void> {
    logger.warn('🚨 Iniciando limpieza forzada...');

    // Limpieza agresiva
    await Promise.allSettled([
      this.cleanupExpiredSessions(),
      this.cleanupBullJobs(),
      this.cleanupDeadConnections()
    ]);

    // Limpiar todas las sub-sesiones expiradas inmediatamente
    await ActiveSessionModel.updateMany(
      { sessionType: 'individual_flexible' },
      { $unset: { 'individualSessions': 1 } },
      { 
        $where: function() {
          return this.individualSessions && 
                 Object.keys(this.individualSessions).length === 0;
        }
      }
    );

    // Forzar garbage collection
    if (global.gc) {
      global.gc();
    }

    logger.warn('✅ Limpieza forzada completada');
  }

  /**
   * Obtener estadísticas de memoria
   */
  async getMemoryStats(): Promise<MemoryStats> {
    try {
      const [sessionStats] = await ActiveSessionModel.aggregate([
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            activeSessions: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            expiredSessions: {
              $sum: { 
                $cond: [
                  { 
                    $and: [
                      { $in: ['$status', ['completed', 'cancelled']] },
                      { $lt: ['$updatedAt', new Date(Date.now() - 60 * 60 * 1000)] }
                    ]
                  }, 
                  1, 
                  0
                ] 
              }
            },
            totalSubSessions: { $sum: '$memoryStats.totalSubSessions' },
            activeSubSessions: { $sum: '$memoryStats.activeSubSessions' }
          }
        }
      ]);

      let totalBullJobs = 0;
      for (const queue of this.queues) {
        try {
          const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(),
            queue.getFailed()
          ]);
          totalBullJobs += waiting.length + active.length + completed.length + failed.length;
        } catch (error) {
          // Ignorar errores de colas
        }
      }

      return {
        totalSessions: sessionStats?.totalSessions || 0,
        activeSessions: sessionStats?.activeSessions || 0,
        expiredSessions: sessionStats?.expiredSessions || 0,
        totalSubSessions: sessionStats?.totalSubSessions || 0,
        activeSubSessions: sessionStats?.activeSubSessions || 0,
        totalBullJobs,
        activeConnections: this.activeConnections.size,
        memoryUsage: process.memoryUsage()
      };

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de memoria:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        totalSubSessions: 0,
        activeSubSessions: 0,
        totalBullJobs: 0,
        activeConnections: this.activeConnections.size,
        memoryUsage: process.memoryUsage()
      };
    }
  }

  /**
   * Configurar umbral de memoria
   */
  setMemoryThreshold(threshold: number): void {
    this.memoryThreshold = threshold;
    logger.info(`📊 Umbral de memoria establecido en ${Math.round(threshold / 1024 / 1024)}MB`);
  }

  /**
   * Detener monitoreo (para shutdown)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('🛑 MemoryLeakGuard detenido');
  }
}