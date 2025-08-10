import type React from "react";

export type UserRole = "admin" | "student" | "teacher" | "proctor" | "guest";
export type RouteRole = UserRole | "all";

export interface RouteType {
  path: string;
  element?: React.ComponentType<any>;
  name: string;
  type: "public" | "protected";
  icon?: any;
  exact?: boolean;
  children?: RouteType[];
  role?: RouteRole[];
  hidden?: boolean;
  priority?: number;
  description?: string;
  isDefault?: boolean;
  // Mantener compatibilidad con estructura actual
  isAdmin?: boolean;
}

export interface RouteConfig {
  routes: RouteType[];
  defaultPath: string;
  fallbackPath: string;
}
