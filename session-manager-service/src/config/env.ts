/**
 * Startup-validated environment for session-manager-service.
 *
 * This service reads process.env directly in a dozen places, each with its own
 * inline default. Secrets are centralised here so a missing one fails at boot
 * instead of surfacing as an obscure error in the middle of a request.
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

/** Secret used to verify incoming access tokens issued by auth-service. */
export const JWT_SECRET = requireEnv('JWT_SECRET');

/**
 * Secret used to sign the short-lived WebSocket/session tokens this service
 * issues itself. Falls back to JWT_SECRET when no dedicated secret is set.
 */
export const SESSION_JWT_SECRET = process.env.SESSION_JWT_SECRET || JWT_SECRET;
