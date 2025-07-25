import type React from "react";

export default interface RouteType {
    path: string;
    element?:  React.ComponentType<any>;
    name: string;
    type: "public" | "protected";
    icon?: any;
    exact?: boolean;
    children?: RouteType[]; 
    isAdmin?: boolean;
    role?: "admin" | "user" | "guest" | "all"; // Define roles if needed
}