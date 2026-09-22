import http from 'http';
import https from 'https';

const USER_MANAGEMENT_URL =
  process.env.USER_MANAGEMENT_SERVICE_URL || 'http://user-management-service:3002';

interface AuditPayload {
  action: string;
  target: { type: string; id?: string; name?: string };
  actor?: { userId?: string; email?: string; role?: string; ip?: string };
  details?: Record<string, any>;
  status?: 'success' | 'failure';
}

/**
 * Fire-and-forget audit log sender to user-management-service internal endpoint.
 */
export function auditLog(payload: AuditPayload): void {
  const body = JSON.stringify({ ...payload, service: 'auth-service' });

  const url = new URL(`${USER_MANAGEMENT_URL}/internal/audit`);
  const isHttps = url.protocol === 'https:';
  const mod = isHttps ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = mod.request(options);
  req.setTimeout(2000, () => req.destroy());
  req.on('error', () => {}); // silenciar errores de red
  req.write(body);
  req.end();
}
