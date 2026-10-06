import { Label } from '@/components/keel/label';
import { FormSection } from '@/components/layout';
import { Alert, AlertDescription } from '@/components/keel/alert';
import { Spinner } from '@/components/keel/spinner';
import { Button } from '@/components/keel/button';
import { Input } from '@/components/keel/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/keel/select';
import { Switch } from '@/components/keel/switch';
import { Textarea } from '@/components/keel/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useExams } from '../hooks/useExams';
import { useLevels } from '../hooks/useLevels';
import { useQuestionAvailability } from '../hooks/useQuestionAvailability';
import type { Competency, Exam, ExamSection, Level } from '../types';
import { formatWeight, isWeightSumValid, sumWeights } from '../utils/weights';
import { COMPETENCY_SHORT } from '../constants/academic.constants';
import { SectionsBuilder } from './exam-sections/SectionsBuilder';
import { DEFAULT_INSTRUCTIONS, newSection, sectionsFromTemplate, type SectionDraft } from './exam-sections/sectionDefaults';

// Esquema de validación
const examSectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre es requerido'),
  competency: z.string().min(1, 'La competencia es requerida'),
  instructions: z.string().min(1, 'Las instrucciones son requeridas'),
  questionCount: z.number().min(1, 'Debe tener al menos 1 pregunta'),
  questionTypes: z.array(z.string()).min(1, 'Debe seleccionar al menos un tipo'),
  // An empty/invalid weight input is stored as NaN (see WeightInput), which
  // z.number() rejects as invalid_type — so submit is blocked with this message.
  weight: z
    .number({ invalid_type_error: 'Ingresa un peso entre 0 y 100', required_error: 'Ingresa un peso entre 0 y 100' })
    .min(0, 'El peso no puede ser negativo')
    .max(100, 'El peso no puede superar 100'),
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
type ExamSectionFormData = z.infer<typeof examSectionSchema>;

interface ExamFormProps {
  exam?: Exam | null;
  onCancel: () => void;
  onSaved: () => void;
}

const DEFAULT_QUESTION_TYPES = ['multiple_choice'];

/**
 * Persisted sections only store name/competency/duration/questionCount/weight
 * (exam-service `exam.model.ts`) and Mongo returns `_id` instead of `id`.
 * The form schema also requires id/instructions/questionTypes/order, so an
 * exam loaded from the API would fail zodResolver silently and never submit.
 * Fill the form-only fields with the same defaults a new section gets.
 */
const normalizeLoadedSections = (sections: ExamSection[]): ExamSectionFormData[] =>
  sections.map((section, index) => {
    const raw = section as Partial<ExamSection> & { _id?: string };
    const competency = raw.competency ?? 'reading';
    return {
      id: raw.id ?? raw._id ?? `section-${index}`,
      name: raw.name ?? '',
      competency,
      instructions: raw.instructions?.trim()
        ? raw.instructions
        : DEFAULT_INSTRUCTIONS[competency as keyof typeof DEFAULT_INSTRUCTIONS] ?? DEFAULT_INSTRUCTIONS.reading,
      questionCount: raw.questionCount ?? 0,
      questionTypes: raw.questionTypes?.length ? raw.questionTypes : [...DEFAULT_QUESTION_TYPES],
      weight: raw.weight ?? 0,
      duration: raw.duration,
      order: raw.order ?? index + 1
    };
  });

