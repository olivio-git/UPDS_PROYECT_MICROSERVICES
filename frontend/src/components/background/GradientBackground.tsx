import { useTheme } from "@/context/ThemeContext"; 

export type GradientPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right'
  | 'center-left' 
  | 'center' 
  | 'center-right'
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right';

export type GradientVariant = 
  | 'primary' 
  | 'secondary' 
  | 'accent' 
  | 'warm' 
  | 'cool' 
  | 'aurora' 
  | 'sunset';

interface GradientBackgroundProps {
  children?: any;
  variant?: GradientVariant;
  position?: GradientPosition;
  intensity?: 'low' | 'medium' | 'high';
  grid?: boolean;
  decorativeObjects?: boolean;
  className?: string;
  isSection?: boolean; // Si es true, será un contenedor de sección en lugar de fixed
}

const getPositionClasses = (position: GradientPosition) => {
  const positions = {
    'top-left': 'top-0 left-0',
    'top-center': 'top-0 left-1/2 -translate-x-1/2',
    'top-right': 'top-0 right-0',
    'center-left': 'top-1/2 left-0 -translate-y-1/2',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'center-right': 'top-1/2 right-0 -translate-y-1/2',
    'bottom-left': 'bottom-0 left-0',
    'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-0 right-0',
  };
  return positions[position];
};

const getVariantGradients = (variant: GradientVariant, intensity: string) => {
  const intensityMultiplier = {
    'low': { primary: '15', secondary: '8' },
    'medium': { primary: '25', secondary: '15' },
    'high': { primary: '35', secondary: '25' }
  };

  const { primary, secondary } = intensityMultiplier[intensity as keyof typeof intensityMultiplier];

  const variants = {
    primary: {
      main: `from-violet-600/${primary} via-purple-600/${secondary} to-transparent`,
      accent: `from-blue-500/${secondary} via-indigo-600/${primary} to-transparent`,
      tertiary: `from-cyan-400/${primary} via-blue-500/${secondary} to-transparent`
    },
    secondary: {
      main: `from-emerald-500/${primary} via-teal-600/${secondary} to-transparent`,
      accent: `from-green-400/${secondary} via-emerald-500/${primary} to-transparent`,
      tertiary: `from-cyan-300/${primary} via-teal-400/${secondary} to-transparent`
    },
    accent: {
      main: `from-pink-500/${primary} via-purple-500/${secondary} to-transparent`,
      accent: `from-rose-400/${secondary} via-pink-500/${primary} to-transparent`,
      tertiary: `from-purple-400/${primary} via-violet-500/${secondary} to-transparent`
    },
    warm: {
      main: `from-orange-500/${primary} via-red-500/${secondary} to-transparent`,
      accent: `from-yellow-400/${secondary} via-orange-500/${primary} to-transparent`,
      tertiary: `from-red-400/${primary} via-pink-500/${secondary} to-transparent`
    },
    cool: {
      main: `from-blue-500/${primary} via-cyan-500/${secondary} to-transparent`,
      accent: `from-indigo-400/${secondary} via-blue-500/${primary} to-transparent`,
      tertiary: `from-teal-400/${primary} via-cyan-500/${secondary} to-transparent`
    },
    aurora: {
      main: `from-green-400/${primary} via-blue-500/${secondary} to-transparent`,
      accent: `from-purple-400/${secondary} via-pink-500/${primary} to-transparent`,
      tertiary: `from-cyan-300/${primary} via-green-400/${secondary} to-transparent`
    },
    sunset: {
      main: `from-orange-400/${primary} via-red-500/${secondary} to-transparent`,
      accent: `from-pink-400/${secondary} via-purple-500/${primary} to-transparent`,
      tertiary: `from-yellow-300/${primary} via-orange-400/${secondary} to-transparent`
    }
  };

  return variants[variant];
};

const GradientBackground = ({
  children,
  variant = 'primary',
  position = 'center',
  intensity = 'medium',
  grid = false,
  decorativeObjects = false,
  className = '',
  isSection = false
}: GradientBackgroundProps) => { 

  const gradients = getVariantGradients(variant, intensity);
  const positionClasses = getPositionClasses(position);

  const containerClasses = isSection 
    ? `relative overflow-hidden ${className}`
    : `fixed  top-0 z-[-10] min-h-screen w-screen overflow-hidden ${grid ? 'bg-grid-pattern' : ''} bg-[#020617] ${className}`;

  return (
    <div className={containerClasses}>
      {/* Gradientes principales */}
      <div className={`absolute ${positionClasses} w-[800px] h-[800px] bg-gradient-radial ${gradients.main} rounded-full blur-[150px] animate-pulse-slow`}></div>
      <div 
        className={`absolute ${positionClasses} w-[700px] h-[700px] bg-gradient-radial ${gradients.accent} rounded-full blur-[140px] animate-pulse-slow`}
        style={{ animationDelay: "1s" }}
      ></div>
      <div 
        className={`absolute ${positionClasses} w-[500px] h-[500px] bg-gradient-radial ${gradients.tertiary} rounded-full blur-[100px] animate-pulse-slow`}
        style={{ animationDelay: "2s" }}
      ></div>

      {/* Gradientes flotantes adicionales */}
      <div className={`absolute ${positionClasses} w-[400px] h-[400px] bg-gradient-radial ${gradients.accent} rounded-full blur-[80px] animate-float`}></div>
      <div 
        className={`absolute ${positionClasses} w-[600px] h-[600px] bg-gradient-radial ${gradients.main} rounded-full blur-[120px] animate-float`}
        style={{ animationDelay: "3s" }}
      ></div>

      {/* Overlay de gradiente */}
      {!isSection && (
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-slate-900/30"></div>
      )}

      {/* Objetos decorativos */}
      {decorativeObjects && (
        <>
          <div className={`absolute ${positionClasses} w-32 h-32 border border-purple-400/20 rotate-45 animate-spin-slow opacity-30`}></div>
          <div className={`absolute ${positionClasses} w-24 h-24 border-2 border-cyan-400/15 rounded-full animate-pulse opacity-25`}></div>
          <div className={`absolute ${positionClasses} w-20 h-20 bg-gradient-to-br from-violet-500/10 to-transparent rotate-12 opacity-40`}></div>
        </>
      )}

      {/* Bordes con gradiente */}
      {!isSection && (
        <>
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent"></div>
          <div className="absolute left-0 top-0 w-px h-full bg-gradient-to-b from-transparent via-indigo-400/20 to-transparent"></div>
          <div className="absolute right-0 top-0 w-px h-full bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent"></div>
        </>
      )}

      {children}
    </div>
  );
};

export default GradientBackground;
