import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwt.service';
import { AuthService } from '../services/auth.service';
import { CacheRepository } from '../repositories/cache.repository';
import { ApiResponse, JWTPayload } from '../types';

// Removed duplicate AuthenticatedRequest interface

export class AuthMiddleware {
  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
    private cacheRepository: CacheRepository
  ) {}

  authenticate = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      console.log(authHeader,"HEADER IN AUTH MIDDLEWARE");
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Token de acceso requerido',
          error: 'Missing authorization header'
        });
      }

      const token = authHeader.substring(7);

      // Verificar si el token está en la lista negra
      const tokenJti = this.jwtService.getTokenJti(token);
      if (tokenJti && await this.cacheRepository.isTokenBlacklisted(tokenJti)) {
        return res.status(401).json({
          success: false,
          message: 'Token revocado',
          error: 'Token blacklisted'
        });
      }

      // Verificar y decodificar el token
      const payload = this.jwtService.verifyAccessToken(token);

      // Validar que el usuario sigue activo
      const user = await this.authService.validateUser(payload.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no válido o inactivo',
          error: 'Invalid user'
        });
      }

      // Adjuntar información del usuario a la request
      req.user = payload;
      next();

    } catch (error: any) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado',
        error: error.message
      });
    }
  };

  requireRole = (roles: string | string[]) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Autenticación requerida',
          error: 'Not authenticated'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Permisos insuficientes',
          error: 'Insufficient permissions'
        });
      }

      next();
    };
  };

  requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Autenticación requerida',
          error: 'Not authenticated'
        });
      }

      // Los admin tienen permisos universales
      if (req.user.permissions.includes('*') || req.user.permissions.includes(permission)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Permiso requerido: ${permission}`,
        error: 'Missing permission'
      });
    };
  };

  rateLimiter = (maxRequests: number, windowMs: number) => {
    return async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
      const identifier = req.ip || 'unknown';
      const key = `rate_limit:${identifier}`;
      
      const rateLimit = await this.cacheRepository.checkRateLimit(
        key, 
        maxRequests, 
        Math.floor(windowMs / 1000)
      );

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Demasiadas solicitudes',
          error: 'Rate limit exceeded',
          data: {
            retryAfter: windowMs / 1000,
            remaining: rateLimit.remaining
          }
        });
      }

      // Agregar headers de rate limiting
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });

      next();
    };
  };
}

// Helper para extender el tipo Request con el usuario
export type AuthenticatedRequest = Request & { user?: JWTPayload };
