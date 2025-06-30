import { Request, Response, NextFunction } from 'express';

// Interfaz para errores personalizados
export interface AppError extends Error {
    statusCode?: number;
    status?: string;
    isOperational?: boolean;
}

// Clase para errores personalizados
export class CustomError extends Error implements AppError {
    statusCode: number;
    status: string;
    isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class InvalidCredentialsError extends Error implements AppError {
    statusCode: number;
    status: string;
    isOperational: boolean;

    constructor(message: string = 'Invalid credentials') {
        super(message);
        this.statusCode = 401;
        this.status = 'fail';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Middleware para manejar errores
export const errorHandler = (
    err: AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.log(err)
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } else {
        // En producción, no enviamos el stack trace
        if (err.isOperational) {
            res.status(err.statusCode).json({
                status: err.status,
                message: err.message
            });
        } else {
            // Error de programación: no enviar detalles al cliente
            console.error('ERROR 💥', err);
            res.status(500).json({
                status: 'error',
                message: 'Something went wrong!'
            });
        }
    }
}; 