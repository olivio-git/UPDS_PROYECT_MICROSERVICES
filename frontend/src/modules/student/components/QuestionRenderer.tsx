import { AudioPlayer, AudioRecorder } from '@/components/audio';
import { isMultipleAnswer } from '../utils/questionView';
import { Badge } from '@/components/keel/badge';
import { Spinner } from '@/components/keel/spinner';
import { Textarea } from '@/components/keel/textarea';
import { FillBlanksInput } from '@/components/questions/inputs/FillBlanksInput';
import { MatchingInput } from '@/components/questions/inputs/MatchingInput';
import { OrderingInput } from '@/components/questions/inputs/OrderingInput';
import { SentenceBuilderInput } from '@/components/questions/inputs/SentenceBuilderInput';
import { derange, shuffle } from '@/components/questions/shuffle';
import type { Question } from '@/modules/exams/types';
import { toBrowserMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, CheckCircle, Headphones } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

/** A, B, C... labels for answer options — keyboard shortcuts in ExamRunnerHTTP
 * mirror this exact letter-to-index mapping (see its keyboard map). */
const optionLetter = (index: number) => String.fromCharCode(65 + index);

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

const KNOWN_TYPES = [
  'multiple_choice', 'true_false', 'open_text', 'essay', 'audio_response', 'file_upload',
  'fill_blanks', 'drag_drop', 'matching', 'ordering',
];

const RESPONSE_LENGTH_LABEL: Record<string, string> = {
  word: 'Una palabra',
  sentence: 'Una oración',
  paragraph: 'Un párrafo',
};

// Detect media kind from a URL (data:, blob: or file extension).
const detectMediaType = (url?: string): 'audio' | 'image' | 'video' | null => {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.startsWith('data:')) {
    if (u.includes('audio/')) return 'audio';
    if (u.includes('image/')) return 'image';
    if (u.includes('video/')) return 'video';
  }
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

function MediaError({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      <AlertTriangle className="size-3.5 shrink-0" />
      {children}
    </div>
  );
}

// Small media attached to a single item (matching / ordering rows).
const ItemMedia: React.FC<{ url?: string }> = ({ url }) => {
  const [imgFailed, setImgFailed] = useState(false);
  if (!url) return null;
  if (url.startsWith('blob:')) return <MediaError>Archivo no guardado correctamente</MediaError>;
  const type = detectMediaType(url);
  if (type === 'audio' || (type === null && imgFailed)) {
    return <AudioPlayer src={url} variant="compact" title="Audio" showControls={{ time: true, seek: true }} className="mt-1.5 w-full" />;
  }
  if (type === 'video') {
    return <video controls src={url} className="mt-1.5 h-20 rounded-md" />;
  }
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      onError={() => setImgFailed(true)}
      className="mt-1.5 h-16 w-auto rounded-md object-cover"
    />
  );
};

/** Choice card shared by multiple choice and true/false. */
function ChoiceCard({
  letter,
  label,
  selected,
  role,
  tabIndex,
  onActivate,
}: {
  letter: string;
  label: string;
  selected: boolean;
  role: 'radio' | 'checkbox';
  tabIndex: number;
  onActivate: () => void;
}) {
  return (
    <div
      data-testid="mc-option"
      role={role}
      aria-checked={selected}
      aria-label={label}
      tabIndex={tabIndex}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
      className={cn(
        'group flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150 outline-none',
        'focus-visible:ring-3 focus-visible:ring-ring/40',
        selected
          ? 'border-primary bg-primary/5 ring-3 ring-primary/15'
          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
      )}
    >
      <span
        key={selected ? 'on' : 'off'}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
          selected ? 'q-pop bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground',
        )}
      >
        {selected ? <Check className="size-4" /> : letter}
      </span>
      <span className={cn('flex-1 text-[15px]', selected ? 'font-medium text-foreground' : 'text-foreground')}>{label}</span>
    </div>
  );
}

