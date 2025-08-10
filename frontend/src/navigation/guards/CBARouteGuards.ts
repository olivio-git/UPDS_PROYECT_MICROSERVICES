import { UserRole } from '../types/RouteTypes';

export class CBARouteGuards {
  
  // Guard: Verificar si hay un examen activo
  static checkActiveExamSession(userRole: UserRole, targetPath: string): boolean {
    if (userRole === 'student') {
      const activeExam = sessionStorage.getItem('cba_active_exam');
      if (activeExam && !targetPath.includes('/student/exam/')) {
        console.warn('Navegación bloqueada: Examen en curso');
        return false;
      }
    }
    return true;
  }

  // Guard: Verificar proctoring activo
  static checkActiveProctoring(userRole: UserRole, targetPath: string): boolean {
    if (userRole === 'proctor') {
      const activeProctoring = sessionStorage.getItem('cba_active_proctoring');
      if (activeProctoring && !targetPath.includes('/proctor/monitor/')) {
        console.warn('Navegación bloqueada: Sesión de monitoreo activa');
        return false;
      }
    }
    return true;
  }

  // Guard: Verificar configuración de audio para exámenes
  static checkAudioSetup(userRole: UserRole, targetPath: string): boolean {
    if (userRole === 'student' && targetPath.includes('/exam/')) {
      const audioSetup = sessionStorage.getItem('cba_audio_verified');
      if (!audioSetup) {
        console.warn('Navegación bloqueada: Configuración de audio requerida');
        return false;
      }
    }
    return true;
  }

  // Guard: Verificar horario académico
  static checkAcademicSession(): boolean {
    const currentHour = new Date().getHours();
    const isAcademicHours = currentHour >= 7 && currentHour <= 22;
    
    if (!isAcademicHours) {
      console.warn('Fuera de horario académico (7:00 AM - 10:00 PM)');
      return false;
    }
    return true;
  }

  // Guard: Verificar identidad del candidato
  static checkCandidateVerification(userRole: UserRole, targetPath: string): boolean {
    if (userRole === 'student' && targetPath.includes('/exam/')) {
      const isVerified = sessionStorage.getItem('cba_candidate_verified');
      if (!isVerified) {
        console.warn('Navegación bloqueada: Verificación de identidad requerida');
        return false;
      }
    }
    return true;
  }

  // Guard: Verificar nivel de acceso según el examen
  static checkExamLevelAccess(userRole: UserRole, targetPath: string): boolean {
    if (userRole === 'student' && targetPath.includes('/exam/')) {
      // Lógica específica para verificar nivel de acceso al examen
      // Ejemplo: estudiante de nivel B1 no puede acceder a examen C2
      const userLevel = sessionStorage.getItem('cba_user_level');
      const examLevel = sessionStorage.getItem('cba_exam_level');
      
      if (userLevel && examLevel) {
        // Implementar lógica de niveles MCER
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        const userLevelIndex = levels.indexOf(userLevel);
        const examLevelIndex = levels.indexOf(examLevel);
        
        // Solo permitir exámenes del mismo nivel o uno superior
        if (userLevelIndex < examLevelIndex - 1) {
          console.warn('Navegación bloqueada: Nivel de examen muy alto para el usuario');
          return false;
        }
      }
    }
    return true;
  }

  // Ejecutar todos los guards
  static checkAllGuards(userRole: UserRole, targetPath: string): {
    allowed: boolean;
    reason?: string;
    redirectTo?: string;
  } {
    // Guard 1: Examen activo
    if (!this.checkActiveExamSession(userRole, targetPath)) {
      return {
        allowed: false,
        reason: 'Tienes un examen en curso. Complétalo antes de navegar.',
        redirectTo: '/student/exam/active'
      };
    }

    // Guard 2: Proctoring activo
    if (!this.checkActiveProctoring(userRole, targetPath)) {
      return {
        allowed: false,
        reason: 'Tienes una sesión de monitoreo activa.',
        redirectTo: '/proctor/monitor/active'
      };
    }

    // Guard 3: Audio setup para exámenes
    if (!this.checkAudioSetup(userRole, targetPath)) {
      return {
        allowed: false,
        reason: 'Configura tu audio antes de iniciar el examen.',
        redirectTo: '/student/audio-setup'
      };
    }

    // Guard 4: Verificación de candidato
    if (!this.checkCandidateVerification(userRole, targetPath)) {
      return {
        allowed: false,
        reason: 'Verifica tu identidad antes de acceder al examen.',
        redirectTo: '/student/verification'
      };
    }

    // Guard 5: Nivel de examen
    if (!this.checkExamLevelAccess(userRole, targetPath)) {
      return {
        allowed: false,
        reason: 'No tienes el nivel requerido para este examen.',
        redirectTo: '/student/dashboard'
      };
    }

    // Guard 6: Horario académico (solo para exámenes)
    if (targetPath.includes('/exam/') && !this.checkAcademicSession()) {
      return {
        allowed: false,
        reason: 'Los exámenes solo están disponibles de 7:00 AM a 10:00 PM.',
        redirectTo: '/student/dashboard'
      };
    }

    return { allowed: true };
  }
}
