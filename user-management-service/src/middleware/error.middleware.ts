import { Request, Response, NextFunction } from 'express';

// ================================
// ERROR TYPES
// ================================

export interface AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  details?: any;
}

// ================================
// ERROR FACTORY
// ================================

export const createError = {
  // Bad Request (400)
  badRequest: (message: string, details?: any): AppError => {
    const error = new Error(message) as AppError;
    error.statusCode = 400;
    error.status = 'BAD_REQUEST';
    error.isOperational = true;
    error.details = details;
    return error;
  },

  // Unauthorized (401)
  unauthorized: (message: string = 'No autorizado', details?: any): AppError => {
    const error = new Error(message) as AppError;
    error.statusCode = 401;
    error.status = 'UNAUTHORIZED';
    error.isOperational = true;
    error.details = details;
    return error;
  },

  // Forbidden (403)
  forbidden: (message: string = 'Acceso prohibido', details?: any): AppError => {
    const error = new Error(message) as AppError;
    error.statusCode = 403;
    error.status = 'FORBIDDEN';
    error.isOperational = true;
    error.details = details;
    return error;
  },

  // Not Found (404)
  notFound: (message: string = 'Recurso no encontrado', details?: any): AppError => {
    const error = new Error(message) as AppError;
    error.statusCode = 404;
    error.status = 'NOT_FOUND';
    error.isOperational = true;
    error.details = details;
    return error;
  },

  // Conflict (409)
  conflict: (message: string, details?: any): AppError => {
    const error = new Error(message) as AppError;
    error.statusCode = 409;
    error.status = 'CONFLICT';
    error.isOperational = true;
    error.details = details;
    return error;
  },

  // Validation Error (422)
  validation: (message: string, details?: any): AppError => {
    const error = new Error(message) as AppError;
    error.statusCode = 422;
    error.status = 'VALIDATION_ERROR';
    error.isOperational = true;
    error.details = details;
    return error;
  },

  // Too Many Requests (429)
  tooManyRequests: (message: string = 'Demasiadas solicitudes', details?: any): AppError => {
    const error = new Error(message) as AppError;
    error.statusCode = 429;
    error.status = 'TOO_MANY_REQUESTS';
    error.isOperational = true;
    error.details = details;
    return error;
  },

  // Internal Server Error (500)
  internal: (message: string = 'Error interno del servidor', details?: any): AppError => {
    const error = new Error(message) as AppError;
    error.statusCode = 500;
    error.status = 'INTERNAL_ERROR';
    error.isOperational = true;
    error.details = details;
    return error;
  },

  // Service Unavailable (503)
  serviceUnavailable: (message: string = 'Servicio no disponible', details?: any): AppError => {
    const error = new Error(message) as AppError;
    error.statusCode = 503;
    error.status = 'SERVICE_UNAVAILABLE';
    error.isOperational = true;
    error.details = details;
    return error;
  }
};

// ================================
// ERROR HANDLER MIDDLEWARE
// ================================

export const errorHandler = (
  error: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Log del error
    console.error('❌ Error capturado:', {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Si el error es operacional, usar su información
    if ('isOperational' in error && error.isOperational) {
      const appError = error as AppError;
      
      res.status(appError.statusCode).json({
        success: false,
        message: appError.message,
        error: appError.status,
        details: appError.details,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      });
      return;
    }

    // Manejo de errores específicos de MongoDB
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      handleMongoError(error, res, req);
      return;
    }

    // Manejo de errores de validación de MongoDB
    if (error.name === 'ValidationError') {
      handleValidationError(error, res, req);
      return;
    }

    // Manejo de errores de cast de MongoDB
    if (error.name === 'CastError') {
      handleCastError(error, res, req);
      return;
    }

    // Manejo de errores de JWT
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'INVALID_TOKEN',
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      });
      return;
    }

    // Manejo de errores de JWT expirado
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token expirado',
        error: 'TOKEN_EXPIRED',
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      });
      return;
    }

    // Error no esperado - respuesta genérica
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' 
        ? 'Error interno del servidor' 
        : error.message,
      error: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });

  } catch (handlerError) {
    console.error('❌ Error en el manejador de errores:', handlerError);
    
    res.status(500).json({
      success: false,
      message: 'Error crítico del servidor',
      error: 'CRITICAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

// ================================
// SPECIFIC ERROR HANDLERS
// ================================

const handleMongoError = (error: any, res: Response, req: Request): void => {
  // Error de duplicado (E11000)
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'campo';
    const value = Object.values(error.keyValue || {})[0] || 'valor';
    
    res.status(409).json({
      success: false,
      message: `El ${field} '${value}' ya existe`,
      error: 'DUPLICATE_FIELD',
      details: {
        field,
        value
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
    return;
  }

  // Otros errores de MongoDB
  res.status(500).json({
    success: false,
    message: 'Error de base de datos',
    error: 'DATABASE_ERROR',
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
};

const handleValidationError = (error: any, res: Response, req: Request): void => {
  const errors = Object.values(error.errors || {}).map((err: any) => ({
    field: err.path,
    message: err.message,
    value: err.value
  }));

  res.status(400).json({
    success: false,
    message: 'Errores de validación',
    error: 'VALIDATION_ERROR',
    details: errors,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
};

const handleCastError = (error: any, res: Response, req: Request): void => {
  res.status(400).json({
    success: false,
    message: `Formato inválido para el campo '${error.path}'`,
    error: 'INVALID_FORMAT',
    details: {
      field: error.path,
      value: error.value,
      expectedType: error.kind
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
};

// ================================
// ASYNC ERROR WRAPPER
// ================================

export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ================================
// NOT FOUND HANDLER
// ================================

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = createError.notFound(`Ruta ${req.originalUrl} no encontrada`);
  next(error);
};

// ================================
// UNHANDLED REJECTION HANDLER
// ================================

export const handleUnhandledRejection = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    console.error('En promesa:', promise);
    
    // En producción, cerrar gracefully
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
};

// ================================
// UNCAUGHT EXCEPTION HANDLER
// ================================

export const handleUncaughtException = (): void => {
  process.on('uncaughtException', (error: Error) => {
    console.error('❌ Excepción no capturada:', error);
    
    // Cerrar inmediatamente
    process.exit(1);
  });
};
