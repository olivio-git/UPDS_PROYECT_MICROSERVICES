import { Button } from '@/components/atoms/button';
import { cn } from '@/lib/utils';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  onClick: () => void;
  variant?: 'default' | 'outline';
  className?: string;
}

export function ExportButton({ onClick, variant = 'default', className }: ExportButtonProps) {
  return (
    <Button onClick={onClick} size="sm" variant={variant} className={cn('text-xs h-8 shrink-0', className)}>
      <Download className="h-3 w-3 mr-1.5" />
      Exportar
    </Button>
  );
}
