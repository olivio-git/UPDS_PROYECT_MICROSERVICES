import DashboardScreen from "@/modules/dashboard/screens/DashboardScreen";
import AdaptiveExamRunner from "@/modules/student/screens/AdaptiveExamRunner";
import TestingScreen from "@/modules/testing/screens/TestingScreen";
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
  TestTube,
  Trophy,
  User,
  Users
} from "lucide-react";
import type RouteType from "./RouteType";
// import GradientShowcaseScreen from "@/modules/examples/GradientShowcaseScreen";
// import GradientTestScreen from "@/modules/testing/screens/GradientTestScreen";

// Student Screens
import {
  ExamPreparation,
  StudentDashboard,
  StudentProfile,
  StudentResults
} from "@/modules/student/screens";
import ExamRunnerHTTP from "@/modules/student/screens/ExamRunnerHTTP";
import UsersScreen from "@/modules/users/screens/UserScreen";

// Exams Module
// import ExamsModule from "@/modules/exams/pages/ExamsModule";
import ReportsScreen from "@/modules/admin/screens/ReportsScreen";
import UpcomingSessionsScreen from "@/modules/admin/screens/UpcomingSessionsScreen";
import SessionsList from "@/modules/exams/components/SessionsList";
import SessionMonitorScreen from "@/modules/exams/screens/SessionMonitorScreen";
import AcademicConfigScreen from "@/modules/exams/screens/AcademicConfigScreen";
import ExamsScreen from "@/modules/exams/screens/ExamsScreen";
import LevelsManagementScreen from "@/modules/exams/screens/LevelsManagementScreen";
import QuestionsScreen from "@/modules/exams/screens/QuestionsScreen";
import RubricsManagementScreen from "@/modules/exams/screens/RubricsManagementScreen";

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
  // Admin Dashboard
  // {
  //   path: "/admin/dashboard",
  //   name: "Panel de Administración",
  //   type: "protected", 
  //   element: AdminDashboard,
  //   isAdmin: true,
  //   role: ["admin"],
  //   icon: PanelBottom
  // },
  //===TEACHER DASHBOARD
  {
    path: "/teacher/dashboard", //Pantalla de inicio sin funcionalidad logica
    name: "Pannel",
    type: "protected",
    element: DashboardScreen,
    isAdmin: false,
    role: ["teacher"],
    icon: PanelBottom
  },
  //===PROCTOR DASHBOARD

  {
    path: "/proctor/dashboard", //Pantalla de inicio sin funcionalidad logica
    name: "Pannel",
    type: "protected",
    element: DashboardScreen,
    isAdmin: false,
    role: ["proctor"],
    icon: PanelBottom
  },
  // Rutas específicas para estudiantes
  /// ===== Aqui empieza el flujo de estudiante para dar examen
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
    path: "/testing", //Pantalla simple donde se pueden probar o testear algunos microservicios
    name: "Testing",
    type: "protected",
    element: TestingScreen,
    isAdmin: true,
    role: ["admin"],
    icon: TestTube
  },
  {
    path: "/academic-config", //Lista y gestion de configuracion academica
    name: "Configuración Académica",
    type: "protected",
    element: AcademicConfigScreen,
    isAdmin: true,
    role: ["admin"],
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
    isAdmin: true,
    role: ["admin"],
    icon: BarChart3,
    hidden: true
  },
  {
    path: "/rubrics", //Lista y gestion de niveles
    name: "Rúbricas",
    type: "protected",
    element: RubricsManagementScreen,
    isAdmin: true,
    role: ["admin"],
    icon: Trophy,
    hidden: true
  },
  {
    path: "/questions", //Lista y gestion de preguntas
    name: "Preguntas",
    type: "protected",
    element: QuestionsScreen,
    isAdmin: true,
    role: ["admin", "teacher"],
    icon: ClipboardList,
    hidden: true,
  },
  {
    path: "/exams", //Lista de examenes y gestion de los mismos
    name: "Exámenes",
    type: "protected",
    element: ExamsScreen,
    isAdmin: true,
    role: ["admin"],
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
    path: "/upcoming-sessions", //Vista de próximas programaciones
    name: "Próximas Sesiones",
    type: "protected",
    element: UpcomingSessionsScreen,
    isAdmin: false,
    role: ["admin", "teacher", "proctor"],
    icon: ClipboardList
  },
  // {
  //   path: "/student-history", //Vista de historial de estudiante
  //   name: "Historial Estudiante",
  //   type: "protected",
  //   element: StudentHistoryScreen,
  //   isAdmin: false,
  //   role: ["admin", "teacher"],
  //   icon: User
  // },
  // {
  //   path: "/student-history/:studentId", //Vista específica de historial con ID
  //   name: "Historial Específico",
  //   type: "protected",
  //   element: StudentHistoryScreen,
  //   isAdmin: false,
  //   role: ["admin", "teacher", "student"],
  //   icon: User,
  //   hidden: true
  // },
]
