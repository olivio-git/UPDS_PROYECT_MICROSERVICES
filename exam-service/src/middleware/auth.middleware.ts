import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { cache } from '../config/redis';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Check cache first
    const cacheKey = `auth:${token}`;
    const cachedUser = await cache.get(cacheKey);
    
    if (cachedUser) {
      req.user = cachedUser;
      return next();
    }

    // Verify token locally first
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      
      // Optionally validate against auth service
      if (env.NODE_ENV === 'production') {
        const isValid = await validateTokenWithAuthService(token);
        if (!isValid) {
          throw new Error('Token validation failed');
        }
      }

      req.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || []
      };

      // Cache user data
      await cache.set(cacheKey, req.user, 300); // 5 minutes

      next();
    } catch (jwtError) {
      logger.error('JWT verification failed:', jwtError);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

export const requirePermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(p => userPermissions.includes(p));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

async function validateTokenWithAuthService(token: string): Promise<boolean> {
  try {
    const response = await axios.get(`${env.AUTH_SERVICE_URL}/auth/validate`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.success === true;
  } catch (error) {
    logger.error('Error validating token with auth service:', error);
    return false;
  }
}