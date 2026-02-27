// // ARCHIVO ELIMINADO - No necesario
// // La lógica de reconexión se maneja directamente en el módulo student
// // específicamente en ExamPreparation.tsx y socketService-new.ts
// import type { ExamState, ReconnectionData } from '../utils/ExamConnectionManager';
// import { ExamConnectionManager } from '../utils/ExamConnectionManager';

// interface ExamPageProps {
//   sessionId: string;
//   candidateId: string;
//   authToken: string;
// }

// export const ExamPage: React.FC<ExamPageProps> = ({ 
//   sessionId, 
//   candidateId, 
//   authToken 
// }) => {
//   const [connectionManager, setConnectionManager] = useState<ExamConnectionManager | null>(null);
//   const [examState, setExamState] = useState<ExamState | null>(null);
//   const [timeRemaining, setTimeRemaining] = useState<number>(0);
//   const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
//   const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
//   const [isReconnected, setIsReconnected] = useState(false);
//   const [connectionError, setConnectionError] = useState<string | null>(null);

//   /**
//    * Inicializar ExamConnectionManager
//    */
//   useEffect(() => {
//     const manager = new ExamConnectionManager(
//       process.env.REACT_APP_API_URL || 'http://localhost:4001',
//       authToken
//     );

//     // Configurar event handlers
//     manager.setEventHandlers({
//       onExamReconnected: handleExamReconnected,
//       onExamStarted: handleExamStarted,
//       onConnectionError: handleConnectionError,
//       onTimeUpdate: handleTimeUpdate
//     });

//     setConnectionManager(manager);

//     return () => {
//       manager.disconnect();
//     };
//   }, [sessionId, candidateId, authToken]);

//   /**
//    * Manejar reconexión exitosa al examen
//    */
//   const handleExamReconnected = useCallback((data: ReconnectionData) => {
//     console.log('🔄 Examen reconectado:', data);
    
//     setExamState(data.examState || null);
//     setTimeRemaining(data.timeRemaining || 0);
//     setProgress(data.progress || { current: 0, total: 0 });
//     setConnectionStatus('reconnected');
//     setIsReconnected(true);
//     setConnectionError(null);

//     // Mostrar notificación de reconexión
//     showNotification('✅ Reconectado al examen exitosamente. Tu progreso se ha restaurado.', 'success');
//   }, []);

//   /**
//    * Manejar inicio de nuevo examen
//    */
//   const handleExamStarted = useCallback((data: ReconnectionData) => {
//     console.log('🚀 Nuevo examen iniciado:', data);
    
//     setConnectionStatus('started');
//     setIsReconnected(false);
//     setConnectionError(null);
    
//     // Mostrar notificación de inicio
//     if (data.isNewExam) {
//       showNotification('🚀 Nuevo examen iniciado exitosamente.', 'success');
//     }
//   }, []);

//   /**
//    * Manejar errores de conexión
//    */
//   const handleConnectionError = useCallback((error: string) => {
//     console.error('❌ Error de conexión:', error);
//     setConnectionError(error);
//     setConnectionStatus('error');
    
//     showNotification(`❌ Error: ${error}`, 'error');
//   }, []);

//   /**
//    * Manejar actualización de tiempo
//    */
//   const handleTimeUpdate = useCallback((remaining: number) => {
//     setTimeRemaining(remaining);
    
//     // Alertas de tiempo
//     if (remaining === 300) { // 5 minutos
//       showNotification('⏰ Quedan 5 minutos para finalizar el examen.', 'warning');
//     } else if (remaining === 60) { // 1 minuto
//       showNotification('🚨 ¡Queda 1 minuto! El examen finalizará automáticamente.', 'error');
//     }
//   }, []);

//   /**
//    * Iniciar conexión al examen
//    */
//   const startExamConnection = useCallback(async (forceRestart = false) => {
//     if (!connectionManager) return;

//     try {
//       setConnectionStatus('connecting');
//       setConnectionError(null);
      
//       await connectionManager.startExamConnection(sessionId, candidateId, forceRestart);
      
//     } catch (error) {
//       console.error('Error iniciando conexión:', error);
//       setConnectionError(error instanceof Error ? error.message : 'Error desconocido');
//     }
//   }, [connectionManager, sessionId, candidateId]);

//   /**
//    * Forzar reinicio del examen
//    */
//   const forceRestartExam = useCallback(async () => {
//     if (!connectionManager) return;

//     const confirmed = window.confirm(
//       '⚠️ ¿Estás seguro de que quieres reiniciar el examen?\n\n' +
//       'Esto eliminará todo tu progreso actual y comenzarás desde cero.\n\n' +
//       'Esta acción no se puede deshacer.'
//     );

//     if (confirmed) {
//       try {
//         await connectionManager.forceRestartExam();
//         setIsReconnected(false);
//         setProgress({ current: 0, total: 0 });
//         showNotification('🔄 Examen reiniciado. Comenzando desde cero...', 'info');
//       } catch (error) {
//         showNotification(`❌ Error reiniciando: ${error}`, 'error');
//       }
//     }
//   }, [connectionManager]);

//   /**
//    * Formatear tiempo restante
//    */
//   const formatTime = (seconds: number): string => {
//     const hours = Math.floor(seconds / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
//     const secs = seconds % 60;

//     if (hours > 0) {
//       return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
//     }
//     return `${minutes}:${secs.toString().padStart(2, '0')}`;
//   };

//   /**
//    * Mostrar notificaciones
//    */
//   const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
//     // Implementar tu sistema de notificaciones aquí
//     console.log(`[${type.toUpperCase()}] ${message}`);
    
//     // Ejemplo con toast/alert básico
//     const icon = {
//       success: '✅',
//       error: '❌', 
//       warning: '⚠️',
//       info: 'ℹ️'
//     }[type];
    
