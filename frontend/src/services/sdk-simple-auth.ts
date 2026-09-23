// @ts-ignore
import { AuthSDK } from "sdk-simple-auth";
import { AUTH_SERVICE_URL } from '@/lib/serviceUrls';

const authSDK = new AuthSDK({
    authServiceUrl: AUTH_SERVICE_URL,
    endpoints: {
        login: "/auth/login",
        refresh: "/auth/refresh",
        logout: "/auth/logout",
        profile: "/auth/profile",
    },
    storage: {
        type: "indexedDB",
        dbName: "cba_authDB",
        dbVersion: 1,
        storeName: "authStore",
        tokenKey: "sessionKey",
        refreshTokenKey: "refreshKey",
        userKey: "userKey",
        encryption:{
            enabled: true,
            secret: "cba_tarija_2025"
        }
    },
    tokenRefresh: {
        enabled: true,
        // Access tokens now live 1h (identity-service jwt.service.ts), down
        // from 2d. 1800s (30 min) was fine as a buffer against a 2-day TTL
        // (~1% of it) but would be 50% of a 1h TTL — refreshing at the
        // halfway point of every token's life instead of near its end.
        // 300s (5 min) keeps the buffer comfortably smaller than the new
        // TTL (the invariant this value must satisfy) while still leaving
        // the token mostly used before each refresh.
        //
        // NOTE (sdk-simple-auth@2.2.0 bug, not fixed here): this SDK reads
        // `bufferTime` as SECONDS in isTokenExpiringSoon() (the check an
        // in-flight request actually relies on to avoid firing with a
        // soon-to-expire token) but as raw MILLISECONDS in its internal
        // scheduleTokenRefresh() background timer (dist/index.cjs.js
        // ~L506/523: `bufferTime ?? 900 * 1000`, missing a `* 1000` on the
        // user-supplied value). One field, two incompatible units — no
        // single value fixes both. Setting it in ms would make the correct,
        // request-gating isTokenExpiringSoon() check permanently true
        // (constant refresh storm), which is strictly worse than the
        // background scheduler firing ~`bufferTime`ms (not minutes) before
        // expiry instead of well ahead of it. Keeping seconds here is the
        // safer of the two broken options; isTokenExpiringSoon() is the
        // path that actually gates outgoing requests, so it must stay
        // correct. Fixing this for real needs a patch-package patch on
        // sdk-simple-auth, out of scope for this change.
        bufferTime: 300
    },
    sessionValidation: {
        enabled: true,
        validateOnStartup: true,
        autoLogoutOnInvalid: true,
        maxInactivityTime: 1800 // 30 minutes
    },
});

export { authSDK };