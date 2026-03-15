import { Button } from '@/components/atoms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Textarea } from '@/components/atoms/textarea';
import { Image as ImageIcon, Mic, Plus, Sparkles, Trash2, Volume2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

// Importar los nuevos componentes de audio elegantes
import { AudioPlayer, AudioRecorder } from '@/components/audio';
import AIQuestionGenerator from './AIQuestionGenerator';

import { useLevels } from '../hooks/useLevels';
import { useQuestions } from '../hooks/useQuestions';
import { useRubrics } from '../hooks/useRubrics';
import type {
  Competency,
  Level,
  Question,
  QuestionOption,
  QuestionType,
} from '../types';
import type { Rubric } from '../types/rubrics.types';

// Tipos válidos por competencia MCER
const TYPES_BY_COMPETENCY: Record<string, QuestionType[]> = {
  reading:   ['multiple_choice', 'true_false', 'fill_blanks', 'matching', 'ordering', 'drag_drop', 'open_text', 'essay'],
  writing:   ['essay', 'open_text', 'fill_blanks', 'multiple_choice', 'true_false', 'matching', 'ordering', 'drag_drop'],
  listening: ['multiple_choice', 'true_false', 'fill_blanks', 'matching', 'ordering', 'open_text'],
  speaking:  ['audio_response'],
};

const DEFAULT_TYPE_BY_COMPETENCY: Record<string, QuestionType> = {
  reading:   'multiple_choice',
  writing:   'essay',
  listening: 'multiple_choice',
  speaking:  'audio_response',
};

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Opción Múltiple',
  true_false:      'Verdadero/Falso',
  open_text:       'Texto Abierto',
  essay:           'Ensayo',
  fill_blanks:     'Completar Espacios',
  drag_drop:       'Arrastrar y Soltar',
  matching:        'Emparejar',
  ordering:        'Ordenar',
  audio_response:  'Respuesta de Audio',
  file_upload:     'Subir Archivo',
};

interface Props {
  question: Question | null;
  onCancel: () => void;
  onSaved: () => void;
}

