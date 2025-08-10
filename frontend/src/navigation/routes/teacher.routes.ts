import type { RouteType } from '../types/RouteTypes';
import { Home, Users, BookOpen, BarChart, Calendar, Settings } from "lucide-react";

// Placeholder components - implementar cuando sea necesario
const TeacherDashboard = () => <div>Teacher Dashboard - Por implementar</div>;
const TeacherStudents = () => <div>Teacher Students - Por implementar</div>;
const TeacherExams = () => <div>Teacher Exams - Por implementar</div>;
const TeacherAnalytics = () => <div>Teacher Analytics - Por implementar</div>;
const TeacherSchedule = () => <div>Teacher Schedule - Por implementar</div>;
const TeacherSettings = () => <div>Teacher Settings - Por implementar</div>;

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
    path: "/teacher/exams",
    name: "Gestión de Exámenes",
    type: "protected",
    element: TeacherExams,
    role: ["teacher"],
    icon: BookOpen,
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
