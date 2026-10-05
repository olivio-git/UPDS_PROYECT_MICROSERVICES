import { Spinner } from '@/components/keel/spinner';
import { Button } from "@/components/keel/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/keel/card";
import { Input } from "@/components/keel/input";
import { Label } from "@/components/keel/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/keel/select";
import { Switch } from "@/components/keel/switch";
import { BarChart3, Plus, Save, Target, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MCERLevel, ScoringType } from "../../constants/academic.constants";
import type { Competency } from "../../types";
import type { Rubric, RubricCriterion, RubricLevel } from "../../types/rubrics.types";
import { distributeEvenly, formatWeight, getWeightInputError, isWeightSumValid, sumWeights } from "../../utils/weights";
import CompetencySelector from "../shared/CompetencySelector";
import MCERLevelSelector from "../shared/MCERLevelSelector";
import WeightInput from "../shared/WeightInput";

interface RubricFormProps {
  rubric?: Rubric;
  isEditing?: boolean;
  onSave: (rubricData: Omit<Rubric, '_id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const RubricForm = ({
  rubric,
  isEditing = false,
  onSave,
  onCancel,
  isLoading
}: RubricFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    competency: '' as Competency,
    level: '' as MCERLevel,
    criteria: [] as RubricCriterion[],
    scoringType: 'analytic' as ScoringType,
    maxScore: 100,
    isActive: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Inicializar formulario
  useEffect(() => {
    if (rubric && isEditing) {
      setFormData({
        name: rubric.name,
        competency: rubric.competency,
        level: rubric.level,
        criteria: rubric.criteria,
        scoringType: rubric.scoringType,
        maxScore: rubric.maxScore,
        isActive: rubric.isActive
      });
    } else {
      // Inicializar con un criterio por defecto
      setFormData(prev => ({
        ...prev,
        criteria: [{
          name: '',
          description: '',
          weight: 100,
          levels: [
            { score: 4, description: 'Excelente' },
            { score: 3, description: 'Bueno' },
            { score: 2, description: 'Satisfactorio' },
            { score: 1, description: 'Necesita mejora' }
          ]
        }]
      }));
    }
  }, [rubric, isEditing]);

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

  const addCriterion = () => {
    const newCriterion: RubricCriterion = {
      name: '',
      description: '',
      weight: 0,
      levels: [
        { score: 4, description: 'Excelente' },
        { score: 3, description: 'Bueno' },
        { score: 2, description: 'Satisfactorio' },
        { score: 1, description: 'Necesita mejora' }
      ]
    };
    setFormData(prev => ({
      ...prev,
      criteria: [...prev.criteria, newCriterion]
    }));
  };

