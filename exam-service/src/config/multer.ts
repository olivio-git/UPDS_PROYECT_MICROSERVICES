import multer from 'multer';
import { Request } from 'express';
import { env } from './env';
import { AppError } from '../middleware/errorHandler.middleware';

// File filter functions
const imageFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only JPEG, PNG, GIF and WebP images are allowed.', 400));
  }
};

const audioFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'audio/mpeg', 
    'audio/mp3', 
    'audio/wav', 
    'audio/m4a', 
    'audio/ogg', 
    'audio/webm',
    'audio/x-m4a',
    'audio/mp4',
    'audio/*' // Accept any audio type for flexibility
  ];
  
  // More flexible check
  if (file.mimetype.startsWith('audio/') || allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only audio files are allowed.', 400));
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

const anyFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept any file type but check size
  cb(null, true);
};

// Multer configurations
const storage = multer.memoryStorage();

// Image upload config (max 5MB)
export const uploadImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFileFilter
});

// Audio upload config (max 50MB)
export const uploadAudio = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: audioFileFilter
});

// Document upload config (max 10MB)
export const uploadDocument = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: documentFileFilter
});

// Excel/CSV upload config (max 5MB)
export const uploadSpreadsheet = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: excelFileFilter
});

// Generic file upload config (max size from env)
export const uploadFile = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE
  },
  fileFilter: anyFileFilter
});

// Flexible multimedia upload that accepts any field name and audio/image files
export const uploadMultimediaAny = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    console.log('Multimedia file received:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Accept audio files
    if (file.mimetype.startsWith('audio/') || 
        file.originalname.match(/\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i)) {
      cb(null, true);
    }
    // Accept image files  
    else if (file.mimetype.startsWith('image/') ||
             file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      cb(null, true);
    }
    else {
      cb(new AppError(`Invalid file type: ${file.mimetype}. Only audio and image files are allowed.`, 400));
    }
  }
});

// Backward compatibility - alias
export const uploadAudioAny = uploadMultimediaAny;

// Multiple files upload configurations
export const uploadMultipleImages = uploadImage.array('images', 10);
export const uploadMultipleAudios = uploadAudio.array('audios', 5);
export const uploadMultipleDocuments = uploadDocument.array('documents', 10);

// Mixed file upload
export const uploadMixed = uploadFile.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
  { name: 'document', maxCount: 1 },
  { name: 'file', maxCount: 1 } // Generic field name
]);