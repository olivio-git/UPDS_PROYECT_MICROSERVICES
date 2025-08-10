import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '@/types';
import config from '../config/index';
import { createError } from './error.middleware';

// Extender el tipo Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      jwt?: string;
    }
  }
}

export class AuthMiddleware {
  // ================================
  // JWT AUTHENTICATION
  // ================================

  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = createError.unauthorized('Token de acceso requerido');
        next(error);
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
        // Verificar que el token tenga la estructura esperada
        if (!decoded.userId || !decoded.email || !decoded.role) {
          const error = createError.unauthorized('Token inválido - estructura incorrecta');
          next(error);
          return;
        }

        // Agregar la información del usuario a la request
        req.user = decoded;
        req.jwt = token;
        next();
      } catch (jwtError) {
        if (jwtError instanceof jwt.TokenExpiredError) {
          const error = createError.unauthorized('Token expirado');
          next(error);
          return;
        }

        if (jwtError instanceof jwt.JsonWebTokenError) {
          const error = createError.unauthorized('Token inválido');
          next(error);
          return;
        }

        throw jwtError;
      }
    } catch (error) {
      console.error('Error en middleware de autenticación:', error);
      const internalError = createError.internal('Error de autenticación');
      next(internalError);
    }
  };

  // ================================
  // ROLE-BASED ACCESS CONTROL
  // ================================

  requireRole = (allowedRoles: string | string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const user = req.user as JWTPayload;

        if (!user) {
          const error = createError.unauthorized('Usuario no autenticado');
          next(error);
          return;
        }

        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        if (!roles.includes(user.role)) {
          const error = createError.forbidden(`Acceso denegado. Rol requerido: ${roles.join(' o ')}`);
          next(error);
          return;
        }

        next();
      } catch (error) {
        console.error('Error en middleware de roles:', error);
        const internalError = createError.internal('Error de verificación de roles');
        next(internalError);
      }
    };
  };

  // ================================
  // PERMISSION-BASED ACCESS CONTROL
  // ================================

  requirePermission = (resource: string, action: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const user = req.user as JWTPayload;

        if (!user) {
          const error = createError.unauthorized('Usuario no autenticado');
          next(error);
          return;
        }

        // Verificar si el usuario tiene el permiso requerido
        const hasPermission = user.permissions?.some(permission => 
          permission.resource === resource && 
          permission.actions.includes(action)
        );

        if (!hasPermission) {
          const error = createError.forbidden(`Acceso denegado. Permiso requerido: ${action} en ${resource}`);
          next(error);
          return;
        }

        next();
      } catch (error) {
        console.error('Error en middleware de permisos:', error);
        const internalError = createError.internal('Error de verificación de permisos');
        next(internalError);
      }
    };
  };

  // ================================
  // ADMIN ONLY ACCESS
  // ================================

  requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = req.user as JWTPayload;

      if (!user) {
        const error = createError.unauthorized('Usuario no autenticado');
        next(error);
        return;
      }

      if (user.role !== 'admin') {
        const error = createError.forbidden('Acceso denegado. Solo administradores');
        next(error);
        return;
      }

      next();
    } catch (error) {
      console.error('Error en middleware de admin:', error);
      const internalError = createError.internal('Error de verificación de admin');
      next(internalError);
    }
  };

  // ================================
  // OPTIONAL AUTHENTICATION
  // ================================

  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No hay token, continuar sin autenticación
        next();
        return;
      }

      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
        req.user = decoded;
      } catch (jwtError) {
        // Token inválido, continuar sin autenticación
        console.warn('Token inválido en optional auth:', jwtError instanceof Error ? jwtError.message : 'Unknown error');
      }

      next();
    } catch (error) {
      console.error('Error en middleware de autenticación opcional:', error);
      next(); // Continuar incluso si hay error
    }
  };

  // ================================
  // RATE LIMITING
  // ================================

  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  rateLimiter = (maxRequests: number, windowMs: number) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const key = req.ip || 'unknown';
        const now = Date.now();
        
        const record = this.rateLimitStore.get(key);
        
        if (!record || now > record.resetTime) {
          // Crear nuevo registro o resetear
          this.rateLimitStore.set(key, {
            count: 1,
            resetTime: now + windowMs
          });
          next();
          return;
        }

        if (record.count >= maxRequests) {
          res.status(429).json({
            success: false,
            message: 'Demasiadas solicitudes. Intenta más tarde',
            error: 'RATE_LIMIT_EXCEEDED'
          });
          return;
        }

        record.count++;
        next();
      } catch (error) {
        console.error('Error en rate limiter:', error);
        next(); // Continuar si hay error en rate limiting
      }
    };
  };

  constructor() {
    // Limpiar rate limiter cada minuto
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.rateLimitStore.entries()) {
        if (now > record.resetTime) {
          this.rateLimitStore.delete(key);
        }
      }
    }, 60000);
  }
}

// Crear instancia única del middleware
export const authMiddleware = new AuthMiddleware();

// Middleware preconfigurados para casos comunes
export const authPresets = {
  adminOnly: [authMiddleware.authenticate, authMiddleware.requireAdmin],
  teacherOrAdmin: [authMiddleware.authenticate, authMiddleware.requireRole(['teacher', 'admin'])],
  proctorOrAdmin: [authMiddleware.authenticate, authMiddleware.requireRole(['proctor', 'admin'])],
  anyAuthenticated: [authMiddleware.authenticate],
  optionalAuth: [authMiddleware.optionalAuth]
};
