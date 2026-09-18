import { lazyRoute } from "./lazyRoute";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  // Palette,
  // Zap,
  FileText,
  Home,
  Monitor,
  PanelBottom,
  Settings,
  Activity,
  Shield,
  Trophy,
  User,
  Users
} from "lucide-react";
import type RouteType from "./RouteType";

// Each screen is its own chunk, fetched on first navigation to its route.
const DashboardScreen = lazyRoute(() => import("@/modules/dashboard/screens/DashboardScreen"));
const AdaptiveExamRunner = lazyRoute(() => import("@/modules/student/screens/AdaptiveExamRunner"));
const TestingScreen = lazyRoute(() => import("@/modules/testing/screens/TestingScreen"));
const ExamRunnerHTTP = lazyRoute(() => import("@/modules/student/screens/ExamRunnerHTTP"));
const UsersScreen = lazyRoute(() => import("@/modules/users/screens/UserScreen"));
const AuditLogsScreen = lazyRoute(() => import("@/modules/admin/screens/AuditLogsScreen"));
const ReportsScreen = lazyRoute(() => import("@/modules/admin/screens/ReportsScreen"));
const StudentHistoryScreen = lazyRoute(() => import("@/modules/admin/screens/StudentHistoryScreen"));
const UpcomingSessionsScreen = lazyRoute(() => import("@/modules/admin/screens/UpcomingSessionsScreen"));
const SessionsList = lazyRoute(() => import("@/modules/exams/components/SessionsList"));
const SessionMonitorScreen = lazyRoute(() => import("@/modules/exams/screens/SessionMonitorScreen"));
const AcademicConfigScreen = lazyRoute(() => import("@/modules/exams/screens/AcademicConfigScreen"));
const ExamsScreen = lazyRoute(() => import("@/modules/exams/screens/ExamsScreen"));
const LevelsManagementScreen = lazyRoute(() => import("@/modules/exams/screens/LevelsManagementScreen"));
const QuestionsScreen = lazyRoute(() => import("@/modules/exams/screens/QuestionsScreen"));
const RubricsManagementScreen = lazyRoute(() => import("@/modules/exams/screens/RubricsManagementScreen"));
const ExamPreparation = lazyRoute(() => import("@/modules/student/screens/ExamPreparation"));
const StudentDashboard = lazyRoute(() => import("@/modules/student/screens/StudentDashboard"));
const StudentProfile = lazyRoute(() => import("@/modules/student/screens/StudentProfile"));
const StudentResults = lazyRoute(() => import("@/modules/student/screens/StudentResults"));

