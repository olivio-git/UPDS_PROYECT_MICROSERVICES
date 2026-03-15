import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userRole: string;
  userEmail: string;
  sessionId?: string;
  token?: string; // Agregar token para peticiones HTTP

  [key: string]: any; // Permitir otras propiedades dinámicas
}

interface JWTPayload {
  id?: string;
  userId?: string;  // Agregar soporte para ambos formatos
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export const authenticateSocket = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    // Intentar obtener token de múltiples fuentes
    let token = socket.handshake.auth?.token || 
                socket.handshake.query?.token ||
                socket.request.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ No token provided in socket handshake');
      return next(new Error('No token provided'));
    }

    console.log('🔐 Token recibido:', token.substring(0, 50) + '...');

    // Verificar JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ JWT_SECRET no configurado');
      return next(new Error('Server configuration error'));
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as JWTPayload;
      console.log('✅ Token decodificado:', { 
        id: decoded.id, 
        userId: decoded.userId, 
        email: decoded.email, 
        role: decoded.role 
      });
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', jwtError);
      
      if (jwtError instanceof jwt.JsonWebTokenError) {
        return next(new Error('Invalid token'));
      } else if (jwtError instanceof jwt.TokenExpiredError) {
        return next(new Error('Token expired'));
      } else {
        return next(new Error('Token verification failed'));
      }
    }

    // Obtener ID del usuario - soportar ambos formatos
    const userId = decoded.userId || decoded.id;
    
    if (!userId) {
      console.error('❌ No user ID found in token:', decoded);
      return next(new Error('Invalid token: missing user ID'));
    }

    if (!decoded.email || !decoded.role) {
      console.error('❌ Missing required fields in token:', decoded);
      return next(new Error('Invalid token: missing required fields'));
    }

    // Extender el socket con información del usuario
    const authenticatedSocket = socket as AuthenticatedSocket;
    authenticatedSocket.userId = userId;
    authenticatedSocket.userRole = decoded.role;
    authenticatedSocket.userEmail = decoded.email;
    authenticatedSocket.token = token; // Guardar token para peticiones HTTP

    console.log(`✅ Socket authenticated: ${decoded.email} (${decoded.role}) - ID: ${userId}`);
    next();
    
  } catch (error) {
    console.error('❌ Socket authentication failed:', error);
    return next(new Error('Authentication failed'));
  }
};

// Resto del código igual...
export const authorizeSessionAccess = (requiredRole?: string) => {
  return async (socket: AuthenticatedSocket, sessionId: string, next: (err?: Error) => void) => {
    try {
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      const session = await ActiveSessionModel.findBySessionId(sessionId);
      
      if (!session) {
        return next(new Error('Session not found'));
      }

      const canAccess = session.canJoin(socket.userId);
      
      if (!canAccess) {
        return next(new Error('Access denied to this session'));
      }

      if (requiredRole) {
        if (requiredRole === 'proctor' && !session.participants.proctors.includes(socket.userId)) {
          return next(new Error('Proctor role required'));
        }
        
        if (requiredRole === 'candidate' && !session.participants.registeredCandidates.includes(socket.userId)) {
          return next(new Error('Candidate registration required'));
        }
      }

      socket.sessionId = sessionId;
      next();
      
    } catch (error) {
      console.error('❌ Session authorization failed:', error);
      next(new Error('Authorization failed'));
    }
  };
};

export type AuthenticatedHttpUser = {
  id: string;
  email: string;
  role: string;
};

export type AuthenticatedHttpRequest = Request & { user?: AuthenticatedHttpUser };

export const authenticateHTTP: RequestHandler = (
  req: AuthenticatedHttpRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    
    // Soportar ambos formatos de ID
    const userId = decoded.userId || decoded.id;
    
    req.user = {
      id: userId!,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
    return;
  } catch (error) {
    console.error('❌ HTTP authentication failed:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    } else if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    } else {
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }
};

export const requireRole = (roles: string | string[]): RequestHandler => {
  return (req: AuthenticatedHttpRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: userRole 
      });
      return;
    }
    
    next();
    return;
  };
};

export type { AuthenticatedSocket };