/** Flattens react-hook-form errors into their messages (skipping DOM refs). */
const collectErrorMessages = (node: unknown, acc: string[] = []): string[] => {
  if (!node || typeof node !== 'object') return acc;
  const { message } = node as { message?: unknown };
  if (typeof message === 'string' && message && !acc.includes(message)) acc.push(message);
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'ref' && key !== 'message' && key !== 'type' && key !== 'types') {
      collectErrorMessages(value, acc);
    }
  }
  return acc;
};

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
  const { checkAvailability, availability } = useQuestionAvailability();
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
        // New exams start from the full MCER template (six competencies, 20/20/20/20/10/10).
        sections: exam?.structure?.sections ? normalizeLoadedSections(exam.structure.sections) : sectionsFromTemplate('mcer'),
        totalQuestions: exam?.structure?.totalQuestions || 0,
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
        const totalDuration = currentSections.reduce((sum, section) => sum + (section?.duration || 0), 0);

        setValue('structure.totalQuestions', totalQuestions);
        setValue('structure.totalDuration', totalDuration);
      }
    });

    // También ejecutar una vez al inicializar
    const currentSections = getValues('structure.sections');
    const totalQuestions = currentSections.reduce((sum, section) => sum + (section.questionCount || 0), 0);
    const totalDuration = currentSections.reduce((sum, section) => sum + (section.duration || 0), 0);

    setValue('structure.totalQuestions', totalQuestions);
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

  // Question availability per section (cached per level by the hook). Checked
  // for every section on change; previously a single shared debounce meant
  // only the last section was ever validated.
  useEffect(() => {
    if (!watchedTargetLevel) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const next: Record<string, string> = {};
      for (const [index, section] of watchedSections.entries()) {
        if (!section?.competency || !section.questionCount) continue;
        const { isAvailable, maxAllowed } = await checkAvailability(section.competency, watchedTargetLevel, section.questionCount);
        if (!isAvailable) {
          const name = (COMPETENCY_SHORT[section.competency as keyof typeof COMPETENCY_SHORT] ?? section.competency).toLowerCase();
          next[`section-${index}`] = maxAllowed === 0
            ? `Todavía no hay preguntas de ${name} en ${watchedTargetLevel}`
            : `Solo hay ${maxAllowed} preguntas de ${name} en ${watchedTargetLevel}`;
        }
      }
      if (!cancelled) setValidationErrors(next);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [watchedTargetLevel, watchedSections, checkAvailability]);

  const setSections = (next: SectionDraft[]) =>
    setValue('structure.sections', next as ExamSectionFormData[], { shouldValidate: true, shouldDirty: true });

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

        // Validar que el peso de las secciones sume 100% (grading-section-weights:
        // Weight Sum Validation on Write — el backend rechaza el examen si no).
        const totalWeight = sumWeights(data.structure.sections.map(section => section.weight));
        if (!isWeightSumValid(totalWeight)) {
          toast.error(
            `Las secciones deben sumar 100% de peso (suma actual: ${formatWeight(totalWeight)}%). ` +
            "Usa 'Distribuir equitativamente' o ajusta a 100 (p. ej. 33.33 / 33.33 / 33.34)."
          );
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
            weight: section.weight,
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
      // useExams shows the success/error toast itself and returns null on
      // failure — keep the form open (with the teacher's input) in that case.
      const saved = exam?._id
        ? await updateExam(exam._id, apiPayload as Partial<Exam>)
        : await createExam(apiPayload as Partial<Exam>);

      if (!saved) return;

      onSaved();
    } catch (error) {
      console.error('Error al guardar examen:', error);
      toast.error('Error al guardar el examen');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Errores de campos sin mensaje visible (p. ej. campos ocultos) no deben
  // bloquear el envío en silencio.
  const onInvalid = (formErrors: FieldErrors<ExamFormData>) => {
    const messages = collectErrorMessages(formErrors);
    toast.error(
      messages.length > 0
        ? `No se pudo guardar el examen: ${messages.slice(0, 3).join(' · ')}`
        : 'No se pudo guardar el examen: revisa los campos del formulario'
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-3">
      {/* Información básica */}
      <FormSection title="Información básica">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            Nombre del Examen *
          </Label>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Ej: Examen de Nivelación A1"
              />
            )}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Tipo de Examen *
          </Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select value={field.value || null} onValueChange={(v) => v && field.onChange(v)} items={{ placement: 'Colocación', progress: 'Progreso', final: 'Final', practice: 'Práctica' }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placement">Colocación</SelectItem>
                  <SelectItem value="progress">Progreso</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                  <SelectItem value="practice">Práctica</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.type && (
            <p className="text-xs text-destructive">{errors.type.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Nivel Objetivo *
          </Label>
          <Controller
            name="targetLevel"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || null}
                onValueChange={(v) => v && field.onChange(v)}
                items={levels.map((level) => ({ value: level.code, label: `${level.code} - ${level.name}` }))}
                disabled={isLoadingLevels}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={isLoadingLevels ? "Cargando niveles..." : "Selecciona el nivel"} />
                </SelectTrigger>
                <SelectContent>
                  {levels
                    .filter(level => level.isActive)
                    .map((level) => (
                      <SelectItem
                        key={level._id}
                        value={level.code}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{level.code}</span>
                          <span className="text-sm text-muted-foreground">- {level.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.targetLevel && (
            <p className="text-xs text-destructive">{errors.targetLevel.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Puntaje Mínimo (%) *
          </Label>
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
              />
            )}
          />
          {errors.structure?.passingScore && (
            <p className="text-xs text-destructive">{errors.structure.passingScore.message}</p>
          )}
        </div>
      </div>

      {/* Descripción */}
      <div className="space-y-2">
        <Label>
          Descripción
        </Label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="Descripción del examen..."
              rows={3}
            />
          )}
        />
      </div>
      </FormSection>

      {/* Configuración de Nivelación (solo para type=placement) */}
      {watchedType === 'placement' && (
        <FormSection title="Configuración de nivelación" description="Cómo se elige el nivel del candidato">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Modo</Label>
              <Select
                value={placementConfig.mode}
                items={{ static: 'Estático (secciones fijas)', adaptive: 'Adaptativo (CAT)' }}
                onValueChange={(v) => {
                  if (!v) return;
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
                      setValue('structure.sections', [newSection('reading', 1, 100)]);
                    }
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Estático (secciones fijas)</SelectItem>
                  <SelectItem value="adaptive">Adaptativo (CAT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                % mínimo por nivel para aprobar
              </Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={placementConfig.levelPassingThreshold}
                onChange={(e) => setPlacementConfig(p => ({ ...p, levelPassingThreshold: parseInt(e.target.value) || 60 }))}
              />
            </div>

            {placementConfig.mode === 'adaptive' && (
              <>
                <div className="space-y-2">
                  <Label>Nivel de inicio</Label>
                  <Select
                    value={placementConfig.startingLevel}
                    onValueChange={(v) => v && setPlacementConfig(p => ({ ...p, startingLevel: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLACEMENT_LEVELS.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Máx. preguntas</Label>
                  <Input
                    type="number"
                    min="5"
                    max="50"
                    value={placementConfig.maxQuestions}
                    onChange={(e) => setPlacementConfig(p => ({ ...p, maxQuestions: parseInt(e.target.value) || 20 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Errores consecutivos para finalizar
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={placementConfig.consecutiveWrongThreshold}
                    onChange={(e) => setPlacementConfig(p => ({ ...p, consecutiveWrongThreshold: parseInt(e.target.value) || 3 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Duración total (minutos)
                  </Label>
                  <Input
                    type="number"
                    min="5"
                    max="300"
                    value={watch('structure.totalDuration') || 60}
                    onChange={(e) => setValue('structure.totalDuration', parseInt(e.target.value) || 60)}
                  />
                </div>
              </>
            )}
          </div>

          {placementConfig.mode === 'adaptive' && (
            <Alert>
              <AlertDescription>
                En modo adaptativo, el sistema selecciona preguntas dinámicamente. No es necesario configurar secciones (se ignorarán).
              </AlertDescription>
            </Alert>
          )}
        </FormSection>
      )}

      {/* Secciones del examen — ocultar en modo adaptativo */}
      {!(watchedType === 'placement' && placementConfig.mode === 'adaptive') && (
      <>
      <FormSection
        title="Secciones del examen"
        description="Cada sección evalúa una competencia; su peso es cuánto aporta al puntaje final."
      >
        <SectionsBuilder
          sections={watchedSections as SectionDraft[]}
          onChange={setSections}
          level={watchedTargetLevel || ''}
          availability={availability}
          errors={Object.fromEntries(
            watchedSections.map((sec, i) => [sec.id, validationErrors[`section-${i}`] || undefined]),
          )}
          onApplyTemplate={(previous) =>
            toast.success('Plantilla aplicada', {
              action: { label: 'Deshacer', onClick: () => setSections(previous) },
            })
          }
        />
      </FormSection>
      </>
      )}

      {/* Configuración */}
      <FormSection title="Configuración">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>
                Aleatorizar preguntas
              </Label>
              <Controller
                name="configuration.randomizeQuestions" 
                control={control}
                render={({ field }) => (
                  <Switch
                    
                    checked={field.value}
                  disabled={true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>
                Aleatorizar opciones
              </Label>
              <Controller
                name="configuration.randomizeOptions"
                control={control}
                render={({ field }) => (
                  <Switch
                    
                    checked={field.value}
                    disabled={true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>
                Mostrar resultados
              </Label>
              <Controller
                name="configuration.showResults"
                control={control}
                render={({ field }) => (
                  <Switch
                    
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
              <Label>
                Permitir revisión
              </Label>
              <Controller
                name="configuration.allowReview"
                control={control}
                render={({ field }) => (
                  <Switch
                    
                    checked={field.value}
                    disabled={true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Máximo de intentos
              </Label>
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
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>
                Es plantilla
              </Label>
              <Controller
                name="isTemplate"
                control={control}
                render={({ field }) => (
                  <Switch
                    
                    checked={field.value}
                    disabled={true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>
                Activo
              </Label>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Switch
                    
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
        </div>
      </FormSection>

      {/* Botones de acción */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" onClick={onCancel} variant="outline">
          <X />
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner /> : <Save />}
          {isSubmitting ? 'Guardando...' : exam ? 'Actualizar examen' : 'Crear examen'}
        </Button>
      </div>
    </form>
  );
};

export default ExamForm;