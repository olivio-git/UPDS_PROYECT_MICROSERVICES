/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Browser-reachable MinIO origin, e.g. http://192.168.1.10:9000. See src/lib/mediaUrl.ts. */
  readonly VITE_MINIO_PUBLIC_URL?: string;
}
