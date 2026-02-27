import { Request, Response } from 'express';
import { systemMonitoringService } from '../services/systemMonitoring.service';
import { logger } from '../utils/logger';

export class SystemMonitoringController {
  
  /**
   * Get current system statistics
   */
  async getSystemStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await systemMonitoringService.getRestStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      logger.error('Error getting system stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve system statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get memory usage statistics
   */
  async getMemoryStats(req: Request, res: Response): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryStats = {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        arrayBuffers: memoryUsage.arrayBuffers,
        // Convert to MB for readability
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024)
      };

      res.json({
        success: true,
        data: memoryStats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      logger.error('Error getting memory stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve memory statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Force memory cleanup
   */
  async forceCleanup(req: Request, res: Response): Promise<void> {
    try {
      logger.info('📊 Manual memory cleanup requested');
      
      const result = await systemMonitoringService.forceCleanup();
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error: any) {
      logger.error('Error during forced cleanup:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform memory cleanup',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get active connections count
   */
  async getConnections(req: Request, res: Response): Promise<void> {
    try {
      const stats = await systemMonitoringService.getRestStats();
      
      res.json({
        success: true,
        data: {
          connections: stats.connections,
          websocketConnections: stats.connections,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error: any) {
      logger.error('Error getting connections:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve connection statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus(req: Request, res: Response): Promise<void> {
    try {
      const stats = await systemMonitoringService.getRestStats();
      const memoryUsageMB = Math.round(stats.memory.heapUsed / 1024 / 1024);
      
      let healthStatus = 'healthy';
      let alerts = [];
      
      // Check memory usage
      if (memoryUsageMB > 800) {
        healthStatus = 'critical';
        alerts.push('High memory usage detected');
      } else if (memoryUsageMB > 500) {
        healthStatus = 'warning';
        alerts.push('Elevated memory usage');
      }
      
      // Check database connection
      if (!stats.database.connected) {
        healthStatus = 'critical';
        alerts.push('Database connection lost');
      }
      
      // Check expired sessions
      if (stats.sessions.expiredSessions > 20) {
        if (healthStatus !== 'critical') {
          healthStatus = 'warning';
        }
        alerts.push(`${stats.sessions.expiredSessions} expired sessions need cleanup`);
      }

      const healthData = {
        status: healthStatus,
        alerts,
        uptime: process.uptime(),
        memoryUsageMB,
        databaseConnected: stats.database.connected,
        activeSessions: stats.sessions.activeSessions,
        expiredSessions: stats.sessions.expiredSessions,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: healthData
      });
      
    } catch (error) {
      logger.error('Error getting health status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve health status',
        data: {
          status: 'error',
          alerts: ['Failed to retrieve system status'],
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get system processes information
   */
  async getProcessInfo(req: Request, res: Response): Promise<void> {
    try {
      const processInfo = {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        cpuUsage: process.cpuUsage(),
        execPath: process.execPath,
        argv: process.argv
      };

      res.json({
        success: true,
        data: processInfo,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      logger.error('Error getting process info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve process information',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}