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

// // Debug habilitado para ver qué está pasando
// console.log('🔧 [SDK] Configuración del SDK:', {
//     authServiceUrl: import.meta.env.VITE_AUTH_SERVICE_URL || "http://localhost:3000",
//     storageType: "indexedDB",
//     dbName: "cba_authDB"
// });

// // Verificar estado inicial del SDK
// const checkInitialState = async () => {
//     try {
//         const currentUser = authSDK.getCurrentUser();
//         const isAuth = await authSDK.isAuthenticated();

//         console.log('🔍 [SDK] Estado inicial:', {
//             hasUser: !!currentUser,
//             isAuthenticated: isAuth,
//             user: currentUser
//         });
//     } catch (error) {
//         console.error('❌ [SDK] Error verificando estado inicial:', error);
//     }
// };

// // Ejecutar verificación inicial
// checkInitialState();

export { authSDK };