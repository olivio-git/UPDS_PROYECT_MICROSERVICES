import { authSDK } from "@/services/sdk-simple-auth";
import axios from "axios";

export interface TechnicalCheck {
  name: string;
  status: 'pending' | 'checking' | 'success' | 'warning' | 'error';
  message: string;
  required: boolean;
  value?: any;
  timestamp?: string;
}

export interface TechnicalVerificationData {
  candidateId: string;
  sessionId?: string;
  examId: string;
  checks: TechnicalCheck[];
  browser: {
    userAgent: string;
    language: string;
    platform: string;
    cookieEnabled: boolean;
    onLine: boolean;
  };
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
  };
  connection: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
  permissions: {
    microphone: 'granted' | 'denied' | 'prompt';
    camera: 'granted' | 'denied' | 'prompt';
  };
  audio: {
    inputDevices: MediaDeviceInfo[];
    outputDevices: MediaDeviceInfo[];
    sampleRate?: number;
  };
  verificationStarted: string;
  verificationCompleted?: string;
  overallStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
}

class TechnicalVerificationService {
  private verificationData: TechnicalVerificationData | null = null;

  /**
   * Inicializa una nueva verificación técnica
   */
  async initializeVerification(examId: string, candidateId: string): Promise<TechnicalVerificationData> {
    this.verificationData = {
      candidateId,
      examId,
      checks: this.getInitialChecks(),
      browser: this.getBrowserInfo(),
      screen: this.getScreenInfo(),
      connection: await this.getConnectionInfo(),
      permissions: {
        microphone: 'prompt',
        camera: 'prompt'
      },
      audio: {
        inputDevices: [],
        outputDevices: []
      },
      verificationStarted: new Date().toISOString(),
      overallStatus: 'pending'
    };

    return this.verificationData;
  }

  async technicalVerificationExists(___: string): Promise<boolean> {
    try {
      const candidateId = await this.getCandidateId();
      const response = await axios.get(`${import.meta.env.VITE_USER_MANAGEMENT_URL}/api/v1/candidates/${candidateId}/technical-exist`,{
        headers: {
          Authorization: `Bearer ${authSDK.getAccessToken()}`
        }
      });
      if(!response.data.success) return false; 
      return true;
    } catch (error) {
      // console.error("Error checking verification existence:", error);
      return false;
    }
  }

  /**
   * Actualiza el estado de una verificación específica
   */
  updateCheck(checkName: string, status: TechnicalCheck['status'], message: string, value?: any) {
    if (!this.verificationData) return;

    this.verificationData.checks = this.verificationData.checks.map(check => 
      check.name === checkName 
        ? { ...check, status, message, value, timestamp: new Date().toISOString() }
        : check
    );

    this.updateOverallStatus();
  }

