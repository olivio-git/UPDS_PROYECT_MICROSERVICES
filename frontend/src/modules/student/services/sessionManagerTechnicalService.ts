import { authSDK } from '@/services/sdk-simple-auth';
import axios, { type AxiosInstance } from 'axios';

interface TechnicalVerificationResponse {
  success: boolean;
  data?: {
    verificationId: string;
    userId: string;
    sessionId: string;
    browser: any;
    permissions: any;
    devices: any;
    networkTest: any;
    microphoneTest: any;
    cameraTest: any;
    audioTest: any;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    canProceed: boolean;
    createdAt: string;
    updatedAt: string;
  };
  message?: string;
}

interface NetworkTestResult {
  latency: number;
  downloadSpeed: number;
  uploadSpeed: number;
  jitter: number;
  packetLoss: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface MicrophoneTestResult {
  hasPermission: boolean;
  isWorking: boolean;
  level: number;
  sampleRate: number;
  channelCount: number;
}

interface CameraTestResult {
  hasPermission: boolean;
  isWorking: boolean;
  resolution: { width: number; height: number };
  frameRate: number;
}

class SessionManagerTechnicalService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    // VITE_SESSION_MANAGER_URL already includes /api/v1, so only append /technical
    this.baseURL = import.meta.env.VITE_SESSION_MANAGER_URL || 'http://localhost:80/api/v1';

