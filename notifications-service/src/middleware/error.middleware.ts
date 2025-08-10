import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  console.error('🚨 Error:', error);

  // Error de MongoDB
  if (error.name === 'MongoError') {
    return res.status(500).json({
      success: false,
      message: 'Error en la base de datos',
      error: 'Database error'
    });
  }

  // Error de Redis
  if (error.message.includes('Redis')) {
    return res.status(500).json({
      success: false,
      message: 'Error en el cache',
      error: 'Cache error'
    });
  }

  // Error de Kafka
  if (error.message.includes('Kafka')) {
    return res.status(500).json({
      success: false,
      message: 'Error en el sistema de mensajería',
      error: 'Message broker error'
    });
  }

  // Error de Resend
  if (error.message.includes('Resend') || error.message.includes('email')) {
    return res.status(500).json({
      success: false,
      message: 'Error en el servicio de email',
      error: 'Email service error'
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