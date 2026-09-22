/**
 * Where the backend lives, resolved once.
 *
 * Every service file used to carry its own `import.meta.env.VITE_X ||
 * 'http://localhost:PORT'` fallback — thirty of them, with disagreeing ports.
 * When a variable was missing the app silently talked to localhost, which
 * looks fine on the developer's machine and fails everywhere else.
 *
 * Now: if the variable is set it wins; otherwise the app calls the host that
 * served it. Deployed behind the gateway, no variable needs to be set at all.
 */
const trimSlash = (value: string | undefined) => value?.trim().replace(/\/+$/, '') || '';

const pageOrigin = typeof window !== 'undefined' ? window.location.origin : '';

/** Origin of the API gateway (nginx). */
export const GATEWAY_URL = trimSlash(import.meta.env.VITE_API_GATEWAY_URL) || pageOrigin;

/** Gateway origin plus the shared API prefix. */
export const API_V1_URL = `${GATEWAY_URL}/api/v1`;

/** Bases that already include /api/v1 (callers append `/auth/...`, `/sessions/...`). */
export const AUTH_SERVICE_URL = trimSlash(import.meta.env.VITE_AUTH_SERVICE_URL) || API_V1_URL;
export const SESSION_MANAGER_URL = trimSlash(import.meta.env.VITE_SESSION_MANAGER_URL) || API_V1_URL;
export const NOTIFICATION_SERVICE_URL = trimSlash(import.meta.env.VITE_NOTIFICATION_SERVICE_URL) || API_V1_URL;

/** Bases that are only an origin (callers append `/api/v1/...`). */
export const EXAM_SERVICE_URL = trimSlash(import.meta.env.VITE_EXAM_SERVICE_URL) || GATEWAY_URL;
export const USER_MANAGEMENT_URL = trimSlash(import.meta.env.VITE_USER_MANAGEMENT_URL) || GATEWAY_URL;

/** Socket.IO endpoints. */
export const NOTIFICATION_WS_URL =
  trimSlash(import.meta.env.VITE_NOTIFICATION_SERVICE_WS) ||
  trimSlash(import.meta.env.VITE_NOTIFICATION_SERVICE_URL) ||
  GATEWAY_URL;

/** Where the browser can read exam media. The gateway proxies /minio to MinIO. */
export const MEDIA_BASE_URL = trimSlash(import.meta.env.VITE_MINIO_PUBLIC_URL) || `${GATEWAY_URL}/minio`;