const QuestionRenderer: React.FC<Props> = ({
  question,
  answer,
  onChange,
  className = '',
  showQuestionNumber = false,
  questionNumber,
  totalQuestions,
  isUploadingAudio = false,
  sectionInfo,
}) => {
  const id = question?._id || question?.id || 'unknown';
  const content = useMemo(() => question?.content || {}, [question?.content]);

  const titleText = content.question || question?.title || question?.text || '';
  const contextText = content.context || question?.context || '';
  const optionsList = content.options || question?.options || [];
  const items: any[] = useMemo(() => content.items || [], [content.items]);
  const mediaUrl = toBrowserMediaUrl(content.mediaUrl || question?.mediaUrl || '');
  const isListening = question?.competency === 'listening';

  const effectiveType: string = useMemo(() => {
    if (question?.type && KNOWN_TYPES.includes(question.type)) return question.type;
    const legacy = question?.type || question?.competency;
    if (legacy === 'listening' || legacy === 'speaking') return 'audio_response';
    return 'open_text';
  }, [question?.type, question?.competency]);

  // Single vs multi select for multiple choice (same rule ExamRunnerHTTP uses).
  const isSingleSelect = !isMultipleAnswer(content, optionsList);

  // ── Shuffles: computed once per question, never saved until the student acts ──
  const matchingOptions = useMemo(() => {
    // The exam runner receives the right-hand column apart from the rows (no answer key);
    // the editor preview still passes full items with matchingPair.
    const source: unknown[] = Array.isArray(content.matchOptions) ? content.matchOptions : items.map((i) => i.matchingPair);
    const values = Array.from(new Set(source.filter((v): v is string => typeof v === 'string' && v.length > 0)));
    return derange(values);
  }, [items, content.matchOptions]);

  const initialOrder = useMemo(() => derange(items.map((i) => String(i.id))), [items]);
  const builderPieces = useMemo(
    () => shuffle(items.map((i) => ({ id: String(i.id), content: String(i.content ?? '') }))),
    [items],
  );

  const emit = useCallback((value: any) => onChange(id, value), [id, onChange]);

  const toggleOption = useCallback(
    (optionId: string) => {
      const selected: string[] = answer?.selectedOptions || [];
      emit({
        selectedOptions: selected.includes(optionId) ? selected.filter((s) => s !== optionId) : [...selected, optionId],
      });
    },
    [answer?.selectedOptions, emit],
  );

  if (!question) return null;

  const textValue: string = answer?.text || '';
  const wordCount = textValue.trim() ? textValue.trim().split(/\s+/).length : 0;
  const mediaKind = detectMediaType(mediaUrl);

  return (
    <div className={cn('q-enter flex flex-col gap-5', className)}>
      {/* ── Header ── */}
      {showQuestionNumber && questionNumber && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-medium">
            Pregunta {questionNumber}
            {totalQuestions ? ` de ${totalQuestions}` : ''}
          </span>
          {sectionInfo && (
            <span className="flex items-center gap-2">
              <Badge variant="secondary">{sectionInfo.competency}</Badge>
              {sectionInfo.name} · {sectionInfo.questionIndex + 1}/{sectionInfo.totalQuestionsInSection}
            </span>
          )}
        </div>
      )}

      {/* Listening: the audio comes first, so the student hears it before reading. */}
      {isListening && mediaUrl && (
        mediaUrl.startsWith('blob:') ? (
          <MediaError>Audio no guardado correctamente</MediaError>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Headphones className="size-3.5" />
              Audio
            </span>
            <AudioPlayer src={mediaUrl} variant="compact" title="Audio de comprensión" showControls={{ volume: true, speed: true, seek: true, time: true }} />
          </div>
        )
      )}

      {/* Reading passage — hidden for listening, where it is the audio transcript. */}
      {contextText && !isListening && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">
          {contextText}
        </div>
      )}

      {titleText && <h2 className="text-xl leading-snug font-semibold text-foreground">{titleText}</h2>}
      {content.instructions && <p className="-mt-3 text-sm text-muted-foreground">{content.instructions}</p>}

      {/* Question media (image / video / non-listening audio) */}
      {mediaUrl && !(isListening && mediaKind === 'audio') && (
        <div className="flex justify-center">
          {mediaUrl.startsWith('blob:') ? (
            <MediaError>Archivo no guardado correctamente</MediaError>
          ) : mediaKind === 'audio' ? (
            <AudioPlayer src={mediaUrl} variant="compact" title="Audio de la pregunta" showControls={{ volume: true, speed: true, seek: true, time: true }} className="w-full max-w-md" />
          ) : mediaKind === 'video' ? (
            <video controls src={mediaUrl} className="max-h-64 max-w-full rounded-xl" />
          ) : (
            <img src={mediaUrl} alt="" className="max-h-64 max-w-full rounded-xl object-contain" />
          )}
        </div>
      )}

      {/* ── Answer area ── */}
      {effectiveType === 'multiple_choice' && (
        <div
          className="flex flex-col gap-2.5"
          role={isSingleSelect ? 'radiogroup' : 'group'}
          aria-label="Opciones de respuesta"
          onKeyDown={(e) => {
            // Up/Down move within the options; Left/Right stay free for the
            // runner's "next/previous question" shortcut.
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-testid="mc-option"]'));
            const current = els.findIndex((el) => el === document.activeElement);
            const next = (current + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length;
            els[next]?.focus();
            if (isSingleSelect) {
              const opt = optionsList[next];
              const optId = opt?.id || opt?._id;
              if (optId) emit({ selectedOptions: [optId] });
            }
          }}
        >
          {!isSingleSelect && <p className="text-xs text-muted-foreground">Puedes elegir más de una opción.</p>}
          {optionsList.map((opt: any, index: number) => {
            const optId = opt.id || opt._id;
            const selected = (answer?.selectedOptions || []).includes(optId);
            const anySelected = (answer?.selectedOptions || []).length > 0;
            return (
              <ChoiceCard
                key={optId}
                letter={optionLetter(index)}
                label={opt.text}
                selected={selected}
                role={isSingleSelect ? 'radio' : 'checkbox'}
                tabIndex={selected || (!anySelected && index === 0) ? 0 : -1}
                onActivate={() => (isSingleSelect ? emit({ selectedOptions: [optId] }) : toggleOption(optId))}
              />
            );
          })}
        </div>
      )}

      {effectiveType === 'true_false' && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Verdadero o falso">
          {([
            { label: 'Verdadero', value: true },
            { label: 'Falso', value: false },
          ] as const).map((opt, index) => {
            const selected = answer?.answer === opt.value || answer?.answer === String(opt.value);
            const anySelected = answer?.answer !== undefined && answer?.answer !== null && answer?.answer !== '';
            return (
              <ChoiceCard
                key={opt.label}
                letter={optionLetter(index)}
                label={opt.label}
                selected={selected}
                role="radio"
                tabIndex={selected || (!anySelected && index === 0) ? 0 : -1}
                onActivate={() => emit({ answer: opt.value })}
              />
            );
          })}
        </div>
      )}

      {(effectiveType === 'open_text' || effectiveType === 'essay') && (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={textValue}
            onChange={(e) => emit({ text: e.target.value })}
            rows={effectiveType === 'essay' ? 10 : 4}
            placeholder={effectiveType === 'essay' ? 'Escribe tu texto…' : 'Escribe tu respuesta…'}
            className="min-h-28 bg-card text-[15px] leading-relaxed"
          />
          <span className="self-end text-xs text-muted-foreground tabular-nums">
            {wordCount} {wordCount === 1 ? 'palabra' : 'palabras'}
          </span>
        </div>
      )}

      {effectiveType === 'fill_blanks' && (
        <FillBlanksInput
          template={content.template ?? ''}
          value={answer?.blanks ?? []}
          onChange={(blanks) => emit({ blanks })}
        />
      )}

      {effectiveType === 'matching' && (
        <>
          {items.some((i) => i.mediaUrl?.startsWith('blob:')) && (
            <MediaError>Algunos archivos de esta pregunta no se guardaron. Avisa a tu docente.</MediaError>
          )}
          <MatchingInput
            items={items.map((i) => ({
              id: String(i.id),
              content: String(i.content ?? ''),
              media: i.mediaUrl ? <ItemMedia url={toBrowserMediaUrl(i.mediaUrl)} /> : undefined,
            }))}
            options={matchingOptions}
            pairs={answer?.pairs ?? {}}
            onChange={(pairs) => emit({ pairs })}
          />
        </>
      )}

      {effectiveType === 'ordering' && (
        <OrderingInput
          items={items.map((i) => ({
            id: String(i.id),
            content: String(i.content ?? ''),
            media: i.mediaUrl ? <ItemMedia url={toBrowserMediaUrl(i.mediaUrl)} /> : undefined,
          }))}
          order={answer?.order ?? initialOrder}
          onChange={(order) => emit({ order })}
        />
      )}

      {effectiveType === 'drag_drop' && (
        <SentenceBuilderInput
          pieces={builderPieces}
          positions={answer?.positions ?? {}}
          onChange={(positions) => emit({ positions })}
        />
      )}

      {effectiveType === 'audio_response' && (
        <div className="flex flex-col gap-3">
          {content.promptAudioUrl && (
            <AudioPlayer src={toBrowserMediaUrl(content.promptAudioUrl)} variant="compact" title="Consigna en audio" />
          )}
          {content.expectedResponseType && (
            <Badge variant="secondary" className="self-start">
              {RESPONSE_LENGTH_LABEL[content.expectedResponseType] ?? 'Respuesta oral'}
            </Badge>
          )}
          <AudioRecorder
            variant="compact"
            maxDuration={content.expectedResponseType === 'word' ? 10 : content.expectedResponseType === 'sentence' ? 30 : 120}
            onRecordingComplete={(blob: Blob, url: string, duration: number) => {
              emit({ previewUrl: url, audioBlob: blob, audioDuration: duration });
            }}
          />
          {isUploadingAudio && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Guardando tu respuesta…
            </p>
          )}
          {answer?.uploadFailed && !isUploadingAudio && (
            <MediaError>No se pudo guardar el audio. Vuelve a grabar.</MediaError>
          )}
          {answer?.audioUrl && !isUploadingAudio && (
            <p className="q-enter flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="size-4" />
              Respuesta guardada
            </p>
          )}
          {/* audioUrl is the server copy; previewUrl is only valid while the blob is in memory. */}
          {(answer?.audioUrl || (answer?.previewUrl && answer?.audioBlob)) && (
            <AudioPlayer
              src={answer.audioUrl || answer.previewUrl}
              variant="compact"
              title="Tu respuesta"
              knownDuration={answer.audioDuration}
            />
          )}
        </div>
      )}

      {effectiveType === 'file_upload' && (
        <div className="flex flex-col gap-2">
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) emit({ file });
            }}
            className="w-full rounded-xl border border-dashed border-border bg-card p-3 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
          />
          {answer?.file && <p className="text-xs text-muted-foreground">{answer.file.name}</p>}
        </div>
      )}
    </div>
  );
};

export default QuestionRenderer;
