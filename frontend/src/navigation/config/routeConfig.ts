import { UserRole } from '../types/RouteTypes';

/**
 * Configuración central del sistema de rutas CBA
 */
export const ROUTE_CONFIG = {
  // Claves de sessionStorage
  SESSION_KEYS: {
    LAST_ROUTE: 'cba_last_route',
    ACTIVE_EXAM: 'cba_active_exam',
    ACTIVE_PROCTORING: 'cba_active_proctoring',
    AUDIO_VERIFIED: 'cba_audio_verified',
    CANDIDATE_VERIFIED: 'cba_candidate_verified',
    USER_LEVEL: 'cba_user_level',
    EXAM_LEVEL: 'cba_exam_level'
  },

  // Rutas por defecto por rol
  DEFAULT_PATHS: {
    admin: '/dashboard',
    student: '/student/dashboard',
    teacher: '/teacher/dashboard',
    proctor: '/proctor/dashboard',
    guest: '/'
  } as Record<UserRole, string>,

  // Rutas públicas que no se guardan en sessionStorage
  EXCLUDED_ROUTES: [
    '/',
    '/login',
    '/otp-verification'
  ],

  // Horarios académicos (para guards)
  ACADEMIC_HOURS: {
    START: 7,  // 7:00 AM
    END: 22    // 10:00 PM
  },

  // Niveles MCER para validaciones
  MCER_LEVELS: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],

  // Configuración de roles
  ROLES: {
    ADMIN: 'admin',
    STUDENT: 'student', 
    TEACHER: 'teacher',
    PROCTOR: 'proctor',
    GUEST: 'guest'
  } as const,

  // Permisos especiales por rol
  ROLE_PERMISSIONS: {
    admin: ['*'], // Acceso total
    student: ['exam.take', 'result.view', 'profile.edit'],
    teacher: ['student.view', 'exam.create', 'result.review'],
    proctor: ['session.monitor', 'incident.report'],
    guest: ['login', 'register']
  },

  // Configuración de guards
  GUARDS: {
    ENABLE_EXAM_BLOCKING: true,
    ENABLE_PROCTORING_BLOCKING: true,
    ENABLE_AUDIO_VERIFICATION: true,
    ENABLE_ACADEMIC_HOURS: false, // Deshabilitado por defecto
    ENABLE_LEVEL_VERIFICATION: true
  }
};

/**
 * Utilidades de configuración
 */
export class RouteConfigUtils {
  
  static isRouteExcluded(path: string): boolean {
    return ROUTE_CONFIG.EXCLUDED_ROUTES.includes(path);
  }

  static getDefaultPathForRole(role: UserRole): string {
    return ROUTE_CONFIG.DEFAULT_PATHS[role] || ROUTE_CONFIG.DEFAULT_PATHS.guest;
  }

  static isWithinAcademicHours(): boolean {
    const currentHour = new Date().getHours();
    return currentHour >= ROUTE_CONFIG.ACADEMIC_HOURS.START && 
           currentHour <= ROUTE_CONFIG.ACADEMIC_HOURS.END;
  }

  static hasPermission(userRole: UserRole, permission: string): boolean {
    const rolePermissions = ROUTE_CONFIG.ROLE_PERMISSIONS[userRole] || [];
    return rolePermissions.includes('*') || rolePermissions.includes(permission);
  }

  static getMCERLevelIndex(level: string): number {
    return ROUTE_CONFIG.MCER_LEVELS.indexOf(level);
  }
}
