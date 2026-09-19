import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createError } from './error.middleware';

// ================================
// VALIDATION MIDDLEWARE
// ================================

export const validateSchema = (schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[target];
      
      // Validar datos usando el schema de Zod
      const validatedData = schema.parse(dataToValidate);
      
      // Reemplazar los datos originales con los datos validados y transformados
      req[target] = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Formatear errores de Zod de manera más amigable
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: getCustomErrorMessage(err),
          code: err.code,
          expected: getExpectedType(err)
        }));

        res.status(400).json({
          success: false,
          message: 'Errores de validación',
          error: 'VALIDATION_ERROR',
          details: formattedErrors
        });
        return;
      }

      next(error);
    }
  };
};

// ================================
// BODY VALIDATION
// ================================

export const validateBody = (schema: ZodSchema) => {
  return validateSchema(schema, 'body');
};

// ================================
// QUERY VALIDATION
// ================================

export const validateQuery = (schema: ZodSchema) => {
  return validateSchema(schema, 'query');
};

// ================================
// PARAMS VALIDATION
// ================================

export const validateParams = (schema: ZodSchema) => {
  return validateSchema(schema, 'params');
};

// ================================
// MULTIPLE VALIDATION
// ================================

export const validateMultiple = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const errors: any[] = [];

      // Validar body si se proporciona schema
      if (schemas.body) {
        try {
          req.body = schemas.body.parse(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              target: 'body',
              field: err.path.join('.'),
              message: getCustomErrorMessage(err),
              code: err.code
            })));
          }
        }
      }

      // Validar query si se proporciona schema
      if (schemas.query) {
        try {
          req.query = schemas.query.parse(req.query);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              target: 'query',
              field: err.path.join('.'),
              message: getCustomErrorMessage(err),
              code: err.code
            })));
          }
        }
      }

      // Validar params si se proporciona schema
      if (schemas.params) {
        try {
          req.params = schemas.params.parse(req.params);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              target: 'params',
              field: err.path.join('.'),
              message: getCustomErrorMessage(err),
              code: err.code
            })));
          }
        }
      }

      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Errores de validación',
          error: 'VALIDATION_ERROR',
          details: errors
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ================================
// CONDITIONAL VALIDATION
// ================================

