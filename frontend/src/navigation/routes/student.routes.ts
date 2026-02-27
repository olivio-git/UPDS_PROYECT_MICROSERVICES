// import {
//   ExamPreparation,
//   ExamRunner,
//   StudentDashboard,
//   StudentExams,
//   StudentProfile,
//   StudentResults
// } from "@/modules/student/screens";
// import {
//   BookOpen,
//   FileText,
//   Monitor,
//   PanelBottom,
//   Trophy,
//   User
// } from "lucide-react";
// import type RouteType from '../RouteType';

// export const studentRoutes: RouteType[] = [
//   {
//     path: "/student/dashboard",
//     name: "Panel",
//     type: "protected",
//     element: StudentDashboard,
//     role: ["student"],
//     icon: PanelBottom,
//     isAdmin: false
//   },
//   {
//     path: "/student/exams",
//     name: "Mis Exámenes",
//     type: "protected",
//     element: StudentExams,
//     role: ["student"],
//     icon: BookOpen,
//     isAdmin: false
//   },
//   {
//     path: "/student/exam/:examId/preparation",
//     name: "Preparación",
//     type: "protected",
//     element: ExamPreparation,
//     role: ["student"],
//     icon: Monitor,
//     hidden: true,
//     isAdmin: false
//   },
//   {
//     path: "/student/exam/:sessionId/run",
//     name: "Tomar Examen",
//     type: "protected",
//     element: ExamRunner,
//     role: ["student"],
//     icon: Monitor,
//     hidden: true,
//     isAdmin: false
//   },
//   {
//     path: "/student/results",
//     name: "Resultados",
//     type: "protected",
//     element: StudentResults,
//     role: ["student"],
//     icon: Trophy,
//     isAdmin: false
//   },
//   {
//     path: "/student/results/:resultId",
//     name: "Detalle",
//     type: "protected",
//     element: StudentResults,
//     role: ["student"],
//     icon: FileText,
//     hidden: true,
//     isAdmin: false
//   },
//   {
//     path: "/student/profile",
//     name: "Perfil",
//     type: "protected",
//     element: StudentProfile,
//     role: ["student"],
//     icon: User,
//     isAdmin: false
//   }
// ];
