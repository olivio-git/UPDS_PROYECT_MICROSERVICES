import LoginScreen from "@/modules/auth/screens/LoginScreen";
import OtpInitialScreen from "@/modules/auth/screens/OtpInitialScreen";
import type RouteType from "./RouteType";
import { LogIn, Mail, Shield } from "lucide-react"
import OtpVerificator from "@/modules/auth/screens/Otp-Verification";

export const publicRoutes: RouteType[] = [
  {
    path: "/",
    name: "OTP Verification",
    type: "public",
    element: OtpInitialScreen,
    isAdmin: false,
    role: ["all"],
    icon: Shield
  },
  {
    path: "/login",
    name: "Login",
    type: "public",
    element: LoginScreen,
    isAdmin: false,
    role: ["all"],
    icon: LogIn
  },
  {
    path: "/otp-verification",
    name: "OTP Verification",
    type: "public",
    element: OtpVerificator,
    isAdmin: false,
    role: ["all"],
    icon: Mail
  },
];