// src/controllers/TestController.ts - Controller para testing de integración

import { Request, Response, NextFunction } from 'express';
import { authServiceIntegration } from '../integrations/auth-service.integration';
import { eventService } from '../services/event.service';
import { KAFKA_TOPICS, KAFKA_EVENT_TYPES } from '../config/kafka-topics';
import { JWTPayload } from '../types';

export class TestController {
  
  // ================================
  // HEALTH CHECKS
  // ================================

  /**
   * Health check completo del sistema
   */
  systemHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const healthStatus = {
        userManagementService: {
          status: 'healthy',
          timestamp: new Date().toISOString()
        },
        authService: {
          status: 'unknown',
          connected: false,
          baseUrl: '',
          error: null as string | null
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

      // Check Auth Service
      try {
        const authHealthy = await authServiceIntegration.healthCheck();
        const connectionInfo = authServiceIntegration.getConnectionInfo();
        
        healthStatus.authService = {
          status: authHealthy ? 'healthy' : 'unhealthy',
          connected: authHealthy,
          baseUrl: connectionInfo.baseUrl,
          error: null
        };
      } catch (error) {
        healthStatus.authService = {
          status: 'error',
          connected: false,
          baseUrl: authServiceIntegration.getConnectionInfo().baseUrl,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

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

      // Determinar status general
      const allHealthy = healthStatus.authService.status === 'healthy' && 
                        healthStatus.kafka.status === 'healthy';

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
  // AUTH SERVICE INTEGRATION TESTS
  // ================================

  /**
   * Test de conexión con auth-service
   */
  testAuthServiceConnection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const connectionInfo = authServiceIntegration.getConnectionInfo();
      const healthCheck = await authServiceIntegration.healthCheck();

      res.status(200).json({
        success: true,
        message: 'Test de conexión con auth-service completado',
        data: {
          connection: connectionInfo,
          healthy: healthCheck,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error en test de auth-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Test de validación de usuario en auth-service
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

      const result = await authServiceIntegration.validateUserExists(email);

      res.status(200).json({
        success: true,
        message: 'Test de validación completado',
        data: {
          email,
          exists: result.data,
          validationResult: result,
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
   * Test completo del flujo de creación de usuario
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
        const userExists = await authServiceIntegration.validateUserExists(testEmail);
        testResults.steps.push({
          step: 1,
          description: 'Verificar usuario no existe',
          success: !userExists.data,
          result: userExists
        });
      } catch (error) {
        testResults.errors.push('Error verificando usuario existente');
        testResults.success = false;
      }

      // Step 2: Generar credenciales
      try {
        const credentials = await authServiceIntegration.generateUserCredentials({
          email: testEmail,
          firstName: 'Test',
          lastName: 'User',
          role: 'student'
        });
        
        testResults.steps.push({
          step: 2,
          description: 'Generar credenciales',
          success: true,
          result: {
            hasPassword: Boolean(credentials.password),
            passwordLength: credentials.password.length,
            credentials: {
              email: credentials.credentials.email,
              hasPassword: Boolean(credentials.credentials.password)
            }
          }
        });
      } catch (error) {
        testResults.errors.push('Error generando credenciales');
        testResults.success = false;
      }

      // Step 3: Test de publicación de evento (sin crear usuario real)
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
          step: 3,
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
      const connectionInfo = authServiceIntegration.getConnectionInfo();
      const kafkaStatus = eventService.getConnectionStatus();

      res.status(200).json({
        success: true,
        message: 'Información del servicio obtenida',
        data: {
          service: 'user-management-service',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          authService: connectionInfo,
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
