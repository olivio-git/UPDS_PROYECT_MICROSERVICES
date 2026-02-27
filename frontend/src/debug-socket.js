// Script de debugging para probar el socketService manualmente
// Usar en la consola del navegador

console.log('🧪 [DEBUG] Script de debugging cargado - Versión Avanzada');

// Función para test rápido
window.testSocketConnection = async () => {
  console.log('🧪 [TEST] Iniciando test de conexión...');
  
  // Importar el servicio
  const { default: socketService } = await import('/src/modules/student/services/socketService.ts');
  
  console.log('🔍 [TEST] Estado inicial del socket:');
  console.log('- Conectado:', socketService.isConnected());
  console.log('- Info:', socketService.getConnectionInfo());
  
  // Conectar si no está conectado
  if (!socketService.isConnected()) {
    console.log('🔌 [TEST] Conectando...');
    await socketService.connect();
  }
  
  console.log('🔍 [TEST] Estado después de conectar:');
  console.log('- Conectado:', socketService.isConnected());
  console.log('- Info:', socketService.getConnectionInfo());
  
  return socketService;
};

// Función para test del evento start-individual-exam con debugging avanzado
window.testStartIndividualExam = async (sessionId = 'test-session-123') => {
  console.log('🧪 [TEST] Iniciando test de start-individual-exam AVANZADO...');
  
  const { default: socketService } = await import('/src/modules/student/services/socketService.ts');
  
  // 1. Verificar listeners actuales
  console.log('👂 [TEST] Configurando listeners de debug...');
  
  const debugListeners = {
    examStarted: (data) => console.log('✅ [DEBUG] exam-started recibido:', data),
    sessionError: (error) => console.log('❌ [DEBUG] session-error recibido:', error),
    testEvent: (data) => console.log('🧪 [DEBUG] test-event recibido:', data),
    connect: () => console.log('🔌 [DEBUG] Socket conectado'),
    disconnect: () => console.log('🔌 [DEBUG] Socket desconectado'),
    error: (error) => console.log('⚠️ [DEBUG] Socket error:', error)
  };
  
  // Agregar todos los listeners de debug
  socketService.on('exam-started', debugListeners.examStarted);
  socketService.on('session-error', debugListeners.sessionError);
  socketService.on('test-event', debugListeners.testEvent);
  socketService.on('connect', debugListeners.connect);
  socketService.on('disconnect', debugListeners.disconnect);
  socketService.on('error', debugListeners.error);
  
  // 2. Enviar evento de prueba primero
  console.log('📤 [TEST] Enviando test-event...');
  socketService.emit('test-event', { 
    message: 'prueba manual desde debug', 
    timestamp: new Date().toISOString(),
    sessionId 
  });
  
  // 3. Esperar un momento y luego intentar start-individual-exam
  setTimeout(async () => {
    try {
      console.log('🚀 [TEST] Iniciando startIndividualExam...');
      await socketService.startIndividualExam(sessionId);
      console.log('✅ [TEST] startIndividualExam completado exitosamente');
    } catch (error) {
      console.error('❌ [TEST] Error en startIndividualExam:', error);
      console.error('❌ [TEST] Stack trace:', error.stack);
    }
  }, 2000);
  
  // 4. Limpiar listeners después de 30 segundos
  setTimeout(() => {
    console.log('� [TEST] Limpiando listeners de debug...');
    socketService.off('exam-started', debugListeners.examStarted);
    socketService.off('session-error', debugListeners.sessionError);
    socketService.off('test-event', debugListeners.testEvent);
    socketService.off('connect', debugListeners.connect);
    socketService.off('disconnect', debugListeners.disconnect);
    socketService.off('error', debugListeners.error);
  }, 30000);
  
  return socketService;
};

// Función para monitorear todos los eventos del socket
window.monitorAllEvents = async () => {
  console.log('👂 [MONITOR] Configurando monitoreo de todos los eventos...');
  
  const { default: socketService } = await import('/src/modules/student/services/socketService.ts');
  
  // Lista de eventos comunes a monitorear
  const events = [
    'connect', 'disconnect', 'error', 'connect_error',
    'exam-started', 'session-error', 'test-event',
    'session-joined', 'exam-updated', 'exam-finished'
  ];
  
  const listeners = {};
  
  events.forEach(event => {
    listeners[event] = (data) => {
      console.log(`📨 [MONITOR] Evento '${event}' recibido:`, data);
    };
    socketService.on(event, listeners[event]);
  });
  
  console.log('✅ [MONITOR] Monitoreo activo para eventos:', events.join(', '));
  
  // Función para limpiar el monitoreo
  window.stopMonitoring = () => {
    console.log('🛑 [MONITOR] Deteniendo monitoreo...');
    events.forEach(event => {
      socketService.off(event, listeners[event]);
    });
    console.log('✅ [MONITOR] Monitoreo detenido');
  };
  
  return socketService;
};

