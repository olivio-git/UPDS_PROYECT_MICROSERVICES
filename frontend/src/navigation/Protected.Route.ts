import type RouteType from "./RouteType";
import { Home, Users, Settings, TestTube } from "lucide-react";
import DashboardScreen from "@/modules/dashboard/screens/DashboardScreen";
import TestingScreen from "@/modules/testing/screens/TestingScreen";

export const protectedRoutes: RouteType[] = [
  {
    path: "/dashboard",
    name: "Dashboard",
    type: "protected",
    element: DashboardScreen,
    isAdmin: false,
    role: "all",
    icon: Home
  },
  {
    path: "/testing",
    name: "Panel de Testing",
    type: "protected", 
    element: TestingScreen,
    isAdmin: true,
    role: "admin",
    icon: TestTube
  },
  // Aquí se pueden agregar más rutas protegidas según el rol
  // {
  //   path: "/admin",
  //   name: "Admin Panel",
  //   type: "protected", 
  //   element: AdminScreen,
  //   isAdmin: true,
  //   role: "admin",
  //   icon: Settings
  // },
  // {
  //   path: "/users",
  //   name: "Users",
  //   type: "protected",
  //   element: UsersScreen,
  //   isAdmin: false,
  //   role: "teacher",
  //   icon: Users
  // }
]