import type { RouteType } from '../types/RouteTypes';
import { Home, Users, BookOpen, BarChart, Calendar, Settings, HelpCircle } from "lucide-react";
import QuestionsScreen from "@/modules/exams/screens/QuestionsScreen";
import ExamsScreen from "@/modules/exams/screens/ExamsScreen";
import SessionsList from "@/modules/exams/components/SessionsList";

// Placeholder components - implementar cuando sea necesario
const TeacherDashboard = () => null;
const TeacherStudents = () => null;
const TeacherAnalytics = () => null;
const TeacherSchedule = () => null;
const TeacherSettings = () => null;

export const teacherRoutes: RouteType[] = [
  {
    path: "/teacher/dashboard",
    name: "Panel Docente",
    type: "protected",
    element: TeacherDashboard,
    role: ["teacher"],
    icon: Home,
    isDefault: true,
    isAdmin: false
  },
  {
    path: "/teacher/students",
    name: "Mis Estudiantes",
    type: "protected",
    element: TeacherStudents,
    role: ["teacher"],
    icon: Users,
    isAdmin: false
  },
  {
    path: "/teacher/questions",
    name: "Gestión de Preguntas",
    type: "protected",
    element: QuestionsScreen,
    role: ["teacher"],
    icon: HelpCircle,
    isAdmin: false
  },
  {
    path: "/teacher/exams",
    name: "Gestión de Exámenes",
    type: "protected",
    element: ExamsScreen,
    role: ["teacher"],
    icon: BookOpen,
    isAdmin: false
  },
  {
    path: "/sessions",
    name: "Mis Sesiones",
    type: "protected",
    element: SessionsList,
    role: ["teacher"],
    icon: Calendar,
    isAdmin: false
  },
  {
    path: "/teacher/analytics",
    name: "Análisis de Rendimiento",
    type: "protected",
    element: TeacherAnalytics,
    role: ["teacher"],
    icon: BarChart,
    isAdmin: false
  },
  {
    path: "/teacher/schedule",
    name: "Horarios",
    type: "protected",
    element: TeacherSchedule,
    role: ["teacher"],
    icon: Calendar,
    isAdmin: false
  },
  {
    path: "/teacher/settings",
    name: "Configuración",
    type: "protected",
    element: TeacherSettings,
    role: ["teacher"],
    icon: Settings,
    isAdmin: false
  }
];