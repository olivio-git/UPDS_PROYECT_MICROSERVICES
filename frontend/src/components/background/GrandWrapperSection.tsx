import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GradientWrapperProps {
  children: ReactNode;
  /** @deprecated Decorative props from the old coloured-glow look; ignored. */
  variant?: 'spiral' | 'radial' | 'conic' | 'linear' | 'aurora' | 'sunset' | 'ocean' | 'cosmic';
  /** @deprecated Ignored. */
  intensity?: 'low' | 'medium' | 'high';
  /** @deprecated Ignored. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** @deprecated Ignored. */
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  /** @deprecated Ignored. */
  animate?: boolean;
}

/**
 * Used to paint a coloured blurred blob behind its children. The app is now
 * neutral (one accent, no coloured gradients); the only background light is
 * the subtle dark-mode glow on `.app-canvas` in index.css. Kept as a plain
 * wrapper so existing call sites keep their layout.
 */
const GradientWrapper = ({ children, className }: GradientWrapperProps) => (
  <div className={cn('relative', className)}>{children}</div>
);

export default GradientWrapper;