  /**
   * Obtiene datos del navegador
   */
  private getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    };
  }

  /**
   * Obtiene información de la pantalla
   */
  private getScreenInfo() {
    return {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    };
  }

  /**
   * Obtiene información de conexión
   */
  private async getConnectionInfo() {
    const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
    
    return {
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt
    };
  }

  /**
   * Verificaciones iniciales
   */
  private getInitialChecks(): TechnicalCheck[] {
    return [
      {
        name: "Conexión a Internet",
        status: 'pending',
        message: "Verificando velocidad de conexión...",
        required: true
      },
      {
        name: "Navegador Compatible",
        status: 'pending',
        message: "Verificando compatibilidad...",
        required: true
      },
      {
        name: "Resolución de Pantalla",
        status: 'pending',
        message: "Verificando resolución...",
        required: true
      },
      {
        name: "Micrófono",
        status: 'pending',
        message: "Esperando permisos...",
        required: true
      },
      {
        name: "Auriculares/Altavoces",
        status: 'pending',
        message: "Esperando prueba de audio...",
        required: true
      },
      {
        name: "Cámara Web",
        status: 'pending',
        message: "Esperando permisos...",
        required: false
      }
    ];
  }

  /**
   * Actualiza el estado general
   */
  private updateOverallStatus() {
    if (!this.verificationData) return;

    const requiredChecks = this.verificationData.checks.filter(check => check.required);
    const completedChecks = requiredChecks.filter(check => 
      check.status === 'success' || check.status === 'warning'
    );
    const failedChecks = requiredChecks.filter(check => check.status === 'error');
    const inProgressChecks = requiredChecks.filter(check => check.status === 'checking');

    if (failedChecks.length > 0) {
      this.verificationData.overallStatus = 'failed';
    } else if (completedChecks.length === requiredChecks.length) {
      this.verificationData.overallStatus = 'completed';
      this.verificationData.verificationCompleted = new Date().toISOString();
    } else if (inProgressChecks.length > 0) {
      this.verificationData.overallStatus = 'in-progress';
    }
  }

  /**
   * Verifica compatibilidad del navegador
   */
  async checkBrowserCompatibility(): Promise<boolean> {
    const isCompatible = Boolean(
      navigator.mediaDevices &&
      (window.AudioContext || (window as any).webkitAudioContext)
    );
    
    const message = isCompatible 
      ? "Navegador compatible detectado"
      : "Navegador no compatible. Use Chrome, Firefox o Safari.";
    
    this.updateCheck("Navegador Compatible", isCompatible ? 'success' : 'error', message);
    return isCompatible;
  }

  /**
   * Verifica la resolución de pantalla
   */
  async checkScreenResolution(): Promise<boolean> {
    const minWidth = 1024;
    const minHeight = 768;
    
    const { width, height } = this.verificationData?.screen || { width: 0, height: 0 };
    const isValid = width >= minWidth && height >= minHeight;
    
    const message = isValid 
      ? `Resolución adecuada: ${width}x${height}`
      : `Resolución insuficiente: ${width}x${height}. Mínimo requerido: ${minWidth}x${minHeight}`;
    
    this.updateCheck("Resolución de Pantalla", isValid ? 'success' : 'warning', message, { width, height });
    return isValid;
  }

  /**
   * Verifica la conexión a internet
   */
  async checkInternetConnection(): Promise<boolean> {
    const connection = this.verificationData?.connection;
    let quality = 'excellent';
    let message = "Conexión excelente (>10 Mbps)";
    let status: TechnicalCheck['status'] = 'success';
    
    if (!navigator.onLine) {
      quality = 'offline';
      message = "Sin conexión a Internet. Verifica tu red.";
      status = 'error';
    } else if (connection?.downlink) {
      if (connection.downlink < 0.3) {
        quality = 'very-poor';
        message = "Conexión extremadamente lenta (<0.3 Mbps). No se puede continuar.";
        status = 'error';
      } else if (connection.downlink < 1) {
        quality = 'poor';
        message = "Conexión lenta (<1 Mbps). Considera mejorar tu conexión.";
        status = 'warning';
      } else if (connection.downlink < 5) {
        quality = 'fair';
        message = "Conexión moderada (1-5 Mbps). Funcional pero no óptima.";
        status = 'warning';
      } else if (connection.downlink < 10) {
        quality = 'good';
        message = "Buena conexión (5-10 Mbps)";
        status = 'success';
      }
    } else {
      message = "Conexión detectada (velocidad no disponible)";
      status = 'success';
    }
    
    this.updateCheck("Conexión a Internet", status, message, { quality, speed: connection?.downlink });
    return status !== 'error';
  }

  /**
   * Solicita permisos de micrófono
   */
  async requestMicrophonePermission(): Promise<boolean> {
    try {
      this.updateCheck("Micrófono", 'checking', "Solicitando permisos...");
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (this.verificationData) {
        this.verificationData.permissions.microphone = 'granted';
      }
      
      // Obtener información de dispositivos de audio
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputDevices = devices.filter(device => device.kind === 'audioinput');
      
      if (this.verificationData) {
        this.verificationData.audio.inputDevices = inputDevices;
      }
      
      this.updateCheck("Micrófono", 'success', `Micrófono detectado: ${inputDevices[0]?.label || 'Dispositivo de audio'}`, {
        deviceCount: inputDevices.length,
        primaryDevice: inputDevices[0]?.label
      });
      
      // Limpiar el stream
      stream.getTracks().forEach(track => track.stop());
      return true;
      
    } catch (error) {
      if (this.verificationData) {
        this.verificationData.permissions.microphone = 'denied';
      }
      this.updateCheck("Micrófono", 'error', "No se pudo acceder al micrófono. Verifica los permisos.");
      return false;
    }
  }

  /**
   * Solicita permisos de cámara
   */
  async requestCameraPermission(): Promise<boolean> {
    try {
      this.updateCheck("Cámara Web", 'checking', "Solicitando permisos...");
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      if (this.verificationData) {
        this.verificationData.permissions.camera = 'granted';
      }
      
      this.updateCheck("Cámara Web", 'success', "Cámara detectada y funcionando");
      
      // Limpiar el stream
      stream.getTracks().forEach(track => track.stop());
      return true;
      
    } catch (error) {
      if (this.verificationData) {
        this.verificationData.permissions.camera = 'denied';
      }
      this.updateCheck("Cámara Web", 'warning', "Cámara no disponible (opcional para este examen)");
      return false;
    }
  }

  /**
   * Confirma el test de audio
   */
  confirmAudioTest(success: boolean) {
    const message = success 
      ? "Audio funcionando correctamente"
      : "Problema con la reproducción de audio. Verifica tus auriculares.";
    
    this.updateCheck("Auriculares/Altavoces", success ? 'success' : 'error', message);
  }

  /**
   * Obtiene el estado actual de verificación
   */
  getVerificationState(): TechnicalVerificationData | null {
    return this.verificationData;
  }

  /**
   * Verifica si se puede proceder con el examen
   */
  canProceedWithExam(): boolean {
    if (!this.verificationData) return false;
    console.log(this.verificationData," ============================= ");
    const requiredChecks = this.verificationData.checks.filter(check => check.required);
    return requiredChecks.every(check => check.status === 'success' || check.status === 'warning');
  }

  /**
   * Envía los datos de verificación al backend
   */
  async getCandidateId(): Promise<string | null> {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_USER_MANAGEMENT_URL}/api/v1/candidates/by-auth-user/${authSDK.getCurrentUser()?.id}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSDK.getAccessToken()}`
        }
      });
      return data.data._id || null;
    } catch (error) {
      console.error('Error obteniendo ID de candidato:', error);
      return null;
    }
  }

  async submitVerificationToBackend(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.verificationData) {
        throw new Error('No hay datos de verificación para enviar');
      }

      // TODO: Implementar cuando tengamos el endpoint específico
      // Por ahora, simularemos el envío al technicalSetup del candidato
      
      const {data} = await axios.get(`${import.meta.env.VITE_USER_MANAGEMENT_URL}/api/v1/candidates/by-auth-user/${authSDK.getCurrentUser()?.id}`,{
        headers:{
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSDK.getAccessToken()}`
        }
      });
      if(!data.data._id) throw new Error('No se encontró el candidato asociado al usuario autenticado');

      const payload = {
        candidateId: data.data._id,
        examId: this.verificationData.examId,
        technicalSetup: {
          verificationData: this.verificationData,
          lastUpdated: new Date().toISOString(),
          status: this.verificationData.overallStatus
        }
      };
      
      // Simular llamada al backend (implementar cuando esté disponible)
      await axios.put(`${import.meta.env.VITE_USER_MANAGEMENT_URL}/api/v1/candidates/${payload.candidateId}/technical-setup`, payload,{
        headers:{
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSDK.getAccessToken()}`
        }
      });
      return {
        success: true,
        message: 'Verificación técnica guardada exitosamente'
      };
      
    } catch (error) {
      console.error('Error enviando verificación técnica:', error);
      return {
        success: false,
        message: 'Error al guardar la verificación técnica'
      };
    }
  }

  /**
   * Genera un tono de audio para testing
   */
  generateTestTone(frequency: number = 440, duration: number = 2): AudioBuffer | null {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      const sampleRate = audioContext.sampleRate;
      const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
      }
      
      return buffer;
    } catch (error) {
      console.error('Error generando tono de prueba:', error);
      return null;
    }
  }

  /**
   * Reproduce un tono de prueba
   */
  async playTestTone(frequency: number = 440, duration: number = 2): Promise<boolean> {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + duration - 0.1);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
      
      return true;
    } catch (error) {
      console.error('Error reproduciendo tono de prueba:', error);
      return false;
    }
  }

  /**
   * Analiza el nivel de audio del micrófono
   */
  async analyzeMicrophoneLevel(): Promise<{ level: number; isWorking: boolean }> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      source.connect(analyser);
      analyser.fftSize = 256;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      return new Promise((resolve) => {
        let maxLevel = 0;
        let samples = 0;
        const sampleCount = 30; // 30 muestras (aproximadamente 1 segundo)
        
        const checkLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          maxLevel = Math.max(maxLevel, average);
          samples++;
          
          if (samples < sampleCount) {
            requestAnimationFrame(checkLevel);
          } else {
            stream.getTracks().forEach(track => track.stop());
            audioContext.close();
            
            const normalizedLevel = maxLevel / 255;
            const isWorking = normalizedLevel > 0.01; // Threshold mínimo
            
            resolve({ level: normalizedLevel, isWorking });
          }
        };
        
        checkLevel();
      });
    } catch (error) {
      console.error('Error analizando nivel de micrófono:', error);
      return { level: 0, isWorking: false };
    }
  }
}

export const technicalVerificationService = new TechnicalVerificationService();
