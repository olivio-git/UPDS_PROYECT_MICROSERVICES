// import type RouteType from '../RouteType';
// import { Home, Users, TestTube, BookOpen, Palette, Zap, HelpCircle, FileText, Settings, BarChart3, Award } from "lucide-react";
// import DashboardScreen from "@/modules/dashboard/screens/DashboardScreen";
// import TestingScreen from "@/modules/testing/screens/TestingScreen";
// import GradientShowcaseScreen from "@/modules/examples/GradientShowcaseScreen";
// import GradientTestScreen from "@/modules/testing/screens/GradientTestScreen";
// import QuestionsScreen from "@/modules/exams/screens/QuestionsScreen";
// import ExamsScreen from "@/modules/exams/screens/ExamsScreen";
// // Nuevas importaciones para configuración académica
// import AcademicConfigScreen from "@/modules/exams/screens/AcademicConfigScreen";
// import LevelsManagementScreen from "@/modules/exams/screens/LevelsManagementScreen";
// import RubricsManagementScreen from "@/modules/exams/screens/RubricsManagementScreen";

// export const adminRoutes: RouteType[] = [
//   {
//     path: "/dashboard",
//     name: "Dashboard",
//     type: "protected",
//     element: DashboardScreen,
//     role: ["admin","student","teacher"],
//     icon: Home,
//     isAdmin: false
//   },
//   {
//     path: "/users",
//     name: "Usuarios",
//     type: "protected",
//     element: TestingScreen,
//     role: ["admin"],
//     icon: Users,
//     isAdmin: true
//   },
//   {
//     path: "/questions",
//     name: "Gestión de Preguntas",
//     type: "protected",
//     element: QuestionsScreen,
//     role: ["admin", "teacher"],
//     icon: HelpCircle,
//     isAdmin: false
//   },
//   {
//     path: "/exams",
//     name: "Gestión de Exámenes", 
//     type: "protected",
//     element: ExamsScreen,
//     role: ["admin", "teacher"],
//     icon: BookOpen,
//     isAdmin: false
//   },
//   {
//     path: "/academic-config",
//     name: "Configuración Académica",
//     type: "protected",
//     element: AcademicConfigScreen,
//     role: ["admin", "teacher"],
//     icon: Settings,
//     isAdmin: false
//   },
//   {
//     path: "/levels",
//     name: "Niveles MCER",
//     type: "protected",
//     element: LevelsManagementScreen,
//     role: ["admin", "teacher"],
//     icon: BarChart3,
//     isAdmin: false
//   },
//   {
//     path: "/rubrics",
//     name: "Rúbricas",
//     type: "protected",
//     element: RubricsManagementScreen,
//     role: ["admin", "teacher"],
//     icon: Award,
//     isAdmin: false
//   },
//   {
//     path: "/testing",
//     name: "Testing",
//     type: "protected",
//     element: TestingScreen,
//     role: ["admin"],
//     icon: TestTube,
//     isAdmin: true
//   },
//   {
//     path: "/showcase",
//     name: "Showcase",
//     type: "protected",
//     element: GradientShowcaseScreen,
//     role: ["admin"],
//     icon: Palette,
//     isAdmin: true
//   },
//   {
//     path: "/gradient-test",
//     name: "Test Gradientes",
//     type: "protected",
//     element: GradientTestScreen,
//     role: ["admin"],
//     icon: Zap,
//     isAdmin: true
//   }
// ];