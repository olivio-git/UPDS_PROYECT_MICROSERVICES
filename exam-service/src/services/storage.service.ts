import { Client } from 'minio';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { Readable } from 'stream';

export class StorageService {
  private minioClient: Client;
  private bucketName: string;
  private isConnected: boolean = false;

  constructor() {
    // Cliente único que usa el hostname interno de Docker
    this.minioClient = new Client({
      endPoint: env.MINIO_ENDPOINT || 'localhost',
      port: env.MINIO_PORT || 9000,
      useSSL: env.MINIO_USE_SSL || false,
      accessKey: env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: env.MINIO_SECRET_KEY || 'minioadmin'
    });

    this.bucketName = env.MINIO_BUCKET_NAME || 'exam-files';
    // Initialize bucket in background, don't block startup
    this.initializeBucket().catch(error => {
      logger.warn('MinIO initialization deferred, will retry on first use');
    });
  }

  private async initializeBucket(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        logger.info(`Bucket ${this.bucketName} created successfully`);
      }

      // Configurar política para hacer públicos los archivos multimedia
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [
              `arn:aws:s3:::${this.bucketName}/questions/*/audio/*`,
              `arn:aws:s3:::${this.bucketName}/questions/*/images/*`,
              `arn:aws:s3:::${this.bucketName}/responses/*/audio/*`,
              `arn:aws:s3:::${this.bucketName}/public/*`
            ]
          }
        ]
      };

      await this.minioClient.setBucketPolicy(
        this.bucketName,
        JSON.stringify(policy)
      );
      
      this.isConnected = true;
      logger.info('✅ MinIO storage service connected successfully with public access for media files');
    } catch (error) {
      this.isConnected = false;
      logger.error('Error initializing MinIO bucket:', error);
      throw error;
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      await this.initializeBucket();
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    fileName?: string
  ): Promise<{ url: string; key: string; publicUrl?: string }> {
    try {
      await this.ensureConnection();
      const timestamp = Date.now();
      const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const objectName = fileName || `${folder}/${timestamp}_${sanitizedOriginalName}`;

      // Upload file to MinIO
      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
          'X-Original-Name': file.originalname
        }
      );

      // Para archivos multimedia, usar URL pública directa
      const isMediaFile = folder.includes('audio') || folder.includes('images');
      let url: string;
      let publicUrl: string | undefined;

      if (isMediaFile) {
        // URL pública directa (sin firma) para archivos multimedia
        publicUrl = this.getPublicUrl(objectName);
        url = publicUrl;
      } else {
        // URL presignada para otros archivos
        url = await this.getFileUrl(objectName);
      }

      logger.info(`File uploaded successfully: ${objectName}`);
      return { url, key: objectName, publicUrl };
    } catch (error) {
      logger.error('Error uploading file to MinIO:', error);
      throw error;
    }
  }

  async uploadStream(
    stream: Readable,
    objectName: string,
    size: number,
    metadata?: Record<string, string>
  ): Promise<{ url: string; key: string }> {
    try {
      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        stream,
        size,
        metadata
      );

      const url = await this.getFileUrl(objectName);

      logger.info(`Stream uploaded successfully: ${objectName}`);
      return { url, key: objectName };
    } catch (error) {
      logger.error('Error uploading stream to MinIO:', error);
      throw error;
    }
  }

  async downloadFile(objectName: string): Promise<Buffer> {
    try {
      const stream = await this.minioClient.getObject(this.bucketName, objectName);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`Error downloading file ${objectName}:`, error);
      throw error;
    }
  }

  async getFileStream(objectName: string): Promise<Readable> {
    try {
      return await this.minioClient.getObject(this.bucketName, objectName);
    } catch (error) {
      logger.error(`Error getting file stream ${objectName}:`, error);
      throw error;
    }
  }

  async deleteFile(objectName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, objectName);
      logger.info(`File deleted successfully: ${objectName}`);
    } catch (error) {
      logger.error(`Error deleting file ${objectName}:`, error);
      throw error;
    }
  }

  async deleteFiles(objectNames: string[]): Promise<void> {
    try {
      await this.minioClient.removeObjects(this.bucketName, objectNames);
      logger.info(`${objectNames.length} files deleted successfully`);
    } catch (error) {
      logger.error('Error deleting multiple files:', error);
      throw error;
    }
  }

  async getFileUrl(objectName: string, expiry = 7 * 24 * 60 * 60): Promise<string> {
    try {
      // Generar URL presignada con el cliente interno
      let url = await this.minioClient.presignedGetObject(
        this.bucketName,
        objectName,
        expiry
      );

      // Reemplazar el hostname interno con el público para acceso externo
      const internalUrl = `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;
      const publicUrl = env.MINIO_PUBLIC_URL || `http://localhost:${env.MINIO_PORT}`;
      
      url = url.replace(internalUrl, publicUrl);
      
      logger.debug(`Generated public URL for ${objectName}: ${url}`);
      return url;
    } catch (error) {
      logger.error(`Error generating presigned URL for ${objectName}:`, error);
      throw error;
    }
  }

  // Método alternativo: URL directa sin firma (requiere bucket público)
  getPublicUrl(objectName: string): string {
    const publicEndpoint = env.MINIO_PUBLIC_URL || `http://localhost:${env.MINIO_PORT}`;
    return `${publicEndpoint}/${this.bucketName}/${objectName}`;
  }

  // URL interna Docker-to-Docker (para que grading-service descargue desde la red interna)
  getInternalUrl(objectName: string): string {
    const base = env.MINIO_INTERNAL_ENDPOINT || `http://localhost:${env.MINIO_PORT}`;
    return `${base}/${this.bucketName}/${objectName}`;
  }

  async getFileMetadata(objectName: string): Promise<any> {
    try {
      const stat = await this.minioClient.statObject(this.bucketName, objectName);
      return {
        size: stat.size,
        contentType: stat.metaData['content-type'],
        lastModified: stat.lastModified,
        etag: stat.etag,
        metadata: stat.metaData
      };
    } catch (error) {
      logger.error(`Error getting metadata for ${objectName}:`, error);
      throw error;
    }
  }

  async listFiles(prefix: string, recursive = true): Promise<any[]> {
    try {
      const stream = this.minioClient.listObjectsV2(
        this.bucketName,
        prefix,
        recursive
      );

      const files: any[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => files.push(obj));
        stream.on('end', () => resolve(files));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`Error listing files with prefix ${prefix}:`, error);
      throw error;
    }
  }

  async copyFile(sourceObject: string, destObject: string): Promise<void> {
    try {
      await this.minioClient.copyObject(
        this.bucketName,
        destObject,
        `/${this.bucketName}/${sourceObject}`,
        undefined
      );
      logger.info(`File copied from ${sourceObject} to ${destObject}`);
    } catch (error) {
      logger.error(`Error copying file from ${sourceObject} to ${destObject}:`, error);
      throw error;
    }
  }

  // Specific methods for exam files

  async uploadQuestionAudio(
    file: Express.Multer.File,
    questionId: string
  ): Promise<{ url: string; key: string; publicUrl?: string }> {
    const folder = `questions/${questionId}/audio`;
    return this.uploadFile(file, folder);
  }

  async uploadQuestionImage(
    file: Express.Multer.File,
    questionId: string
  ): Promise<{ url: string; key: string; publicUrl?: string }> {
    const folder = `questions/${questionId}/images`;
    return this.uploadFile(file, folder);
  }

  async uploadResponseAudio(
    file: Express.Multer.File,
    sessionId: string,
    candidateId: string,
    questionId: string
  ): Promise<{ url: string; key: string }> {
    const folder = `responses/${sessionId}/${candidateId}/audio`;
    const fileName = `${folder}/${questionId}_${Date.now()}.${file.originalname.split('.').pop()}`;
    return this.uploadFile(file, folder, fileName);
  }

  async uploadResponseFile(
    file: Express.Multer.File,
    sessionId: string,
    candidateId: string,
    questionId: string
  ): Promise<{ url: string; key: string }> {
    const folder = `responses/${sessionId}/${candidateId}/files`;
    const fileName = `${folder}/${questionId}_${Date.now()}_${file.originalname}`;
    return this.uploadFile(file, folder, fileName);
  }

  async uploadExamTemplate(
    file: Express.Multer.File,
    examId: string
  ): Promise<{ url: string; key: string }> {
    const folder = `exams/${examId}/templates`;
    return this.uploadFile(file, folder);
  }

  async getQuestionMedia(questionId: string): Promise<any[]> {
    const audioFiles = await this.listFiles(`questions/${questionId}/audio`);
    const imageFiles = await this.listFiles(`questions/${questionId}/images`);
    return [...audioFiles, ...imageFiles];
  }

  async getCandidateResponses(
    sessionId: string,
    candidateId: string
  ): Promise<any[]> {
    return this.listFiles(`responses/${sessionId}/${candidateId}`);
  }
}

// Export as a singleton but don't initialize immediately
let storageServiceInstance: StorageService | null = null;

export const getStorageService = (): StorageService => {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
};