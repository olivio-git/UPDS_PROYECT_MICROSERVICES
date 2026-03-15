import Redis from 'ioredis';
import { UserManagementIntegration } from '../integrations/user-management.integration';
import { logger } from '../utils/logger';

export interface TechnicalVerificationData {
  userId: string;
  sessionId: string;
  verificationId: string;
  timestamp: number;
  expiresAt: number;
  browserInfo: {
    userAgent: string;
    platform: string;
    language: string;
    cookieEnabled: boolean;
    javaEnabled: boolean;
  };
  systemInfo: {
    screen: { width: number; height: number; colorDepth: number };
    timezone: string;
    onlineStatus: boolean;
  };
  permissions: {
    microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
    camera: 'granted' | 'denied' | 'prompt' | 'unknown';
    notifications: 'granted' | 'denied' | 'default';
  };
  devices: {
    audioInputs: { deviceId: string; label: string }[];
    videoInputs: { deviceId: string; label: string }[];
    audioOutputs: { deviceId: string; label: string }[];
  };
  networkInfo?: {
    downlink?: number;
    effectiveType?: string;
    rtt?: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
  };
  verification: {
    browserCompatible: boolean;
    screenResolution: boolean;
    internetConnection: boolean;
    microphoneWorking: boolean;
    cameraWorking: boolean;
    audioWorking: boolean;
  };
  scores: {
    overall: number;
    stability: number;
    compatibility: number;
  };
}

export interface TechnicalCheckResult {
  success: boolean;
  level: 'pass' | 'warning' | 'fail';
  message: string;
  data?: any;
}