export const protectedRoutes: RouteType[] = [
  // Dashboard general (para todos los roles)
  {
    path: "/dashboard", //Pantalla de inicio sin funcionalidad logica
    name: "Inicio",
    type: "protected",
    element: DashboardScreen,
    isAdmin: false,
    role: ["admin",'teacher'],
    icon: Home,
    hidden: true
  },
  {
    path: "/student/dashboard", //Pantalla de inicio sin funcionalidad logica
    name: "Pannel",
    type: "protected",
    element: StudentDashboard,
    isAdmin: false,
    role: ["student"],
    icon: PanelBottom
  }, 
  {
    path: "/student/exam/:examId/preparation", //Pantalla de preparación de examen, es donde se hace la comprobacion tecnica
    name: "Preparación de Examen",
    type: "protected",
    element: ExamPreparation,
    isAdmin: false,
    role: ["student"],
    icon: Monitor,
    hidden: true // No mostrar en el menú
  },
  {
    path: "/student/exam/:sessionId", //Es la vista donde se toma el examen con HTTP requests (unificada)
    name: "Tomar Examen",
    type: "protected",
    element: ExamRunnerHTTP,
    role: ["student"],
    icon: Monitor,
    hidden: true,
    isAdmin: false
  },
  {
    path: "/student/exam/:sessionId/run", //Ruta legacy - redirige a la nueva
    name: "Tomar Examen (Legacy)",
    type: "protected",
    element: ExamRunnerHTTP,
    role: ["student"],
    icon: Monitor,
    hidden: true,
    isAdmin: false
  },
  {
    path: "/student/exam/:sessionId/adaptive", // Examen de nivelación adaptativo (CAT)
    name: "Examen Adaptativo",
    type: "protected",
    element: AdaptiveExamRunner,
    role: ["student"],
    icon: Monitor,
    hidden: true,
    isAdmin: false
  },
  {
    path: "/student/exam/:sessionId/individual", //Es la vista donde se toma el examen individual flexible
    name: "Examen Individual",
    type: "protected",
    element: ExamRunnerHTTP, // Ahora usa la versión HTTP
    role: ["student"],
    icon: Monitor,
    hidden: true,
    isAdmin: false
  },
  // ❌ LOBBY ELIMINADO - Acceso directo al examen
  {
    path: "/student/results", //Sin funcionalidades integradas con backend ya que aun no hay resultados ni integracion ni implementacion de backend(API) para correcciones
    name: "Mis Resultados",
    type: "protected",
    element: StudentResults,
    isAdmin: false,
    role: ["student"],
    icon: Trophy
  },
  {
    path: "/student/results/:resultId", //Pantalla de detalle de resultado sin integracion con logica backend aun
    name: "Detalle de Resultado",
    type: "protected",
    element: StudentResults,
    isAdmin: false,
    role: ["student"],
    icon: FileText,
    hidden: true // No mostrar en el menú
  },
  {
    path: "/student/profile", //Vista donde se ve el perfil de estudiante
    name: "Mi Perfil",
    type: "protected",
    element: StudentProfile,
    isAdmin: false,
    role: ["student"],
    icon: User
  },
  
  // Rutas de administración
  {
    path: "/testing",
    name: "Diagnóstico del Sistema",
    type: "protected",
    element: TestingScreen,
    isAdmin: true,
    role: ["admin"],
    icon: Activity
  },
  {
    path: "/academic-config", //Lista y gestion de configuracion academica
    name: "Configuración Académica",
    type: "protected",
    element: AcademicConfigScreen,
    isAdmin: false,
    role: ["admin", "teacher"],
    icon: Settings,
  },
  {
    path: "/users", //Lista y gestion de usuarios
    name: "Usuarios",
    type: "protected",
    element: UsersScreen,
    isAdmin: true,
    role: ["admin"],
    icon: Users
  },
  {
    path: "/levels", //Lista y gestion de niveles
    name: "Niveles MCER",
    type: "protected",
    element: LevelsManagementScreen,
    isAdmin: false,
    role: ["admin", "teacher"],
    icon: BarChart3,
    hidden: true
  },
  {
    path: "/rubrics", //Lista y gestion de niveles
    name: "Rúbricas",
    type: "protected",
    element: RubricsManagementScreen,
    isAdmin: false,
    role: ["admin", "teacher"],
    icon: Trophy,
    hidden: true
  },
  {
    path: "/questions", //Lista y gestion de preguntas
    name: "Preguntas",
    type: "protected",
    element: QuestionsScreen,
    isAdmin: false,
    role: ["admin", "teacher"],
    icon: ClipboardList,
    hidden: true,
  },
  {
    path: "/exams", //Lista de examenes y gestion de los mismos
    name: "Exámenes",
    type: "protected",
    element: ExamsScreen,
    isAdmin: false,
    role: ["admin", "teacher"],
    icon: BookOpen,
    hidden: true
  },
  {
    path: "/sessions/:sessionId/monitor",
    name: "Monitor de Sesión",
    type: "protected",
    element: SessionMonitorScreen,
    isAdmin: false,
    role: ["admin", "teacher", "proctor"],
    icon: Monitor,
    hidden: true
  },
  {
    path: "/sessions", //Lista y visualizacion de las sessiones en tabla y tambien gestion de las mismas
    name: "Sesiones",  //Aqui se hara la implementacion de sockets tambien para controlar eventos
    type: "protected", //Es posible que aqui se implemente la funcionalidad de poder gestionar mediante una nueva ventana las sessiones de manera individual y detallada
    element: SessionsList, //Aqui se deberia de implementar o acabar de implementar al formulario de creacion las configuraciones nuevas de tipo de sesion etc etc.
    isAdmin: false,
    role: ["admin","proctor","teacher"],
    icon: BookOpen
  },
  // {
  //   path: "/system/monitoring", //Dashboard de monitoreo de memoria y sistema
  //   name: "Monitoreo del Sistema",
  //   type: "protected",
  //   element: SystemMonitoringScreen,
  //   isAdmin: true,
  //   role: ["admin"],
  //   icon: Monitor
  // }, 
  {
    path: "/teacher/profile", //Vista del perfil de profesor
    name: "Perfil",
    type: "protected",
    element: StudentProfile,
    isAdmin: false,
    role: ["teacher"],
    icon: User
  },
  {
    path: "/reports", //Vista de reportes y análisis académico
    name: "Reportes",
    type: "protected",
    element: ReportsScreen,
    isAdmin: false,
    role: ["admin", "teacher"],
    icon: FileText
  },
  {
    path: "/audit-logs",
    name: "Auditoría",
    type: "protected",
    element: AuditLogsScreen,
    isAdmin: true,
    role: ["admin"],
    icon: Shield
  },
  {
    path: "/upcoming-sessions", //Vista de próximas programaciones
    name: "Próximas Sesiones",
    type: "protected",
    element: UpcomingSessionsScreen,
    isAdmin: false,
    role: ["admin", "teacher", "proctor"],
    icon: ClipboardList
  },
  {
    path: "/student-history",
    name: "Historial Estudiante",
    type: "protected",
    element: StudentHistoryScreen,
    isAdmin: false,
    role: ["admin", "teacher"],
    icon: User,
  },
  {
    path: "/student-history/:studentId",
    name: "Historial Específico",
    type: "protected",
    element: StudentHistoryScreen,
    isAdmin: false,
    role: ["admin", "teacher", "student"],
    icon: User,
    hidden: true
  },
]
