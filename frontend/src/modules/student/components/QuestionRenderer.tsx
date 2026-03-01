import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { AudioPlayer, AudioRecorder } from '@/components/audio';
import type { Question } from '@/modules/exams/types';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, CheckCircle, GripVertical, Loader2, RotateCcw, Shuffle, Volume2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface Props {
  question: Question | any;
  answer: any;
  onChange: (questionId: string, value: any) => void;
  className?: string;
  showQuestionNumber?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
  isUploadingAudio?: boolean;
  sectionInfo?: {
    name: string;
    competency: string;
    questionIndex: number;
    totalQuestionsInSection: number;
  };
}

// Función para detectar el tipo de media
const detectMediaType = (url?: string): 'audio' | 'image' | 'video' | null => {
  if (!url) return null;
  const u = url.toLowerCase();
  // data: URLs include the MIME type
  if (u.startsWith('data:')) {
    if (u.includes('audio/')) return 'audio';
    if (u.includes('image/')) return 'image';
    if (u.includes('video/')) return 'video';
  }
  // blob URLs often don't have extensions; try simple heuristics
  if (u.startsWith('blob:') || !u.includes('.')) {
    if (u.includes('audio')) return 'audio';
    if (u.includes('image') || u.includes('img')) return 'image';
    if (u.includes('video')) return 'video';
  }
  if (u.match(/\.(mp3|wav|ogg|m4a|aac)$/)) return 'audio';
  if (u.match(/\.(jpe?g|png|gif|webp|svg)$/)) return 'image';
  if (u.match(/\.(mp4|webm|avi|mov)$/)) return 'video';
  return null;
};

