// @ts-ignore
import { AuthSDK } from "sdk-simple-auth";

const authSDK = new AuthSDK({
    authServiceUrl: import.meta.env.VITE_AUTH_SERVICE_URL || "http://localhost:3000",
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
        bufferTime: 1800 // in seconds (30 minutes)
    },
    sessionValidation: {
        enabled: true,
        validateOnStartup: true,
        autoLogoutOnInvalid: true,
        maxInactivityTime: 1800 // 30 minutes
    },
});

export { authSDK };