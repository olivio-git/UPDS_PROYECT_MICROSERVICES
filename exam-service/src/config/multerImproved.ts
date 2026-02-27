import multer from 'multer';
import { Request } from 'express';
import { env } from './env';
import { AppError } from '../middleware/errorHandler.middleware';

// Función para debug de multer
const debugMulter = (req: Request, file: Express.Multer.File, stage: string) => {
  console.log(`[MULTER ${stage}]`, {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    headers: req.headers['content-type'],
    boundary: req.headers['content-type']?.includes('boundary') 
      ? 'Present' 
      : 'Missing'
  });
};

// File filter functions mejoradas
const imageFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  debugMulter(req, file, 'IMAGE_FILTER');
  
  const allowedMimes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'image/bmp',
    'image/tiff'
  ];
  
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
  const fileExtension = '.' + file.originalname.split('.').pop()?.toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new AppError(`Tipo de imagen no válido: ${file.mimetype}. Tipos permitidos: ${allowedMimes.join(', ')}`, 400));
  }
};

const audioFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  debugMulter(req, file, 'AUDIO_FILTER');
  
  const allowedMimes = [
    'audio/mpeg', 
    'audio/mp3', 
    'audio/wav', 
    'audio/m4a', 
    'audio/ogg', 
    'audio/webm',
    'audio/x-m4a',
    'audio/mp4',
    'audio/aac',
    'audio/flac',
    'audio/x-wav',
    'audio/wave',
    'audio/vnd.wav'
  ];
  
  const allowedExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.aac', '.flac'];
  const fileExtension = '.' + file.originalname.split('.').pop()?.toLowerCase();
  
  // Verificación más flexible para archivos de audio
  const isValidMimeType = file.mimetype.startsWith('audio/') || allowedMimes.includes(file.mimetype);
  const isValidExtension = allowedExtensions.includes(fileExtension);
  
  if (isValidMimeType || isValidExtension) {
    console.log(`[AUDIO_FILTER] ✅ Archivo de audio aceptado:`, {
      mimetype: file.mimetype,
      extension: fileExtension,
      validMime: isValidMimeType,
      validExt: isValidExtension
    });
    cb(null, true);
  } else {
    console.log(`[AUDIO_FILTER] ❌ Archivo de audio rechazado:`, {
      mimetype: file.mimetype,
      extension: fileExtension,
      allowedMimes,
      allowedExtensions
    });
    cb(new AppError(`Tipo de audio no válido: ${file.mimetype}. Tipos permitidos: ${allowedMimes.join(', ')}`, 400));
  }
};

const documentFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only PDF, DOC, DOCX and TXT files are allowed.', 400));
  }
};

const excelFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv'
  ];
  
  if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only Excel (XLS, XLSX) and CSV files are allowed.', 400));
  }
};

// Filtro flexible que acepta tanto audio como imagen
const mediaFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  debugMulter(req, file, 'MEDIA_FILTER');
  
  const isAudio = file.mimetype.startsWith('audio/') || 
    file.originalname.match(/\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i);
    
  const isImage = file.mimetype.startsWith('image/') || 
    file.originalname.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i);
  
  if (isAudio || isImage) {
    console.log(`[MEDIA_FILTER] ✅ Archivo multimedia aceptado:`, {
      type: isAudio ? 'audio' : 'image',
      mimetype: file.mimetype,
      originalname: file.originalname
    });
    cb(null, true);
  } else {
    console.log(`[MEDIA_FILTER] ❌ Archivo multimedia rechazado:`, {
      mimetype: file.mimetype,
      originalname: file.originalname
    });
    cb(new AppError(`Tipo de archivo no válido. Solo se permiten archivos de audio e imagen.`, 400));
  }
};

const anyFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  debugMulter(req, file, 'ANY_FILTER');
  // Accept any file type but check size
  cb(null, true);
};

// Multer configurations
const storage = multer.memoryStorage();

// Image upload config (max 10MB)
export const uploadImage = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: imageFileFilter
});

// Audio upload config (max 50MB) - MEJORADO
export const uploadAudio = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
    parts: 10 // Límite de partes del form
  },
  fileFilter: audioFileFilter
});

// Document upload config (max 10MB)
export const uploadDocument = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: documentFileFilter
});

// Excel/CSV upload config (max 5MB)
export const uploadSpreadsheet = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: excelFileFilter
});

// Generic file upload config (max size from env)
export const uploadFile = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE || 50 * 1024 * 1024,
    files: 1
  },
  fileFilter: anyFileFilter
});

// Flexible audio upload que acepta cualquier nombre de campo
export const uploadAudioFlexible = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
    parts: 10,
    fieldSize: 2 * 1024 * 1024 // 2MB para campos de texto
  },
  fileFilter: audioFileFilter
});

// Multiple files upload configurations
export const uploadMultipleImages = uploadImage.array('images', 10);
export const uploadMultipleAudios = uploadAudio.array('audios', 5);
export const uploadMultipleDocuments = uploadDocument.array('documents', 10);

// Mixed file upload MEJORADO
export const uploadMixed = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB máximo por archivo
    files: 5, // Máximo 5 archivos
    parts: 20, // Máximo 20 partes del formulario
    fieldSize: 5 * 1024 * 1024 // 5MB para campos de texto (para JSON grande)
  },
  fileFilter: mediaFileFilter
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
  { name: 'document', maxCount: 1 },
  { name: 'file', maxCount: 1 }, // Campo genérico
  { name: 'media', maxCount: 1 } // Campo específico para multimedia
]);

// Configuración específica para el endpoint de subida de audio individual
export const uploadAudioSingle = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
    parts: 5
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    console.log('[AUDIO_SINGLE] Procesando archivo:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      contentType: req.headers['content-type']
    });
    
    audioFileFilter(req, file, cb);
  }
});

// Configuración específica para el endpoint de subida de imagen individual
export const uploadImageSingle = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
    parts: 5
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    console.log('[IMAGE_SINGLE] Procesando archivo:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      contentType: req.headers['content-type']
    });
    
    imageFileFilter(req, file, cb);
  }
});

// Middleware de error personalizado para multer
export const handleMulterError = (error: any, req: Request, res: any, next: any) => {
  console.error('[MULTER ERROR]', {
    error: error.message,
    code: error.code,
    field: error.field,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });
  
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'El archivo es demasiado grande. Tamaño máximo: 50MB para audio, 10MB para imágenes.',
          error: 'FILE_TOO_LARGE'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Demasiados archivos. Máximo 1 archivo por campo.',
          error: 'TOO_MANY_FILES'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: `Campo de archivo no esperado: ${error.field}`,
          error: 'UNEXPECTED_FIELD'
        });
      case 'LIMIT_PART_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Demasiadas partes en el formulario.',
          error: 'TOO_MANY_PARTS'
        });
      default:
        return res.status(400).json({
          success: false,
          message: `Error de carga: ${error.message}`,
          error: error.code
        });
    }
  }
  
  next(error);
};
