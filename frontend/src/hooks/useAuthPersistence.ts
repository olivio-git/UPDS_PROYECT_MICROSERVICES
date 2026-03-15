import { useEffect, useState } from 'react';
import { useAuthStore } from '@/modules/auth/services/authStore';
import { authService } from '@/modules/auth/services/authService';

export const useAuthPersistence = () => {
  const [isReady, setIsReady] = useState(false);
  const { isInitialized, isAuthenticated, user, initialize } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    let unsubscribe: any;

    const initAuth = async () => {
      try {
        // console.log('🔧 [useAuthPersistence] Inicializando persistencia...');
        
        // Verificar inmediatamente el estado del SDK
        // const currentUser = authService.getCurrentUser();
        // const isAuth = await authService.isAuthenticated();
        
        // console.log('🔍 [useAuthPersistence] Estado inmediato del SDK:', {
        //   hasUser: !!currentUser,
        //   isAuthenticated: isAuth,
        //   userRole: currentUser?.role
        // });

        // Si no está inicializado, inicializar
        if (!isInitialized && mounted) {
          // console.log('🚀 [useAuthPersistence] Ejecutando initialize...');
          unsubscribe = await initialize();
        }

        // Configurar listener adicional para cambios de estado
        const sdkUnsubscribe = authService.onAuthStateChanged((state) => {
          console.log('🔔 [useAuthPersistence] Cambio detectado en el SDK:', {
            hasUser: !!state.user,
            isLoading: state.loading,
            error: state.error
          });
        });

        // Marcar como listo después de un breve delay para asegurar sincronización
        setTimeout(() => {
          if (mounted) {
            setIsReady(true);
            // console.log('✅ [useAuthPersistence] Persistencia lista');
          }
        }, 200);

        return () => {
          if (typeof sdkUnsubscribe === 'function') {
            sdkUnsubscribe();
          }
        };

      } catch (error) {
        console.error('❌ [useAuthPersistence] Error en inicialización:', error);
        if (mounted) {
          setIsReady(true); // Marcar como listo aun con error para evitar bucle infinito
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isInitialized, initialize]);

  return {
    isReady,
    isAuthenticated,
    user,
    isInitialized
  };
};