export const validateConditional = (
  condition: (req: Request) => boolean,
  schema: ZodSchema,
  target: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Solo validar si se cumple la condición
      if (!condition(req)) {
        next();
        return;
      }

      validateSchema(schema, target)(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// ================================
// FILE VALIDATION
// ================================

export const validateFile = (options: {
  required?: boolean;
  maxSize?: number; // en bytes
  allowedTypes?: string[];
  maxFiles?: number;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      const file = req.file as Express.Multer.File | undefined;

      // Verificar si el archivo es requerido
      if (options.required && !file && (!files || files.length === 0)) {
        res.status(400).json({
          success: false,
          message: 'Archivo requerido',
          error: 'FILE_REQUIRED'
        });
        return;
      }

      // Validar archivo único
      if (file) {
        const validationError = validateSingleFile(file, options);
        if (validationError) {
          res.status(400).json(validationError);
          return;
        }
      }

      // Validar múltiples archivos
      if (files && files.length > 0) {
        // Verificar número máximo de archivos
        if (options.maxFiles && files.length > options.maxFiles) {
          res.status(400).json({
            success: false,
            message: `Máximo ${options.maxFiles} archivos permitidos`,
            error: 'TOO_MANY_FILES',
            details: { maxFiles: options.maxFiles, received: files.length }
          });
          return;
        }

        // Validar cada archivo
        for (let i = 0; i < files.length; i++) {
          const currentFile = files[i];
          if (currentFile) {
            const validationError = validateSingleFile(currentFile, options, i);
            if (validationError) {
              res.status(400).json(validationError);
              return;
            }
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ================================
// SANITIZATION MIDDLEWARE
// ================================

export const sanitizeInput = (options: {
  trim?: boolean;
  lowercase?: string[]; // campos a convertir a minúsculas
  removeEmpty?: boolean; // remover campos vacíos
  maxLength?: Record<string, number>; // longitud máxima por campo
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, options);
      }

      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query, options);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ================================
// RATE LIMITING VALIDATION
// ================================

export const validateRateLimit = (
  maxRequests: number,
  windowMs: number,
  keyGenerator?: (req: Request) => string
) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
      const now = Date.now();

      const requestData = requests.get(key);

      if (!requestData || now > requestData.resetTime) {
        requests.set(key, { count: 1, resetTime: now + windowMs });
        next();
        return;
      }

      if (requestData.count >= maxRequests) {
        res.status(429).json({
          success: false,
          message: 'Demasiadas solicitudes',
          error: 'RATE_LIMIT_EXCEEDED',
          details: {
            maxRequests,
            windowMs,
            retryAfter: Math.ceil((requestData.resetTime - now) / 1000)
          }
        });
        return;
      }

      requestData.count++;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// ================================
// HELPER FUNCTIONS
// ================================

function getCustomErrorMessage(error: any): string {
  const customMessages: Record<string, string> = {
    'too_small': 'Valor muy pequeño',
    'too_big': 'Valor muy grande',
    'invalid_email': 'Email inválido',
    'invalid_url': 'URL inválida',
    'invalid_date': 'Fecha inválida',
    'invalid_string': 'Debe ser una cadena de texto',
    'invalid_number': 'Debe ser un número',
    'invalid_boolean': 'Debe ser verdadero o falso',
    'required': 'Campo requerido',
    'invalid_type': 'Tipo de dato inválido',
    'invalid_enum_value': 'Valor no permitido',
    'custom': error.message
  };

  return customMessages[error.code] || error.message || 'Error de validación';
}

function getExpectedType(error: any): string {
  if (error.expected) return error.expected;
  if (error.code === 'invalid_type') return error.expected;
  if (error.code === 'invalid_enum_value') return `uno de: ${error.options?.join(', ')}`;
  return 'desconocido';
}

function validateSingleFile(
  file: Express.Multer.File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
  },
  index?: number
): any | null {
  const fileInfo = index !== undefined ? `archivo ${index + 1}` : 'archivo';

  // Verificar tamaño
  if (options.maxSize && file.size > options.maxSize) {
    return {
      success: false,
      message: `${fileInfo} muy grande`,
      error: 'FILE_TOO_LARGE',
      details: {
        maxSize: options.maxSize,
        receivedSize: file.size,
        filename: file.originalname
      }
    };
  }

  // Verificar tipo de archivo
  if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
    return {
      success: false,
      message: `Tipo de ${fileInfo} no permitido`,
      error: 'INVALID_FILE_TYPE',
      details: {
        allowedTypes: options.allowedTypes,
        receivedType: file.mimetype,
        filename: file.originalname
      }
    };
  }

  return null;
}

function sanitizeObject(obj: any, options: {
  trim?: boolean;
  lowercase?: string[];
  removeEmpty?: boolean;
  maxLength?: Record<string, number>;
}): any {
  if (typeof obj !== 'object' || obj === null) return obj;

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    let sanitizedValue = value;

    // Trim strings
    if (options.trim && typeof value === 'string') {
      sanitizedValue = value.trim();
    }

    // Convert to lowercase
    if (options.lowercase?.includes(key) && typeof sanitizedValue === 'string') {
      sanitizedValue = sanitizedValue.toLowerCase();
    }

    // Check max length
    if (options.maxLength?.[key] && typeof sanitizedValue === 'string') {
      if (sanitizedValue.length > options.maxLength[key]) {
        throw createError.validation(
          `Campo ${key} excede la longitud máxima de ${options.maxLength[key]} caracteres`,
          { field: key, maxLength: options.maxLength[key], received: sanitizedValue.length }
        );
      }
    }

    // Remove empty values if requested
    if (options.removeEmpty && (sanitizedValue === '' || sanitizedValue === null || sanitizedValue === undefined)) {
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof sanitizedValue === 'object' && sanitizedValue !== null) {
      sanitizedValue = sanitizeObject(sanitizedValue, options);
    }

    sanitized[key] = sanitizedValue;
  }

  return sanitized;
}

// ================================
// VALIDATION PRESETS
// ================================

export const validationPresets = {
  // Sanitización común para formularios
  commonForm: sanitizeInput({
    trim: true,
    lowercase: ['email'],
    removeEmpty: true,
    maxLength: {
      firstName: 50,
      lastName: 50,
      email: 100,
      phone: 20
    }
  }),

  // Validación de archivos de imagen
  imageFile: validateFile({
    required: true,
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  }),

  // Validación de archivos de documento
  documentFile: validateFile({
    required: true,
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  }),

  // Rate limiting básico
  basicRateLimit: validateRateLimit(100, 15 * 60 * 1000), // 100 requests per 15 minutes

  // Rate limiting estricto
  strictRateLimit: validateRateLimit(10, 60 * 1000), // 10 requests per minute
};
