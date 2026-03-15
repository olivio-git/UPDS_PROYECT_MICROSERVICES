import GradientBackground from './GradientBackground';
import type { GradientVariant, GradientPosition } from './GradientBackground';

interface GradientSectionProps {
  children: any;
  variant?: GradientVariant;
  position?: GradientPosition;
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
  decorativeObjects?: boolean;
}

// Componente para secciones hero
export const HeroGradientSection = ({ 
  children, 
  variant = 'primary', 
  intensity = 'high',
  className = '',
  decorativeObjects = true 
}: GradientSectionProps) => (
  <GradientBackground
    variant={variant}
    position="center"
    intensity={intensity}
    decorativeObjects={decorativeObjects}
    isSection={true}
    className={`min-h-screen flex items-center justify-center ${className}`}
  >
    {children}
  </GradientBackground>
);

// Componente para secciones de contenido
export const ContentGradientSection = ({ 
  children, 
  variant = 'secondary', 
  position = 'top-right',
  intensity = 'medium',
  className = '' 
}: GradientSectionProps) => (
  <GradientBackground
    variant={variant}
    position={position}
    intensity={intensity}
    isSection={true}
    className={`py-16 ${className}`}
  >
    {children}
  </GradientBackground>
);

// Componente para footers
export const FooterGradientSection = ({ 
  children, 
  variant = 'cool', 
  position = 'bottom-center',
  intensity = 'low',
  className = '' 
}: GradientSectionProps) => (
  <GradientBackground
    variant={variant}
    position={position}
    intensity={intensity}
    isSection={true}
    className={`py-12 ${className}`}
  >
    {children}
  </GradientBackground>
);

// Componente para cards destacados
export const CardGradientWrapper = ({ 
  children, 
  variant = 'accent', 
  position = 'center',
  intensity = 'low',
  className = '' 
}: GradientSectionProps) => (
  <GradientBackground
    variant={variant}
    position={position}
    intensity={intensity}
    isSection={true}
    className={`p-6 rounded-lg ${className}`}
  >
    {children}
  </GradientBackground>
);
