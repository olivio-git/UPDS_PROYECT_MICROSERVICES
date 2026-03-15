import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/atoms/table";
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
      <div className="bg-card/50 backdrop-blur-sm border border-line rounded-xl p-8">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="text-muted-foreground">Cargando niveles...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border border-line rounded-xl p-8">
        <div className="text-center space-y-3">
          <div className="text-red-400">❌ Error al cargar los niveles</div>
          <p className="text-muted-foreground text-sm">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (levels.length === 0) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border border-line rounded-xl p-8">
        <div className="text-center space-y-4">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-foreground">No hay niveles configurados</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Comienza creando tu primer nivel MCER para estructurar el sistema de evaluación.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card backdrop-blur-sm border border-line rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-line hover:bg-muted/30">
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
              className="border-line hover:bg-muted/20 transition-colors"
            >
              <TableCell>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center">
                    <span className="text-blue-700 dark:text-blue-300 font-bold text-sm">{level.code}</span>
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
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-muted"
                    >
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="bg-popover border-line"
                  >
                    <DropdownMenuItem 
                      onClick={() => onViewLevel(level)}
                      className="text-foreground hover:bg-muted focus:bg-muted"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalles
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={() => onEditLevel(level)}
                      className="text-foreground hover:bg-muted focus:bg-muted"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator className="bg-border" />
                    
                    {level.isActive ? (
                      <DropdownMenuItem 
                        onClick={() => onDeactivateLevel(level)}
                        className="text-orange-400 hover:bg-orange-500/10 focus:bg-orange-500/10"
                      >
                        <ToggleLeft className="h-4 w-4 mr-2" />
                        Desactivar
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onClick={() => onActivateLevel(level)}
                        className="text-green-400 hover:bg-green-500/10 focus:bg-green-500/10"
                      >
                        <ToggleRight className="h-4 w-4 mr-2" />
                        Activar
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator className="bg-border" />
                    
                    <DropdownMenuItem 
                      onClick={() => onDeleteLevel(level)}
                      className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10"
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