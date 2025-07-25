import LoginScreen from "@/modules/auth/screens/LoginScreen";
import type RouteType from "./RouteType";
import { LogIn, Mail } from "lucide-react"
import OtpVerificator from "@/modules/auth/screens/Otp-Verification";

export const publicRoutes: RouteType[] = [
  {
    path: "/",
    name: "Login",
    type: "public",
    element: LoginScreen,
    isAdmin: false,
    role: "guest",
    icon: LogIn
  },
  {
    path: "/login",
    name: "Login",
    type: "public",
    element: LoginScreen,
    isAdmin: false,
    role: "guest",
    icon: LogIn
  },
  {
    path: "/otp-verification",
    name: "OTP Verification",
    type: "public",
    element: OtpVerificator,
    isAdmin: false,
    role: "guest",
    icon: Mail
  },
];