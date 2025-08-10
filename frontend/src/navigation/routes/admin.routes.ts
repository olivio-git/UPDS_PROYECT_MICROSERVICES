import type RouteType from '../RouteType';
import { Home, Users, TestTube, BookOpen, Palette, Zap } from "lucide-react";
import DashboardScreen from "@/modules/dashboard/screens/DashboardScreen";
import TestingScreen from "@/modules/testing/screens/TestingScreen";
import GradientShowcaseScreen from "@/modules/examples/GradientShowcaseScreen";
import GradientTestScreen from "@/modules/testing/screens/GradientTestScreen";

export const adminRoutes: RouteType[] = [
  {
    path: "/dashboard",
    name: "Dashboard",
    type: "protected",
    element: DashboardScreen,
    role: ["admin","student","teacher"],
    icon: Home,
    isAdmin: false
  },
  {
    path: "/users",
    name: "Usuarios",
    type: "protected",
    element: TestingScreen,
    role: ["admin"],
    icon: Users,
    isAdmin: true
  },
  {
    path: "/testing",
    name: "Testing",
    type: "protected",
    element: TestingScreen,
    role: ["admin"],
    icon: TestTube,
    isAdmin: true
  },
  {
    path: "/create-exam",
    name: "Crear Examen",
    type: "protected",
    element: TestingScreen,
    role: ["admin"],
    icon: BookOpen,
    isAdmin: true
  },
  {
    path: "/showcase",
    name: "Showcase",
    type: "protected",
    element: GradientShowcaseScreen,
    role: ["admin"],
    icon: Palette,
    isAdmin: true
  },
  {
    path: "/gradient-test",
    name: "Test Gradientes",
    type: "protected",
    element: GradientTestScreen,
    role: ["admin"],
    icon: Zap,
    isAdmin: true
  }
];
