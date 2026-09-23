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
        // Access tokens live 1h (identity-service jwt.service.ts), down from
        // 2d, so the refresh buffer has to be well under an hour: 30 min
        // would refresh at the halfway point of every token's life.
        // bufferTime is in MILLISECONDS (the SDK compares it against a
        // millisecond delta and defaults to 900000), even though the SDK's
        // own example writes `bufferTime: 300 // 5 minutos`, which is 300ms.
        bufferTime: 5 * 60 * 1000
    },
    sessionValidation: {
        enabled: true,
        validateOnStartup: true,
        autoLogoutOnInvalid: true,
        maxInactivityTime: 1800 // 30 minutes
    },
});

export { authSDK };