// Componente para mostrar multimedia en items
const ItemMediaPreview: React.FC<{ url?: string; explicitType?: 'audio' | 'image' | 'video' | null }> = ({ url, explicitType }) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  
  if (!url) return null;

  const type = explicitType ?? detectMediaType(url);
  
  // Si es una blob URL temporal, mostrar mensaje de error
  if (url.startsWith('blob:')) {
    return (
      <div className="text-xs text-red-400 bg-red-900/20 border border-red-700 rounded p-2">
        <AlertTriangle className="w-3 h-3 inline mr-1" />
        Error: Archivo no guardado correctamente
      </div>
    );
  }
  
  // Si explicit/audio detect => show audio player
  if (type === 'audio') {
    return (
      <AudioPlayer
        src={url}
        variant="compact"
        title="Audio del item"
        showControls={{
          time: true,
          seek:true, 
        }}
        className="w-full max-w-full"
      />
    );
  }

  // Si explicit/image detect => show image
  if (type === 'image') {
    return (
      <img
        src={url}
        alt="Imagen del item"
        draggable={false}
        className="w-16 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => window.open(url, '_blank')}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // If explicit video
  if (type === 'video') {
    return (
      <video controls className="w-16 h-12 rounded">
        <source src={url} />
        Tu navegador no soporta video.
      </video>
    );
  }

  // Unknown type: try image first and fallback to audio on error
  if (!imgFailed) {
    return (
      <img
        src={url}
        alt="Media del item"
        draggable={false}
        className="w-16 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => window.open(url, '_blank')}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Fallback to audio player
  return (
    <AudioPlayer
      src={url}
      variant="compact"
      title="Audio del item"
      showControls={{
        time: true,
      }}
      className="w-full max-w-48"
    />
  );
};

// ─── Sortable item for `ordering` type ───────────────────────────────────────
const SortableListItem: React.FC<{ id: string; index: number; children: React.ReactNode }> = ({ id, index, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onDragStart={(e) => e.preventDefault()}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors select-none ${
        isDragging
          ? 'bg-blue-600/20 border-blue-400 shadow-lg'
          : 'bg-muted border-border hover:bg-muted/80'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <span className="text-xs text-muted-foreground w-4 flex-shrink-0 font-mono">{index + 1}</span>
      {children}
    </div>
  );
};

// ─── Sortable card for `drag_drop` type ──────────────────────────────────────
const SortableGridCard: React.FC<{ id: string; index: number; children: React.ReactNode }> = ({ id, index, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDragStart={(e) => e.preventDefault()}
      className={`relative p-3 pt-5 rounded-xl border-2 cursor-grab active:cursor-grabbing touch-none transition-all select-none ${
        isDragging
          ? 'border-blue-400 shadow-xl bg-blue-600/20'
          : 'border-border bg-muted/50 hover:border-blue-500/60 hover:bg-muted'
      }`}
    >
      {/* Position badge */}
      <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
        <span className="text-white text-[10px] font-bold">{index + 1}</span>
      </div>
      {children}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const QuestionRenderer: React.FC<Props> = ({
  question,
  answer,
  onChange,
  className = "",
  showQuestionNumber = false,
  questionNumber,
  totalQuestions,
  isUploadingAudio = false,
  sectionInfo
}) => {
  if (!question) return <div>No hay pregunta seleccionada</div>;

  const id = question._id || question.id || 'unknown';
  const type = question.type || question.response?.type || 'open_text';

  // Memoize content to avoid recreating it on every render
  const content = useMemo(() => question.content || {}, [question.content]);

  const titleText = content.question || question.title || question.text || 'Pregunta';
  const contextText = content.context || question.context || '';
  const promptText = content.instructions || question.prompt || '';
  const optionsList = content.options || question.options || [];
  const mediaUrl = content.mediaUrl || question.mediaUrl || null;

  // Memoize effective type to avoid recalculation
  const effectiveType = useMemo(() => {
    const knownTypes = [
      'multiple_choice', 'true_false', 'open_text', 'essay', 'audio_response', 'file_upload',
      'fill_blanks', 'drag_drop', 'matching', 'ordering'
    ];

    if (question.type && knownTypes.includes(question.type)) {
      return question.type;
    } else if (question.type && ['listening', 'speaking', 'reading', 'writing'].includes(question.type)) {
      // when the author used 'type' as competency
      if (question.type === 'listening') return 'audio_response';
      else if (question.type === 'speaking') return 'audio_response';
      else return 'open_text';
    } else if (question.competency) {
      if (question.competency === 'listening') return 'audio_response';
      else if (question.competency === 'speaking') return 'audio_response';
      else return 'open_text';
    }
    return 'open_text';
  }, [question.type, question.competency]);

  // Decide single vs multi select for multiple_choice: if a correctAnswer is provided or only one option flagged as correct -> single-select
  const correctCount = (optionsList || []).filter((o: any) => o.isCorrect).length;
  const isSingleSelect = correctCount <= 1 || Boolean(content.correctAnswer);

  // Estado para tipos interactivos
  const [fillBlanksAnswers, setFillBlanksAnswers] = useState<string[]>([]);
  const [matchingPairs, setMatchingPairs] = useState<{[key: string]: string}>({});
  const [orderingItems, setOrderingItems] = useState<string[]>([]);
  const [dragDropPositions, setDragDropPositions] = useState<{[key: string]: number}>({});
  // dragDropOrder: ordered list of item IDs (index+1 = current position for grading)
  const [dragDropOrder, setDragDropOrder] = useState<string[]>([]);

  // Estados específicos para matching interactivo
  const [selectedLeftItem, setSelectedLeftItem] = useState<string | null>(null);
  const [matchingColors, setMatchingColors] = useState<{[key: string]: string}>({});
  const [shuffledMatchingPairs, setShuffledMatchingPairs] = useState<string[]>([]);

  // Función Fisher-Yates shuffle para mezclar arrays correctamente
  const fisherYatesShuffle = useCallback(<T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Función para crear un derangement (shuffle sin fixed-points)
  // Asegura que ningún elemento quede en su posición original
  const derangementShuffle = useCallback(<T,>(array: T[], originalPositions: Map<T, number>): T[] => {
    const shuffled = fisherYatesShuffle(array);
    
    // Verificar si hay fixed-points (elemento en su posición original)
    let hasFixedPoint = false;
    for (let i = 0; i < shuffled.length; i++) {
      const originalPos = originalPositions.get(shuffled[i]!);
      if (originalPos === i) {
        hasFixedPoint = true;
        break;
      }
    }
    
    // Si hay fixed-points, intentar corregirlos
    if (hasFixedPoint) {
      // Intentar hasta 10 veces encontrar un derangement válido
      for (let attempt = 0; attempt < 10; attempt++) {
        const newShuffle = fisherYatesShuffle(array);
        let validDerangement = true;
        
        for (let i = 0; i < newShuffle.length; i++) {
          const originalPos = originalPositions.get(newShuffle[i]!);
          if (originalPos === i) {
            validDerangement = false;
            break;
          }
        }
        
        if (validDerangement) {
          return newShuffle;
        }
      }
      
      // Si después de 10 intentos no encontramos un derangement perfecto,
      // intercambiar elementos con fixed-points manualmente
      const result = [...shuffled];
      for (let i = 0; i < result.length; i++) {
        const originalPos = originalPositions.get(result[i]!);
        if (originalPos === i) {
          // Buscar otro elemento para intercambiar
          for (let j = 0; j < result.length; j++) {
            if (i !== j) {
              const jOriginalPos = originalPositions.get(result[j]!);
              if (jOriginalPos !== j && jOriginalPos !== i) {
                [result[i], result[j]] = [result[j], result[i]];
                break;
              }
            }
          }
        }
      }
      return result;
    }
    
    return shuffled;
  }, [fisherYatesShuffle]);

  // dnd-kit sensors (pointer for mouse/touch, keyboard for a11y)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Inicializar opciones mezcladas SOLO cuando cambia la pregunta (no cuando cambia answer)
  useEffect(() => {
    if (effectiveType === 'matching') {
      // Inicializar opciones mezcladas del lado derecho con derangement
      // Esto solo debe ejecutarse cuando cambia la pregunta, NO cuando cambia answer
      const items = content.items || [];
      const allPairs: string[] = items
        .map((i: any) => i.matchingPair as string | undefined)
        .filter((v: any): v is string => typeof v === 'string' && v.length > 0);
      const uniquePairs: string[] = Array.from(new Set(allPairs));

      // Crear mapa de posiciones originales para derangement
      // Mapear cada matchingPair a su posición original en items
      const originalPositions = new Map<string, number>();
      items.forEach((item: any, index: number) => {
        if (item.matchingPair && typeof item.matchingPair === 'string') {
          originalPositions.set(item.matchingPair, index);
        }
      });

      // Mezclar con derangement para evitar que pares correctos queden en la misma posición
      const shuffled = derangementShuffle(uniquePairs, originalPositions);
      setShuffledMatchingPairs(shuffled);
    }
  }, [id, effectiveType, derangementShuffle, content]); // NO incluir answer aquí para evitar remezclar

  // Inicializar estados desde answer existente o valores por defecto
  useEffect(() => {
    if (effectiveType === 'fill_blanks') {
      const template = content.template || '';
      const blanksCount = (template.match(/___/g) || []).length;
      if (answer?.blanks) {
        setFillBlanksAnswers(answer.blanks);
      } else {
        setFillBlanksAnswers(new Array(blanksCount).fill(''));
      }
    }

    if (effectiveType === 'matching') {
      // Solo actualizar matchingPairs cuando cambia answer, NO remezclar las opciones
      if (answer?.pairs) {
        // Debug: verificar qué se está cargando
        console.log('🔍 [Matching] Cargando pairs desde answer:', {
          answerPairs: answer.pairs,
          items: (content.items || []).map((i: any) => ({
            id: i.id,
            matchingPair: i.matchingPair
          }))
        });
        setMatchingPairs(answer.pairs);
      } else {
        setMatchingPairs({});
      }
    }

    if (effectiveType === 'ordering') {
      if (answer?.order) {
        setOrderingItems(answer.order);
      } else {
        const items = content.items || [];
        setOrderingItems(items.map((item: any) => item.id));
      }
    }

    if (effectiveType === 'drag_drop') {
      const items = content.items || [];
      if (answer?.positions && Object.keys(answer.positions).length > 0) {
        // Debug: verificar qué se está cargando
        console.log('🔍 [DragDrop] Cargando posiciones desde answer:', {
          answerPositions: answer.positions,
          itemsWithCorrectPositions: items.map((item: any) => ({
            id: item.id,
            correctPosition: item.correctPosition,
            savedPosition: answer.positions[item.id]
          }))
        });
        
        setDragDropPositions(answer.positions);
        // Restore order from saved positions
        const sorted = [...items]
          .sort((a: any, b: any) => (answer.positions[a.id] ?? 99) - (answer.positions[b.id] ?? 99))
          .map((i: any) => i.id);
        setDragDropOrder(sorted);
      } else {
        // Mezclar los items usando Fisher-Yates shuffle para que no vengan en orden correcto
        const itemIds = items.map((item: any) => item.id);
        const shuffled = fisherYatesShuffle(itemIds);
        setDragDropOrder(shuffled);
        // Inicializar las posiciones basadas en el orden mezclado (NO las posiciones correctas)
        // Esto asegura que las posiciones iniciales reflejen el orden mezclado, no el correcto
        const initialPositions = Object.fromEntries(shuffled.map((itemId, i) => [itemId, i + 1]));
        
        // Debug: verificar qué se está inicializando
        console.log('🔍 [DragDrop] Inicializando posiciones mezcladas:', {
          shuffledOrder: shuffled,
          initialPositions,
          itemsWithCorrectPositions: items.map((item: any) => ({
            id: item.id,
            correctPosition: item.correctPosition,
            initialPosition: initialPositions[item.id]
          }))
        });
        
        setDragDropPositions(initialPositions);
        // NO guardar automáticamente las posiciones iniciales - solo cuando el usuario arrastra
        // onChange(id, { positions: initialPositions });
      }
    }
  }, [id, effectiveType, answer, content, fisherYatesShuffle]); // Incluir fisherYatesShuffle para drag_drop

  // Debug effect que solo se ejecuta cuando cambia el answer
  useEffect(() => {
    if (effectiveType === 'multiple_choice' && answer?.selectedOptions) {
      console.log('🔍 [QuestionRenderer] Multiple Choice Answer Changed:', {
        questionId: id,
        selectedOptions: answer.selectedOptions,
        selectedTypes: answer.selectedOptions.map((s: any) => typeof s),
        optionsList: optionsList.map((opt:any) => ({ id: opt.id || opt._id, type: typeof (opt.id || opt._id) }))
      });
    }

    if ((effectiveType === 'true_false' || type === 'true_false') && answer?.answer !== undefined) {
      console.log('🔍 [QuestionRenderer] True/False Answer Changed:', {
        questionId: id,
        answer: answer.answer,
        answerType: typeof answer.answer,
        answerStringValue: String(answer.answer),
        isTrue: answer.answer === true,
        isFalse: answer.answer === false,
        isTrueLoose: answer.answer == true,
        isFalseLoose: answer.answer == false,
        isTrueString: answer.answer === 'true',
        isFalseString: answer.answer === 'false',
        fullAnswerObject: answer
      });
    }
  }, [answer?.selectedOptions, answer?.answer, id, effectiveType, type, optionsList]);

  const handleText = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(id, { text: e.target.value });
  }, [id, onChange]);

  const handleOption = useCallback((optionId: string) => {
    const prev = answer || {};
    let selected = prev.selectedOptions || [];
    console.log('🎯 [QuestionRenderer] handleOption called:', {
      optionId,
      optionIdType: typeof optionId,
      prevSelected: selected,
      prevSelectedTypes: selected.map((s: any) => typeof s),
      includes: selected.includes(optionId)
    });

    if (selected.includes(optionId)) {
      selected = selected.filter((s: string) => s !== optionId);
    } else {
      selected = [...selected, optionId];
    }

    console.log('🎯 [QuestionRenderer] handleOption result:', {
      newSelected: selected,
      sendingToOnChange: { selectedOptions: selected }
    });

    onChange(id, { selectedOptions: selected });
  }, [id, answer, onChange]);

  // single-select handler is implemented inline where needed

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // simple approach: send File object as value; caller will handle upload
    onChange(id, { file });
  }, [id, onChange]);

  // Handlers para nuevos tipos de pregunta
  const handleFillBlanks = useCallback((index: number, value: string) => {
    const newAnswers = [...fillBlanksAnswers];
    newAnswers[index] = value;
    setFillBlanksAnswers(newAnswers);
    onChange(id, { blanks: newAnswers });
  }, [id, onChange, fillBlanksAnswers]);

  // Función para generar colores consistentes
  const generateColor = useCallback((pairValue: string): string => {
    const colors = [
      'bg-blue-500/20 border-blue-500 text-blue-300',
      'bg-green-500/20 border-green-500 text-green-300',
      'bg-purple-500/20 border-purple-500 text-purple-300',
      'bg-yellow-500/20 border-yellow-500 text-yellow-300',
      'bg-red-500/20 border-red-500 text-red-300',
      'bg-indigo-500/20 border-indigo-500 text-indigo-300',
      'bg-pink-500/20 border-pink-500 text-pink-300',
      'bg-teal-500/20 border-teal-500 text-teal-300',
      'bg-orange-500/20 border-orange-500 text-orange-300',
      'bg-cyan-500/20 border-cyan-500 text-cyan-300'
    ];
    
    // Generar hash simple del pairValue para consistencia
    let hash = 0;
    for (let i = 0; i < pairValue.length; i++) {
      hash = ((hash << 5) - hash + pairValue.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  }, []);

  // Manejar selección interactiva de matching
  const handleMatchingSelection = useCallback((itemId: string, isLeftSide: boolean) => {
    if (isLeftSide) {
      // Seleccionar item del lado izquierdo
      if (selectedLeftItem === itemId) {
        setSelectedLeftItem(null); // Deseleccionar si ya estaba seleccionado
      } else {
        setSelectedLeftItem(itemId);
      }
    } else {
      // Seleccionar item del lado derecho (opciones de matching)
      if (selectedLeftItem) {
        // Emparejar: guardar el pairValue que el usuario seleccionó (no el correcto)
        // itemId aquí es el pairValue del elemento del lado derecho que el usuario seleccionó
        // IMPORTANTE: Este es el valor que el usuario seleccionó, NO el matchingPair correcto del item izquierdo
        const newPairs = { ...matchingPairs, [selectedLeftItem]: itemId };
        setMatchingPairs(newPairs);
        
        // Debug: verificar qué se está guardando
        console.log('🔍 [Matching] Guardando emparejamiento:', {
          leftItemId: selectedLeftItem,
          selectedPairValue: itemId,
          leftItemCorrectPair: (content.items || []).find((i: any) => i.id === selectedLeftItem)?.matchingPair,
          newPairs
        });
        
        onChange(id, { pairs: newPairs });
        
        // Generar colores para el emparejamiento usando el pairValue seleccionado
        const newColors = { ...matchingColors };
        const color = generateColor(itemId);
        newColors[selectedLeftItem] = color;
        newColors[itemId] = color;
        setMatchingColors(newColors);
        
        setSelectedLeftItem(null); // Limpiar selección
      }
    }
  }, [selectedLeftItem, matchingPairs, matchingColors, onChange, id, generateColor, content]);

  // Función para desemparejar
  const handleUnmatch = useCallback((itemId: string) => {
    const pairedValue = matchingPairs[itemId];
    if (pairedValue) {
      const newPairs = { ...matchingPairs };
      delete newPairs[itemId];
      setMatchingPairs(newPairs);
      onChange(id, { pairs: newPairs });
      
      // Limpiar colores
      const newColors = { ...matchingColors };
      delete newColors[itemId];
      delete newColors[pairedValue];
      setMatchingColors(newColors);
    }
  }, [matchingPairs, matchingColors, onChange, id]);

  // Función para remezclar las opciones de matching
  const shuffleMatchingOptions = useCallback(() => {
    const items = content.items || [];
    const allPairs: string[] = items
      .map((i: any) => i.matchingPair as string | undefined)
      .filter((v: any): v is string => typeof v === 'string' && v.length > 0);
    const uniquePairs: string[] = Array.from(new Set(allPairs));

    // Crear mapa de posiciones originales para derangement
    const originalPositions = new Map<string, number>();
    items.forEach((item: any, index: number) => {
      if (item.matchingPair && typeof item.matchingPair === 'string') {
        originalPositions.set(item.matchingPair, index);
      }
    });

    // Mezclar con derangement
    const shuffled = derangementShuffle(uniquePairs, originalPositions);
    setShuffledMatchingPairs(shuffled);
  }, [content, derangementShuffle]);

  const handleOrdering = useCallback((newOrder: string[]) => {
    setOrderingItems(newOrder);
    onChange(id, { order: newOrder });
  }, [id, onChange]);

  const shuffleOrdering = useCallback(() => {
    const items = content.items || [];
    const shuffled = fisherYatesShuffle(items.map((item: any) => item.id));
    handleOrdering(shuffled);
  }, [content, handleOrdering, fisherYatesShuffle]);

  const resetOrdering = useCallback(() => {
    const items = content.items || [];
    const original = items.map((item:any) => item.id);
    handleOrdering(original);
  }, [content, handleOrdering]);

  const handleDragDrop = useCallback((itemId: string, position: number) => {
    const newPositions = { ...dragDropPositions, [itemId]: position };
    setDragDropPositions(newPositions);
    onChange(id, { positions: newPositions });
  }, [id, onChange, dragDropPositions]);

  // ── dnd-kit handlers ────────────────────────────────────────────────────────
  const handleOrderingDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleOrderingDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = orderingItems.indexOf(String(active.id));
      const newIndex = orderingItems.indexOf(String(over.id));
      handleOrdering(arrayMove(orderingItems, oldIndex, newIndex));
    }
  }, [orderingItems, handleOrdering]);

  const handleDragDropDndEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = dragDropOrder.indexOf(String(active.id));
      const newIndex = dragDropOrder.indexOf(String(over.id));
      const newOrder = arrayMove(dragDropOrder, oldIndex, newIndex);
      setDragDropOrder(newOrder);
      // Guardar las posiciones basadas en el orden actual (índice + 1)
      // IMPORTANTE: Estas son las posiciones en el array mezclado, NO las posiciones correctas
      const newPositions = Object.fromEntries(newOrder.map((itemId, i) => [itemId, i + 1]));
      
      // Debug: verificar qué se está guardando
      const items = content.items || [];
      console.log('🔍 [DragDrop] Guardando posiciones después de arrastrar:', {
        newOrder,
        newPositions,
        itemsWithCorrectPositions: items.map((item: any) => ({
          id: item.id,
          correctPosition: item.correctPosition,
          savedPosition: newPositions[item.id]
        }))
      });
      
      setDragDropPositions(newPositions);
      onChange(id, { positions: newPositions });
    }
  }, [dragDropOrder, id, onChange, content]);

  return (
    <div className={`bg-muted/30 rounded-lg p-4 border border-border/30 ${className}`}>
      <div className="mb-3">
        {showQuestionNumber && questionNumber && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">
                {questionNumber}
              </span>
              {sectionInfo && (
                <span className="text-xs text-muted-foreground">
                  de {totalQuestions || '?'}
                </span>
              )}
            </div>
            {sectionInfo && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                  {sectionInfo.competency}
                </span>
                <span className="text-xs text-muted-foreground">
                  Pregunta {sectionInfo.questionIndex + 1} de {sectionInfo.totalQuestionsInSection} en {sectionInfo.name}
                </span>
              </div>
            )}
          </div>
        )}
        {/* Para listening: audio ANTES de la pregunta para que el estudiante escuche primero */}
        {question.competency === 'listening' && mediaUrl && !mediaUrl.startsWith('blob:') && (
          <div className="mb-4 rounded-lg border border-green-700/40 bg-green-900/10 p-3">
            <div className="text-[11px] font-medium text-green-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>🎧</span> Escucha el audio antes de responder:
            </div>
            <AudioPlayer
              src={mediaUrl}
              variant="compact"
              title="Audio de comprensión"
              showControls={{ volume: true, speed: true, seek: true, time: true }}
            />
          </div>
        )}

        {/* Contexto de la pregunta — oculto para listening (es la transcripción del audio) */}
        {contextText && question.competency !== 'listening' && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30">
            <div className="px-4 pt-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Contexto:
              </div>
            </div>
            <div className="px-4 pb-4 pt-2 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {contextText}
            </div>
          </div>
        )}

        <div className="space-y-1 px-4 pt-3">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Pregunta:</div>
          <div className="text-base md:text-lg text-foreground font-semibold leading-snug">{titleText}</div>
        </div>
      </div>

      {/* Media general (imágenes, video — para listening ya se mostró el audio arriba) */}
      {mediaUrl && !(question.competency === 'listening' && detectMediaType(mediaUrl) === 'audio') && (
        <div className="mb-3 flex justify-center">
          {detectMediaType(mediaUrl) === 'audio' ? (
            <div className="w-full max-w-md">
              {mediaUrl.startsWith('blob:') ? (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded p-3">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  Error: Audio no guardado correctamente
                </div>
              ) : (
                <AudioPlayer 
                  src={mediaUrl} 
                  variant="compact"
                  title="Audio de la pregunta"
                  showControls={{
                    volume: true,
                    speed: true,
                    seek: true,
                    time: true,
                  }}
                />
              )}
            </div>
          ) : detectMediaType(mediaUrl) === 'video' ? (
            <video controls className="max-w-full max-h-48 rounded shadow-sm">
              <source src={mediaUrl} />
              Tu navegador no soporta video.
            </video>
          ) : (
            /* Default to image */
            mediaUrl.startsWith('blob:') ? (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded p-3">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Error: Imagen no guardada correctamente
              </div>
            ) : (
              <img src={mediaUrl} alt="Pregunta media" className="max-w-full max-h-48 object-contain rounded shadow-sm" />
            )
          )}
        </div>
      )}

      {effectiveType === 'multiple_choice' && (
        <div className="space-y-3">
          {optionsList.map((opt: any) => {
            const optId = opt.id || opt._id;
            const isSelected = (answer?.selectedOptions || []).includes(optId);

            // isSelected calculation for this option
            if (isSingleSelect) {
              return (
                <div
                  key={optId}
                  onClick={() => onChange(id, { selectedOptions: [optId] })}
                  className={isSelected
                    ? "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer bg-blue-600 bg-opacity-30 border-blue-400 text-foreground"
                    : "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer bg-muted border-border text-foreground/80 hover:bg-muted/80 hover:border-border"
                  }
                >
                  <div className={isSelected
                    ? "w-5 h-5 rounded-full border-2 border-blue-300 bg-blue-500 flex items-center justify-center"
                    : "w-5 h-5 rounded-full border-2 border-gray-400 bg-transparent flex items-center justify-center"
                  }>
                    {isSelected && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="text-sm flex-1">{opt.text}</span>
                </div>
              );
            }
            return (
              <div
                key={optId}
                onClick={() => handleOption(optId)}
                className={isSelected
                  ? "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer bg-green-600 bg-opacity-30 border-green-400 text-foreground"
                  : "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer bg-muted border-border text-foreground/80 hover:bg-muted/80 hover:border-border"
                }
              >
                <div className={isSelected
                  ? "w-5 h-5 rounded border-2 border-green-300 bg-green-500 flex items-center justify-center"
                  : "w-5 h-5 rounded border-2 border-gray-400 bg-transparent flex items-center justify-center"
                }>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-sm flex-1">{opt.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {(effectiveType === 'true_false' || type === 'true_false') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* True/False section */}
          {(() => {
            const isTrueSelected = (answer?.answer === true || answer?.answer === 'true');
            const isFalseSelected = (answer?.answer === false || answer?.answer === 'false');
            console.log('🎨 [QuestionRenderer] True/False Render:', {
              questionId: id,
              answer: answer?.answer,
              answerType: typeof answer?.answer,
              isTrueSelected,
              isFalseSelected,
              strictTrue: answer?.answer === true,
              strictFalse: answer?.answer === false,
              stringTrue: answer?.answer === 'true',
              stringFalse: answer?.answer === 'false'
            });
            return null;
          })()}
          <div
            onClick={() => {
              console.log('🎯 [QuestionRenderer] True/False TRUE clicked, sending:', { answer: true });
              onChange(id, { answer: true });
            }}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer ${
              (answer?.answer === true || answer?.answer === 'true')
                ? "bg-green-600 bg-opacity-30 border-green-400 text-foreground"
                : "bg-muted border-border text-foreground/80 hover:bg-muted/80 hover:border-border"
            }`}
            style={{
              backgroundColor: (answer?.answer === true || answer?.answer === 'true') ? 'rgba(34, 197, 94, 0.3)' : 'rgb(31, 41, 55)',
              borderColor: (answer?.answer === true || answer?.answer === 'true') ? 'rgb(74, 222, 128)' : 'rgb(75, 85, 99)',
              color: 'white'
            }}
          >
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                (answer?.answer === true || answer?.answer === 'true')
                  ? "border-green-300 bg-green-500"
                  : "border-gray-400 bg-transparent"
              }`}
              style={{
                backgroundColor: (answer?.answer === true || answer?.answer === 'true') ? 'rgb(34, 197, 94)' : 'transparent',
                borderColor: (answer?.answer === true || answer?.answer === 'true') ? 'rgb(134, 239, 172)' : 'rgb(156, 163, 175)'
              }}
            >
              {(answer?.answer === true || answer?.answer === 'true') && (
                <div className="w-2 h-2 bg-white rounded-full"></div>
              )}
            </div>
            <span className="text-sm font-medium">Verdadero</span>
          </div>

          <div
            onClick={() => {
              console.log('🎯 [QuestionRenderer] True/False FALSE clicked, sending:', { answer: false });
              onChange(id, { answer: false });
            }}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer ${
              (answer?.answer === false || answer?.answer === 'false')
                ? "bg-red-600 bg-opacity-30 border-red-400 text-foreground"
                : "bg-muted border-border text-foreground/80 hover:bg-muted/80 hover:border-border"
            }`}
            style={{
              backgroundColor: (answer?.answer === false || answer?.answer === 'false') ? 'rgba(220, 38, 38, 0.3)' : 'rgb(31, 41, 55)',
              borderColor: (answer?.answer === false || answer?.answer === 'false') ? 'rgb(248, 113, 113)' : 'rgb(75, 85, 99)',
              color: 'white'
            }}
          >
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                (answer?.answer === false || answer?.answer === 'false')
                  ? "border-red-300 bg-red-500"
                  : "border-gray-400 bg-transparent"
              }`}
              style={{
                backgroundColor: (answer?.answer === false || answer?.answer === 'false') ? 'rgb(220, 38, 38)' : 'transparent',
                borderColor: (answer?.answer === false || answer?.answer === 'false') ? 'rgb(252, 165, 165)' : 'rgb(156, 163, 175)'
              }}
            >
              {(answer?.answer === false || answer?.answer === 'false') && (
                <div className="w-2 h-2 bg-white rounded-full"></div>
              )}
            </div>
            <span className="text-sm font-medium">Falso</span>
          </div>
        </div>
      )}

      {(effectiveType === 'open_text' || effectiveType === 'essay' || type === 'open_text' || type === 'essay') && (
        <div>
          <textarea
            className="w-full bg-transparent border border-border rounded p-2 text-sm text-foreground"
            rows={effectiveType === 'essay' || type === 'essay' ? 8 : 4}
            value={answer?.text || ''}
            onChange={handleText}
            placeholder={effectiveType === 'essay' || type === 'essay' ? 'Escribe tu ensayo aquí...' : 'Escribe tu respuesta aquí...'}
          />
        </div>
      )}

      {(effectiveType === 'audio_response' || type === 'audio_response') && (
        <div className="space-y-4">
          {/* Audio de pregunta/prompt si existe */}
          {(content.promptAudioUrl || mediaUrl) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-foreground/80">Escucha la pregunta:</span>
              </div>
              <AudioPlayer
                src={content.promptAudioUrl || mediaUrl}
                variant="compact"
                title="Pregunta de audio"
              />
            </div>
          )}

          {/* Instrucción para el tipo de respuesta */}
          <div className="text-sm text-muted-foreground">
            Tipo de respuesta esperada: <span className="text-foreground font-medium">
              {content.expectedResponseType === 'word' && 'Palabra'}
              {content.expectedResponseType === 'sentence' && 'Oración'}
              {content.expectedResponseType === 'paragraph' && 'Párrafo'}
              {!content.expectedResponseType && 'Respuesta de audio'}
            </span>
          </div>

          {/* Grabador de respuesta */}
          <div className="space-y-2">
            <p className="text-sm text-foreground/80">Graba tu respuesta:</p>
            <AudioRecorder
              variant="compact"
              maxDuration={content.expectedResponseType === 'word' ? 10 : content.expectedResponseType === 'sentence' ? 30 : 120}
              onRecordingComplete={(blob: Blob, url: string) => {
                onChange(id, { previewUrl: url, audioBlob: blob });
              }}
              onRecordingStart={() => console.log('Iniciando grabación...')}
              onRecordingStop={() => console.log('Grabación detenida')}
            />

            {/* Estado de subida */}
            {isUploadingAudio && (
              <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Guardando tu respuesta de audio...</span>
              </div>
            )}

            {/* Error de subida */}
            {answer?.uploadFailed && !isUploadingAudio && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-700 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>No se pudo guardar el audio. Vuelve a grabar.</span>
              </div>
            )}

            {/* Confirmación de audio guardado en servidor */}
            {answer?.audioUrl && !isUploadingAudio && (
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-900/20 border border-green-700 rounded-lg p-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Audio guardado correctamente</span>
              </div>
            )}

            {/* Preview local o URL permanente */}
            {(answer?.previewUrl || answer?.audioUrl) && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Tu respuesta grabada:</p>
                <AudioPlayer
                  src={answer.previewUrl || answer.audioUrl}
                  variant="compact"
                  title="Tu respuesta"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {(effectiveType === 'file_upload' || type === 'file_upload') && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Adjunta el archivo requerido.</p>
          <input
            type="file"
            onChange={handleFile}
            className="w-full p-2 bg-muted border border-border rounded text-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          />
          {answer?.file && (
            <p className="text-xs text-green-400">Archivo seleccionado: {answer.file.name}</p>
          )}
        </div>
      )}

      {/* Nuevos tipos de pregunta */}
      {effectiveType === 'fill_blanks' && (() => {
        const parts = (content.template ?? '').split('___');
        const blanksData: Array<{ correctAnswers?: string[] }> = content.blanks ?? [];

        return (
          <div className="space-y-5">
            {/* ── Sentence with inline Duolingo-style blanks ── */}
            <div className="leading-[3] text-base text-foreground flex flex-wrap items-end">
              {parts.map((part, index) => {
                const blankData = blanksData[index];
                const maxLen = Math.max(
                  ...(blankData?.correctAnswers?.map((a: string) => a.length) ?? []),
                  5
                );
                const currentVal = fillBlanksAnswers[index] ?? '';
                // Width grows with typed content, minimum based on expected answer
                const widthPx = Math.max(maxLen, currentVal.length, 5) * 10 + 24;

                return (
                  <React.Fragment key={index}>
                    {part && <span className="whitespace-pre-wrap">{part}</span>}
                    {index < parts.length - 1 && (
                      <span className="inline-flex flex-col items-center mx-1.5">
                        {/* Blank number badge */}
                        <span className="text-[10px] font-bold text-blue-400 leading-none mb-0.5 select-none">
                          {index + 1}
                        </span>
                        {/* Underline-only input — Duolingo style */}
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) => handleFillBlanks(index, e.target.value)}
                          style={{ width: `${widthPx}px` }}
                          className={`
                            border-0 border-b-2 bg-transparent text-center text-foreground text-sm pb-0.5
                            focus:outline-none caret-foreground transition-colors duration-150
                            placeholder-muted-foreground
                            ${currentVal
                              ? 'border-blue-400 focus:border-blue-300'
                              : 'border-border focus:border-blue-400'
                            }
                          `}
                          placeholder={'· · ·'}
                        />
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── Progress pills showing filled / empty blanks ── */}
            {parts.length > 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {parts.slice(0, -1).map((_, i) => {
                  const filled = fillBlanksAnswers[i]?.trim();
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        filled
                          ? 'bg-blue-900/40 border-blue-500/50 text-blue-200'
                          : 'bg-muted/50 border-border text-muted-foreground'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        filled ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="max-w-[100px] truncate">
                        {filled || 'vacío'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {effectiveType === 'matching' && (
        <div className="space-y-6">
          {/* Información sobre errores de multimedia */}
          {(content.items || []).some((item: any) => item.mediaUrl?.startsWith('blob:')) && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1">
                <AlertTriangle className="w-4 h-4" />
                Problemas detectados:
              </div>
              <div className="text-red-300 text-xs">
                Algunos archivos multimedia no se guardaron correctamente. 
                Contacta con el profesor si no puedes completar la pregunta.
              </div>
            </div>
          )}

          {/* Instrucciones */}
          <div className="bg-blue-950/50 border border-blue-800 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <p className="text-blue-200 text-sm">
                {selectedLeftItem ? 
                  '👆 Ahora selecciona la opción correcta del lado derecho para emparejar' :
                  '👆 Primero selecciona un elemento del lado izquierdo'
                }
              </p>
              <Button
                onClick={shuffleMatchingOptions}
                size="sm"
                variant="outline"
                className="flex items-center gap-1 text-blue-300 border-blue-600 hover:bg-blue-900/30"
              >
                <Shuffle className="w-4 h-4" />
                Mezclar opciones
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Lado izquierdo - Items principales */}
            <div className="space-y-3">
              <h4 className="font-semibold text-purple-200 mb-3 text-center">Elementos principales</h4>
              {(content.items || []).map((item: any, index: number) => {
                const isPaired = Boolean(matchingPairs[item.id]);
                const isSelected = selectedLeftItem === item.id;
                const colorClass = matchingColors[item.id] || '';
                
                return (
                  <div
                    key={`item-${index}`}
                    onClick={() => handleMatchingSelection(item.id, true)}
                    className={`
                      relative group p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
                      ${isPaired ? `${colorClass} border-2` : 
                        isSelected ? 'bg-yellow-500/20 border-yellow-500 border-2' : 
                        'bg-muted/50 border-border hover:border-border hover:bg-muted/70'
                      }
                      ${isSelected ? 'ring-2 ring-yellow-400/50 shadow-lg' : ''}
                    `}
                  >
                    {/* Botón para desemparejar */}
                    {isPaired && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnmatch(item.id);
                        }}
                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                        title="Desemparejar"
                      >
                        <span className="text-white text-xs">×</span>
                      </button>
                    )}
                    
                    {/* Contenido del item */}
                    <div className="space-y-2">
                      <div className="font-medium text-foreground">
                        {item.content}
                      </div>
                      
                      {/* Media preview */}
                      {item.mediaUrl && (
                        <ItemMediaPreview 
                          url={item.mediaUrl} 
                          explicitType={detectMediaType(item.mediaUrl)}
                        />
                      )}
                      
                      {/* Estado visual */}
                      <div className="flex items-center gap-2 text-xs">
                        {isPaired ? (
                          <>
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span className="text-green-300">Emparejado</span>
                          </>
                        ) : isSelected ? (
                          <>
                            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                            <span className="text-yellow-300">Seleccionado</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                            <span className="text-muted-foreground">Sin emparejar</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lado derecho - Opciones de matching */}
            <div className="space-y-3">
              <h4 className="font-semibold text-purple-200 mb-3 text-center">Opciones de emparejamiento</h4>
              {shuffledMatchingPairs.map((pairValue, index) => {
                // Verificar si esta opción está emparejada con algún elemento izquierdo
                // IMPORTANTE: Solo usar matchingPairs (selecciones del usuario), NO comparar con item.matchingPair (respuesta correcta)
                const isUsed = Object.values(matchingPairs).includes(pairValue);
                // Obtener el color del elemento izquierdo que está emparejado con este pairValue
                const leftItemId = Object.keys(matchingPairs).find(key => matchingPairs[key] === pairValue);
                const colorClass = leftItemId ? (matchingColors[leftItemId] || matchingColors[pairValue] || '') : '';
                const canSelect = Boolean(selectedLeftItem) && !isUsed;
                return (
                  <div
                    key={`option-${index}`}
                    onClick={() => canSelect && handleMatchingSelection(pairValue, false)}
                    className={`
                      relative p-4 border-2 rounded-lg transition-all duration-200
                      ${isUsed ? `${colorClass} border-2` :
                        canSelect ? 'bg-muted/50 border-border hover:border-green-500 hover:bg-green-900/20 cursor-pointer' :
                        'bg-card/50 border-border opacity-60 cursor-not-allowed'
                      }
                      ${canSelect ? 'hover:shadow-lg' : ''}
                    `}
                  >
                    <div className="space-y-2">
                      <div className="font-medium text-foreground">{pairValue}</div>
                      <div className="flex items-center gap-2 text-xs">
                        {isUsed ? (
                          <><div className="w-2 h-2 bg-green-400 rounded-full" /><span className="text-green-300">Usado</span></>
                        ) : canSelect ? (
                          <><div className="w-2 h-2 bg-blue-400 rounded-full" /><span className="text-blue-300">Disponible</span></>
                        ) : (
                          <><div className="w-2 h-2 bg-muted-foreground rounded-full" /><span className="text-muted-foreground">No disponible</span></>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progreso */}
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <div className="flex justify-between items-center text-sm text-foreground/80">
              <span>Progreso del emparejamiento:</span>
              <span>{Object.keys(matchingPairs).length} de {(content.items || []).length} elementos emparejados</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${((Object.keys(matchingPairs).length) / ((content.items || []).length || 1)) * 100}%` 
                }}
              />
            </div>
          </div>
        </div>
      )}

      {effectiveType === 'ordering' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Arrastra los elementos para ordenarlos correctamente:</p>
            <div className="flex gap-2">
              <Button onClick={shuffleOrdering} size="sm" variant="outline" className="flex items-center gap-1 text-xs">
                <Shuffle className="w-3 h-3" /> Mezclar
              </Button>
              <Button onClick={resetOrdering} size="sm" variant="outline" className="flex items-center gap-1 text-xs">
                <RotateCcw className="w-3 h-3" /> Reiniciar
              </Button>
            </div>
          </div>

          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragStart={handleOrderingDragStart}
            onDragEnd={handleOrderingDragEnd}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          >
            <SortableContext items={orderingItems} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {orderingItems.map((itemId: string, index: number) => {
                  const item = (content.items || []).find((i: any) => i.id === itemId);
                  if (!item) return null;
                  return (
                    <SortableListItem key={itemId} id={itemId} index={index}>
                      {item.mediaUrl && (
                        <div className="flex-shrink-0 w-12 h-10 bg-muted/50 border border-border rounded flex items-center justify-center">
                          <ItemMediaPreview url={item.mediaUrl} explicitType={detectMediaType(item.mediaUrl)} />
                        </div>
                      )}
                      <span className="text-foreground flex-1 text-sm">{item.content}</span>
                    </SortableListItem>
                  );
                })}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeDragId ? (() => {
                const item = (content.items || []).find((i: any) => i.id === activeDragId);
                return item ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-blue-400 bg-blue-600/30 shadow-2xl">
                    <GripVertical className="w-4 h-4 text-blue-300 flex-shrink-0" />
                    <span className="text-white text-sm font-medium">{item.content}</span>
                  </div>
                ) : null;
              })() : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {effectiveType === 'drag_drop' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Arrastra las tarjetas para asignarlas a la posición correcta. El número indica la posición actual.
          </p>

          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveDragId(String(e.active.id))}
            onDragEnd={handleDragDropDndEnd}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          >
            <SortableContext items={dragDropOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {dragDropOrder.map((itemId: string, index: number) => {
                  const item = (content.items || []).find((i: any) => i.id === itemId);
                  if (!item) return null;
                  return (
                    <SortableGridCard key={itemId} id={itemId} index={index}>
                      <div className="text-center space-y-1">
                        {item.mediaUrl && (
                          <div className="flex justify-center mb-2">
                            <div className="w-14 h-10 bg-muted/50 rounded flex items-center justify-center">
                              <ItemMediaPreview url={item.mediaUrl} explicitType={detectMediaType(item.mediaUrl)} />
                            </div>
                          </div>
                        )}
                        <span className="text-foreground font-medium text-sm block leading-tight">{item.content}</span>
                      </div>
                    </SortableGridCard>
                  );
                })}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeDragId ? (() => {
                const item = (content.items || []).find((i: any) => i.id === activeDragId);
                return item ? (
                  <div className="p-3 rounded-xl border-2 border-blue-400 bg-blue-600/40 shadow-2xl rotate-3">
                    <div className="text-center">
                      <span className="text-foreground font-medium text-sm">{item.content}</span>
                    </div>
                  </div>
                ) : null;
              })() : null}
            </DragOverlay>
          </DndContext>

        </div>
      )}

    </div>
  );
};

export default QuestionRenderer;
