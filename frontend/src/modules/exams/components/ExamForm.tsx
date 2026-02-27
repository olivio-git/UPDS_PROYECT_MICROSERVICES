import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select';
import { Switch } from '@/components/atoms/switch';
import { Textarea } from '@/components/atoms/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useExams } from '../hooks/useExams';
import { useLevels } from '../hooks/useLevels';
import { useQuestionAvailability } from '../hooks/useQuestionAvailability';
import type { Competency, Exam, Level } from '../types';
import QuestionAvailabilityIndicator from './QuestionAvailabilityIndicator';

// Esquema de validación
const examSectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre es requerido'),
  competency: z.string().min(1, 'La competencia es requerida'),
  instructions: z.string().min(1, 'Las instrucciones son requeridas'),
  questionCount: z.number().min(1, 'Debe tener al menos 1 pregunta'),
  questionTypes: z.array(z.string()).min(1, 'Debe seleccionar al menos un tipo'),
  points: z.number().min(1, 'Los puntos deben ser mayor a 0'),
  duration: z.number().min(1, 'La duración debe ser mayor a 0').optional(),
  order: z.number()
});

const examSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  description: z.string().optional(),
  type: z.string().min(1, 'El tipo es requerido'),
  targetLevel: z.string().min(1, 'El nivel es requerido'),
  structure: z.object({
    sections: z.array(examSectionSchema).min(0),
    totalQuestions: z.number().min(0),
    totalPoints: z.number().min(0),
    totalDuration: z.number().min(0),
    passingScore: z.number().min(1).max(100, 'El puntaje mínimo debe estar entre 1 y 100')
  }),
  configuration: z.object({
    randomizeQuestions: z.boolean(),
    randomizeOptions: z.boolean(),
    showResults: z.boolean(),
    allowReview: z.boolean(),
    maxAttempts: z.number().min(1).max(10)
  }),
  isActive: z.boolean(),
  isTemplate: z.boolean()
});

type ExamFormData = z.infer<typeof examSchema>;

interface ExamFormProps {
  exam?: Exam | null;
  onCancel: () => void;
  onSaved: () => void;
}

const PLACEMENT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

interface PlacementConfig {
  mode: 'static' | 'adaptive';
  startingLevel: string;
  maxQuestions: number;
  consecutiveWrongThreshold: number;
  levelPassingThreshold: number;
}

