// src/services/session-scheduler.service.ts
import Bull from 'bull';
import { getSessionSchedulerQueue } from '../config/redis';
import { Session } from '../models/session.model';
import { logger } from '../utils/logger';
import { KafkaService } from './kafka.service';
import { SessionService } from './session.service';
import { auditLog } from './audit-client.service';

const SYSTEM_ACTOR = { userId: 'system', email: 'system@scheduler', role: 'system' };

export class SessionSchedulerService {
  private schedulerQueue: Bull.Queue | null = null; // 👈 Cambiar a null
  private kafkaService: KafkaService;
  private processorsInitialized = false; // 👈 Flag para evitar inicializar múltiples veces
  private sessionService: SessionService;
  
  constructor(sessionService?: SessionService) {
    this.kafkaService = new KafkaService();
    // Evitar dependencia circular: solo asignar si se pasa como parámetro
    this.sessionService = sessionService || ({} as SessionService);
    // 👇 NO inicializar aquí, se hará bajo demanda
  }

  // Método para inyectar la dependencia después de la construcción
  public setSessionService(sessionService: SessionService): void {
    this.sessionService = sessionService;
  }

  // 👇 NUEVA FUNCIÓN: Inicializar cola y processors bajo demanda
  private ensureQueueInitialized(): void {
    if (!this.schedulerQueue) {
      this.schedulerQueue = getSessionSchedulerQueue();

      if (!this.processorsInitialized) {
        this.setupProcessors();
        this.processorsInitialized = true;
      }
    }
  }