// Función para limpiar listeners
window.cleanupSocketListeners = async () => {
  const { default: socketService } = await import('/src/modules/student/services/socketService.ts');
  socketService.cleanup();
  console.log('🧹 [TEST] Listeners limpiados');
};

// Función para verificar el estado completo del backend
window.checkBackendStatus = async () => {
  console.log('🏥 [HEALTH] Verificando estado del backend...');
  
  try {
    // Verificar session-manager-service
    const response = await fetch('http://localhost:3004/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ [HEALTH] Session Manager:', data);
    } else {
      console.log('⚠️ [HEALTH] Session Manager respuesta:', response.status);
    }
  } catch (error) {
    console.error('❌ [HEALTH] Session Manager error:', error);
  }
  
  // También podemos probar la conexión direct del socket
  const { default: socketService } = await import('/src/modules/student/services/socketService.ts');
  console.log('🔍 [HEALTH] Socket status:', {
    connected: socketService.isConnected(),
    info: socketService.getConnectionInfo()
  });
  
  // Probar authentication status
  console.log('👤 [AUTH] Checking auth status...');
  try {
    const { authSDK } = await import('/src/services/authSdk.ts');
    const currentUser = authSDK.getCurrentUser();
    const token = authSDK.getAccessToken();
    console.log('👤 [AUTH] Usuario:', currentUser?.id || 'No autenticado');
    console.log('🎟️ [AUTH] Token presente:', !!token);
  } catch (error) {
    console.error('❌ [AUTH] Error checking auth:', error);
  }
};

// Función para test directo del socket - sin usar socketService
window.testDirectSocket = async (sessionId = '68b3a83e30347f7a2e49faca') => {
  console.log('🔌 [DIRECT] Creando conexión directa al socket...');
  
  try {
    const { io } = await import('https://cdn.socket.io/4.6.1/socket.io.esm.min.js');
    const { authSDK } = await import('/src/services/authSdk.ts');
    
    const token = authSDK.getAccessToken();
    
    if (!token) {
      console.error('❌ [DIRECT] No hay token de autenticación');
      return;
    }
    
    console.log('🔌 [DIRECT] Conectando con token...');
    
    const directSocket = io('http://localhost:3004', {
      auth: {
        token: token
      },
      transports: ['websocket']
    });
    
    // Listeners de conexión
    directSocket.on('connect', () => {
      console.log('✅ [DIRECT] Conectado! Socket ID:', directSocket.id);
      
      // Listener para respuestas
      directSocket.on('exam-started', (data) => {
        console.log('✅ [DIRECT] exam-started recibido:', data);
        directSocket.disconnect();
      });
      
      directSocket.on('session-error', (error) => {
        console.log('❌ [DIRECT] session-error recibido:', error);
        directSocket.disconnect();
      });
      
      directSocket.on('test-event', (data) => {
        console.log('🧪 [DIRECT] test-event recibido:', data);
      });
      
      // Enviar evento de prueba primero
      console.log('📤 [DIRECT] Enviando test-event...');
      directSocket.emit('test-event', {
        message: 'prueba directa',
        timestamp: new Date().toISOString()
      });
      
      // Después de 2 segundos, enviar start-individual-exam
      setTimeout(() => {
        console.log('📤 [DIRECT] Enviando start-individual-exam...');
        directSocket.emit('start-individual-exam', {
          sessionId: sessionId,
          candidateId: '68ae737f78cd5364f86ae5b7' // ID de prueba
        });
      }, 2000);
    });
    
    directSocket.on('connect_error', (error) => {
      console.error('❌ [DIRECT] Error de conexión:', error);
    });
    
    directSocket.on('error', (error) => {
      console.error('❌ [DIRECT] Error del socket:', error);
    });
    
    // Timeout para limpiar
    setTimeout(() => {
      console.log('⏰ [DIRECT] Timeout, desconectando...');
      directSocket.disconnect();
    }, 30000);
    
  } catch (error) {
    console.error('❌ [DIRECT] Error en test directo:', error);
  }
};

console.log('🧪 [DEBUG] Funciones disponibles:');
console.log('- testSocketConnection()');
console.log('- testStartIndividualExam(sessionId?)');
console.log('- testDirectSocket(sessionId?) - NUEVA');
console.log('- monitorAllEvents() + stopMonitoring()');
console.log('- checkBackendStatus()');
console.log('- cleanupSocketListeners()');