    this.api = axios.create({
      baseURL: `${this.baseURL}/technical`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para agregar token de autenticación
    this.api.interceptors.request.use(
      async (config) => {
        const token = await authSDK.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Inicializar verificación técnica para una sesión
   */
  async initializeVerification(sessionId: string): Promise<string> {
    try {
      // Obtener userId del token actual
      const user = authSDK.getCurrentUser();
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      const response = await this.api.post<TechnicalVerificationResponse>('/init', {
        sessionId,
        userId: user.id
      });

      if (response.data.success && response.data.data) {
        return response.data.data.verificationId;
      } else {
        throw new Error(response.data.message || 'Error inicializando verificación técnica');
      }
    } catch (error: any) {
      console.error('Error inicializando verificación técnica:', error);
      throw new Error(error.response?.data?.message || 'Error de conexión al inicializar verificación');
    }
  }

  /**
   * Obtener estado de verificación técnica
   */
  async getVerificationStatus(verificationId: string): Promise<TechnicalVerificationResponse['data']> {
    try {
      const response = await this.api.get<TechnicalVerificationResponse>(`/${verificationId}`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Error obteniendo estado de verificación');
      }
    } catch (error: any) {
      console.error('Error obteniendo estado de verificación:', error);
      throw new Error(error.response?.data?.message || 'Error de conexión al obtener verificación');
    }
  }

  /**
   * Realizar test de conectividad de red
   */
  async performNetworkTest(verificationId: string): Promise<NetworkTestResult> {
    try {
      const startTime = performance.now();
      
      // Test básico usando el endpoint de health del session-manager
      const testUrls = [
        `${this.baseURL}/health`,
        `${import.meta.env.VITE_EXAM_SERVICE_URL || 'http://localhost:3003'}/health`,
        `${import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:3002'}/health`
      ];

      let totalLatency = 0;
      let successfulTests = 0;

      for (const url of testUrls) {
        try {
          const testStart = performance.now();
          await fetch(url, { method: 'HEAD', cache: 'no-cache' });
          const testEnd = performance.now();
          totalLatency += (testEnd - testStart);
          successfulTests++;
        } catch (error) {
          console.warn(`Network test failed for ${url}:`, error);
        }
      }

      const avgLatency = successfulTests > 0 ? totalLatency / successfulTests : 1000;
      
      // Estimar calidad basada en latencia
      let quality: NetworkTestResult['quality'] = 'poor';
      if (avgLatency < 100 && successfulTests >= 2) quality = 'excellent';
      else if (avgLatency < 300 && successfulTests >= 1) quality = 'good';
      else if (avgLatency < 600) quality = 'fair';

      const networkResult: NetworkTestResult = {
        latency: Math.round(avgLatency),
        downloadSpeed: 5, // Placeholder
        uploadSpeed: 1,   // Placeholder
        jitter: Math.round(avgLatency * 0.1),
        packetLoss: successfulTests < testUrls.length ? 10 : 0,
        quality
      };

      // Enviar resultado al backend
      const response = await this.api.post<TechnicalVerificationResponse>(
        `/${verificationId}/network-test`, 
        networkResult
      );

      if (!response.data.success) {
        console.warn('Backend network test update failed:', response.data.message);
      }

      return networkResult;
    } catch (error: any) {
      console.error('Error realizando test de red:', error);
      throw new Error('Error realizando test de conectividad de red');
    }
  }

  /**
   * Realizar test de micrófono
   */
  async performMicrophoneTest(verificationId: string): Promise<MicrophoneTestResult> {
    try {
      let micResult: MicrophoneTestResult = {
        hasPermission: false,
        isWorking: false,
        level: 0,
        sampleRate: 0,
        channelCount: 0
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micResult.hasPermission = true;

        // Analizar nivel de audio
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        
        microphone.connect(analyser);
        analyser.fftSize = 256;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Medir nivel por 2 segundos
        let maxLevel = 0;
        const measurementTime = 2000;
        const measurementStart = Date.now();

        return new Promise((resolve) => {
          const measureLevel = () => {
            analyser.getByteFrequencyData(dataArray);
            const currentLevel = Math.max(...dataArray) / 255;
            maxLevel = Math.max(maxLevel, currentLevel);

            if (Date.now() - measurementStart < measurementTime) {
              requestAnimationFrame(measureLevel);
            } else {
              // Limpiar recursos
              stream.getTracks().forEach(track => track.stop());
              audioContext.close();

              micResult.isWorking = maxLevel > 0.01; // Umbral mínimo de detección
              micResult.level = maxLevel;
              micResult.sampleRate = audioContext.sampleRate;
              micResult.channelCount = stream.getAudioTracks()[0]?.getSettings()?.channelCount || 1;

              // Enviar resultado al backend
              this.api.post(`/${verificationId}/microphone-test`, micResult)
                .catch(error => console.warn('Backend microphone test update failed:', error));

              resolve(micResult);
            }
          };

          measureLevel();
        });

      } catch (error) {
        console.warn('Microphone access denied or failed:', error);
        micResult.hasPermission = false;
      }

      // Enviar resultado al backend
      await this.api.post(`/${verificationId}/microphone-test`, micResult)
        .catch(error => console.warn('Backend microphone test update failed:', error));

      return micResult;
    } catch (error: any) {
      console.error('Error realizando test de micrófono:', error);
      throw new Error('Error realizando test de micrófono');
    }
  }

  /**
   * Realizar test de cámara
   */
  async performCameraTest(verificationId: string): Promise<CameraTestResult> {
    try {
      let cameraResult: CameraTestResult = {
        hasPermission: false,
        isWorking: false,
        resolution: { width: 0, height: 0 },
        frameRate: 0
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();

        cameraResult.hasPermission = true;
        cameraResult.isWorking = true;
        cameraResult.resolution = {
          width: settings.width || 640,
          height: settings.height || 480
        };
        cameraResult.frameRate = settings.frameRate || 30;

        // Limpiar recursos
        stream.getTracks().forEach(track => track.stop());

      } catch (error) {
        console.warn('Camera access denied or failed:', error);
        cameraResult.hasPermission = false;
      }

      // Enviar resultado al backend
      await this.api.post(`/${verificationId}/camera-test`, cameraResult)
        .catch(error => console.warn('Backend camera test update failed:', error));

      return cameraResult;
    } catch (error: any) {
      console.error('Error realizando test de cámara:', error);
      throw new Error('Error realizando test de cámara');
    }
  }

  /**
   * Verificar si el usuario puede proceder con el examen
   */
  async canUserProceed(userId: string): Promise<boolean> {
    try {
      const response = await this.api.get<{success: boolean; canProceed: boolean}>(`/user/${userId}/can-proceed`);
      return response.data.success ? response.data.canProceed : false;
    } catch (error) {
      console.warn('Error verificando si puede proceder:', error);
      return false;
    }
  }

  /**
   * Finalizar verificación técnica
   */
  async finalizeVerification(verificationId: string): Promise<boolean> {
    try {
      const response = await this.api.post<TechnicalVerificationResponse>(`/${verificationId}/finalize`);
      return response.data.success || false;
    } catch (error) {
      console.warn('Error finalizando verificación:', error);
      return false;
    }
  }
}

export const sessionManagerTechnicalService = new SessionManagerTechnicalService();
export default sessionManagerTechnicalService;