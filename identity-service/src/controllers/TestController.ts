// src/controllers/TestController.ts - Controller para testing de integración
//
// NOTE: this used to exercise the HTTP round-trip to the separate auth-service.
// After the identity-service merge there is no HTTP hop for user creation /
// credential validation anymore — those checks now go straight through
// UserRepository / AuthService in-process. Kept as a debug/admin-only surface.

import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../repositories/user.repository';
import { eventService } from '../services/event.service';
import { KAFKA_TOPICS, KAFKA_EVENT_TYPES } from '../config/kafka-topics';
import { JWTPayload } from '../types';

export class TestController {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  // ================================
  // HEALTH CHECKS
  // ================================

  /**
   * Health check completo del sistema
   */
  systemHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const healthStatus = {
        identityService: {
          status: 'healthy',
          timestamp: new Date().toISOString()
        },
        kafka: {
          status: 'unknown',
          connected: false,
          producer: false,
          consumer: false,
          error: null as string | null
        },
        database: {
          status: 'connected', // Esto se podría verificar realmente
          timestamp: new Date().toISOString()
        }
      };

      // Check Kafka
      try {
        const kafkaHealthy = await eventService.healthCheck();
        const kafkaStatus = eventService.getConnectionStatus();

        healthStatus.kafka = {
          status: kafkaHealthy ? 'healthy' : 'unhealthy',
          connected: kafkaStatus.initialized,
          producer: kafkaStatus.producer,
          consumer: kafkaStatus.consumer,
          error: null
        };
      } catch (error) {
        healthStatus.kafka = {
          status: 'error',
          connected: false,
          producer: false,
          consumer: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      const allHealthy = healthStatus.kafka.status === 'healthy';

      res.status(allHealthy ? 200 : 207).json({
        success: true,
        message: 'Health check completado',
        data: {
          overall: allHealthy ? 'healthy' : 'degraded',
          services: healthStatus,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // AUTH MODULE INTEGRATION TESTS (in-process now)
  // ================================

  /**
   * Test de validación de existencia de usuario (in-process, sin HTTP)
   */
  testUserValidation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email es requerido para el test',
          error: 'MISSING_EMAIL'
        });
        return;
      }

      const existing = await this.userRepository.findByEmail(email);

      res.status(200).json({
        success: true,
        message: 'Test de validación completado',
        data: {
          email,
          exists: Boolean(existing),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // KAFKA INTEGRATION TESTS
  // ================================

  /**
   * Test de conexión con Kafka
   */
  testKafkaConnection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const healthCheck = await eventService.healthCheck();
      const connectionStatus = eventService.getConnectionStatus();

      res.status(200).json({
        success: true,
        message: 'Test de conexión con Kafka completado',
        data: {
          healthy: healthCheck,
          connections: connectionStatus,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error en test de Kafka',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Test de publicación de eventos en Kafka
   */
  testKafkaEventPublishing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = req.user as JWTPayload;
      const { eventType = 'USER_CREATED', testData } = req.body;

      // Publicar evento de prueba
      const testUserId = `test-user-${Date.now()}`;
      const testEventData = testData || {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'student',
        status: 'active'
      };

      await eventService.publishTestEvent(
        KAFKA_TOPICS.USER_EVENTS,
        eventType,
        {
          userId: testUserId,
          userData: testEventData,
          triggeredBy: currentUser.userId
        }
      );

      res.status(200).json({
        success: true,
        message: 'Evento de prueba publicado exitosamente',
        data: {
          topic: KAFKA_TOPICS.USER_EVENTS,
          eventType,
          testUserId,
          testData: testEventData,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // INTEGRATION FLOW TESTS
  // ================================

  /**
   * Test completo del flujo de creación de usuario (in-process, sin HTTP)
   */
  testCompleteUserFlow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testEmail = `test-${Date.now()}@cba-test.com` } = req.body;
      const currentUser = req.user as JWTPayload;

      const testResults = {
        steps: [] as any[],
        success: true,
        errors: [] as string[]
      };

      // Step 1: Verificar que el usuario no existe
      try {
        const existing = await this.userRepository.findByEmail(testEmail);
        testResults.steps.push({
          step: 1,
          description: 'Verificar usuario no existe',
          success: !existing,
          result: { exists: Boolean(existing) }
        });
      } catch (error) {
        testResults.errors.push('Error verificando usuario existente');
        testResults.success = false;
      }

      // Step 2: Test de publicación de evento (sin crear usuario real)
      try {
        await eventService.publishTestEvent(
          KAFKA_TOPICS.USER_EVENTS,
          KAFKA_EVENT_TYPES.USER_CREATED,
          {
            testEmail,
            isIntegrationTest: true,
            triggeredBy: currentUser.userId
          }
        );

        testResults.steps.push({
          step: 2,
          description: 'Publicar evento de creación',
          success: true,
          result: 'Evento publicado exitosamente'
        });
      } catch (error) {
        testResults.errors.push('Error publicando evento');
        testResults.success = false;
      }

      res.status(testResults.success ? 200 : 500).json({
        success: testResults.success,
        message: testResults.success ?
          'Test de flujo completo exitoso' :
          'Test de flujo completado con errores',
        data: {
          testEmail,
          results: testResults,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // CONFIG INFO
  // ================================

  /**
   * Información de configuración del servicio
   */
  getServiceInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const kafkaStatus = eventService.getConnectionStatus();

      res.status(200).json({
        success: true,
        message: 'Información del servicio obtenida',
        data: {
          service: 'identity-service',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          kafka: kafkaStatus,
          availableTopics: Object.values(KAFKA_TOPICS),
          availableEventTypes: Object.values(KAFKA_EVENT_TYPES),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
