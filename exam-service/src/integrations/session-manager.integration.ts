import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

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

/**
 * Calls session-manager-service's internal technical-verification gate.
 * NOT proxied by nginx — this is a service-to-service call inside the
 * Docker network, authenticated with SERVICE_TOKEN (timing-safe compared
 * on the other side — see session-manager-service/src/middleware/auth.middleware.ts).
 *
 * Fail-open decision (deliberate, see PR10): if session-manager is
 * unreachable or the call times out, we let the student proceed rather than
 * blocking exam start on this service's availability. Technical
 * verification is a UX/quality gate, not a security boundary — availability
 * of the exam flow takes priority. This is logged as a warning so it's
 * visible in ops, and it must not be silently relaxed to "fail closed"
 * without discussing the availability tradeoff.
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
    logger.warn(
      `[TechnicalGate] session-manager-service unreachable or errored, failing OPEN (allowing exam start): ${error?.message || error}`
    );
    return { canProceed: true, reasons: [], failOpen: true };
  }
}
