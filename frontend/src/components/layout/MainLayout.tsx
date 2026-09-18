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
 * in one place; screens only provide their content.
 */
const MainLayout = ({ children, hideHeader = false, className = '' }: MainLayoutProps) => {
  if (hideHeader) {
    return <div className={`min-h-screen bg-background ${className}`}>{children}</div>;
  }
  return (
    <AppShell>
      <div className={className}>{children}</div>
    </AppShell>
  );
};

export default MainLayout;
