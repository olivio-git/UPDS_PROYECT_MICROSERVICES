import { Client } from 'minio';
import path from 'path';

const BUCKET = 'user-avatars';
const ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL || `http://localhost:${PORT}`;

/**
 * Reads a required MinIO credential from the environment. This is a local
 * copy of src/config/index.ts's requireEnv rather than a move into that
 * shared config: this module is only ever imported lazily, on the first
 * avatar upload (see UserController.uploadAvatar), so a missing credential
 * fails that request instead of blocking service boot/login for a feature
 * that is not in the critical path.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Refusing to start with an insecure default.`
    );
  }
  return value;
}

const minioClient = new Client({
  endPoint: ENDPOINT,
  port: PORT,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: requireEnv('MINIO_ACCESS_KEY'),
  secretKey: requireEnv('MINIO_SECRET_KEY'),
});

async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, 'us-east-1');
  }
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      },
    ],
  };
  await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
}

let bucketReady = false;

export async function uploadAvatar(
  file: Express.Multer.File,
  userId: string
): Promise<string> {
  if (!bucketReady) {
    await ensureBucket();
    bucketReady = true;
  }

  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const objectName = `avatars/${userId}${ext}`;

  await minioClient.putObject(BUCKET, objectName, file.buffer, file.size, {
    'Content-Type': file.mimetype,
  });

  return `${PUBLIC_URL}/${BUCKET}/${objectName}`;
}
