import socketService from '../services/socketService-new';

/**
 * Script de prueba para diagnosticar el problema de startIndividualExam
 */

export async function runDiagnosticTests() {
  console.log(`🧪 === INICIANDO DIAGNÓSTICOS COMPLETOS ===`);
  console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
  
  // Test 1: Estado básico del socket
  console.log(`\n🔍 === TEST 1: Estado básico del socket ===`);
  const diagnosis = socketService.diagnose();
  console.log(`📊 Diagnóstico:`, diagnosis);
  
  // Test 2: Conectividad bidireccional
  console.log(`\n🏓 === TEST 2: Test de ping/pong ===`);
  try {
    const isConnected = await socketService.testConnection();
    console.log(`✅ Test de conectividad: ${isConnected ? 'EXITOSO' : 'FALLIDO'}`);
  } catch (error) {
    console.error(`❌ Test de conectividad falló:`, error);
  }
  
  // Test 3: Test con evento simple
  console.log(`\n🧪 === TEST 3: Evento de prueba simple ===`);
  try {
    await testSimpleEvent();
  } catch (error) {
    console.error(`❌ Test de evento simple falló:`, error);
  }
  
  // Test 4: startIndividualExam con logging completo
  console.log(`\n🚀 === TEST 4: startIndividualExam diagnóstico ===`);
  try {
    await testStartIndividualExam();
  } catch (error) {
    console.error(`❌ Test de startIndividualExam falló:`, error);
  }
  
  console.log(`\n🧪 === DIAGNÓSTICOS COMPLETADOS ===`);
}

/**
 * Test simple de evento
 */
async function testSimpleEvent(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout en evento simple'));
    }, 5000);
    
    socketService.on('test-response' as any, () => {
      console.log(`✅ Respuesta de evento simple recibida`);
      clearTimeout(timeout);
      resolve();
    });
    
    console.log(`📤 Enviando evento test simple...`);
    socketService.emit('test-event', { message: 'Hola backend', timestamp: new Date().toISOString() });
  });
}

/**
 * Test específico de startIndividualExam con datos de prueba
 */
async function testStartIndividualExam(): Promise<void> {
  const testData = {
    sessionId: '68b5454144f29eef77a33058', // Mismo ID que falla
    candidateId: '68ae737f78cd5364f86ae5b7', // Mismo ID que falla
    forceRestart: false
  };
  
  console.log(`🔍 Datos de prueba:`, testData);
  console.log(`📊 Estado antes del test:`, socketService.diagnose());
  
  try {
    const result = await socketService.startIndividualExam(testData.sessionId);
    console.log(`✅ startIndividualExam exitoso:`, result);
  } catch (error) {
    console.error(`❌ startIndividualExam falló:`, error);
    console.log(`📊 Estado después del error:`, socketService.diagnose());
  }
}

/**
 * Función de utilidad para usar en la consola del navegador
 */
(window as any).runSocketDiagnostics = runDiagnosticTests;