export class TechnicalVerificationService {
  private redis: Redis;
  private readonly VERIFICATION_TTL = 3600 * 24; // 24 horas
  private readonly VERIFICATION_PREFIX = 'tech_verify:';
  private readonly USER_VERIFICATION_PREFIX = 'user_tech:';
  private userManagementIntegration: UserManagementIntegration;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      // retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('✅ Conectado a Redis para verificación técnica');
    });

    this.userManagementIntegration = new UserManagementIntegration();
  }

  /**
   * Inicializar nueva verificación técnica
   */
  async initializeVerification(sessionId: string, userId: string): Promise<string> {
    const verificationId = `${sessionId}_${userId}_${Date.now()}`;
    const now = Date.now();
    
    const initialData: Partial<TechnicalVerificationData> = {
      userId,
      sessionId,
      verificationId,
      timestamp: now,
      expiresAt: now + (this.VERIFICATION_TTL * 1000),
      verification: {
        browserCompatible: false,
        screenResolution: false,
        internetConnection: false,
        microphoneWorking: false,
        cameraWorking: false,
        audioWorking: false,
      },
      scores: {
        overall: 0,
        stability: 0,
        compatibility: 0,
      }
    };

    await this.redis.setex(
      `${this.VERIFICATION_PREFIX}${verificationId}`,
      this.VERIFICATION_TTL,
      JSON.stringify(initialData)
    );

    // Índice por usuario para búsqueda rápida
    await this.redis.setex(
      `${this.USER_VERIFICATION_PREFIX}${userId}`,
      this.VERIFICATION_TTL,
      verificationId
    );

    logger.info(`📋 Verificación técnica iniciada: ${verificationId} para usuario ${userId}`);
    return verificationId;
  }

  /**
   * Obtener datos de verificación
   */
  async getVerification(verificationId: string): Promise<TechnicalVerificationData | null> {
    try {
      const data = await this.redis.get(`${this.VERIFICATION_PREFIX}${verificationId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error obteniendo verificación:', error);
      return null;
    }
  }

  /**
   * Obtener verificación activa por usuario
   */
  async getActiveVerificationByUser(candidateId: string, token?: string): Promise<any | null> {
    try {

      const technicalSetup = await this.userManagementIntegration.getTechnicalVerification(candidateId, token!);
      console.log(technicalSetup,' <------- RESPONSE technicalSetup =====')
      return {
        canProceed:true,
        status: technicalSetup
      }
    } catch (error) {
      logger.error('Error obteniendo verificación activa:', error);
      return null;
    }
  }

  /**
   * Actualizar datos del navegador y sistema
   */
  async updateBrowserInfo(verificationId: string, browserInfo: any, systemInfo: any): Promise<TechnicalCheckResult> {
    try {
      const verification = await this.getVerification(verificationId);
      if (!verification) {
        return { success: false, level: 'fail', message: 'Verificación no encontrada' };
      }

      verification.browserInfo = browserInfo;
      verification.systemInfo = systemInfo;

      // Verificar compatibilidad del navegador
      const isCompatible = this.checkBrowserCompatibility(browserInfo);
      verification.verification.browserCompatible = isCompatible;

      // Verificar resolución de pantalla
      const screenOk = systemInfo.screen.width >= 1024 && systemInfo.screen.height >= 768;
      verification.verification.screenResolution = screenOk;

      await this.saveVerification(verification);

      return {
        success: true,
        level: isCompatible && screenOk ? 'pass' : 'warning',
        message: `Navegador: ${isCompatible ? 'Compatible' : 'Incompatible'}, Pantalla: ${screenOk ? 'OK' : 'Muy pequeña'}`,
        data: { browserCompatible: isCompatible, screenOk }
      };
    } catch (error) {
      logger.error('Error actualizando info del navegador:', error);
      return { success: false, level: 'fail', message: 'Error interno' };
    }
  }

  /**
   * Actualizar permisos del dispositivo
   */
  async updatePermissions(verificationId: string, permissions: any): Promise<TechnicalCheckResult> {
    try {
      const verification = await this.getVerification(verificationId);
      if (!verification) {
        return { success: false, level: 'fail', message: 'Verificación no encontrada' };
      }

      verification.permissions = permissions;
      await this.saveVerification(verification);

      const micOk = permissions.microphone === 'granted';
      const camOk = permissions.camera === 'granted';

      return {
        success: true,
        level: micOk && camOk ? 'pass' : 'warning',
        message: `Micrófono: ${micOk ? 'Permitido' : 'Denegado'}, Cámara: ${camOk ? 'Permitida' : 'Denegada'}`,
        data: { micOk, camOk }
      };
    } catch (error) {
      logger.error('Error actualizando permisos:', error);
      return { success: false, level: 'fail', message: 'Error interno' };
    }
  }

  /**
   * Actualizar información de dispositivos disponibles
   */
  async updateDevices(verificationId: string, devices: any): Promise<TechnicalCheckResult> {
    try {
      const verification = await this.getVerification(verificationId);
      if (!verification) {
        return { success: false, level: 'fail', message: 'Verificación no encontrada' };
      }

      verification.devices = devices;
      await this.saveVerification(verification);

      const hasMic = devices.audioInputs?.length > 0;
      const hasCam = devices.videoInputs?.length > 0;
      const hasAudio = devices.audioOutputs?.length > 0;

      return {
        success: true,
        level: hasMic && hasCam && hasAudio ? 'pass' : 'warning',
        message: `Dispositivos - Mic: ${hasMic ? devices.audioInputs.length : 0}, Cám: ${hasCam ? devices.videoInputs.length : 0}, Audio: ${hasAudio ? devices.audioOutputs.length : 0}`,
        data: { hasMic, hasCam, hasAudio, devices }
      };
    } catch (error) {
      logger.error('Error actualizando dispositivos:', error);
      return { success: false, level: 'fail', message: 'Error interno' };
    }
  }

  /**
   * Probar conexión de red
   */
  async testNetworkConnection(verificationId: string): Promise<TechnicalCheckResult> {
    try {
      const verification = await this.getVerification(verificationId);
      if (!verification) {
        return { success: false, level: 'fail', message: 'Verificación no encontrada' };
      }

      // Simular prueba de red (en la implementación real, harías pruebas HTTP)
      const startTime = Date.now();
      
      // Simulación de test de latencia y velocidad
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
      
      const rtt = Date.now() - startTime;
      const simulatedDownlink = Math.random() * 10 + 5; // 5-15 Mbps simulado
      
      const quality: 'excellent' | 'good' | 'fair' | 'poor' = 
        simulatedDownlink > 10 ? 'excellent' :
        simulatedDownlink > 5 ? 'good' :
        simulatedDownlink > 2 ? 'fair' : 'poor';

      verification.networkInfo = {
        downlink: Math.round(simulatedDownlink * 10) / 10,
        effectiveType: quality === 'excellent' ? '4g' : quality === 'good' ? '3g' : '2g',
        rtt,
        quality
      };

      verification.verification.internetConnection = quality !== 'poor';
      await this.saveVerification(verification);

      return {
        success: true,
        level: quality === 'poor' ? 'warning' : 'pass',
        message: `Conexión ${quality === 'excellent' ? 'excelente' : quality === 'good' ? 'buena' : quality === 'fair' ? 'regular' : 'deficiente'} - ${simulatedDownlink} Mbps`,
        data: verification.networkInfo
      };
    } catch (error) {
      logger.error('Error probando conexión:', error);
      return { success: false, level: 'fail', message: 'Error de red' };
    }
  }

  /**
   * Verificar funcionamiento del micrófono
   */
  async verifyMicrophone(verificationId: string, audioLevel: number): Promise<TechnicalCheckResult> {
    try {
      const verification = await this.getVerification(verificationId);
      if (!verification) {
        return { success: false, level: 'fail', message: 'Verificación no encontrada' };
      }

      const isWorking = audioLevel > 0.1; // Nivel mínimo para considerar que funciona
      verification.verification.microphoneWorking = isWorking;
      await this.saveVerification(verification);

      return {
        success: true,
        level: isWorking ? 'pass' : 'warning',
        message: `Micrófono ${isWorking ? 'funcionando' : 'sin señal'} - Nivel: ${Math.round(audioLevel * 100)}%`,
        data: { audioLevel, isWorking }
      };
    } catch (error) {
      logger.error('Error verificando micrófono:', error);
      return { success: false, level: 'fail', message: 'Error interno' };
    }
  }

  /**
   * Verificar funcionamiento de la cámara
   */
  async verifyCamera(verificationId: string, hasVideo: boolean, resolution?: {width: number, height: number}): Promise<TechnicalCheckResult> {
    try {
      const verification = await this.getVerification(verificationId);
      if (!verification) {
        return { success: false, level: 'fail', message: 'Verificación no encontrada' };
      }

      verification.verification.cameraWorking = hasVideo;
      await this.saveVerification(verification);

      return {
        success: true,
        level: hasVideo ? 'pass' : 'warning',
        message: `Cámara ${hasVideo ? 'funcionando' : 'sin video'}${resolution ? ` - ${resolution.width}x${resolution.height}` : ''}`,
        data: { hasVideo, resolution }
      };
    } catch (error) {
      logger.error('Error verificando cámara:', error);
      return { success: false, level: 'fail', message: 'Error interno' };
    }
  }

  /**
   * Verificar funcionamiento del audio
   */
  async verifyAudio(verificationId: string, canHear: boolean): Promise<TechnicalCheckResult> {
    try {
      const verification = await this.getVerification(verificationId);
      if (!verification) {
        return { success: false, level: 'fail', message: 'Verificación no encontrada' };
      }

      verification.verification.audioWorking = canHear;
      await this.saveVerification(verification);

      return {
        success: true,
        level: canHear ? 'pass' : 'warning',
        message: `Audio ${canHear ? 'funcionando' : 'sin sonido'}`,
        data: { canHear }
      };
    } catch (error) {
      logger.error('Error verificando audio:', error);
      return { success: false, level: 'fail', message: 'Error interno' };
    }
  }

  /**
   * Calcular puntuación final de verificación
   */
  async calculateFinalScore(verificationId: string): Promise<TechnicalCheckResult> {
    try {
      const verification = await this.getVerification(verificationId);
      if (!verification) {
        return { success: false, level: 'fail', message: 'Verificación no encontrada' };
      }

      const v = verification.verification;
      
      // Puntuaciones por categoría (0-100)
      const compatibility = (
        (v.browserCompatible ? 50 : 0) +
        (v.screenResolution ? 50 : 0)
      );
      
      const stability = (
        (v.internetConnection ? 34 : 0) +
        (verification.networkInfo?.quality === 'excellent' ? 33 : 
         verification.networkInfo?.quality === 'good' ? 25 :
         verification.networkInfo?.quality === 'fair' ? 15 : 0) +
        (verification.systemInfo?.onlineStatus ? 33 : 0)
      );
      
      const devices = (
        (v.microphoneWorking ? 25 : 0) +
        (v.cameraWorking ? 25 : 0) +
        (v.audioWorking ? 25 : 0) +
        (verification.permissions?.microphone === 'granted' ? 8 : 0) +
        (verification.permissions?.camera === 'granted' ? 8 : 0) +
        (verification.devices?.audioInputs?.length > 0 ? 9 : 0)
      );

      const overall = Math.round((compatibility + stability + devices) / 3);

      verification.scores = {
        overall,
        compatibility,
        stability
      };

      await this.saveVerification(verification);

      const level: 'pass' | 'warning' | 'fail' = 
        overall >= 80 ? 'pass' : overall >= 60 ? 'warning' : 'fail';

      return {
        success: true,
        level,
        message: `Verificación completada - Puntuación: ${overall}/100`,
        data: {
          scores: verification.scores,
          canProceed: overall >= 60,
          recommendations: this.generateRecommendations(verification)
        }
      };
    } catch (error) {
      logger.error('Error calculando puntuación final:', error);
      return { success: false, level: 'fail', message: 'Error interno' };
    }
  }

  /**
   * Verificar si el usuario puede proceder con el examen
   */
  async canUserProceed(candidateId: string, token?: string): Promise<{ canProceed: boolean; reason?: string; verification?: TechnicalVerificationData }> {
    try {
      const verification = await this.getActiveVerificationByUser(candidateId, token);
      console.log(verification, ' <--- verification in canUserProceed==========');
      // if (!verification) {
      //   console.log(verification, ' <--- verification Not proceder=========='); 
      //   return { canProceed: false, reason: 'No se encontró verificación técnica' };
      // }

      // // Verificar si la verificación no ha expirado
      // if (Date.now() > verification.expiresAt) {
      //   console.log(verification, ' <--- verification si no ha expirado =========='); 
      //   return { canProceed: false, reason: 'La verificación técnica ha expirado', verification };
      // }

      // // Verificar requisitos mínimos
      // const v = verification.verification;
      // const score = verification.scores.overall;

      // if (score < 60) {
      //   console.log(verification, ' <--- verification tecnica minima =========='); 
      //   return { canProceed: false, reason: 'Puntuación insuficiente de verificación técnica', verification };
      // }

      // if (!v.browserCompatible) {
      //   console.log(verification, ' <--- verification browserCompatible ==========');
      //   return { canProceed: false, reason: 'Navegador no compatible', verification };
      // }

      // if (!v.microphoneWorking && !v.cameraWorking) {
      //   console.log(verification, ' <--- verification microphoneWorking & cameraWorking ==========');
      //   return { canProceed: false, reason: 'Micrófono y cámara no funcionan', verification };
      // }
      console.log(verification, ' <--- verification final ==========');
      return { canProceed: true, verification };
    } catch (error) {
      console.log(error, ' <--- error en canUserProceed==========');
      logger.error('Error verificando si puede proceder:', error);
      return { canProceed: false, reason: 'Error interno' };
    }
  }

  /**
   * Marcar verificación como utilizada
   */
  async markVerificationUsed(verificationId: string): Promise<void> {
    try {
      const verification = await this.getVerification(verificationId);
      if (verification) {
        verification.timestamp = Date.now(); // Actualizar timestamp de uso
        await this.saveVerification(verification);
        logger.info(`✅ Verificación marcada como utilizada: ${verificationId}`);
      }
    } catch (error) {
      logger.error('Error marcando verificación como utilizada:', error);
    }
  }

  /**
   * Limpiar verificaciones expiradas
   */
  async cleanupExpiredVerifications(): Promise<void> {
    // Este método sería llamado periódicamente por un cron job
    // Por simplicidad, Redis manejará la expiración automáticamente
    logger.info('🧹 Limpieza automática de verificaciones (TTL por Redis)');
  }

  // Métodos privados auxiliares

  private async saveVerification(verification: TechnicalVerificationData): Promise<void> {
    await this.redis.setex(
      `${this.VERIFICATION_PREFIX}${verification.verificationId}`,
      this.VERIFICATION_TTL,
      JSON.stringify(verification)
    );
  }

  private checkBrowserCompatibility(browserInfo: any): boolean {
    const ua = browserInfo.userAgent?.toLowerCase() || '';
    
    // Navegadores compatibles básicos
    const isChrome = ua.includes('chrome') && !ua.includes('edg');
    const isFirefox = ua.includes('firefox');
    const isEdge = ua.includes('edg');
    const isSafari = ua.includes('safari') && !ua.includes('chrome');
    
    return isChrome || isFirefox || isEdge || isSafari;
  }

  private generateRecommendations(verification: TechnicalVerificationData): string[] {
    const recommendations: string[] = [];
    const v = verification.verification;

    if (!v.browserCompatible) {
      recommendations.push('Usa Chrome, Firefox, Edge o Safari para mejor compatibilidad');
    }

    if (!v.screenResolution) {
      recommendations.push('Aumenta la resolución de pantalla a mínimo 1024x768');
    }

    if (!v.internetConnection) {
      recommendations.push('Verifica tu conexión a internet');
    }

    if (!v.microphoneWorking) {
      recommendations.push('Revisa la configuración y permisos del micrófono');
    }

    if (!v.cameraWorking) {
      recommendations.push('Revisa la configuración y permisos de la cámara');
    }

    if (!v.audioWorking) {
      recommendations.push('Verifica los auriculares o altavoces');
    }

    if (verification.networkInfo?.quality === 'poor') {
      recommendations.push('Mejora tu conexión a internet para una experiencia óptima');
    }

    return recommendations;
  }

  /**
   * Estadísticas de verificaciones
   */
  async getVerificationStats(): Promise<any> {
    // Implementar estadísticas si es necesario
    return {
      active: 0,
      completed: 0,
      failed: 0
    };
  }
}

export const technicalVerificationService = new TechnicalVerificationService();
