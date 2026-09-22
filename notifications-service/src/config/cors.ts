import type { Request } from 'express';

/**
 * The frontend is served by the API gateway, so browser calls to this service
 * arrive from the gateway's own origin and are effectively same-origin. That
 * origin depends on where the stack is deployed (localhost:8088 in dev, the
 * institution's domain in production), so instead of listing it, accept any
 * origin that matches the host the request came in through.
 */
export function isSameOriginThroughGateway(req: Request, origin: string): boolean {
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  if (!host) return false;
  return origin === `http://${host}` || origin === `https://${host}`;
}