  async scheduleSessionEvents(sessionId: string, scheduling: any, settings: any, sessionType: string, timing: any): Promise<void> {
    this.ensureQueueInitialized();

    const now = new Date();
    
    // Las fechas ahora vienen con zona horaria explícita desde el frontend
    // MongoDB las almacena correctamente como UTC
    const startTime = new Date(scheduling.startDate);
    const endTime = new Date(scheduling.endDate);
    
    console.log('📅 Datos recibidos:');
    console.log('  startDate original:', scheduling.startDate);
    console.log('  endDate original:', scheduling.endDate);
    console.log('  settings.autoStart:', settings?.autoStart);
    
    console.log('📅 Fechas parseadas:');
    console.log('  Ahora (servidor UTC):', now.toISOString());
    console.log('  Inicio programado (UTC):', startTime.toISOString());
    console.log('  Fin programado (UTC):', endTime.toISOString());

    const startDelay = startTime.getTime() - now.getTime();
    const endDelay = endTime.getTime() - now.getTime();
    
    console.log('🕒 Delays calculados:');
    console.log('  Delay inicio:', startDelay, 'ms');
    console.log('  Delay fin:', endDelay, 'ms');

    logger.info(`Programando sesión ${sessionId}:
    - Inicio: ${startTime.toISOString()} (${startDelay}ms)
    - Fin: ${endTime.toISOString()} (${endDelay}ms)  
    - AutoStart: ${settings?.autoStart}
  `);

    try {
      // Limpiar trabajos existentes sin cambiar status de la sesión
      const startJob = await this.schedulerQueue!.getJob(`start-${sessionId}`);
      const endJob = await this.schedulerQueue!.getJob(`end-${sessionId}`);
      
      if (startJob) await startJob.remove();
      if (endJob) await endJob.remove();

      // Programar inicio si autoStart está habilitado Y la fecha es futura
      if (settings?.autoStart === true && startDelay > 0) {
        console.log('📅 Programando INICIO con delay:', startDelay);

        await this.schedulerQueue!.add('start-session', {
          sessionId,
          action: 'start',
          scheduledFor: startTime.toISOString(),
          sessionType,
          timing
        }, {
          delay: startDelay,
          jobId: `start-${sessionId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 10,
          removeOnFail: 10
        });

        logger.info(`✅ Sesión ${sessionId} programada para INICIAR el ${startTime.toISOString()}`);
      } else {
        console.log('❌ NO programando inicio:', {
          autoStart: settings?.autoStart,
          startDelay,
          esFuturo: startDelay > 0
        });
      }

      // Programar fin si la fecha es futura
      if (endDelay > 0) {
        console.log('📅 Programando FIN con delay:', endDelay);

        await this.schedulerQueue!.add('end-session', {
          sessionId,
          action: 'end',
          scheduledFor: endTime.toISOString()
        }, {
          delay: endDelay,
          jobId: `end-${sessionId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 10,
          removeOnFail: 10
        });

        logger.info(`✅ Sesión ${sessionId} programada para FINALIZAR el ${endTime.toISOString()}`);
      } else {
        console.log('❌ NO programando fin - endDate está en el pasado, delay:', endDelay);
      }

    } catch (error) {
      logger.error(`Error programando sesión ${sessionId}:`, error);
      throw error;
    }
  }

  private setupProcessors(): void {
    if (!this.schedulerQueue) return;

    // Procesar INICIO - Solo envía evento Kafka, NO cambia status
    this.schedulerQueue.process('start-session', 1, async (job: Bull.Job) => {
      const { sessionId, scheduledFor, metadata, sessionType, timing } = job.data;

      try {
        logger.info(`🚀 ENVIANDO evento de inicio para sesión: ${sessionId}`);

        const session = await Session.findById(sessionId);
        if (!session) {
          throw new Error(`Sesión ${sessionId} no encontrada`);
        }

        // SOLO enviar evento al session-manager, NO cambiar status aquí
        await this.kafkaService.publishEvent('session.start_requested', {
          sessionId,
          examId: session.examId,
          scheduledFor,
          actualStartTime: new Date().toISOString(),
          sessionName: session.sessionName,
          participants: session.participants,
          settings: session.settings,
          scheduling: session.scheduling,
          sessionType,
          createdBy: session.createdBy,
          timing
        });
        await this.sessionService.startSession(sessionId);
        auditLog({
          action: 'session.auto_started',
          target: { type: 'session', id: sessionId, name: session.sessionName },
          actor: SYSTEM_ACTOR,
          details: { scheduledFor, trigger: 'scheduler' },
        });
        logger.info(`✅ Evento START_REQUESTED enviado para sesión ${sessionId}`);

      } catch (error: any) {
        auditLog({
          action: 'session.auto_start_failed',
          target: { type: 'session', id: sessionId },
          actor: SYSTEM_ACTOR,
          status: 'failure',
          details: { error: (error as any)?.message },
        });
        logger.error(`❌ Error enviando evento de inicio ${sessionId}:`, error);
        throw error;
      }
    });

    // Procesar FIN - Solo envía evento Kafka
    this.schedulerQueue.process('end-session', 1, async (job: Bull.Job) => {
      const { sessionId, scheduledFor } = job.data;

      try {
        logger.info(`🛑 ENVIANDO evento de fin para sesión: ${sessionId}`);

        const session = await Session.findById(sessionId);
        if (!session) {
          throw new Error(`Sesión ${sessionId} no encontrada`);
        }

        // SOLO enviar evento al session-manager
        await this.kafkaService.publishEvent('session.end_requested', {
          sessionId,
          examId: session.examId,
          scheduledFor,
          actualEndTime: new Date().toISOString()
        });
        await this.sessionService.endSession(sessionId);
        auditLog({
          action: 'session.auto_ended',
          target: { type: 'session', id: sessionId, name: session.sessionName },
          actor: SYSTEM_ACTOR,
          details: { scheduledFor, trigger: 'scheduler' },
        });
        logger.info(`✅ Evento END_REQUESTED enviado para sesión ${sessionId}`);

      } catch (error: any) {
        auditLog({
          action: 'session.auto_end_failed',
          target: { type: 'session', id: sessionId },
          actor: SYSTEM_ACTOR,
          status: 'failure',
          details: { error: (error as any)?.message },
        });
        logger.error(`❌ Error enviando evento de fin ${sessionId}:`, error);
        throw error;
      }
    });

    logger.info('✅ Session scheduler processors initialized');
  }

  async cancelScheduledSession(sessionId: string): Promise<void> {
    this.ensureQueueInitialized();

    try {
      const startJob = await this.schedulerQueue!.getJob(`start-${sessionId}`);
      const endJob = await this.schedulerQueue!.getJob(`end-${sessionId}`);

      if (startJob) {
        await startJob.remove();
        logger.info(`🚫 Trabajo de inicio cancelado para sesión ${sessionId}`);
      }

      if (endJob) {
        await endJob.remove();
        logger.info(`🚫 Trabajo de fin cancelado para sesión ${sessionId}`);
      }

      // Solo actualizar status si la sesión existe
      const session = await Session.findById(sessionId);
      if (session) {
        await Session.findByIdAndUpdate(sessionId, {
          status: 'cancelled'
        });

        await this.kafkaService.publishEvent('session.scheduling_cancelled', {
          sessionId
        });
      }

    } catch (error) {
      logger.error(`Error cancelando programación de sesión ${sessionId}:`, error);
      // No lanzar error para que no bloquee la programación
    }
  }

  async rescheduleEndJob(sessionId: string, newEndDate: Date): Promise<void> {
    this.ensureQueueInitialized();
    try {
      const endJob = await this.schedulerQueue!.getJob(`end-${sessionId}`);
      if (endJob) await endJob.remove();

      const endDelay = newEndDate.getTime() - Date.now();
      if (endDelay > 0) {
        await this.schedulerQueue!.add('end-session', {
          sessionId,
          action: 'end',
          scheduledFor: newEndDate.toISOString()
        }, {
          delay: endDelay,
          jobId: `end-${sessionId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 10,
          removeOnFail: 10
        });
        logger.info(`End job reprogramado para sesion ${sessionId}: ${newEndDate.toISOString()}`);
      }
    } catch (error) {
      logger.error(`Error reprogramando end job para sesion ${sessionId}:`, error);
      throw error;
    }
  }

  async getScheduledJobs(sessionId: string): Promise<{ start?: Bull.Job, end?: Bull.Job }> {
    this.ensureQueueInitialized();

    try {
      const startJob = await this.schedulerQueue!.getJob(`start-${sessionId}`);
      const endJob = await this.schedulerQueue!.getJob(`end-${sessionId}`);

      return { start: startJob || undefined, end: endJob || undefined };
    } catch (error) {
      logger.error(`Error obteniendo trabajos programados para sesión ${sessionId}:`, error);
      throw error;
    }
  }
}