import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from "@/components/keel/badge";
import { Button } from "@/components/keel/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/keel/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/keel/table";
import {
  BookOpen,
  Clock,
  Edit,
  Eye,
  MoreHorizontal,
  ToggleLeft,
  ToggleRight,
  Trash2
} from "lucide-react";
import type { MCERLevelDefinition } from "../../types/levels.types";

interface LevelTableProps {
  levels: MCERLevelDefinition[];
  onEditLevel: (level: MCERLevelDefinition) => void;
  onDeleteLevel: (level: MCERLevelDefinition) => void;
  onViewLevel: (level: MCERLevelDefinition) => void;
  onActivateLevel: (level: MCERLevelDefinition) => void;
  onDeactivateLevel: (level: MCERLevelDefinition) => void;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
}

const LevelTable = ({
  levels,
  onEditLevel,
  onDeleteLevel,
  onViewLevel,
  onActivateLevel,
  onDeactivateLevel,
  isLoading,
  isError,
  errorMessage
}: LevelTableProps) => {

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge
        variant={isActive ? "default" : "secondary"}
        className={`${
          isActive 
            ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30"
            : "bg-muted/50 text-muted-foreground border-border"
        }`}
      >
        {isActive ? "Activo" : "Inactivo"}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center border-border bg-card rounded-xl border overflow-hidden">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="text-muted-foreground">Cargando niveles...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center border-border bg-card text-center rounded-xl border overflow-hidden">
        <div className="space-y-3">
          <div className="text-red-400">Error al cargar los niveles</div>
          <p className="text-muted-foreground text-sm">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (levels.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 flex-col border-border bg-card rounded-xl border overflow-hidden">
        <EmptyState
          icon={BookOpen}
          title="No hay niveles configurados"
          description="Comienza creando tu primer nivel MCER para estructurar el sistema de evaluación."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col border-border bg-card rounded-xl border overflow-hidden">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow className="border-border hover:bg-muted/30">
            <TableHead className="text-muted-foreground font-medium">Nivel</TableHead>
            <TableHead className="text-muted-foreground font-medium">Nombre</TableHead>
            <TableHead className="text-muted-foreground font-medium">Descripción</TableHead>
            <TableHead className="text-muted-foreground font-medium">Puntaje Mínimo</TableHead>
            <TableHead className="text-muted-foreground font-medium">Estado</TableHead>
            <TableHead className="text-muted-foreground font-medium">Creado</TableHead>
            <TableHead className="text-muted-foreground font-medium text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {levels.map((level) => (
            <TableRow
              key={level._id}
              className="border-border hover:bg-muted/20 transition-colors"
            >
              <TableCell>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-foreground font-semibold text-sm">{level.code}</span>
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="space-y-1">
                  <div className="text-foreground font-medium">{level.name}</div>
                  <div className="text-xs text-muted-foreground">Código: {level.code}</div>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="max-w-xs">
                  <p className="text-muted-foreground text-sm truncate" title={level.description}>
                    {level.description}
                  </p>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="text-foreground font-mono text-sm">
                  {level.overallMinScore}%
                </div>
              </TableCell>
              
              <TableCell>
                {getStatusBadge(level.isActive)}
              </TableCell>
              
              <TableCell>
                <div className="flex items-center space-x-1 text-muted-foreground text-sm">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(level.createdAt)}</span>
                </div>
              </TableCell>
              
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                  >
                    <DropdownMenuItem 
                      onClick={() => onViewLevel(level)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalles
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={() => onEditLevel(level)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {level.isActive ? (
                      <DropdownMenuItem 
                        onClick={() => onDeactivateLevel(level)}
                      >
                        <ToggleLeft className="h-4 w-4 mr-2" />
                        Desactivar
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onClick={() => onActivateLevel(level)}
                      >
                        <ToggleRight className="h-4 w-4 mr-2" />
                        Activar
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                      onClick={() => onDeleteLevel(level)}
                      variant="destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default LevelTable;