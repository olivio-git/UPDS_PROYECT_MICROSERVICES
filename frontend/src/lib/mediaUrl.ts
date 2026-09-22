import { MEDIA_BASE_URL } from './serviceUrls';

/** Matches object URLs that use MinIO's hostname inside the Docker network. */
const INTERNAL_MINIO_ORIGIN = /^https?:\/\/minio(:\d+)?/;


/** Rewrites an internal MinIO URL so the browser can load it. Other URLs pass through. */
export function toBrowserMediaUrl(url: string): string {
  return url.replace(INTERNAL_MINIO_ORIGIN, MEDIA_BASE_URL);
}
