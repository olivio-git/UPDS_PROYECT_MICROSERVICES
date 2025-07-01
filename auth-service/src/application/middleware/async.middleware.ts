import { Request, Response, NextFunction } from 'express';
import { CustomError } from './error.middleware';

// Tipo para funciones de controlador asíncronas
type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

// Función de orden superior para manejar promesas
export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (error instanceof CustomError) {
        next(error);
      } else {
        next(new CustomError(error.message || 'Internal Server Error', 500));
      }
    });
  };
}; 