//     alert(`${icon} ${message}`);
//   };

//   /**
//    * Iniciar automáticamente al montar componente
//    */
//   useEffect(() => {
//     if (connectionManager) {
//       startExamConnection(false);
//     }
//   }, [connectionManager, startExamConnection]);

//   return (
//     <div className="exam-container p-6 max-w-4xl mx-auto">
//       {/* Header con información de estado */}
//       <div className="exam-header mb-6">
//         <div className="flex justify-between items-center">
//           <h1 className="text-2xl font-bold">Examen Individual</h1>
          
//           {/* Estado de conexión */}
//           <div className="flex items-center space-x-4">
//             {/* Indicador de reconexión */}
//             {isReconnected && (
//               <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
//                 🔄 Reconectado - Progreso restaurado
//               </div>
//             )}
            
//             {/* Tiempo restante */}
//             <div className={`px-3 py-1 rounded-full text-sm font-mono ${
//               timeRemaining < 300 ? 'bg-red-100 text-red-800' : 
//               timeRemaining < 900 ? 'bg-yellow-100 text-yellow-800' : 
//               'bg-blue-100 text-blue-800'
//             }`}>
//               ⏰ {formatTime(timeRemaining)}
//             </div>

//             {/* Estado de conexión */}
//             <div className={`px-3 py-1 rounded-full text-sm ${
//               connectionStatus === 'reconnected' || connectionStatus === 'started' ? 'bg-green-100 text-green-800' :
//               connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
//               connectionStatus === 'error' ? 'bg-red-100 text-red-800' :
//               'bg-gray-100 text-gray-800'
//             }`}>
//               {connectionStatus === 'reconnected' ? '🔄 Reconectado' :
//                connectionStatus === 'started' ? '✅ Conectado' :
//                connectionStatus === 'connecting' ? '🔄 Conectando...' :
//                connectionStatus === 'error' ? '❌ Error' :
//                '⚪ Desconectado'}
//             </div>
//           </div>
//         </div>

//         {/* Progreso del examen */}
//         {progress.total > 0 && (
//           <div className="mt-4">
//             <div className="flex justify-between text-sm text-gray-600 mb-2">
//               <span>Progreso: {progress.current} / {progress.total} preguntas</span>
//               <span>{Math.round((progress.current / progress.total) * 100)}% completado</span>
//             </div>
//             <div className="w-full bg-gray-200 rounded-full h-2">
//               <div 
//                 className="bg-blue-600 h-2 rounded-full transition-all duration-300"
//                 style={{ width: `${(progress.current / progress.total) * 100}%` }}
//               />
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Controles de conexión */}
//       {connectionError && (
//         <div className="error-panel bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
//           <div className="flex items-center justify-between">
//             <div>
//               <h3 className="text-red-800 font-semibold">Error de conexión</h3>
//               <p className="text-red-600 text-sm mt-1">{connectionError}</p>
//             </div>
//             <div className="flex space-x-2">
//               <button
//                 onClick={() => startExamConnection(false)}
//                 className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
//               >
//                 🔄 Reconectar
//               </button>
//               <button
//                 onClick={forceRestartExam}
//                 className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
//               >
//                 🔄 Reiniciar
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Estado de examen */}
//       {examState && (
//         <div className="exam-info bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
//           <h3 className="text-blue-800 font-semibold mb-2">Estado del Examen</h3>
//           <div className="grid grid-cols-2 gap-4 text-sm">
//             <div>
//               <span className="text-blue-600">Estado:</span> {examState.status}
//             </div>
//             <div>
//               <span className="text-blue-600">Inicio:</span> {new Date(examState.startTime).toLocaleTimeString()}
//             </div>
//             <div>
//               <span className="text-blue-600">Tiempo permitido:</span> {Math.floor(examState.timeAllowed / 60)} min
//             </div>
//             <div>
//               <span className="text-blue-600">Última actividad:</span> {new Date(examState.lastActivity).toLocaleTimeString()}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Panel de control manual */}
//       <div className="control-panel bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
//         <h3 className="font-semibold mb-3">Control Manual</h3>
//         <div className="flex space-x-3">
//           <button
//             onClick={() => startExamConnection(false)}
//             disabled={connectionStatus === 'connecting'}
//             className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
//           >
//             {connectionStatus === 'connecting' ? '🔄 Conectando...' : '🔌 Reconectar'}
//           </button>
          
//           <button
//             onClick={forceRestartExam}
//             disabled={!examState || connectionStatus === 'connecting'}
//             className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
//           >
//             🔄 Reiniciar Examen
//           </button>
          
//           <button
//             onClick={() => connectionManager?.disconnect()}
//             className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
//           >
//             🔌 Desconectar
//           </button>
//         </div>
//       </div>

//       {/* Contenido principal del examen */}
//       <div className="exam-content">
//         {connectionStatus === 'started' || connectionStatus === 'reconnected' ? (
//           <div className="text-center py-8">
//             <h2 className="text-xl font-semibold mb-4">
//               {isReconnected ? '🔄 Examen Restaurado' : '🚀 Examen Listo'}
//             </h2>
//             <p className="text-gray-600">
//               {isReconnected 
//                 ? 'Tu progreso ha sido restaurado. Puedes continuar donde lo dejaste.' 
//                 : 'El examen ha comenzado. ¡Buena suerte!'}
//             </p>
//             {/* Aquí van las preguntas del examen */}
//           </div>
//         ) : (
//           <div className="text-center py-8 text-gray-500">
//             <h2 className="text-xl font-semibold mb-4">Conectando al examen...</h2>
//             <p>Por favor espera mientras establecemos la conexión.</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ExamPage;
