import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { Session } from '../models/session.model';
import { Exam } from '../models/exam.model';
import { Question } from '../models/question.model';
import { getRedisClient } from '../config/redis';

interface SystemStats {
  sessions: {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    totalSubSessions: number;
    activeSubSessions: number;
  };
  activeJobs: number;
  autoSaveJobs: number;
  queueStats: {
    session: {
      waiting: any[];
      active: any[];
      completed: any[];
      failed: any[];
    };
    autoSave: {
      waiting: any[];
      active: any[];
    };
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  connections: number;
  database: {
    connected: boolean;
    collections: {
      sessions: number;
      exams: number;
      questions: number;
    };
  };
}

export class SystemMonitoringService {
  private io: SocketIOServer | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private connectedClients: Set<string> = new Set();
  
  constructor() {
    // Ya no necesitamos configurar Redis aquí - usamos el cliente existente
  }

  public initializeWebSocket(io: SocketIOServer): void {
    this.io = io;
    
    // Create monitoring namespace
    const monitoringNamespace = io.of('/monitoring');
    
    monitoringNamespace.on('connection', (socket) => {
      this.connectedClients.add(socket.id);
      logger.info(`📊 System monitoring client connected: ${socket.id}`);
      
      // Send initial stats
      this.sendSystemStats(socket);
      
      // Handle client requests
      socket.on('get-system-stats', () => {
        this.sendSystemStats(socket);
      });
      
      socket.on('force-cleanup', async () => {
        try {
          await this.performMemoryCleanup();
          this.sendSystemStats(socket);
          socket.emit('cleanup-complete', { success: true });
        } catch (error: any) {
          socket.emit('cleanup-complete', { success: false, error: error.message });
        }
      });
      
      socket.on('disconnect', () => {
        this.connectedClients.delete(socket.id);
        logger.info(`📊 System monitoring client disconnected: ${socket.id}`);
      });
    });
    
    // Start monitoring
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Send stats every 30 seconds to connected clients
    this.monitoringInterval = setInterval(async () => {
      if (this.connectedClients.size > 0) {
        const stats = await this.collectSystemStats();
        this.broadcastStats(stats);
        this.checkForAlerts(stats);
      }
    }, 30000);
    
    logger.info('📊 System monitoring started');
  }

  private async sendSystemStats(socket: any): Promise<void> {
    try {
      const stats = await this.collectSystemStats();
      socket.emit('system-stats', {
        type: 'system-stats',
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error sending system stats:', error);
      socket.emit('error', {
        type: 'stats-error',
        message: 'Failed to collect system statistics'
      });
    }
  }

  private broadcastStats(stats: SystemStats): void {
    if (this.io) {
      this.io.of('/monitoring').emit('system-stats', {
        type: 'system-stats',
        stats,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async collectSystemStats(): Promise<SystemStats> {
    const memoryUsage = process.memoryUsage();
    
    // Database stats
    const totalSessions = await Session.countDocuments();
    const activeSessions = await Session.countDocuments({ 
      status: { $in: ['active', 'in_progress'] }
    });
    const expiredSessions = await Session.countDocuments({
      status: 'expired'
    });

    // Mock queue stats (replace with actual Bull queue stats if available)
    const queueStats = {
      session: {
        waiting: [],
        active: [],
        completed: [],
        failed: []
      },
      autoSave: {
        waiting: [],
        active: []
      }
    };

    const stats: SystemStats = {
      sessions: {
        totalSessions,
        activeSessions,
        expiredSessions,
        totalSubSessions: activeSessions * 2, // Estimate
        activeSubSessions: activeSessions
      },
      activeJobs: Math.floor(Math.random() * 10) + 5, // Mock data
      autoSaveJobs: Math.floor(Math.random() * 15) + 2, // Mock data  
      queueStats,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      connections: this.connectedClients.size,
      database: {
        connected: mongoose.connection.readyState === 1,
        collections: {
          sessions: totalSessions,
          exams: await Exam.countDocuments(),
          questions: await Question.countDocuments()
        }
      }
    };

    return stats;
  }

  private checkForAlerts(stats: SystemStats): void {
    const memoryUsageMB = Math.round(stats.memory.heapUsed / 1024 / 1024);
    
    // Memory alert
    if (memoryUsageMB > 500) {
      this.sendAlert('memory-warning', `High memory usage: ${memoryUsageMB}MB`);
    }
    
    if (memoryUsageMB > 800) {
      this.sendAlert('memory-critical', `Critical memory usage: ${memoryUsageMB}MB`);
    }
    
    // Expired sessions alert
    if (stats.sessions.expiredSessions > 10) {
      this.sendAlert('sessions-warning', `${stats.sessions.expiredSessions} expired sessions need cleanup`);
    }
    
    // Database connection alert
    if (!stats.database.connected) {
      this.sendAlert('database-error', 'Database connection lost');
    }
  }

  private sendAlert(type: string, message: string): void {
    if (this.io) {
      this.io.of('/monitoring').emit('alert', {
        type,
        message,
        timestamp: new Date().toISOString()
      });
    }
    
    logger.warn(`System Alert [${type}]: ${message}`);
  }

  private async performMemoryCleanup(): Promise<void> {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.info('📊 Forced garbage collection');
      }
      
      // Clear expired sessions
      const expiredCount = await Session.deleteMany({
        status: 'expired',
        updatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Older than 24h
      });
      
      if (expiredCount.deletedCount > 0) {
        logger.info(`📊 Cleaned up ${expiredCount.deletedCount} expired sessions`);
      }
      
    } catch (error) {
      logger.error('Error during memory cleanup:', error);
      throw error;
    }
  }

  public async getRestStats(): Promise<SystemStats> {
    return this.collectSystemStats();
  }

  public async forceCleanup(): Promise<{ success: boolean; message: string }> {
    try {
      await this.performMemoryCleanup();
      return { success: true, message: 'Memory cleanup completed successfully' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Ya no manejamos la desconexión de Redis aquí - se maneja centralmente
    
    logger.info('📊 System monitoring stopped');
  }
}

export const systemMonitoringService = new SystemMonitoringService();