import {
  Activity, Award, BarChart3, BookOpen, CalendarClock, ClipboardList, FileText, Home,
  HelpCircle, Layers, ListChecks, Shield, User, Users, type LucideIcon,
} from 'lucide-react';

export type AppRole = 'admin' | 'teacher' | 'proctor' | 'student';

export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles: AppRole[];
  /** Shown as a tooltip and in the command palette. */
  hint?: string;
}

export interface MenuGroup {
  /** Undefined renders the items without a group heading. */
  label?: string;
  items: MenuItem[];
}

/**
 * The navigation is grouped by what a person is trying to DO, not by which
 * table the data lives in. Before this, question and exam authoring had no menu
 * entry at all: they were reachable only through a card inside "Configuración
 * Académica", which reads like settings, so nobody found them.
 */
export const MENU: MenuGroup[] = [
  {
    items: [
      { path: '/dashboard', label: 'Inicio', icon: Home, roles: ['admin', 'teacher'] },
      { path: '/student/dashboard', label: 'Inicio', icon: Home, roles: ['student'] },
    ],
  },
  {
    label: 'Diseñar',
    items: [
      { path: '/questions', label: 'Preguntas', icon: HelpCircle, roles: ['admin', 'teacher'], hint: 'Banco de preguntas: audio, texto e imagen' },
      { path: '/exams', label: 'Exámenes', icon: BookOpen, roles: ['admin', 'teacher'], hint: 'Armar exámenes a partir del banco' },
      { path: '/levels', label: 'Niveles MCER', icon: Layers, roles: ['admin', 'teacher'] },
      { path: '/rubrics', label: 'Rúbricas', icon: Award, roles: ['admin', 'teacher'] },
    ],
  },
  {
    label: 'Operar',
    items: [
      { path: '/sessions', label: 'Sesiones', icon: ClipboardList, roles: ['admin', 'teacher', 'proctor'], hint: 'Programar y controlar sesiones de examen' },
      { path: '/upcoming-sessions', label: 'Calendario', icon: CalendarClock, roles: ['admin', 'teacher', 'proctor'] },
    ],
  },
  {
    label: 'Analizar',
    items: [
      { path: '/reports', label: 'Reportes', icon: BarChart3, roles: ['admin', 'teacher'] },
      { path: '/student-history', label: 'Historial de estudiante', icon: FileText, roles: ['admin', 'teacher'] },
      { path: '/audit-logs', label: 'Auditoría', icon: Shield, roles: ['admin'] },
    ],
  },
  {
    label: 'Mi examen',
    items: [
      { path: '/student/results', label: 'Mis resultados', icon: ListChecks, roles: ['student'] },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { path: '/users', label: 'Usuarios', icon: Users, roles: ['admin'] },
      { path: '/testing', label: 'Diagnóstico', icon: Activity, roles: ['admin'] },
    ],
  },
  {
    items: [
      { path: '/teacher/profile', label: 'Mi perfil', icon: User, roles: ['teacher'] },
      { path: '/student/profile', label: 'Mi perfil', icon: User, roles: ['student'] },
    ],
  },
];

/** Groups with at least one item this role can open. */
export function menuForRole(role: string | undefined): MenuGroup[] {
  if (!role) return [];
  return MENU
    .map((group) => ({ ...group, items: group.items.filter((i) => i.roles.includes(role as AppRole)) }))
    .filter((group) => group.items.length > 0);
}

/** Longest matching path, so /sessions/123/monitor still highlights "Sesiones". */
export function activePath(pathname: string, groups: MenuGroup[]): string | undefined {
  const paths = groups.flatMap((g) => g.items.map((i) => i.path));
  return paths
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** Where each role lands after signing in. */
export const HOME_BY_ROLE: Record<string, string> = {
  admin: '/dashboard',
  teacher: '/sessions',
  proctor: '/sessions',
  student: '/student/dashboard',
};
