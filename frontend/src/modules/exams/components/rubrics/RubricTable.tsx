import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Checkbox } from "@/components/atoms/checkbox";
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
  Award,
  BarChart3,
  Clock,
  Copy,
  Edit,
  Eye,
  MoreHorizontal,
  Target,
  ToggleLeft,
  ToggleRight,
  Trash2
} from "lucide-react";
import { COMPETENCY_LABELS, SCORING_TYPE_LABELS } from "../../constants/academic.constants";
import type { Rubric } from "../../types/rubrics.types";

interface RubricTableProps {
  rubrics: Rubric[];
  selectedRubrics: string[];
  onSelectRubric: (id: string, isSelected: boolean) => void;
  onSelectAllRubrics: (isSelected: boolean) => void;
  onEditRubric: (rubric: Rubric) => void;
  onDeleteRubric: (rubric: Rubric) => void;
  onViewRubric: (rubric: Rubric) => void;
  onActivateRubric: (rubric: Rubric) => void;
  onDeactivateRubric: (rubric: Rubric) => void;
  onCloneRubric: (rubric: Rubric) => void;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
}

const RubricTable = ({
  rubrics,
  selectedRubrics,
  onSelectRubric,
  onSelectAllRubrics,
  onEditRubric,
  onDeleteRubric,
  onViewRubric,
  onActivateRubric,
  onDeactivateRubric,
  onCloneRubric,
  isLoading,
  isError,
  errorMessage
}: RubricTableProps) => {

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
            ? "bg-green-500/20 text-green-300 border-green-500/30" 
            : "bg-muted/50 text-muted-foreground border-border"
        }`}
      >
        {isActive ? "Activa" : "Inactiva"}
      </Badge>
    );
  };

  const getCompetencyBadge = (competency: string) => {
    const colors = {
      reading: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      writing: "bg-green-500/20 text-green-300 border-green-500/30",
      listening: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      speaking: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      grammar: "bg-pink-500/20 text-pink-300 border-pink-500/30",
      vocabulary: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
    };
    
    return (
      <Badge
        variant="outline"
        className={colors[competency as keyof typeof colors] || "bg-muted/50 text-muted-foreground border-border"}
      >
        {COMPETENCY_LABELS[competency as keyof typeof COMPETENCY_LABELS]}
      </Badge>
    );
  };

  const getScoringTypeBadge = (scoringType: string) => {
    return (
      <Badge
        variant="outline"
        className={
          scoringType === 'holistic' 
            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
            : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
        }
      >
        {SCORING_TYPE_LABELS[scoringType as keyof typeof SCORING_TYPE_LABELS]}
      </Badge>
    );
  };

  const isAllSelected = rubrics.length > 0 && selectedRubrics.length === rubrics.length;
  const isIndeterminate = selectedRubrics.length > 0 && selectedRubrics.length < rubrics.length;

  if (isLoading) {
    return (
      <div className="bg-box/50 backdrop-blur-sm border border-line rounded-xl p-8">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          <span className="text-muted-foreground">Cargando rúbricas...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-box/50 backdrop-blur-sm border border-line rounded-xl p-8">
        <div className="text-center space-y-3">
          <div className="text-red-400">❌ Error al cargar las rúbricas</div>
          <p className="text-muted-foreground text-sm">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (rubrics.length === 0) {
    return (
      <div className="bg-box/50 backdrop-blur-sm border border-line rounded-xl p-8">
        <div className="text-center space-y-4">
          <Award className="h-12 w-12 text-muted-foreground mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-foreground">No hay rúbricas disponibles</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Comienza creando tu primera rúbrica de evaluación para estructurar el proceso de calificación.
            </p>
          </div>
        </div>
      </div>
    );
  } 
  return (
    <div className="bg-box backdrop-blur-sm border border-line rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-line hover:bg-line/30">
            <TableHead className="w-12">
              <Checkbox
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onCheckedChange={onSelectAllRubrics}
                className="border-border data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
              />
            </TableHead>
            <TableHead className="text-muted-foreground font-medium">Nombre</TableHead>
            <TableHead className="text-muted-foreground font-medium">Competencia</TableHead>
            <TableHead className="text-muted-foreground font-medium">Nivel</TableHead>
            <TableHead className="text-muted-foreground font-medium">Tipo</TableHead>
            <TableHead className="text-muted-foreground font-medium">Criterios</TableHead>
            <TableHead className="text-muted-foreground font-medium">Puntaje Máx.</TableHead>
            <TableHead className="text-muted-foreground font-medium">Estado</TableHead>
            <TableHead className="text-muted-foreground font-medium">Creada</TableHead>
            <TableHead className="text-muted-foreground font-medium text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rubrics.map((rubric) => (
            <TableRow 
              key={rubric._id}
              className="border-line hover:bg-line/20 transition-colors"
            >
              <TableCell>
                <Checkbox
                  checked={selectedRubrics.includes(rubric._id!)}
                  onCheckedChange={(checked) => onSelectRubric(rubric._id!, checked as boolean)}
                  className="border-border data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                />
              </TableCell>
              
              <TableCell>
                <div className="space-y-1">
                  <div className="text-foreground font-medium">{rubric.name}</div>
                  <div className="text-xs text-muted-foreground max-w-48 truncate">
                    {rubric.criteria.length} criterio(s) definido(s)
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                {getCompetencyBadge(rubric.competency)}
              </TableCell>
              
              <TableCell>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center">
                    <span className="text-blue-300 font-bold text-xs">{rubric.level}</span>
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                {getScoringTypeBadge(rubric.scoringType)}
              </TableCell>
              
              <TableCell>
                <div className="flex items-center space-x-1 text-muted-foreground">
                  <Target className="h-3 w-3" />
                  <span className="text-sm">{rubric.criteria.length}</span>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="flex items-center space-x-1 text-muted-foreground">
                  <BarChart3 className="h-3 w-3" />
                  <span className="font-mono text-sm">{rubric.maxScore}</span>
                </div>
              </TableCell>
              
              <TableCell>
                {getStatusBadge(rubric.isActive)}
              </TableCell>
              
              <TableCell>
                <div className="flex items-center space-x-1 text-muted-foreground text-sm">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(rubric.createdAt)}</span>
                </div>
              </TableCell>
              
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-line/50"
                    >
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="bg-box border-line"
                  >
                    <DropdownMenuItem 
                      onClick={() => onViewRubric(rubric)}
                      className="text-foreground hover:bg-line/50 focus:bg-line/50"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalles
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={() => onEditRubric(rubric)}
                      className="text-foreground hover:bg-line/50 focus:bg-line/50"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={() => onCloneRubric(rubric)}
                      className="text-blue-400 hover:bg-blue-500/10 focus:bg-blue-500/10"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Clonar
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator className="bg-line" />
                    
                    {rubric.isActive ? (
                      <DropdownMenuItem 
                        onClick={() => onDeactivateRubric(rubric)}
                        className="text-orange-400 hover:bg-orange-500/10 focus:bg-orange-500/10"
                      >
                        <ToggleLeft className="h-4 w-4 mr-2" />
                        Desactivar
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onClick={() => onActivateRubric(rubric)}
                        className="text-green-400 hover:bg-green-500/10 focus:bg-green-500/10"
                      >
                        <ToggleRight className="h-4 w-4 mr-2" />
                        Activar
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator className="bg-line" />
                    
                    <DropdownMenuItem 
                      onClick={() => onDeleteRubric(rubric)}
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

export default RubricTable;