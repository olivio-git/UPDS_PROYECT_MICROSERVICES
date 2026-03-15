import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  console.error('🚨 Error:', error);

  // Error de MongoDB duplicado (email único)
  if (error.message.includes('E11000')) {
    return res.status(409).json({
      success: false,
      message: 'El email ya está registrado',
      error: 'Duplicate email'
    });
  }

  // Error de JWT
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
      error: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado',
      error: 'Token expired'
    });
  }

  // Error de validación
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      error: error.message
    });
  }

  // Error de MongoDB
  if (error.name === 'MongoError') {
    return res.status(500).json({
      success: false,
      message: 'Error en la base de datos',
      error: 'Database error'
    });
  }

  // Error genérico
  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFoundHandler = (req: Request, res: Response<ApiResponse>) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.path}`,
    error: 'Route not found'
  });
};
