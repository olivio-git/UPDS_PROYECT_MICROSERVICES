import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler.middleware';

export interface CanProceedReason {
  code: string;
  message: string;
}

export interface CanProceedResult {
  canProceed: boolean;
  reasons: CanProceedReason[];
  failOpen?: boolean;
}

const CAN_PROCEED_TIMEOUT_MS = 2500;

// Network-level failure codes — session-manager-service is simply
// unreachable (down, DNS failure, connection reset) or our own request
// timed out. These are the ONLY cases that fail open (see below).
const NETWORK_FAILURE_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ECONNABORTED', // axios' own timeout code
]);

/**
 * Calls session-manager-service's internal technical-verification gate.
 * NOT proxied by nginx — this is a service-to-service call inside the
 * Docker network, authenticated with SERVICE_TOKEN (timing-safe compared
 * on the other side — see session-manager-service/src/middleware/auth.middleware.ts).
 *
 * Fail-open decision (deliberate, see PR10 review): only a genuine
 * network-level failure — the service is unreachable, DNS resolution
 * fails, the connection resets, or our own request times out — fails OPEN.
 * Technical verification is a UX/quality gate, not a security boundary, so
 * we don't want exam start blocked purely on this service's uptime.
 *
 * Any HTTP response error (401/403 = bad SERVICE_TOKEN, 404 = route gone,
 * 5xx = its own bug) means the service IS reachable and something is
 * MISCONFIGURED — that's not a case to silently wave every candidate
 * through, so it fails CLOSED instead, with a distinct
 * TECHNICAL_GATE_UNAVAILABLE (503) so the client can show a clear message
 * instead of a confusing generic error. This distinction must not be
 * collapsed back into a blanket fail-open without discussing the tradeoff.
 */
export async function checkCanProceed(userId: string, requireMicrophone: boolean): Promise<CanProceedResult> {
  try {
    const response = await axios.get(
      `${env.SESSION_MANAGER_SERVICE_URL}/internal/technical/can-proceed/${userId}`,
      {
        params: { requireMicrophone: requireMicrophone ? 'true' : 'false' },
        headers: { 'X-Service-Token': env.SERVICE_TOKEN },
        timeout: CAN_PROCEED_TIMEOUT_MS,
      }
    );

    const data = response.data?.data;
    return {
      canProceed: Boolean(data?.canProceed),
      reasons: Array.isArray(data?.reasons) ? data.reasons : [],
    };
  } catch (error: any) {
    const isNetworkFailure =
      !error?.response &&
      (NETWORK_FAILURE_CODES.has(error?.code) || String(error?.message || '').toLowerCase().includes('timeout'));

    if (isNetworkFailure) {
      logger.warn(
        `[TechnicalGate] session-manager-service unreachable (${error?.code || error?.message}), failing OPEN (allowing exam start)`
      );
      return { canProceed: true, reasons: [], failOpen: true };
    }

    // The service responded (or something unexpected happened) — treat as a
    // misconfiguration and fail CLOSED rather than silently letting the
    // candidate through.
    logger.error(
      `[TechnicalGate] session-manager-service errored — failing CLOSED. status=${error?.response?.status} data=${JSON.stringify(error?.response?.data)} message=${error?.message}`
    );
    throw new AppError(
      'No se pudo validar la verificación técnica. Avisa al supervisor.',
      503,
      'TECHNICAL_GATE_UNAVAILABLE'
    );
  }
}
