import type React from "react"; 
import type { RouteRole } from "./types/RouteTypes";

export default interface RouteType {
    path: string;
    element?:  React.ComponentType<any>;
    name: string;
    type: "public" | "protected";
    icon?: any;
    exact?: boolean;
    children?: RouteType[]; 
    isAdmin?: boolean;
    role?: RouteRole[]; // Updated to use new types
    hidden?: boolean; // Para ocultar rutas del menú de navegación
    priority?: number;
    description?: string;
    isDefault?: boolean;
}