const ExamForm: React.FC<ExamFormProps> = ({ exam, onCancel, onSaved }) => {
  const { createExam, updateExam } = useExams();
  const { levels, isLoading: isLoadingLevels } = useLevels();
  const { checkAvailability, availability, loading: availabilityLoading, getMaxAllowed } = useQuestionAvailability();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [placementConfig, setPlacementConfig] = useState<PlacementConfig>({
    mode: (exam as any)?.placementConfig?.mode ?? 'static',
    startingLevel: (exam as any)?.placementConfig?.startingLevel ?? 'A2',
    maxQuestions: (exam as any)?.placementConfig?.maxQuestions ?? 20,
    consecutiveWrongThreshold: (exam as any)?.placementConfig?.consecutiveWrongThreshold ?? 3,
    levelPassingThreshold: (exam as any)?.placementConfig?.levelPassingThreshold ?? 60,
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors }
  } = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      name: exam?.name || '',
      description: exam?.description || '',
      type: exam?.type || '',
      targetLevel: exam?.targetLevel || (levels.length > 0 ? levels[0].code : ''),
      structure: {
        sections: exam?.structure?.sections || [
          {
            id: '1',
            name: 'Sección 1',
            competency: 'reading',
            instructions: '',
            questionCount: 10,
            questionTypes: ['multiple_choice'],
            points: 10,
            duration: 30,
            order: 1
          }
        ],
        totalQuestions: exam?.structure?.totalQuestions || 0,
        totalPoints: exam?.structure?.totalPoints || 0,
        totalDuration: exam?.structure?.totalDuration || 0,
        passingScore: exam?.structure?.passingScore || 70
      },
      configuration: {
        randomizeQuestions: exam?.configuration?.randomizeQuestions ?? true,
        randomizeOptions: exam?.configuration?.randomizeOptions ?? true,
        showResults: exam?.configuration?.showResults ?? true,
        allowReview: exam?.configuration?.allowReview ?? false,
        maxAttempts: exam?.configuration?.maxAttempts || 1
      },
      isActive: exam?.isActive ?? true,
      isTemplate: exam?.isTemplate ?? false
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'structure.sections'
  });

  const watchedSections = watch('structure.sections');
  const watchedTargetLevel = watch('targetLevel');
  const watchedType = watch('type');

  // Actualizar targetLevel cuando los niveles se carguen por primera vez
  useEffect(() => {
    if (levels.length > 0 && !watchedTargetLevel) {
      setValue('targetLevel', levels[0].code);
    }
  }, [levels, watchedTargetLevel, setValue]);

  // Calcular totales automáticamente cuando cambian las secciones
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      // Solo recalcular si cambió algo relacionado con las secciones
      if (name?.startsWith('structure.sections')) {
        const currentSections = value.structure?.sections || [];

        const totalQuestions = currentSections.reduce((sum, section) => sum + (section?.questionCount || 0), 0);
        const totalPoints = currentSections.reduce((sum, section) => sum + (section?.points || 0), 0);
        const totalDuration = currentSections.reduce((sum, section) => sum + (section?.duration || 0), 0);

        setValue('structure.totalQuestions', totalQuestions);
        setValue('structure.totalPoints', totalPoints);
        setValue('structure.totalDuration', totalDuration);
      }
    });

    // También ejecutar una vez al inicializar
    const currentSections = getValues('structure.sections');
    const totalQuestions = currentSections.reduce((sum, section) => sum + (section.questionCount || 0), 0);
    const totalPoints = currentSections.reduce((sum, section) => sum + (section.points || 0), 0);
    const totalDuration = currentSections.reduce((sum, section) => sum + (section.duration || 0), 0);

    setValue('structure.totalQuestions', totalQuestions);
    setValue('structure.totalPoints', totalPoints);
    setValue('structure.totalDuration', totalDuration);

    return () => subscription.unsubscribe();
  }, [watch, setValue, getValues]);

  // En modo adaptativo, limpiar secciones para evitar errores Zod silenciosos
  useEffect(() => {
    if (watchedType === 'placement' && placementConfig.mode === 'adaptive') {
      const currentSections = getValues('structure.sections');
      if (currentSections.length > 0) {
        setValue('structure.sections', []);
      }
      const currentDuration = getValues('structure.totalDuration');
      if (!currentDuration || currentDuration === 0) {
        setValue('structure.totalDuration', 60);
      }
    }
  }, [watchedType, placementConfig.mode, getValues, setValue]);

  // Función debounce personalizada
  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: any;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }, []);

  // Validación de disponibilidad con debounce
  const validateSectionQuestions = useCallback(
    debounce(async (sectionIndex: number, competency: string, questionCount: number, level: string) => {
      if (!competency || !questionCount || !level || questionCount <= 0) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[`section-${sectionIndex}`];
          return newErrors;
        });
        return;
      }

      try {
        const { isAvailable, maxAllowed } = await checkAvailability(competency, level, questionCount);

        setValidationErrors(prev => ({
          ...prev,
          [`section-${sectionIndex}`]: !isAvailable
            ? `Máximo ${maxAllowed} preguntas disponibles para ${competency} nivel ${level}`
            : ''
        }));

        // Auto-ajustar el valor si excede el máximo
        if (!isAvailable && maxAllowed > 0) {
          setValue(`structure.sections.${sectionIndex}.questionCount`, maxAllowed);
        }
      } catch (error) {
        console.error('Error validating section questions:', error);
      }
    }, 500),
    [checkAvailability, setValue]
  );

  // Validar todas las secciones cuando cambia el nivel objetivo
  useEffect(() => {
    if (watchedTargetLevel && watchedSections.length > 0) {
      watchedSections.forEach((section, index) => {
        if (section.competency && section.questionCount) {
          validateSectionQuestions(index, section.competency, section.questionCount, watchedTargetLevel);
        }
      });
    }
  }, [watchedTargetLevel, watchedSections, validateSectionQuestions]);

  const addSection = () => {
    const newSection = {
      id: Date.now().toString(),
      name: `Sección ${fields.length + 1}`,
      competency: 'reading',
      instructions: '',
      questionCount: 10,
      questionTypes: ['multiple_choice'],
      points: 10,
      duration: 30,
      order: fields.length + 1
    };
    append(newSection);
  };

  const removeSection = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    } else {
      toast.error('Debe mantener al menos una sección');
    }
  };

  const onSubmit = async (data: ExamFormData) => {
    try {
      setIsSubmitting(true);

      const isAdaptivePlacement = data.type === 'placement' && placementConfig.mode === 'adaptive';

      if (!isAdaptivePlacement) {
        // Validar disponibilidad de preguntas antes de enviar
        const hasValidationErrors = Object.values(validationErrors).some(error => error !== '');
        if (hasValidationErrors) {
          toast.error('Por favor, corrige los errores de validación antes de continuar');
          setIsSubmitting(false);
          return;
        }

        if (data.structure.sections.length === 0) {
          toast.error('Debe tener al menos una sección');
          setIsSubmitting(false);
          return;
        }

        // Validar que todas las secciones tengan preguntas disponibles
        const validationPromises = data.structure.sections.map(async (section, index) => {
          if (section.competency && section.questionCount && data.targetLevel) {
            const { isAvailable } = await checkAvailability(section.competency, data.targetLevel, section.questionCount);
            return { index, isAvailable, section };
          }
          return { index, isAvailable: true, section };
        });

        const validationResults = await Promise.all(validationPromises);
        const invalidSections = validationResults.filter(result => !result.isAvailable);

        if (invalidSections.length > 0) {
          toast.error(
            `Las siguientes secciones no tienen suficientes preguntas: ${invalidSections
              .map(s => s.section.name)
              .join(', ')}`
          );
          setIsSubmitting(false);
          return;
        }
      }

      const { passingScore, ...structureRest } = data.structure as any;
      const { randomizeOptions, maxAttempts, ...configRest } = data.configuration as any;

      // In adaptive placement mode, ensure totalDuration has a value
      if (isAdaptivePlacement && (!structureRest.totalDuration || structureRest.totalDuration === 0)) {
        structureRest.totalDuration = 60;
      }

      const apiPayload: any = {
        name: data.name,
        description: data.description,
        type: data.type as Exam['type'],
        targetLevel: data.targetLevel as Level,
        structure: {
          ...structureRest,
          passingScore: passingScore ?? 70,
          sections: data.structure.sections.map((section, index) => ({
            ...section,
            competency: section.competency as Competency,
            questionTypes: section.questionTypes as any,
            weight: section.points ?? 1,
            order: index + 1
          }))
        },
        configuration: {
          randomizeQuestions: configRest.randomizeQuestions,
          showResults: configRest.showResults,
          allowReview: configRest.allowReview,
          attemptsAllowed: maxAttempts ?? 1
        },
        isActive: data.isActive,
        isTemplate: data.isTemplate
      };

      // Add placement config if type is placement
      if (data.type === 'placement') {
        apiPayload.placementConfig = placementConfig;
      }
      console.log(apiPayload);
      if (exam?._id) {
        await updateExam(exam._id, apiPayload as Partial<Exam>);
        toast.success('Examen actualizado exitosamente');
      } else {
        await createExam(apiPayload as Partial<Exam>);
        toast.success('Examen creado exitosamente');
      }

      onSaved();
    } catch (error) {
      console.error('Error al guardar examen:', error);
      toast.error('Error al guardar el examen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const baseInputClass = "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Información básica */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Nombre del Examen *
          </label>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Ej: Examen de Nivelación A1"
                className={baseInputClass}
              />
            )}
          />
          {errors.name && (
            <p className="text-red-400 text-sm">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Tipo de Examen *
          </label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className={baseInputClass}>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border border-gray-700">
                  <SelectItem className='hover:bg-gray-700 focus:bg-gray-700' value="placement">Colocación</SelectItem>
                  <SelectItem className='hover:bg-gray-700 focus:bg-gray-700' value="progress">Progreso</SelectItem>
                  <SelectItem className='hover:bg-gray-700 focus:bg-gray-700' value="final">Final</SelectItem>
                  <SelectItem className='hover:bg-gray-700 focus:bg-gray-700' value="practice">Práctica</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.type && (
            <p className="text-red-400 text-sm">{errors.type.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Nivel Objetivo *
          </label>
          <Controller
            name="targetLevel"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isLoadingLevels}>
                <SelectTrigger className={baseInputClass}>
                  <SelectValue placeholder={isLoadingLevels ? "Cargando niveles..." : "Selecciona el nivel"} />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border border-gray-700">
                  {levels
                    .filter(level => level.isActive)
                    .map((level) => (
                      <SelectItem
                        key={level._id}
                        className="hover:bg-gray-700 focus:bg-gray-700"
                        value={level.code}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{level.code}</span>
                          <span className="text-sm text-gray-400">- {level.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.targetLevel && (
            <p className="text-red-400 text-sm">{errors.targetLevel.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Puntaje Mínimo (%) *
          </label>
          <Controller
            name="structure.passingScore"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                min="1"
                max="100"
                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                className={baseInputClass}
              />
            )}
          />
          {errors.structure?.passingScore && (
            <p className="text-red-400 text-sm">{errors.structure.passingScore.message}</p>
          )}
        </div>
      </div>

      {/* Descripción */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Descripción
        </label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="Descripción del examen..."
              rows={3}
              className={baseInputClass}
            />
          )}
        />
      </div>

      {/* Configuración de Nivelación (solo para type=placement) */}
      {watchedType === 'placement' && (
        <div className="bg-blue-900/10 border border-blue-800/30 rounded-lg p-6 space-y-5">
          <h3 className="text-lg font-semibold text-blue-200">Configuración de Examen de Nivelación</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Modo</label>
              <Select
                value={placementConfig.mode}
                onValueChange={(v) => {
                  const newMode = v as 'static' | 'adaptive';
                  setPlacementConfig(p => ({ ...p, mode: newMode }));
                  if (newMode === 'adaptive') {
                    const current = getValues('structure.totalDuration');
                    if (!current || current === 0) setValue('structure.totalDuration', 60);
                    // Clear sections — adaptive doesn't use them, and empty instructions fails Zod
                    setValue('structure.sections', []);
                  } else {
                    // Restore a default section when switching back to static
                    const currentSections = getValues('structure.sections');
                    if (currentSections.length === 0) {
                      setValue('structure.sections', [{
                        id: Date.now().toString(),
                        name: 'Sección 1',
                        competency: 'reading',
                        instructions: '',
                        questionCount: 10,
                        questionTypes: ['multiple_choice'],
                        points: 10,
                        duration: 30,
                        order: 1
                      }]);
                    }
                  }
                }}
              >
                <SelectTrigger className={baseInputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border border-gray-700">
                  <SelectItem className="hover:bg-gray-700 focus:bg-gray-700" value="static">Estático (secciones fijas)</SelectItem>
                  <SelectItem className="hover:bg-gray-700 focus:bg-gray-700" value="adaptive">Adaptativo (CAT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                % mínimo por nivel para aprobar
              </label>
              <Input
                type="number"
                min="1"
                max="100"
                value={placementConfig.levelPassingThreshold}
                onChange={(e) => setPlacementConfig(p => ({ ...p, levelPassingThreshold: parseInt(e.target.value) || 60 }))}
                className={baseInputClass}
              />
            </div>

            {placementConfig.mode === 'adaptive' && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Nivel de inicio</label>
                  <Select
                    value={placementConfig.startingLevel}
                    onValueChange={(v) => setPlacementConfig(p => ({ ...p, startingLevel: v }))}
                  >
                    <SelectTrigger className={baseInputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border border-gray-700">
                      {PLACEMENT_LEVELS.map(l => (
                        <SelectItem key={l} className="hover:bg-gray-700 focus:bg-gray-700" value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Máx. preguntas</label>
                  <Input
                    type="number"
                    min="5"
                    max="50"
                    value={placementConfig.maxQuestions}
                    onChange={(e) => setPlacementConfig(p => ({ ...p, maxQuestions: parseInt(e.target.value) || 20 }))}
                    className={baseInputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Errores consecutivos para finalizar
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={placementConfig.consecutiveWrongThreshold}
                    onChange={(e) => setPlacementConfig(p => ({ ...p, consecutiveWrongThreshold: parseInt(e.target.value) || 3 }))}
                    className={baseInputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Duración total (minutos)
                  </label>
                  <Input
                    type="number"
                    min="5"
                    max="300"
                    value={watch('structure.totalDuration') || 60}
                    onChange={(e) => setValue('structure.totalDuration', parseInt(e.target.value) || 60)}
                    className={baseInputClass}
                  />
                </div>
              </>
            )}
          </div>

          {placementConfig.mode === 'adaptive' && (
            <div className="bg-yellow-900/10 border border-yellow-700/30 rounded-lg p-4 text-sm text-yellow-300">
              En modo adaptativo, el sistema selecciona preguntas dinámicamente. No es necesario configurar secciones (se ignorarán).
            </div>
          )}
        </div>
      )}

      {/* Secciones del examen — ocultar en modo adaptativo */}
      {!(watchedType === 'placement' && placementConfig.mode === 'adaptive') && (
      <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-200">Secciones del Examen</h3>
          <Button
            type="button"
            onClick={addSection}
            variant="outline"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Sección
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-200">Sección {index + 1}</h4>
              {fields.length > 1 && (
                <Button
                  type="button"
                  onClick={() => removeSection(index)}
                  variant="outline"
                  size="sm"
                  className="text-red-400 bg-gray-800 hover:bg-gray-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Nombre de la Sección *
                </label>
                <Controller
                  name={`structure.sections.${index}.name`}
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="Ej: Comprensión Lectora"
                      className={baseInputClass}
                    />
                  )}
                />
                {errors.structure?.sections?.[index]?.name && (
                  <p className="text-red-400 text-sm">
                    {errors.structure.sections[index]?.name?.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Competencia *
                </label>
                <Controller
                  name={`structure.sections.${index}.competency`}
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Trigger validation when competency changes
                        if (value && watchedTargetLevel && watchedSections[index]?.questionCount) {
                          validateSectionQuestions(index, value, watchedSections[index].questionCount, watchedTargetLevel);
                        }
                      }}
                    >
                      <SelectTrigger className={baseInputClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border border-gray-700">
                        <SelectItem className='hover:bg-gray-700 focus:bg-gray-700' value="reading">Comprensión Lectora</SelectItem>
                        <SelectItem className='hover:bg-gray-700 focus:bg-gray-700' value="writing">Expresión Escrita</SelectItem>
                        <SelectItem className='hover:bg-gray-700 focus:bg-gray-700' value="listening">Comprensión Auditiva</SelectItem>
                        <SelectItem className='hover:bg-gray-700 focus:bg-gray-700' value="speaking">Expresión Oral</SelectItem>
                        <SelectItem className='hover:bg-gray-700 focus:bg-gray-700' value="grammar">Gramática</SelectItem>
                        <SelectItem className='hover:bg-gray-700 focus:bg-gray-700' value="vocabulary">Vocabulario</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Número de Preguntas *
                </label>
                <Controller
                  name={`structure.sections.${index}.questionCount`}
                  control={control}
                  render={({ field }) => (
                    <div>
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        max={availability[`${watchedSections[index]?.competency}-${watchedTargetLevel}`]?.maxAllowed || undefined}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          const maxAllowed = availability[`${watchedSections[index]?.competency}-${watchedTargetLevel}`]?.maxAllowed || Infinity;

                          // Limitar al máximo disponible
                          const finalValue = value > maxAllowed ? maxAllowed : value;
                          field.onChange(finalValue);

                          // Trigger validation
                          if (watchedSections[index]?.competency && watchedTargetLevel) {
                            validateSectionQuestions(index, watchedSections[index].competency, finalValue, watchedTargetLevel);
                          }
                        }}
                        className={`${baseInputClass} ${
                          validationErrors[`section-${index}`] ? 'border-red-500' : ''
                        }`}
                      />

                      {/* Indicador de disponibilidad */}
                      <QuestionAvailabilityIndicator
                        competency={watchedSections[index]?.competency || ''}
                        level={watchedTargetLevel || ''}
                        neededCount={field.value || 0}
                        availability={availability}
                        loading={availabilityLoading}
                      />

                      {/* Error de validación */}
                      {validationErrors[`section-${index}`] && (
                        <p className="text-red-400 text-xs mt-1">
                          {validationErrors[`section-${index}`]}
                        </p>
                      )}
                    </div>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Puntos *
                </label>
                <Controller
                  name={`structure.sections.${index}.points`}
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="number"
                      min="1"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      className={baseInputClass}
                    />
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Duración (min) *
                </label>
                <Controller
                  name={`structure.sections.${index}.duration`}
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="number"
                      min="1"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      className={baseInputClass}
                    />
                  )}
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Instrucciones *
              </label>
              <Controller
                name={`structure.sections.${index}.instructions`}
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    placeholder="Instrucciones para esta sección..."
                    rows={2}
                    className={baseInputClass}
                  />
                )}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Resumen de totales */}
      <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
        <h4 className="font-medium text-blue-200 mb-3">Resumen del Examen</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Preguntas:</span>
            <p className="text-white font-medium">{watch('structure.totalQuestions')}</p>
          </div>
          <div>
            <span className="text-gray-400">Total Puntos:</span>
            <p className="text-white font-medium">{watch('structure.totalPoints')}</p>
          </div>
          <div>
            <span className="text-gray-400">Duración Total:</span>
            <p className="text-white font-medium">{watch('structure.totalDuration')} min</p>
          </div>
          <div>
            <span className="text-gray-400">Puntaje Mínimo:</span>
            <p className="text-white font-medium">{watch('structure.passingScore')}%</p>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Configuración */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-200">Configuración</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Aleatorizar preguntas
              </label>
              <Controller
                name="configuration.randomizeQuestions" 
                control={control}
                render={({ field }) => (
                  <Switch
                    className="bg-gray-600 border border-line"
                    checked={field.value}
                  disabled={true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Aleatorizar opciones
              </label>
              <Controller
                name="configuration.randomizeOptions"
                control={control}
                render={({ field }) => (
                  <Switch
                    className="bg-gray-600 border border-line"
                    checked={field.value}
                    disabled={true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Mostrar resultados
              </label>
              <Controller
                name="configuration.showResults"
                control={control}
                render={({ field }) => (
                  <Switch
                    className="bg-gray-600 border border-line"
                    checked={field.value}
                    disabled={true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Permitir revisión
              </label>
              <Controller
                name="configuration.allowReview"
                control={control}
                render={({ field }) => (
                  <Switch
                    className="bg-gray-600 border border-line"
                    checked={field.value}
                    disabled={true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Máximo de intentos
              </label>
              <Controller
                name="configuration.maxAttempts"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="number"
                    min="1"
                    max="10"
                    disabled={true}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    className={baseInputClass}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Es plantilla
              </label>
              <Controller
                name="isTemplate"
                control={control}
                render={({ field }) => (
                  <Switch
                    className="bg-gray-600 border border-line"
                    checked={field.value}
                    disabled={true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Activo
              </label>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Switch
                    className="bg-gray-600 border border-line"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex items-center gap-4 pt-6 border-t border-gray-700">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando...
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white">
              <Save className="w-4 h-4" />
              {exam ? 'Actualizar' : 'Crear'} Examen
            </div>
          )}
        </Button>

        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="border-gray-600 bg-box border-line text-gray-300 hover:bg-gray-700"
        >
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default ExamForm;