  const removeCriterion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== index)
    }));
  };

  const updateCriterion = (index: number, field: keyof RubricCriterion, value: any) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.map((criterion, i) => 
        i === index ? { ...criterion, [field]: value } : criterion
      )
    }));
  };

  const updateCriterionLevel = (criterionIndex: number, levelIndex: number, field: keyof RubricLevel, value: any) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.map((criterion, i) => 
        i === criterionIndex 
          ? {
              ...criterion,
              levels: criterion.levels.map((level, j) => 
                j === levelIndex ? { ...level, [field]: value } : level
              )
            }
          : criterion
      )
    }));
  };

  const distributeWeightsEvenly = () => {
    const weights = distributeEvenly(formData.criteria.length);

    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.map((criterion, index) => ({
        ...criterion,
        weight: weights[index] ?? 0
      }))
    }));
  };

  const calculateTotalWeight = () => {
    return sumWeights(formData.criteria.map(criterion => criterion.weight));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    if (!formData.competency) {
      newErrors.competency = 'La competencia es requerida';
    }
    if (!formData.level) {
      newErrors.level = 'El nivel MCER es requerido';
    }
    if (formData.maxScore <= 0) {
      newErrors.maxScore = 'El puntaje máximo debe ser mayor a 0';
    }
    if (formData.criteria.length === 0) {
      newErrors.criteria = 'Debe tener al menos un criterio';
    }

    // Validar criterios
    formData.criteria.forEach((criterion, index) => {
      if (!criterion.name.trim()) {
        newErrors[`criterion_${index}_name`] = 'El nombre del criterio es requerido';
      }
      if (!criterion.description.trim()) {
        newErrors[`criterion_${index}_description`] = 'La descripción del criterio es requerida';
      }
      const weightError = getWeightInputError(criterion.weight);
      if (weightError) {
        newErrors[`criterion_${index}_weight`] = weightError;
      } else if (criterion.weight <= 0) {
        newErrors[`criterion_${index}_weight`] = 'El peso debe ser mayor a 0';
      }
    });

    // Validar que los pesos sumen 100%
    const totalWeight = calculateTotalWeight();
    if (!isWeightSumValid(totalWeight)) {
      newErrors.totalWeight = `Los pesos deben sumar 100% (actual: ${formatWeight(totalWeight)}%)`;
    }

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
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Información Básica */}
        <Card flat>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nombre de la Rúbrica *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ej: Rúbrica de Expresión Oral B1"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxScore">
                  Puntaje Máximo *
                </Label>
                <Input
                  id="maxScore"
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.maxScore}
                  onChange={(e) => handleInputChange('maxScore', parseInt(e.target.value))}
                />
                {errors.maxScore && (
                  <p className="text-xs text-destructive">{errors.maxScore}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>
                  Competencia *
                </Label>
                <CompetencySelector
                  value={formData.competency}
                  onValueChange={(value) => handleInputChange('competency', value)}
                  placeholder="Seleccionar competencia"
                />
                {errors.competency && (
                  <p className="text-xs text-destructive">{errors.competency}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Nivel MCER *
                </Label>
                <MCERLevelSelector
                  value={formData.level}
                  onValueChange={(value) => handleInputChange('level', value)}
                  placeholder="Seleccionar nivel"
                  showDescriptions={false}
                />
                {errors.level && (
                  <p className="text-xs text-destructive">{errors.level}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Tipo de Evaluación *
                </Label>
                <Select
                  value={formData.scoringType}
                  onValueChange={(value) => value && handleInputChange('scoringType', value)}
                  items={{ holistic: 'Holística', analytic: 'Analítica' }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem 
                      value="holistic"
                    >
                      Holística
                    </SelectItem>
                    <SelectItem 
                      value="analytic"
                    >
                      Analítica
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleInputChange('isActive', checked)}
              />
              <Label htmlFor="isActive">
                Rúbrica activa
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Criterios de Evaluación */}
        <Card flat>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Criterios de Evaluación</CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={distributeWeightsEvenly}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Distribuir Evenly
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCriterion}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Criterio
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Define los criterios que se utilizarán para evaluar esta competencia
              </p>
              <div className={`text-sm ${isWeightSumValid(calculateTotalWeight()) ? 'text-green-400' : 'text-orange-400'}`}>
                Total: {formatWeight(calculateTotalWeight())}%
              </div>
            </div>
            {errors.totalWeight && (
              <p className="text-xs text-destructive">{errors.totalWeight}</p>
            )}
            {errors.criteria && (
              <p className="text-xs text-destructive">{errors.criteria}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {formData.criteria.map((criterion, criterionIndex) => (
              <div key={criterionIndex} className="border border-border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-foreground flex items-center">
                    <Target className="h-4 w-4 mr-2" />
                    Criterio {criterionIndex + 1}
                  </h4>
                  {formData.criteria.length > 1 && (
                    <Button
                      variant="destructive"
                      type="button"
                      size="sm"
                      onClick={() => removeCriterion(criterionIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>
                      Nombre del Criterio *
                    </Label>
                    <Input
                      value={criterion.name}
                      onChange={(e) => updateCriterion(criterionIndex, 'name', e.target.value)}
                      placeholder="Ej: Fluidez"
                    />
                    {errors[`criterion_${criterionIndex}_name`] && (
                      <p className="text-xs text-destructive">{errors[`criterion_${criterionIndex}_name`]}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Peso (%) *
                    </Label>
                    <WeightInput
                      min="0"
                      max="100"
                      value={criterion.weight}
                      onValueChange={(weight) => updateCriterion(criterionIndex, 'weight', weight)}
                      className="bg-muted/50 border-border text-foreground"
                    />
                    {(getWeightInputError(criterion.weight) ?? errors[`criterion_${criterionIndex}_weight`]) && (
                      <p className="text-xs text-destructive">
                        {getWeightInputError(criterion.weight) ?? errors[`criterion_${criterionIndex}_weight`]}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Descripción *
                    </Label>
                    <Input
                      value={criterion.description}
                      onChange={(e) => updateCriterion(criterionIndex, 'description', e.target.value)}
                      placeholder="Descripción del criterio"
                    />
                    {errors[`criterion_${criterionIndex}_description`] && (
                      <p className="text-xs text-destructive">{errors[`criterion_${criterionIndex}_description`]}</p>
                    )}
                  </div>
                </div>

                {/* Niveles de Desempeño */}
                <div className="space-y-3">
                  <Label>Niveles de Desempeño</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {criterion.levels.map((level, levelIndex) => (
                      <div key={levelIndex} className="border border-border/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            value={level.score}
                            onChange={(e) => updateCriterionLevel(criterionIndex, levelIndex, 'score', parseInt(e.target.value))}
                            className="w-20"
                            placeholder="Puntaje"
                          />
                          <Input
                            value={level.description}
                            onChange={(e) => updateCriterionLevel(criterionIndex, levelIndex, 'description', e.target.value)}
                            placeholder="Descripción del nivel"
                            className="flex-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="-mx-3 flex items-center justify-end gap-2 border-t border-border px-3 pt-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            <X />
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Spinner /> : <Save />}
            {isLoading ? 'Guardando...' : isEditing ? 'Actualizar rúbrica' : 'Crear rúbrica'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default RubricForm;