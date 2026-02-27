import { toast } from 'sonner';
import { useCallback, useEffect, useRef } from 'react';

export interface FileValidationOptions {
  maxSize?: number; // en bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateFile = (
  file: File,
  options: FileValidationOptions = {}
): ValidationResult => {
  const {
    maxSize = 50 * 1024 * 1024, // 50MB por defecto
    allowedTypes = [],
    allowedExtensions = []
  } = options;

  // Verificar tamaño
  if (maxSize && file.size > maxSize) {
    const sizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `El archivo es demasiado grande. Tamaño máximo: ${sizeMB}MB`
    };
  }

  // Verificar tipo MIME
  if (allowedTypes.length > 0 && !allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.slice(0, -1));
    }
    return file.type === type;
  })) {
    return {
      isValid: false,
      error: `Tipo de archivo no permitido. Tipos válidos: ${allowedTypes.join(', ')}`
    };
  }

  // Verificar extensión
  if (allowedExtensions.length > 0) {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: `Extensión no permitida. Extensiones válidas: ${allowedExtensions.join(', ')}`
      };
    }
  }

  return { isValid: true };
};

export const AUDIO_FILE_OPTIONS: FileValidationOptions = {
  maxSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: ['audio/*'],
  allowedExtensions: ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac', 'flac']
};

export const IMAGE_FILE_OPTIONS: FileValidationOptions = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/*'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
};

export const createFileUploadHandler = (
  options: FileValidationOptions,
  onSuccess: (file: File) => void,
  onError?: (error: string) => void
) => {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file, options);
    
    if (!validation.isValid) {
      const error = validation.error || 'Error de validación del archivo';
      toast.error(error);
      if (onError) onError(error);
      // Limpiar el input
      e.target.value = '';
      return;
    }

    onSuccess(file);
  };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const createObjectURL = (file: File): string => {
  return URL.createObjectURL(file);
};

export const revokeObjectURL = (url: string): void => {
  URL.revokeObjectURL(url);
};

// Hook personalizado para manejar archivos con cleanup automático
export const useFileManager = () => {
  const objectUrls = useRef<Set<string>>(new Set());

  const createManagedURL = useCallback((file: File): string => {
    const url = URL.createObjectURL(file);
    objectUrls.current.add(url);
    return url;
  }, []);

  const revokeManagedURL = useCallback((url: string): void => {
    if (objectUrls.current.has(url)) {
      URL.revokeObjectURL(url);
      objectUrls.current.delete(url);
    }
  }, []);

  // Cleanup automático al desmontar el componente
  useEffect(() => {
    return () => {
      objectUrls.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      objectUrls.current.clear();
    };
  }, []);

  return {
    createManagedURL,
    revokeManagedURL,
    cleanup: () => {
      objectUrls.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      objectUrls.current.clear();
    }
  };
};

// Función para debug de archivos
export const debugFile = (file: File, label = 'File Debug') => {
  console.group(label);
  console.log('Name:', file.name);
  console.log('Size:', formatFileSize(file.size));
  console.log('Type:', file.type);
  console.log('Last Modified:', new Date(file.lastModified));
  console.groupEnd();
};
