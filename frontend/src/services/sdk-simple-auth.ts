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
    },
    tokenRefresh: {
        enabled: true,
        bufferTime: 30,
        maxRetries: 2,
        minimumTokenLifetime: 60,
        gracePeriod: 30,
    },
});
authSDK.debugResponse(authSDK.debugResponse.bind(authSDK))
authSDK.debugToken();
authSDK.debugSession();

export { authSDK };