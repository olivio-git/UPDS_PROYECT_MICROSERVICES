/**
 * Primary CTA color for the auth flow, unified with the app's existing primary/CTA
 * convention (see the dashboard's "Entrar al Examen" button in
 * src/modules/student/components/NextExam.tsx) instead of the old brand-blue
 * (#09f / --color-brand-blue) that only appeared on these three screens.
 */
export const AUTH_PRIMARY_BUTTON_CLASS =
  'w-full font-medium text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:shadow-none';
