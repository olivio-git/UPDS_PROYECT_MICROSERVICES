import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { AppShell } from './AppShell';

interface MainLayoutProps {
  children: ReactNode;
  /** Renders the page without the application frame (used by the exam runner). */
  hideHeader?: boolean;
  className?: string;
  /** @deprecated Decorative background props from the previous layout; ignored. */
  showGradient?: boolean;
  /** @deprecated Decorative background props from the previous layout; ignored. */
  gradientVariant?: string;
}

/**
 * Wrapper every screen uses. It delegates to AppShell so the frame is defined
 * in one place; screens only provide their content. The content wrapper is
 * `h-full` so a screen that wants to own the whole viewport (a full-height
 * grid, a two-pane layout) can just set `h-full` on its own root and rely on
 * this div — and AppShell's `<main>` above it — to actually give it that
 * height, instead of every screen re-deriving `min-h-screen` itself.
 */
const MainLayout = ({ children, hideHeader = false, className = '' }: MainLayoutProps) => {
  if (hideHeader) {
    return <div className={cn('h-dvh bg-background', className)}>{children}</div>;
  }
  return (
    <AppShell>
      <div className={cn('h-full', className)}>{children}</div>
    </AppShell>
  );
};

export default MainLayout;
