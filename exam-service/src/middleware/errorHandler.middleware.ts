import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { CONSTANTS } from '../utils/constants';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  // Machine-readable error code (e.g. 'ATTEMPT_NOT_IN_PROGRESS') so clients
  // can branch on the exact failure instead of parsing the message string.
  code?: string;
  // Optional extra context surfaced to the client alongside the code, e.g.
  // the attempt's actual status when the error is a state-mismatch (409).
  attemptStatus?: string;
  // Structured reasons for a blocked action, e.g. why technical verification
  // failed (TECHNICAL_VERIFICATION_REQUIRED) — one entry per failed check.
  reasons?: { code: string; message: string }[];

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    attemptStatus?: string,
    reasons?: { code: string; message: string }[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.attemptStatus = attemptStatus;
    this.reasons = reasons;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err } as any;
  error.message = err.message;

  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    user: req.user?.id
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid ID format';
    error = new AppError(message, 400);
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    const message = `Duplicate field value: ${field}`;
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((e: any) => e.message);
    const message = `Validation Error: ${errors.join(', ')}`;
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401);
  }

  res.status((error as AppError).statusCode || 500).json({
    success: false,
    message: error.message || CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR,
    ...((error as AppError).code && { code: (error as AppError).code }),
    ...((error as AppError).attemptStatus && { attemptStatus: (error as AppError).attemptStatus }),
    ...((error as AppError).reasons && { reasons: (error as AppError).reasons }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const message = `Route ${req.originalUrl} not found`;
  const error = new AppError(message, 404);
  next(error);
};