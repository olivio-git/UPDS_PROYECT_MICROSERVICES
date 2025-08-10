import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiResponse } from '../types';

export const validateSchema = (schema: ZodSchema) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error: any) {
      const errors = error.errors?.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message
      })) || [];

      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        error: 'Validation error',
        data: { errors }
      });
    }
  };
};

export const validateQuerySchema = (schema: ZodSchema) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData;
      next();
    } catch (error: any) {
      const errors = error.errors?.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message
      })) || [];

      return res.status(400).json({
        success: false,
        message: 'Parámetros de consulta inválidos',
        error: 'Query validation error',
        data: { errors }
      });
    }
  };
};
