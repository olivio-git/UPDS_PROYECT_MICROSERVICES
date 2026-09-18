/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API gateway origin (nginx), e.g. http://192.168.1.10. */
  readonly VITE_API_GATEWAY_URL?: string;
  /** Base URL of the API client; in deployments this points at the gateway. */
  readonly VITE_EXAM_SERVICE_URL?: string;
  /** Browser-reachable MinIO origin, e.g. http://192.168.1.10:9000. See src/lib/mediaUrl.ts. */
  readonly VITE_MINIO_PUBLIC_URL?: string;
}
