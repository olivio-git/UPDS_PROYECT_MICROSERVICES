import type { ReactNode } from 'react';

interface GradientWrapperProps {
  children: ReactNode;
  variant?: 'spiral' | 'radial' | 'conic' | 'linear' | 'aurora' | 'sunset' | 'ocean' | 'cosmic';
  intensity?: 'low' | 'medium' | 'high';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  animate?: boolean;
}

const GradientWrapper = ({
  children,
  variant = 'spiral',
  intensity = 'medium',
  size = 'md',
  position = 'center',
  className = '',
  animate = true
}: GradientWrapperProps) => {

  // Configuración de tamaños
  const sizeConfig = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32', 
    lg: 'w-48 h-48',
    xl: 'w-64 h-64'
  };

  // Configuración de posiciones (usando absolute para no afectar layout)
  const positionConfig = {
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    left: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2',
    right: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2',
    'top-left': 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
    'top-right': 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
    'bottom-left': 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
    'bottom-right': 'bottom-0 right-0 translate-x-1/2 translate-y-1/2'
  };

  // Configuración de intensidades
  const intensityConfig = {
    low: { primary: '15', secondary: '8', tertiary: '5' },
    medium: { primary: '25', secondary: '15', tertiary: '8' },
    high: { primary: '35', secondary: '25', tertiary: '15' }
  };

  const { primary, secondary, tertiary } = intensityConfig[intensity];

  // Configuración de gradientes por variante
  const variantConfig = {
    spiral: {
      gradient: `conic-gradient(from 0deg, 
        rgba(168, 85, 247, 0.${primary}) 0deg,
        rgba(59, 130, 246, 0.${secondary}) 90deg,
        rgba(16, 185, 129, 0.${tertiary}) 180deg,
        rgba(245, 101, 101, 0.${secondary}) 270deg,
        rgba(168, 85, 247, 0.${primary}) 360deg)`,
      blur: 'blur-[60px]'
    },
    radial: {
      gradient: `radial-gradient(circle, 
        rgba(147, 51, 234, 0.${primary}) 0%,
        rgba(79, 70, 229, 0.${secondary}) 35%,
        rgba(16, 185, 129, 0.${tertiary}) 70%,
        transparent 100%)`,
      blur: 'blur-[50px]'
    },
    conic: {
      gradient: `conic-gradient(from 45deg,
        rgba(236, 72, 153, 0.${primary}) 0deg,
        rgba(168, 85, 247, 0.${secondary}) 120deg,
        rgba(59, 130, 246, 0.${tertiary}) 240deg,
        rgba(236, 72, 153, 0.${primary}) 360deg)`,
      blur: 'blur-[70px]'
    },
    linear: {
      gradient: `linear-gradient(135deg,
        rgba(99, 102, 241, 0.${primary}) 0%,
        rgba(168, 85, 247, 0.${secondary}) 50%,
        rgba(236, 72, 153, 0.${tertiary}) 100%)`,
      blur: 'blur-[40px]'
    },
    aurora: {
      gradient: `conic-gradient(from 180deg,
        rgba(52, 211, 153, 0.${primary}) 0deg,
        rgba(59, 130, 246, 0.${secondary}) 90deg,
        rgba(168, 85, 247, 0.${tertiary}) 180deg,
        rgba(236, 72, 153, 0.${secondary}) 270deg,
        rgba(52, 211, 153, 0.${primary}) 360deg)`,
      blur: 'blur-[80px]'
    },
    sunset: {
      gradient: `radial-gradient(ellipse at center,
        rgba(251, 146, 60, 0.${primary}) 0%,
        rgba(239, 68, 68, 0.${secondary}) 40%,
        rgba(168, 85, 247, 0.${tertiary}) 80%,
        transparent 100%)`,
      blur: 'blur-[90px]'
    },
    ocean: {
      gradient: `conic-gradient(from 90deg,
        rgba(6, 182, 212, 0.${primary}) 0deg,
        rgba(59, 130, 246, 0.${secondary}) 120deg,
        rgba(99, 102, 241, 0.${tertiary}) 240deg,
        rgba(6, 182, 212, 0.${primary}) 360deg)`,
      blur: 'blur-[65px]'
    },
    cosmic: {
      gradient: `radial-gradient(ellipse at center,
        rgba(124, 58, 237, 0.${primary}) 0%,
        rgba(147, 51, 234, 0.${secondary}) 25%,
        rgba(59, 130, 246, 0.${tertiary}) 50%,
        rgba(6, 182, 212, 0.${secondary}) 75%,
        transparent 100%)`,
      blur: 'blur-[140px]'
    }
  };

  const config = variantConfig[variant];
  const animationClass = animate ? 'animate-pulse-slow' : '';

  return (
    <div className={`relative ${className}`}>
      {/* Gradiente de fondo - positioned absolute para no afectar layout */}
      <div 
        className={`absolute pointer-events-none z-0 ${sizeConfig[size]} ${positionConfig[position]} ${config.blur} ${animationClass} rounded-full`}
        style={{
          background: config.gradient
        }}
      />
      
      {/* Contenido - positioned relative para estar encima del gradiente */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default GradientWrapper; 