const QuestionForm: React.FC<Props> = ({ question, onCancel, onSaved }) => {
  const {
    createQuestion,
    updateQuestion,
    uploadAudio,
    uploadImage,
    createQuestionWithMedia,
    createQuestionWithMultipleMedia,
  } = useQuestions();

  // Hook para obtener niveles de la base de datos
  const { levels, isLoading: isLoadingLevels } = useLevels();

  // Hook para obtener rúbricas filtradas por competencia y nivel
  const { rubrics, isLoading: isLoadingRubrics } = useRubrics();

  // Estado inicial con valores por defecto
  const getInitialFormData = (question: Question | null): Partial<Question> => {
    if (question) {
      return {
        ...question,
        content: {
          question: question.content?.question || '',
          instructions: question.content?.instructions || '',
          context: question.content?.context || '',
          options: question.content?.options || [],
          correctAnswer: question.content?.correctAnswer || '',
          keywords: question.content?.keywords || [],
          mediaUrl: question.content?.mediaUrl || undefined,
          mediaType: question.content?.mediaType || 'audio',
          template: question.content?.template || '',
          blanks: question.content?.blanks || [],
          items: question.content?.items || [],
          promptAudioUrl: question.content?.promptAudioUrl || '',
          expectedResponseType:
            question.content?.expectedResponseType || 'sentence',
        },
        metadata: {
          topic: question.metadata?.topic || '',
          subtopic: question.metadata?.subtopic || '',
          tags: question.metadata?.tags || [],
          estimatedTime: question.metadata?.estimatedTime || undefined,
          points: question.metadata?.points || 1,
        },
        type: question.type || 'multiple_choice',
        competency: question.competency || 'reading',
        level: question.level || (levels.length > 0 ? levels[0].code : 'A1'),
        difficulty: question.difficulty || 3,
        points: question.points || 1,
        isActive: question.isActive !== undefined ? question.isActive : true,
      };
    }

    return {
      type: 'multiple_choice',
      competency: 'reading',
      level: levels.length > 0 ? levels[0].code : 'A1',
      difficulty: 3,
      content: {
        question: '',
        instructions: '',
        context: '',
        options: [],
        correctAnswer: '',
        keywords: [],
        mediaType: 'audio',
        template: '',
        blanks: [],
        items: [],
        promptAudioUrl: '',
        expectedResponseType: 'sentence',
      },
      points: 1,
      metadata: {
        topic: '',
        subtopic: '',
        tags: [],
        points: 1,
      },
      statistics: {
        timesUsed: 0,
        averageScore: 0,
        averageTime: 0,
      },
      isActive: true,
    };
  };

  const [formData, setFormData] = useState<Partial<Question>>(
    getInitialFormData(question)
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newOption, setNewOption] = useState('');
  const [tagInput, setTagInput] = useState('');
  // Estado para archivos multimedia de elementos individuales
  const [itemMediaFiles, setItemMediaFiles] = useState<{
    [itemIndex: number]: { audio?: File; image?: File };
  }>({});
  // Estado para el generador AI
  const [showAIGenerator, setShowAIGenerator] = useState(false);

  // Callback para cuando el AI genera una pregunta (audioFile = null para no-listening, File para listening)
  const handleAIQuestionGenerated = (generatedQuestion: Partial<Question>, mediaFile?: File | null) => {
    setFormData(generatedQuestion);
    setAudioFile(mediaFile !== undefined ? mediaFile : null);
    setImageFile(null);
    setItemMediaFiles({});
  };

  useEffect(() => {
    setFormData(getInitialFormData(question));
    setAudioFile(null);
    setImageFile(null);
    setItemMediaFiles({});
  }, [question]);

  // Actualizar formData cuando los niveles se carguen por primera vez
  useEffect(() => {
    if (levels.length > 0 && !formData.level) {
      setFormData(prev => ({
        ...prev,
        level: levels[0].code
      }));
    }
  }, [levels, formData.level]);

  // Tipos disponibles según la competencia seleccionada
  const availableTypes = useMemo<QuestionType[]>(() => {
    return TYPES_BY_COMPETENCY[formData.competency as string] ?? (Object.keys(TYPE_LABELS) as QuestionType[]);
  }, [formData.competency]);

  const typeIsFixed = availableTypes.length === 1;

  // Filtrar rúbricas por competencia y nivel actuales
  const availableRubrics = useMemo(() => {
    return rubrics.filter(rubric =>
      rubric.competency === formData.competency &&
      rubric.level === formData.level &&
      rubric.isActive
    );
  }, [rubrics, formData.competency, formData.level]);

  // Determinar qué componentes mostrar basado en el tipo de pregunta
  const needsOptions =
    formData.type &&
    ['multiple_choice', 'true_false'].includes(formData.type as string);
  const canHaveMedia = true; // Cualquier pregunta puede tener multimedia
  const needsAudioInput = formData.type === 'audio_response';
  const isListeningQuestion = formData.competency === 'listening';
  const needsFillBlanks = formData.type === 'fill_blanks';
  const needsItems =
    formData.type &&
    ['drag_drop', 'matching', 'ordering'].includes(formData.type as string);
  const showMultimedia =
    canHaveMedia &&
    (isListeningQuestion || needsAudioInput || formData.content?.mediaUrl);

  // Helper: detect if any item has media (audio/image) either selected in state or present in data
  const anyItemHasMedia = () => {
    // check state selection
    if (Object.values(itemMediaFiles).some(f => !!(f.audio || f.image))) return true;
    // check existing items in formData
    const items = formData.content?.items || [];
    for (const it of items) {
      if (!it) continue;
      if (it.mediaType === 'audio' || it.mediaType === 'image') return true;
      if (typeof it.mediaUrl === 'string') {
        if (it.mediaUrl.startsWith('blob:')) return true;
        if (it.mediaUrl.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) return true;
        if (it.mediaUrl.match(/\.(jpe?g|png|gif|webp|svg)$/i)) return true;
      }
    }
    return false;
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    const option: QuestionOption = {
      id: Date.now().toString(),
      text: newOption,
      isCorrect: false,
    };
    setFormData((prev: Partial<Question>) => ({
      ...prev,
      content: {
        ...prev.content!,
        options: [...(prev.content?.options || []), option],
      },
    }));
    setNewOption('');
  };

  const removeOption = (id: string) => {
    setFormData((prev: Partial<Question>) => ({
      ...prev,
      content: {
        ...prev.content!,
        options:
          prev.content?.options?.filter((o: QuestionOption) => o.id !== id) ||
          [],
      },
    }));
  };

  const setCorrectOption = (id: string) => {
    setFormData((prev: Partial<Question>) => ({
      ...prev,
      content: {
        ...prev.content!,
        options:
          prev.content?.options?.map((o: QuestionOption) => ({
            ...o,
            isCorrect: o.id === id,
          })) || [],
        correctAnswer: id,
      },
    }));
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setFormData((prev: Partial<Question>) => ({
      ...prev,
      metadata: {
        ...prev.metadata!,
        tags: [...(prev.metadata?.tags || []), tagInput.trim()],
      },
    }));
    setTagInput('');
  };

  const removeTag = (i: number) => {
    setFormData((prev: Partial<Question>) => ({
      ...prev,
      metadata: {
        ...prev.metadata!,
        tags:
          prev.metadata?.tags?.filter((_: string, idx: number) => idx !== i) ||
          [],
      },
    }));
  };

  // Manejar grabación de audio completada
  const handleRecordingComplete = (audioBlob: Blob) => {
    const mimeType = audioBlob.type || 'audio/webm';
    const ext = mimeType.split(';')[0].split('/')[1] || 'webm';
    const file = new File([audioBlob], `recording_${Date.now()}.${ext}`, { type: mimeType });
    setAudioFile(file);
  };

  // Función de validación
  const validateQuestionData = (data: Partial<Question>) => {
    // Allow empty main question for listening-matching when items include media (audio/image).
    const allowEmptyQuestion = (data as any)._allowEmptyQuestion === true;
    if (!data.content?.question?.trim() && !allowEmptyQuestion) {
      throw new Error('La pregunta es requerida');
    }

    if (
      data.type === 'multiple_choice' &&
      (!data.content?.options || data.content.options.length < 2)
    ) {
      throw new Error(
        'Las preguntas de opción múltiple necesitan al menos 2 opciones'
      );
    }

    if (
      data.type === 'true_false' &&
      (!data.content?.options || data.content.options.length !== 2)
    ) {
      throw new Error(
        'Las preguntas verdadero/falso necesitan exactamente 2 opciones'
      );
    }

    if (data.competency === 'listening') {
      // Check main media or recorded/uploaded audio
      const hasMainAudio = !!data.content?.mediaUrl || !!audioFile;

      // Check if any item has audio declared in the payload (mediaType or mediaUrl)
      const itemsHaveAudioInData = Array.isArray(data.content?.items)
        ? data.content!.items.some((it: any) => it && (it.mediaType === 'audio' || (typeof it.mediaUrl === 'string' && it.mediaUrl.startsWith('blob:'))))
        : false;

      // Check if there are audio files selected in the form state for items
      const itemsHaveAudioInState = Object.values(itemMediaFiles).some(f => !!f.audio);

      if (!hasMainAudio && !itemsHaveAudioInData && !itemsHaveAudioInState) {
        throw new Error('Las preguntas de listening requieren audio');
      }
    }

    if (
      data.type === 'fill_blanks' &&
      !data.content?.template?.includes('___')
    ) {
      throw new Error(
        'Las preguntas de completar espacios necesitan al menos un espacio marcado con ___'
      );
    }

    if (
      data.type === 'matching' &&
      (!data.content?.items || data.content.items.length < 2)
    ) {
      throw new Error(
        'Las preguntas de emparejar necesitan al menos 2 elementos'
      );
    }

    if (
      data.type === 'ordering' &&
      (!data.content?.items || data.content.items.length < 3)
    ) {
      throw new Error(
        'Las preguntas de ordenar necesitan al menos 3 elementos'
      );
    }

    if (
      data.type === 'drag_drop' &&
      (!data.content?.items || data.content.items.length < 2)
    ) {
      throw new Error(
        'Las preguntas de arrastrar y soltar necesitan al menos 2 elementos'
      );
    }

    if (data.type === 'audio_response' && !data.content?.expectedResponseType) {
      throw new Error(
        'Las preguntas de respuesta de audio necesitan especificar el tipo de respuesta esperada'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanedData = JSON.parse(JSON.stringify(formData));

      // If this is a matching question for listening and there are item media files,
      // allow the main question text to be empty (items will supply audio/image content).
      const hasItemMediaFiles = Object.keys(itemMediaFiles).length > 0;
      const itemsHaveMedia = Array.isArray(cleanedData.content?.items) && cleanedData.content!.items.some((it: any) => !!(it.mediaUrl || it.mediaType));
      if (cleanedData.type === 'matching' && cleanedData.competency === 'listening' && (hasItemMediaFiles || itemsHaveMedia)) {
        (cleanedData as any)._allowEmptyQuestion = true;
      }

      // Strip blob URLs — they are temporary local previews and cannot be stored in DB
      if (cleanedData.content?.mediaUrl?.startsWith('blob:')) {
        delete cleanedData.content.mediaUrl;
        delete cleanedData.content.mediaType;
      }

      if (
        cleanedData.content?.mediaUrl === '' ||
        !cleanedData.content?.mediaUrl?.trim()
      ) {
        delete cleanedData.content.mediaUrl;
      }

      // Validar datos antes de enviar
      validateQuestionData(cleanedData);

      if (
        !cleanedData.metadata?.estimatedTime ||
        cleanedData.metadata.estimatedTime <= 0
      ) {
        if (cleanedData.metadata) {
          delete cleanedData.metadata.estimatedTime;
        }
      }

      let saved: Question | undefined;

      if (question?._id) {
        saved = await updateQuestion(question._id, cleanedData);

        if (saved?._id) {
          if (audioFile) await uploadAudio(saved._id, audioFile);
          if (imageFile) await uploadImage(saved._id, imageFile);
        }
      } else {
        // Determinar si necesitamos el endpoint con múltiples archivos
        const hasItemMedia = Object.keys(itemMediaFiles).length > 0;
        const mainMediaFile = audioFile || imageFile;
        
        if (hasItemMedia) {
          // Limpiar blob URLs temporales antes de enviar
          const cleanedDataForMultimedia = { ...cleanedData };
          if (cleanedDataForMultimedia.content?.items) {
            cleanedDataForMultimedia.content.items = cleanedDataForMultimedia.content.items.map((item:any) => {
              if (item.mediaUrl?.startsWith('blob:')) {
                // Remover blob URLs temporales - se reemplazarán con URLs reales del servidor
                const { mediaUrl, ...itemWithoutBlobUrl } = item;
                return itemWithoutBlobUrl;
              }
              return item;
            });
          }
          
          // Usar el nuevo endpoint para múltiples archivos
          saved = await createQuestionWithMultipleMedia(
            cleanedDataForMultimedia,
            itemMediaFiles,
            mainMediaFile || undefined,
            audioFile ? 'audio' : 'image'
          );
        } else if (mainMediaFile) {
          // Usar el endpoint original para archivo único
          const mediaType = audioFile ? 'audio' : 'image';
          saved = await createQuestionWithMedia(
            cleanedData,
            mainMediaFile,
            mediaType
          );
        } else {
          // Sin archivos multimedia
          saved = await createQuestion(cleanedData);
        }
      }

      onSaved();
    } catch (err: any) {
      console.error('Error al guardar la pregunta:', err);
      toast.error(err?.message || 'Error al guardar la pregunta');
    }
  };

  const baseInputClass =
    'bg-muted/50 border-border text-foreground placeholder-muted-foreground border-[0.5px] focus:border-blue-500 focus:ring-0 rounded-lg';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Meta */}
      <Card className="border border-line">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-lg">Metadatos</CardTitle>
              <CardDescription className="text-sm">Configura tipo, competencia y nivel</CardDescription>
            </div>
            {/* Botón AI integrado en el header */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAIGenerator(true)}
              className="gap-2 bg-gradient-to-r from-purple-500/10 to-blue-600/30 border border-purple-500/30 text-purple-300 hover:from-purple-500/20 hover:to-blue-600/40"
              disabled={!formData.competency || !formData.level}
            >
              <Sparkles className="w-4 h-4" />
              Generar con IA
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Tipo de pregunta — filtrado por competencia */}
            <div className="space-y-2">
              <Label>Tipo de Pregunta</Label>
              {typeIsFixed ? (
                <div className={`${baseInputClass} flex items-center px-3 h-10 gap-2`}>
                  <span className="text-foreground text-sm">{TYPE_LABELS[availableTypes[0]]}</span>
                  <span className="ml-auto text-xs text-muted-foreground italic">único disponible</span>
                </div>
              ) : (
                <Select
                  value={formData.type as string}
                  onValueChange={(v: QuestionType) =>
                    setFormData((p: Partial<Question>) => ({ ...p, type: v }))
                  }
                >
                  <SelectTrigger className={baseInputClass}>
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-line">
                    {availableTypes.map(type => (
                      <SelectItem key={type} className="hover:bg-muted" value={type}>
                        {TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Competencia */}
            <div className="space-y-2">
              <Label>Competencia</Label>
              <Select
                value={formData.competency as string}
                onValueChange={(v: Competency) => {
                  const allowed = TYPES_BY_COMPETENCY[v] ?? [];
                  const currentType = formData.type as QuestionType | undefined;
                  const newType = currentType && allowed.includes(currentType)
                    ? currentType
                    : DEFAULT_TYPE_BY_COMPETENCY[v];
                  setFormData((p: Partial<Question>) => ({ ...p, competency: v, type: newType }));
                }}
              >
                <SelectTrigger className={baseInputClass}>
                  <SelectValue placeholder="Selecciona la competencia" />
                </SelectTrigger>
                <SelectContent className="bg-card border border-line">
                  <SelectItem className="hover:bg-muted" value="reading">
                    Comprensión Lectora
                  </SelectItem>
                  <SelectItem className="hover:bg-muted" value="writing">
                    Expresión Escrita
                  </SelectItem>
                  <SelectItem className="hover:bg-muted" value="listening">
                    Comprensión Auditiva
                  </SelectItem>
                  <SelectItem className="hover:bg-muted" value="speaking">
                    Expresión Oral
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nivel */}
            <div className="space-y-2">
              <Label>Nivel MCER</Label>
              <Select
                value={formData.level as string}
                onValueChange={(v: Level) =>
                  setFormData((p: Partial<Question>) => ({ ...p, level: v }))
                }
                disabled={isLoadingLevels}
              >
                <SelectTrigger className={baseInputClass}>
                  <SelectValue placeholder={isLoadingLevels ? "Cargando niveles..." : "Selecciona el nivel"} />
                </SelectTrigger>
                <SelectContent className="bg-card border border-line">
                  {levels
                    .filter(level => level.isActive)
                    .map((level) => (
                      <SelectItem
                        key={level._id}
                        className="hover:bg-muted"
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
            </div>

            {/* Rúbrica - Para tipos subjetivos en competencias que la soportan */}
            {(['essay', 'open_text', 'audio_response'].includes(formData.type || '') &&
              ['reading', 'writing', 'listening', 'speaking'].includes(formData.competency || '')) && (
              <div className="space-y-2">
                <Label>Rúbrica de Evaluación</Label>
                <Select
                  value={formData.metadata?.rubricId || ''}
                  onValueChange={(rubricId: string) =>
                    setFormData((p: Partial<Question>) => ({
                      ...p,
                      metadata: {
                        topic: p.metadata?.topic || '',
                        ...p.metadata,
                        rubricId
                      }
                    }))
                  }
                  disabled={isLoadingRubrics || availableRubrics.length === 0}
                >
                  <SelectTrigger className={baseInputClass}>
                    <SelectValue
                      placeholder={
                        isLoadingRubrics
                          ? "Cargando rúbricas..."
                          : availableRubrics.length === 0
                            ? "No hay rúbricas disponibles"
                            : "Selecciona una rúbrica"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-line">
                    {availableRubrics.map((rubric: Rubric) => (
                      <SelectItem
                        key={rubric._id}
                        className="hover:bg-muted"
                        value={rubric._id!}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{rubric.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {rubric.scoringType === 'holistic' ? 'Holística' : 'Analítica'} •
                            {rubric.criteria.length} criterio(s) • Max: {rubric.maxScore}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Mensaje informativo */}
                {availableRubrics.length === 0 && (formData.competency && formData.level) && (
                  <p className="text-sm text-amber-400">
                    No hay rúbricas para {({'reading':'Comprensión Lectora','writing':'Expresión Escrita','listening':'Comprensión Auditiva','speaking':'Expresión Oral'} as Record<string,string>)[formData.competency] || formData.competency} nivel {formData.level}.{' '}
                    <span className="underline cursor-pointer">
                      Crea una desde Configuración → Rúbricas.
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Dificultad / Puntos / Estado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Dificultad</Label>
              <Select
                value={String(formData.difficulty ?? 3)}
                onValueChange={v =>
                  setFormData((p: Partial<Question>) => ({
                    ...p,
                    difficulty: Number(v),
                  }))
                }
              >
                <SelectTrigger className={baseInputClass}>
                  <SelectValue placeholder="Selecciona la dificultad" />
                </SelectTrigger>
                <SelectContent className="bg-card border border-line">
                  <SelectItem className="hover:bg-muted" value="1">
                    Muy Fácil
                  </SelectItem>
                  <SelectItem className="hover:bg-muted" value="2">
                    Fácil
                  </SelectItem>
                  <SelectItem className="hover:bg-muted" value="3">
                    Medio
                  </SelectItem>
                  <SelectItem className="hover:bg-muted" value="4">
                    Difícil
                  </SelectItem>
                  <SelectItem className="hover:bg-muted" value="5">
                    Muy Difícil
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Puntos</Label>
              <Input
                type="number"
                min={1}
                value={formData.points ?? 1}
                onChange={e =>
                  setFormData((p: Partial<Question>) => ({
                    ...p,
                    points: Number(e.target.value),
                  }))
                }
                className={baseInputClass}
              />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={formData.isActive ?? true ? 'true' : 'false'}
                onValueChange={v =>
                  setFormData((p: Partial<Question>) => ({
                    ...p,
                    isActive: v === 'true',
                  }))
                }
              >
                <SelectTrigger className={baseInputClass}>
                  <SelectValue placeholder="Selecciona el estado" />
                </SelectTrigger>
                <SelectContent className="bg-card border border-line">
                  <SelectItem className="hover:bg-muted" value="true">
                    Activa
                  </SelectItem>
                  <SelectItem className="hover:bg-muted" value="false">
                    Inactiva
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenido */}
      <Card className="border border-line">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-lg">Contenido</CardTitle>
          <CardDescription className="text-sm">Enunciado e instrucciones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label>Pregunta *</Label>
              <Textarea
                rows={2}
                value={formData.content?.question || ''}
                onChange={e =>
                  setFormData((p: Partial<Question>) => ({
                    ...p,
                    content: { ...p.content!, question: e.target.value },
                  }))
                }
                className={baseInputClass}
              />
            </div>

            <div className="space-y-2">
              <Label>Instrucciones (opcional)</Label>
              <Textarea
                rows={2}
                value={formData.content?.instructions || ''}
                onChange={e =>
                  setFormData((p: Partial<Question>) => ({
                    ...p,
                    content: { ...p.content!, instructions: e.target.value },
                  }))
                }
                className={baseInputClass}
              />
            </div>

            {/* Campo de Contexto para Reading Comprehension */}
            {(formData.competency === 'reading' || formData.competency === 'listening') && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Contexto {formData.competency === 'reading' ? '(Texto para leer)' : '(Descripción del audio)'}
                  {/* {formData.content?.context && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                      ✓ Generado por IA
                    </span>
                  )} */}
                  <span className="text-xs text-muted-foreground">
                    - Texto que los estudiantes usarán para responder
                  </span>
                </Label>
                <Textarea
                  rows={formData.content?.context ? Math.min(6, Math.ceil((formData.content.context.length || 0) / 100)) : 4}
                  value={formData.content?.context || ''}
                  onChange={e =>
                  setFormData((p: Partial<Question>) => ({
                    ...p,
                    content: { ...p.content!, context: e.target.value },
                  }))
                  }
                  onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 320) + 'px';
                  }}
                  spellCheck
                  placeholder={
                  formData.competency === 'reading'
                    ? "Escribe o pega aquí el texto que los estudiantes deben leer para responder la pregunta..."
                    : "Describe el contexto o contenido del audio que los estudiantes escucharán..."
                  }
                  className={`${baseInputClass} resize-y min-h-[96px] max-h-[320px] overflow-auto transition-colors duration-150 placeholder:italic ${
                  formData.content?.context ? 'border-purple-500/30 bg-green-100/5' : ''
                  } transition-colors focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus:border-purpple-400/50 shadow-none focus:shadow-none`}
                />
                {formData.content?.context && (
                  <p className="text-xs text-muted-foreground mt-1">
                  {formData.content.context.trim().split(/\s+/).filter(Boolean).length} palabras
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Opciones */}
          {needsOptions && (
            <div className="space-y-2">
              <Label>Opciones</Label>
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  placeholder="Escribe una opción..."
                  className={baseInputClass + ' flex-1'}
                />
                <Button type="button" onClick={addOption} className="gap-1">
                  <Plus className="w-4 h-4" />
                  Agregar
                </Button>
              </div>

              <div className="space-y-2">
                {formData.content?.options?.map((opt: QuestionOption) => (
                  <div
                    key={opt.id}
                    className="flex items-center gap-2 p-2 bg-muted/40 border border-border rounded-lg"
                  >
                    <input
                      type="radio"
                      name="correctOption"
                      checked={!!opt.isCorrect}
                      onChange={() => setCorrectOption(opt.id)}
                      className="w-4 h-4"
                    />
                    <span className="flex-1 text-foreground/90">{opt.text}</span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeOption(opt.id)}
                      className="p-2 border-border hover:bg-muted"
                      title="Eliminar opción"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fill Blanks */}
          {needsFillBlanks && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Plantilla con espacios en blanco</Label>
                <p className="text-sm text-muted-foreground">
                  Usa <code className="bg-muted px-1 rounded">___</code> para
                  marcar los espacios en blanco
                </p>
                <Textarea
                  rows={3}
                  value={formData.content?.template || ''}
                  onChange={e =>
                    setFormData((p: Partial<Question>) => ({
                      ...p,
                      content: { ...p.content!, template: e.target.value },
                    }))
                  }
                  placeholder="Ejemplo: The cat is ___ the house and the dog is ___ the garden."
                  className={baseInputClass}
                />
              </div>

              <div className="space-y-2">
                <Label>Respuestas correctas (opcional)</Label>
                <p className="text-sm text-muted-foreground">
                  Define respuestas específicas para cada espacio. Si no se
                  definen, se evaluará como texto libre.
                </p>
                <Input
                  value={
                    typeof formData.content?.correctAnswer === 'string'
                      ? formData.content.correctAnswer
                      : (formData.content?.correctAnswer || []).join(', ')
                  }
                  onChange={e =>
                    setFormData((p: Partial<Question>) => ({
                      ...p,
                      content: {
                        ...p.content!,
                        correctAnswer: e.target.value,
                      },
                    }))
                  }
                  placeholder="in, outside (separadas por comas)"
                  className={baseInputClass}
                />
              </div>
            </div>
          )}

          {/* Items para drag_drop, matching, ordering */}
          {needsItems && (
            <div className="space-y-4">
              <Label>
                {formData.type === 'drag_drop' &&
                  'Elementos para arrastrar y soltar'}
                {formData.type === 'matching' && 'Elementos para emparejar'}
                {formData.type === 'ordering' && 'Elementos para ordenar'}
              </Label>

              <div className="space-y-3">
                {formData.content?.items?.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 p-4 bg-muted/40 border border-border rounded-lg"
                  >
                    {/* Encabezado del elemento */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground/80 font-medium">
                        Elemento {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newItems =
                            formData.content?.items?.filter(
                              (_, i) => i !== index
                            ) || [];
                          setFormData((p: Partial<Question>) => ({
                            ...p,
                            content: { ...p.content!, items: newItems },
                          }));
                        }}
                        className="h-8 w-8 p-0 border-border hover:bg-muted"
                        title="Eliminar elemento"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>

                    {/* Contenido principal */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm">
                          {formData.type === 'matching' ? 'Elemento A' : 'Contenido'}
                        </Label>
                        <Input
                          value={item.content}
                          onChange={e => {
                            const newItems = [...(formData.content?.items || [])];
                            newItems[index] = { ...item, content: e.target.value };
                            setFormData((p: Partial<Question>) => ({
                              ...p,
                              content: { ...p.content!, items: newItems },
                            }));
                          }}
                          placeholder="Contenido del elemento"
                          className={baseInputClass}
                        />
                      </div>

                      {formData.type === 'matching' && (
                        <div className="space-y-2">
                          <Label className="text-sm">Elemento B (pareja)</Label>
                          <Input
                            value={item.matchingPair || ''}
                            onChange={e => {
                              const newItems = [...(formData.content?.items || [])];
                              newItems[index] = {
                                ...item,
                                matchingPair: e.target.value,
                              };
                              setFormData((p: Partial<Question>) => ({
                                ...p,
                                content: { ...p.content!, items: newItems },
                              }));
                            }}
                            placeholder="Pareja correspondiente"
                            className={baseInputClass}
                          />
                        </div>
                      )}

                      {formData.type === 'ordering' && (
                        <div className="space-y-2">
                          <Label className="text-sm">Posición correcta</Label>
                          <Input
                            type="number"
                            value={item.correctPosition || ''}
                            onChange={e => {
                              const newItems = [...(formData.content?.items || [])];
                              newItems[index] = {
                                ...item,
                                correctPosition: Number(e.target.value),
                              };
                              setFormData((p: Partial<Question>) => ({
                                ...p,
                                content: { ...p.content!, items: newItems },
                              }));
                            }}
                            placeholder="Posición correcta"
                            className={baseInputClass}
                            min={1}
                          />
                        </div>
                      )}
                    </div>

                    {/* Multimedia para el elemento */}
                    <div className="space-y-3 pt-3 border-t border-border">
                      <Label className="text-sm text-blue-300 flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        Multimedia para elemento {index + 1} (opcional)
                      </Label>
                      
                      {/* Mostrar multimedia existente o preview según archivos seleccionados */}
                      {(() => {
                        const filesForItem = itemMediaFiles[index];
                        const hasSelectedAudio = !!(filesForItem && filesForItem.audio);
                        const hasSelectedImage = !!(filesForItem && filesForItem.image);
                        const mediaUrl = item.mediaUrl;
                        const audioRx = /\.(mp3|wav|ogg|m4a|aac)$/i;
                        const imageRx = /\.(jpe?g|png|gif|webp|svg)$/i;

                        if (hasSelectedAudio || (mediaUrl && audioRx.test(mediaUrl))) {
                          return (
                            <div className="p-3 bg-muted/30 border border-border rounded-lg">
                              <div className="text-sm text-muted-foreground mb-2">Archivo actual:</div>
                              <AudioPlayer
                                src={mediaUrl ?? ''}
                                variant="compact"
                                title={`Audio elemento ${index + 1}`}
                                className="max-w-xs"
                              />
                            </div>
                          );
                        }

                        if (hasSelectedImage || (mediaUrl && imageRx.test(mediaUrl))) {
                          return (
                            <div className="p-3 bg-muted/30 border border-border rounded-lg">
                              <div className="text-sm text-muted-foreground mb-2">Archivo actual:</div>
                              <img
                                src={mediaUrl}
                                alt={`Imagen elemento ${index + 1}`}
                                className="h-20 w-auto rounded border border-border"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            </div>
                          );
                        }

                        return null;
                      })()}

                      {/* Controles para subir multimedia: ocultar inputs si ya hay archivo seleccionado para el item */}
                      <div className="flex gap-2 items-center">
                        {!(itemMediaFiles[index] && (itemMediaFiles[index].audio || itemMediaFiles[index].image)) ? (
                          <>
                            <label
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border border-border hover:bg-muted/50 transition-all text-sm ${baseInputClass}`}
                            >
                              <Volume2 className="w-4 h-4" />
                              <span>Audio</span>
                              <input
                                type="file"
                                accept="audio/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setItemMediaFiles(prev => ({
                                      ...prev,
                                      [index]: {
                                        ...prev[index],
                                        audio: file
                                      }
                                    }));

                                    const tempUrl = URL.createObjectURL(file);
                                    const newItems = [...(formData.content?.items || [])];
                                    newItems[index] = { ...item, mediaUrl: tempUrl, mediaType: 'audio' };
                                    setFormData((p: Partial<Question>) => ({
                                      ...p,
                                      content: { ...p.content!, items: newItems },
                                    }));
                                  }
                                }}
                                className="hidden"
                              />
                            </label>

                            <label
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border border-border hover:bg-muted/50 transition-all text-sm ${baseInputClass}`}
                            >
                              <ImageIcon className="w-4 h-4" />
                              <span>Imagen</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setItemMediaFiles(prev => ({
                                      ...prev,
                                      [index]: {
                                        ...prev[index],
                                        image: file
                                      }
                                    }));

                                    const tempUrl = URL.createObjectURL(file);
                                    const newItems = [...(formData.content?.items || [])];
                                    newItems[index] = { ...item, mediaUrl: tempUrl, mediaType: 'image' };
                                    setFormData((p: Partial<Question>) => ({
                                      ...p,
                                      content: { ...p.content!, items: newItems },
                                    }));
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          </>
                        ) : (
                          // Mostrar nombre del archivo seleccionado y botón para quitar
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-foreground/90">
                              {itemMediaFiles[index]?.audio?.name || itemMediaFiles[index]?.image?.name}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // eliminar archivo seleccionado y preview
                                setItemMediaFiles(prev => {
                                  const copy = { ...prev };
                                  if (copy[index]) {
                                    delete copy[index].audio;
                                    delete copy[index].image;
                                    if (Object.keys(copy[index]).length === 0) delete copy[index];
                                  }
                                  return copy;
                                });

                                const newItems = [...(formData.content?.items || [])];
                                newItems[index] = { ...item, mediaUrl: undefined };
                                setFormData((p: Partial<Question>) => ({
                                  ...p,
                                  content: { ...p.content!, items: newItems },
                                }));
                              }}
                              className="border-red-600 text-red-400 hover:bg-red-600/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  onClick={() => {
                    const newItem = {
                      id: Date.now().toString(),
                      content: '',
                      correctPosition:
                        formData.type === 'ordering'
                          ? (formData.content?.items?.length || 0) + 1
                          : undefined,
                      matchingPair:
                        formData.type === 'matching' ? '' : undefined,
                      mediaUrl: undefined,
                    };
                    setFormData((p: Partial<Question>) => ({
                      ...p,
                      content: {
                        ...p.content!,
                        items: [...(p.content?.items || []), newItem],
                      },
                    }));
                  }}
                  className="gap-1 w-full"
                  variant="outline"
                >
                  <Plus className="w-4 h-4" />
                  Agregar elemento
                </Button>

                {/* Ayuda para matching con multimedia */}
                {formData.type === 'matching' && (
                  <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-300 mb-2">
                      💡 Ejemplos de uso con multimedia:
                    </h4>
                    <ul className="text-sm text-blue-200 space-y-1">
                      <li>🔊 Audio + Texto: Emparejar sonidos con palabras</li>
                      <li>🖼️ Imagen + Texto: Emparejar imágenes con descripciones</li>
                      <li>🎵 Audio + Audio: Emparejar pronunciaciones</li>
                      <li>🖼️ Imagen + Imagen: Emparejar conceptos visuales</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Multimedia mejorado */}
      {showMultimedia && (
        <Card className="border border-line">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-blue-400" />
              Multimedia
            </CardTitle>
            <CardDescription className="text-sm">
              {isListeningQuestion &&
                'Audio requerido para comprensión auditiva'}
              {needsAudioInput && 'Configuración de respuesta de audio'}
              {!isListeningQuestion &&
                !needsAudioInput &&
                'Audio e imagen opcional para enriquecer la pregunta'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Audio para listening */}
            {formData.competency === 'listening' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Volume2 className="w-5 h-5 text-blue-400" />
                  <Label className="text-base font-medium">
                    Audio para Comprensión Auditiva
                  </Label>
                </div>

                {!anyItemHasMedia() ? (
                  <>
                    {/* Mostrar reproductor de audio existente */}
                    {formData.content?.mediaUrl &&
                      formData.content.mediaType === 'audio' && (
                        <div className="mb-4">
                          <div className="text-sm text-muted-foreground mb-3">Audio actual:</div>
                          {formData.content.mediaUrl.startsWith('blob:') ? (
                            <div className="text-sm text-amber-400 bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 flex items-start gap-2">
                              <span className="text-lg leading-none">🎵</span>
                              <div>
                                <p className="font-medium">Archivo de audio listo para guardar</p>
                                <p className="text-xs text-amber-300/80 mt-0.5">
                                  {audioFile ? `${audioFile.name} — se subirá al guardar la pregunta` : 'Selecciona el archivo de audio abajo para vincularlo'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <AudioPlayer
                              src={formData.content.mediaUrl}
                              variant="compact"
                              title="Audio de la pregunta"
                              showControls={{ volume: true, speed: true, seek: true, time: true }}
                              className="max-w-md"
                            />
                          )}
                        </div>
                      )}

                    {/* Botón para subir nuevo audio */}
                    <div className="flex items-center gap-3">
                      <label
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border transition-all hover:bg-muted/50 ${baseInputClass}`}
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>
                          {formData.content?.mediaUrl &&
                          formData.content.mediaType === 'audio'
                            ? 'Cambiar Audio'
                            : 'Seleccionar Audio'}
                        </span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={e => setAudioFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                      {audioFile && (
                        <span className="text-sm text-green-400 flex items-center gap-1">
                          ✓ {audioFile.name}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-yellow-300">
                    Se detectó multimedia en los elementos; el audio principal queda oculto.
                  </div>
                )}
              </div>
            )}

            {/* Configuración para audio_response */}
            {needsAudioInput && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Mic className="w-5 h-5 text-red-400" />
                  <Label className="text-base font-medium">
                    Audio de Pregunta y Configuración
                  </Label>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 border border-border">
                  <p className="text-sm text-muted-foreground mb-4">
                    Graba un audio con la pregunta o instrucciones que el
                    estudiante escuchará antes de responder.
                  </p>

                  {/* Tipo de respuesta esperada */}
                  <div className="space-y-2 mb-4">
                    <Label>Tipo de respuesta esperada</Label>
                    <Select
                      value={
                        formData.content?.expectedResponseType || 'sentence'
                      }
                      onValueChange={(
                        value: 'word' | 'sentence' | 'paragraph'
                      ) =>
                        setFormData((p: Partial<Question>) => ({
                          ...p,
                          content: {
                            ...p.content!,
                            expectedResponseType: value,
                          },
                        }))
                      }
                    >
                      <SelectTrigger className={baseInputClass}>
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border border-line">
                        <SelectItem value="word">Palabra</SelectItem>
                        <SelectItem value="sentence">Oración</SelectItem>
                        <SelectItem value="paragraph">Párrafo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Mostrar reproductor si hay audio existente */}
                  {formData.content?.mediaUrl &&
                    formData.content.mediaType === 'audio' && (
                      <div className="mb-4">
                        <div className="text-sm text-muted-foreground mb-2">
                          Audio actual:
                        </div>
                        <AudioPlayer
                          src={formData.content.mediaUrl}
                          variant="compact"
                          title="Audio de ejemplo"
                          showControls={{
                            volume: true,
                            speed: true,
                            seek: true,
                            time: true,
                          }}
                          className="max-w-md"
                        />
                      </div>
                    )}

                  {/* Grabador de audio elegante */}
                  <AudioRecorder
                    variant="compact"
                    maxDuration={180} // 3 minutos máximo
                    showWaveform={true}
                    onRecordingComplete={handleRecordingComplete}
                    onRecordingStart={() =>
                      console.log('Iniciando grabación...')
                    }
                    onRecordingStop={() => console.log('Grabación detenida')}
                    className="mb-4"
                  />

                  {/* Opción alternativa para subir archivo */}
                  <div className="pt-4 border-t border-border">
                    <div className="text-sm text-muted-foreground mb-2">
                      O sube un archivo de audio:
                    </div>
                    <label
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all hover:bg-muted/50 ${baseInputClass}`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Seleccionar archivo</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setAudioFile(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Imagen opcional */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-green-400" />
                <Label className="text-base font-medium">
                  Imagen (opcional)
                </Label>
              </div>

              {/* Mostrar imagen existente si hay */}
              {formData.content?.mediaUrl &&
                formData.content.mediaType === 'image' && (
                  <div className="mb-4 p-3 bg-muted/30 border border-border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-2">
                      Imagen actual:
                    </div>
                    <img
                      src={formData.content.mediaUrl}
                      alt="Imagen actual"
                      className="h-32 w-auto rounded border border-border cursor-pointer hover:border-blue-500 transition-colors"
                      onClick={() => {
                        const url = formData.content?.mediaUrl;
                        if (url) window.open(url, '_blank');
                      }}
                      title="Click para ver imagen completa"
                    />
                  </div>
                )}

              <div className="flex items-center gap-3">
                <label
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border transition-all hover:bg-muted/50 ${baseInputClass}`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>
                    {formData.content?.mediaUrl &&
                    formData.content.mediaType === 'image'
                      ? 'Cambiar Imagen'
                      : 'Seleccionar Imagen'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setImageFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {imageFile && (
                  <span className="text-sm text-green-400 flex items-center gap-1">
                    ✓ {imageFile.name}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadatos adicionales y Etiquetas combinados */}
      <Card className="border border-line">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-lg">Información adicional</CardTitle>
          <CardDescription className="text-sm">
            Tema, subtema y etiquetas para organización
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tema</Label>
              <Input
                value={formData.metadata?.topic || ''}
                onChange={e =>
                  setFormData((p: Partial<Question>) => ({
                    ...p,
                    metadata: { ...p.metadata!, topic: e.target.value },
                  }))
                }
                className={baseInputClass}
                placeholder="Ej: Gramática"
              />
            </div>

            <div className="space-y-2">
              <Label>Subtema</Label>
              <Input
                value={formData.metadata?.subtopic || ''}
                onChange={e =>
                  setFormData((p: Partial<Question>) => ({
                    ...p,
                    metadata: { ...p.metadata!, subtopic: e.target.value },
                  }))
                }
                className={baseInputClass}
                placeholder="Ej: Present Simple"
              />
            </div>
          </div>

          {/* Etiquetas integradas */}
          <div className="space-y-3">
            <Label>Etiquetas</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Agregar etiqueta..."
                className={baseInputClass + ' flex-1'}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addTag}>
                Agregar
              </Button>
            </div>
            {formData?.metadata?.tags && formData.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.metadata.tags.map((tag: string, i: number) => (
                  <span
                    key={`${tag}-${i}`}
                    className="px-2 py-1 bg-muted/50 border border-border text-foreground/90 rounded-full text-xs flex items-center gap-1.5"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(i)}
                      className="hover:text-red-400 text-xs"
                      title="Quitar etiqueta"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-line">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="text-foreground bg-transparent border border-line hover:bg-muted"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {question ? 'Guardar Cambios' : 'Crear Pregunta'}
        </Button>
      </div>

      {/* Modal de Generador AI */}
      <AIQuestionGenerator
        formData={formData}
        onQuestionGenerated={handleAIQuestionGenerated}
        isOpen={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
      />
    </form>
  );
};

export default QuestionForm;
