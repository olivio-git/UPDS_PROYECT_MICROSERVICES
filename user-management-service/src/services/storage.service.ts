import { Client } from 'minio';
import path from 'path';

const BUCKET = 'user-avatars';
const ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL || `http://localhost:${PORT}`;

const minioClient = new Client({
  endPoint: ENDPOINT,
  port: PORT,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'olivio',
  secretKey: process.env.MINIO_SECRET_KEY || 'olivio12',
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
