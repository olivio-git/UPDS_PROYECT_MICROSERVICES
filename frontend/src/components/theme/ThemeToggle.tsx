import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { useTheme } from '@/context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10', 
    lg: 'h-12 w-12'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={`
        ${sizeClasses[size]} 
        border-border
        bg-background/80 
        backdrop-blur-sm 
        hover:bg-accent 
        transition-all 
        duration-300 
        group
        ${className}
      `}
      title={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
    >
      {theme === 'light' ? (
        <Moon 
          size={iconSizes[size]} 
          className="transition-transform duration-300 group-hover:rotate-12" 
        />
      ) : (
        <Sun 
          size={iconSizes[size]} 
          className="transition-transform duration-300 group-hover:rotate-12 text-white" 
        />
      )}
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
