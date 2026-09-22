import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/modules/auth/services/authStore';
import { toast } from 'sonner';

type UserRole = 'admin' | 'teacher' | 'proctor' | 'student';

interface NavigationOptions {
  replace?: boolean;
  state?: any;
  showToast?: boolean;
  toastMessage?: string;
}

export const useNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // Default paths for each role
  const defaultPaths: Record<UserRole, string> = {
    admin: '/dashboard',
    teacher: '/sessions',
    proctor: '/sessions',
    student: '/student/dashboard'
  };

  // Navigation with role-based fallback
  const navigateWithFallback = (
    path: string, 
    options: NavigationOptions = {}
  ) => {
    const { replace = false, state, showToast = false, toastMessage } = options;
    
    try {
      navigate(path, { replace, state });
      
      if (showToast && toastMessage) {
        toast.success(toastMessage);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      toast.error('Error navegando a la página solicitada');
      
      // Fallback to default path for user's role
      if (user) {
        const defaultPath = defaultPaths[user.role as UserRole] || '/dashboard';
        navigate(defaultPath, { replace: true });
      }
    }
  };

  // Navigate to dashboard based on user role
  const navigateToDashboard = (options: NavigationOptions = {}) => {
    if (!user) {
      navigate('/auth/login', { replace: true });
      return;
    }

    const dashboardPath = defaultPaths[user.role as UserRole] || '/dashboard';
    navigateWithFallback(dashboardPath, options);
  };

  // Navigate to exam
  const navigateToExam = (sessionId: string, examType: 'group' | 'individual' = 'group') => {
    const basePath = examType === 'individual' 
      ? '/student/individual/exam'
      : '/student/exam';
    
    navigateWithFallback(`${basePath}/${sessionId}/run`, {
      showToast: true,
      toastMessage: 'Iniciando examen...'
    });
  };

  // Navigate to exam preparation
  const navigateToExamPreparation = (examId: string) => {
    navigateWithFallback(`/student/exam/${examId}/preparation`, {
      showToast: true,
      toastMessage: 'Preparando verificación técnica...'
    });
  };

  // Navigate to exam lobby
  const navigateToExamLobby = (sessionId: string) => {
    navigateWithFallback(`/student/exam/${sessionId}/lobby`, {
      showToast: true,
      toastMessage: 'Ingresando al lobby del examen...'
    });
  };

  // Navigate to results
  const navigateToResults = (sessionId?: string) => {
    const path = sessionId 
      ? `/student/results/${sessionId}`
      : '/student/results';
    
    navigateWithFallback(path, {
      replace: true,
      showToast: true,
      toastMessage: 'Cargando resultados...'
    });
  };

  // Navigate back with fallback
  const navigateBack = (fallbackPath?: string) => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (fallbackPath) {
      navigateWithFallback(fallbackPath);
    } else {
      navigateToDashboard();
    }
  };

  // Navigate to user profile
  const navigateToProfile = () => {
    if (!user) return;
    
    const profilePaths: Record<UserRole, string> = {
      admin: '/admin/profile',
      teacher: '/teacher/profile',
      proctor: '/proctor/profile', 
      student: '/student/profile'
    };

    const profilePath = profilePaths[user.role as UserRole];
    if (profilePath) {
      navigateWithFallback(profilePath);
    }
  };

  // Navigate to system monitoring (admin only)
  const navigateToSystemMonitoring = () => {
    if (user?.role !== 'admin') {
      toast.error('Solo los administradores pueden acceder al monitoreo del sistema');
      return;
    }

    navigateWithFallback('/system/monitoring', {
      showToast: true,
      toastMessage: 'Abriendo panel de monitoreo...'
    });
  };

  // Navigate to user management
  const navigateToUserManagement = () => {
    if (!['admin', 'teacher'].includes(user?.role || '')) {
      toast.error('No tienes permisos para acceder a la gestión de usuarios');
      return;
    }

    const path = user?.role === 'admin' ? '/admin/users' : '/teacher/users';
    navigateWithFallback(path);
  };

  // Navigate to exam management
  const navigateToExamManagement = () => {
    if (!['admin', 'teacher'].includes(user?.role || '')) {
      toast.error('No tienes permisos para acceder a la gestión de exámenes');
      return;
    }

    const path = user?.role === 'admin' ? '/admin/exams' : '/teacher/exams';
    navigateWithFallback(path);
  };

  // Get current route info
  const getCurrentRouteInfo = () => {
    return {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state,
      isExamRoute: location.pathname.includes('/exam/'),
      isAdminRoute: location.pathname.startsWith('/admin/'),
      isTeacherRoute: location.pathname.startsWith('/teacher/'),
      isStudentRoute: location.pathname.startsWith('/student/'),
      isProctorRoute: location.pathname.startsWith('/proctor/')
    };
  };

  // Check if navigation is allowed
  const canNavigateTo = (path: string): boolean => {
    if (!user) return false;

    // Admin can navigate anywhere
    if (user.role === 'admin') return true;

    // Check role-specific restrictions
    if (path.startsWith('/admin/') && user.role !== 'admin') return false;
    if (path.startsWith('/teacher/') && !['admin', 'teacher'].includes(user.role)) return false;
    if (path.startsWith('/proctor/') && !['admin', 'proctor'].includes(user.role)) return false;
    if (path.startsWith('/student/') && !['admin', 'student'].includes(user.role)) return false;

    return true;
  };

  // Navigate with role check
  const navigateWithRoleCheck = (path: string, options: NavigationOptions = {}) => {
    if (!canNavigateTo(path)) {
      toast.error('No tienes permisos para acceder a esta página');
      return;
    }

    navigateWithFallback(path, options);
  };

  return {
    // Basic navigation
    navigate: navigateWithFallback,
    navigateToDashboard,
    navigateBack,
    navigateToProfile,

    // Exam-related navigation
    navigateToExam,
    navigateToExamPreparation,
    navigateToExamLobby,
    navigateToResults,

    // Admin navigation
    navigateToSystemMonitoring,
    navigateToUserManagement,
    navigateToExamManagement,

    // Utilities
    getCurrentRouteInfo,
    canNavigateTo,
    navigateWithRoleCheck,
    
    // Raw navigate for advanced use cases
    rawNavigate: navigate,
    location
  };
};