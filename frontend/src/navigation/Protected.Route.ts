import type RouteType from "./RouteType";
import { 
  Home, 
  Users, 
  TestTube, 
  BookOpen, 
  // Palette, 
  // Zap,
  FileText,
  Trophy,
  User,
  Monitor, 
  PanelBottom
} from "lucide-react";
import DashboardScreen from "@/modules/dashboard/screens/DashboardScreen";
import TestingScreen from "@/modules/testing/screens/TestingScreen";
// import GradientShowcaseScreen from "@/modules/examples/GradientShowcaseScreen";
// import GradientTestScreen from "@/modules/testing/screens/GradientTestScreen";

// Student Screens
import {
  StudentDashboard,
  StudentExams,
  StudentResults,
  StudentProfile,
  ExamPreparation
} from "@/modules/student/screens";
import UsersScreen from "@/modules/users/screens/UserScreen";

export const protectedRoutes: RouteType[] = [
  // Dashboard general (para todos los roles)
  {
    path: "/dashboard",
    name: "Inicio",
    type: "protected",
    element: DashboardScreen,
    isAdmin: false,
    role: ["all"],
    icon: Home,
    hidden: true
  },
  
  // Rutas específicas para estudiantes
  {
    path: "/student/dashboard",
    name: "Pannel",
    type: "protected",
    element: StudentDashboard,
    isAdmin: false,
    role: ["student"],
    icon: PanelBottom
  },
  {
    path: "/student/exams",
    name: "Mis Exámenes",
    type: "protected",
    element: StudentExams,
    isAdmin: false,
    role: ["student"],
    icon: BookOpen
  },
  {
    path: "/student/exam/:examId/preparation",
    name: "Preparación de Examen",
    type: "protected",
    element: ExamPreparation,
    isAdmin: false,
    role: ["student"],
    icon: Monitor,
    hidden: true // No mostrar en el menú
  },
  {
    path: "/student/results",
    name: "Mis Resultados",
    type: "protected",
    element: StudentResults,
    isAdmin: false,
    role: ["student"],
    icon: Trophy
  },
  {
    path: "/student/results/:resultId",
    name: "Detalle de Resultado",
    type: "protected",
    element: StudentResults,
    isAdmin: false,
    role: ["student"],
    icon: FileText,
    hidden: true // No mostrar en el menú
  },
  {
    path: "/student/profile",
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
    name: "Testing",
    type: "protected",
    element: TestingScreen,
    isAdmin: true,
    role: ["admin"],
    icon: TestTube
  },
  // {
  //   path: "/gradient-test",
  //   name: "Test Gradientes",
  //   type: "protected",
  //   element: GradientTestScreen,
  //   isAdmin: true,
  //   role: ["admin"],
  //   icon: Zap
  // },
  {
    path: "/users",
    name: "Usuarios",
    type: "protected",
    element: UsersScreen,
    isAdmin: true,
    role: ["admin"],
    icon: Users
  },
  {
    path: "/create-exam",
    name: "Crear Examen",
    type: "protected",
    element: TestingScreen,
    isAdmin: true,
    role: ["admin"],
    icon: BookOpen
  },
  // {
  //   path: "/showcase",
  //   name: "Showcase",
  //   type: "protected",
  //   element: GradientShowcaseScreen,
  //   isAdmin: true,
  //   role: ["admin"],
  //   icon: Palette
  // },
]
