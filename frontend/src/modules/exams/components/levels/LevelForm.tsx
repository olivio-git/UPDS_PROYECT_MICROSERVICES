import { Button } from "@/components/atoms/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/card";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Switch } from "@/components/atoms/switch";
import { Textarea } from "@/components/atoms/textarea";
import { ArrowLeft, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { COMPETENCIES, COMPETENCY_LABELS, type Competency, type MCERLevel } from "../../constants/academic.constants";
import type { CompetencyRequirement, MCERLevelDefinition } from "../../types/levels.types";
import MCERLevelSelector from "../shared/MCERLevelSelector";

interface LevelFormProps {
  level?: MCERLevelDefinition;
  isEditing?: boolean;
  onSave: (levelData: Omit<MCERLevelDefinition, '_id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const LevelForm = ({
  level,
  isEditing = false,
  onSave,
  onCancel,
  isLoading
}: LevelFormProps) => {
  const [formData, setFormData] = useState({
    code: '' as MCERLevel,
    name: '',
    description: '',
    overallMinScore: 60,
    isActive: true,
    competencyRequirements: {} as Record<Competency, CompetencyRequirement>
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Inicializar formulario
  useEffect(() => {
    if (level && isEditing) {
      setFormData({
        code: level.code,
        name: level.name,
        description: level.description,
        overallMinScore: level.overallMinScore,
        isActive: level.isActive,
        competencyRequirements: level.competencyRequirements
      });
    } else {
      // Inicializar competencyRequirements vacío para modo creación
      const initialRequirements: Record<Competency, CompetencyRequirement> = {} as Record<Competency, CompetencyRequirement>;
      COMPETENCIES.forEach(competency => {
        initialRequirements[competency] = {
          minScore: 60,
          description: '',
          canDoStatements: ['']
        };
      });
      setFormData(prev => ({
        ...prev,
        competencyRequirements: initialRequirements
      }));
    }
  }, [level, isEditing]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Limpiar error del campo cuando se modifica
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCompetencyRequirementChange = (
    competency: Competency, 
    field: keyof CompetencyRequirement, 
    value: any
  ) => {
    setFormData(prev => ({
      ...prev,
      competencyRequirements: {
        ...prev.competencyRequirements,
        [competency]: {
          ...prev.competencyRequirements[competency],
          [field]: value
        }
      }
    }));
  };

  const addCanDoStatement = (competency: Competency) => {
    const currentStatements = formData.competencyRequirements[competency]?.canDoStatements || [];
    handleCompetencyRequirementChange(competency, 'canDoStatements', [...currentStatements, '']);
  };

  const removeCanDoStatement = (competency: Competency, index: number) => {
    const currentStatements = formData.competencyRequirements[competency]?.canDoStatements || [];
    const newStatements = currentStatements.filter((_, i) => i !== index);
    handleCompetencyRequirementChange(competency, 'canDoStatements', newStatements);
  };

  const updateCanDoStatement = (competency: Competency, index: number, value: string) => {
    const currentStatements = formData.competencyRequirements[competency]?.canDoStatements || [];
    const newStatements = [...currentStatements];
    newStatements[index] = value;
    handleCompetencyRequirementChange(competency, 'canDoStatements', newStatements);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.code) {
      newErrors.code = 'El código de nivel es requerido';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'La descripción es requerida';
    }
    if (formData.overallMinScore < 0 || formData.overallMinScore > 100) {
      newErrors.overallMinScore = 'El puntaje debe estar entre 0 y 100';
    }

    // Validar competency requirements
    COMPETENCIES.forEach(competency => {
      const requirement = formData.competencyRequirements[competency];
      if (!requirement) {
        newErrors[`competency_${competency}`] = 'Los requisitos de competencia son requeridos';
      } else {
        if (requirement.minScore < 0 || requirement.minScore > 100) {
          newErrors[`competency_${competency}_score`] = 'El puntaje mínimo debe estar entre 0 y 100';
        }
        if (!requirement.description.trim()) {
          newErrors[`competency_${competency}_desc`] = 'La descripción de la competencia es requerida';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  return (
    <div className="space-y-6  bg-box border border-line rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground hover:bg-line/50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEditing ? 'Editar Nivel MCER' : 'Crear Nuevo Nivel MCER'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEditing ? 'Modifica la configuración del nivel existente' : 'Define un nuevo nivel del Marco Común Europeo de Referencia'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Básica */}
        <Card className="bg-box/50 border-line">
          <CardHeader>
            <CardTitle className="text-foreground">Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-muted-foreground">
                  Código de Nivel *
                </Label>
                <MCERLevelSelector
                  value={formData.code}
                  onValueChange={(value) => handleInputChange('code', value)}
                  placeholder="Seleccionar nivel"
                  disabled={isEditing} // No permitir cambiar código en edición
                />
                {errors.code && (
                  <p className="text-red-400 text-sm">{errors.code}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="overallMinScore" className="text-muted-foreground">
                  Puntaje Mínimo General (%) *
                </Label>
                <Input
                  id="overallMinScore"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.overallMinScore}
                  onChange={(e) => handleInputChange('overallMinScore', parseInt(e.target.value))}
                  className="bg-input border-line text-foreground"
                />
                {errors.overallMinScore && (
                  <p className="text-red-400 text-sm">{errors.overallMinScore}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-muted-foreground">
                Nombre del Nivel *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Ej: Usuario Básico - Acceso"
                className="bg-input border-line text-foreground"
              />
              {errors.name && (
                <p className="text-red-400 text-sm">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-muted-foreground">
                Descripción del Nivel *
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe las características y objetivos de este nivel..."
                className="bg-input border-line text-foreground min-h-20"
              />
              {errors.description && (
                <p className="text-red-400 text-sm">{errors.description}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                className="bg-input data-[state=checked]:bg-blue-600"
                onCheckedChange={(checked) => handleInputChange('isActive', checked)}
              />
              <Label htmlFor="isActive" className="text-muted-foreground">
                Nivel activo
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Requisitos por Competencia */}
        <Card className="bg-box/50 border-line">
          <CardHeader>
            <CardTitle className="text-foreground">Requisitos por Competencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {COMPETENCIES.map((competency) => (
              <div key={competency} className="border border-line rounded-lg p-4 space-y-4">
                <h4 className="text-lg font-medium text-foreground">
                  {COMPETENCY_LABELS[competency]}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">
                      Puntaje Mínimo (%) *
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.competencyRequirements[competency]?.minScore || 60}
                      onChange={(e) => handleCompetencyRequirementChange(
                        competency, 
                        'minScore', 
                        parseInt(e.target.value)
                      )}
                      className="bg-input border-line text-foreground"
                    />
                    {errors[`competency_${competency}_score`] && (
                      <p className="text-red-400 text-sm">{errors[`competency_${competency}_score`]}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">
                      Descripción *
                    </Label>
                    <Input
                      value={formData.competencyRequirements[competency]?.description || ''}
                      onChange={(e) => handleCompetencyRequirementChange(
                        competency, 
                        'description', 
                        e.target.value
                      )}
                      placeholder={`Descripción para ${COMPETENCY_LABELS[competency]}`}
                      className="bg-input border-line text-foreground"
                    />
                    {errors[`competency_${competency}_desc`] && (
                      <p className="text-red-400 text-sm">{errors[`competency_${competency}_desc`]}</p>
                    )}
                  </div>
                </div>

                {/* Can-do Statements */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">
                      Descriptores Can-Do
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCanDoStatement(competency)}
                      className="bg-transparent border-line text-muted-foreground hover:bg-line/50"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </div>
                  
                  {formData.competencyRequirements[competency]?.canDoStatements?.map((statement, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={statement}
                        onChange={(e) => updateCanDoStatement(competency, index, e.target.value)}
                        placeholder={`Descriptor ${index + 1} para ${COMPETENCY_LABELS[competency]}`}
                        className="bg-input border-line text-foreground flex-1"
                      />
                      {formData.competencyRequirements[competency]?.canDoStatements?.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCanDoStatement(competency, index)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            size={'sm'}
            className="bg-transparent border-line text-muted-foreground hover:bg-line/50"
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            size={'sm'}
            className="hover:from-blue-700 hover:to-purple-700 text-white"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </div>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? 'Actualizar Nivel' : 'Crear Nivel'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LevelForm;