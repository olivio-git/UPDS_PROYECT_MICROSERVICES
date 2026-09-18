/** Matches object URLs that use MinIO's hostname inside the Docker network. */
const INTERNAL_MINIO_ORIGIN = /^https?:\/\/minio(:\d+)?/;

/**
 * Where the browser can reach MinIO.
 *
 * VITE_MINIO_PUBLIC_URL wins when set. Otherwise assume MinIO is published on
 * port 9000 of the same host that serves this app, which is how
 * docker-compose.yml maps it. Hardcoding http://localhost:9000 only worked on
 * the server machine itself: on any other computer the browser looked for
 * MinIO on its own localhost and every audio answer failed to load.
 *
 * The default reuses the page's protocol. If the app is served over HTTPS but
 * MinIO's port only speaks HTTP, the browser blocks the media either way; set
 * VITE_MINIO_PUBLIC_URL to an HTTPS-reachable MinIO origin in that deployment.
 */
function publicMinioOrigin(): string {
  const configured = import.meta.env.VITE_MINIO_PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return `${window.location.protocol}//${window.location.hostname}:9000`;
}

/** Rewrites an internal MinIO URL so the browser can load it. Other URLs pass through. */
export function toBrowserMediaUrl(url: string): string {
  return url.replace(INTERNAL_MINIO_ORIGIN, publicMinioOrigin());
}
