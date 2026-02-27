import type { RouteType } from '../types/RouteTypes';
import { Home, Monitor, Users, FileText, AlertTriangle, Settings } from "lucide-react";

// Placeholder components - implementar cuando sea necesario
const ProctorDashboard = () => null;
const ProctorMonitor = () => null;
const ProctorSessions = () => null;
const ProctorReports = () => null;
const ProctorIncidents = () => null;
const ProctorSettings = () => null;

export const proctorRoutes: RouteType[] = [
  {
    path: "/proctor/dashboard",
    name: "Panel Supervisor",
    type: "protected",
    element: ProctorDashboard,
    role: ["proctor"],
    icon: Home,
    isDefault: true,
    isAdmin: false
  },
  {
    path: "/proctor/monitor",
    name: "Monitoreo en Vivo",
    type: "protected",
    element: ProctorMonitor,
    role: ["proctor"],
    icon: Monitor,
    isAdmin: false
  },
  {
    path: "/proctor/monitor/active",
    name: "Sesión Activa",
    type: "protected",
    element: ProctorMonitor,
    role: ["proctor"],
    icon: Monitor,
    hidden: true,
    isAdmin: false
  },
  {
    path: "/proctor/sessions",
    name: "Sesiones de Examen",
    type: "protected",
    element: ProctorSessions,
    role: ["proctor"],
    icon: Users,
    isAdmin: false
  },
  {
    path: "/proctor/reports",
    name: "Reportes",
    type: "protected",
    element: ProctorReports,
    role: ["proctor"],
    icon: FileText,
    isAdmin: false
  },
  {
    path: "/proctor/incidents",
    name: "Incidentes",
    type: "protected",
    element: ProctorIncidents,
    role: ["proctor"],
    icon: AlertTriangle,
    isAdmin: false
  },
  {
    path: "/proctor/settings",
    name: "Configuración",
    type: "protected",
    element: ProctorSettings,
    role: ["proctor"],
    icon: Settings,
    isAdmin: false
  }
];
