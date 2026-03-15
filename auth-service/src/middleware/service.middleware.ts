import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export interface ServiceAuthenticatedRequest extends Request {
  isServiceCall?: boolean;
  serviceId?: string;
}

export class ServiceMiddleware {
  /**
   * Middleware para autenticar llamadas entre servicios
   * Solo permite registro desde user-management-service
   */
  authenticateService = (req: ServiceAuthenticatedRequest, res: Response, next: NextFunction): void => {
    const serviceToken = req.headers['x-service-token'] as string;
    const serviceName = req.headers['x-service-name'] as string;

    // Si no hay token de servicio, es una llamada pública (no permitida para registro)
    if (!serviceToken || !serviceName) {
      res.status(403).json({
        success: false,
        message: 'El registro directo no está permitido. Use user-management-service.',
        error: 'DIRECT_REGISTRATION_DISABLED'
      });
      return;
    }

    // Validar token de servicio
    if (serviceToken !== config.service.token) {
      res.status(401).json({
        success: false,
        message: 'Token de servicio inválido',
        error: 'INVALID_SERVICE_TOKEN'
      });
      return;
    }

    // Validar que sea user-management-service
    if (serviceName !== 'user-management-service') {
      res.status(403).json({
        success: false,
        message: 'Solo user-management-service puede crear usuarios',
        error: 'UNAUTHORIZED_SERVICE'
      });
      return;
    }

    // Marcar como llamada de servicio válida
    req.isServiceCall = true;
    req.serviceId = serviceName;
    next();
  };

  /**
   * Middleware opcional para rutas que pueden ser públicas o de servicio
   */
  optionalServiceAuth = (req: ServiceAuthenticatedRequest, res: Response, next: NextFunction): void => {
    const serviceToken = req.headers['x-service-token'] as string;
    const serviceName = req.headers['x-service-name'] as string;

    if (serviceToken && serviceName) {
      // Validar token si está presente
      if (serviceToken === config.service.token) {
        req.isServiceCall = true;
        req.serviceId = serviceName;
      }
    }

    next();
  };
}
