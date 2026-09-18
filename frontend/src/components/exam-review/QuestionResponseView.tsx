import { toBrowserMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import type { ReviewQuestionData } from './types';

// ── Narrowing helpers: responses are untyped JSON from the database ─────────

type Rec = Record<string, unknown>;

const asRecord = (value: unknown): Rec =>
  value !== null && typeof value === 'object' ? (value as Rec) : {};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

const firstString = (...values: unknown[]): string => {
  for (const v of values) if (typeof v === 'string' && v) return v;
  return '';
};

/**
 * Older records stored structured responses as a JSON string. Only accept the
 * parse when it yields an object: a free-text answer such as "42" or "true" is
 * valid JSON too, and must stay the text the candidate wrote.
 */
function parseResponse(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' ? parsed : raw;
  } catch {
    return raw;
  }
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

// ── Shared styling for right/wrong answers ───────────────────────────────────

const ANSWER = {
  correct: 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-300',
  wrong: 'border border-red-200 bg-red-50 text-red-700 dark:border-red-600/50 dark:bg-red-900/20 dark:text-red-300',
  /** A correct option the candidate did not pick. */
  missed: 'border border-emerald-200/70 bg-emerald-50/60 text-emerald-600/70 dark:border-emerald-600/30 dark:bg-emerald-900/10 dark:text-emerald-400/60',
  neutral: 'border border-border bg-muted/40 text-muted-foreground',
} as const;

const HINT = 'text-emerald-600/70 dark:text-emerald-400/70';

const choiceClass = (selected: boolean, correct: boolean) =>
  selected ? (correct ? ANSWER.correct : ANSWER.wrong) : correct ? ANSWER.missed : ANSWER.neutral;

const gradedClass = (ok: boolean | null) =>
  ok === true ? ANSWER.correct : ok === false ? ANSWER.wrong : 'border border-border bg-muted/40 text-foreground/80';

const Empty = ({ children = 'Sin respuesta' }: { children?: ReactNode }) => (
  <p className="text-xs text-muted-foreground italic">{children}</p>
);

const TextBox = ({ children }: { children: ReactNode }) => (
  <div className="bg-muted/40 border border-border rounded-lg px-3 py-2.5">
    <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{children}</p>
  </div>
);

// ── One renderer per question type ──────────────────────────────────────────

type Renderer = (response: unknown, data: ReviewQuestionData | undefined) => ReactNode;

const multipleChoice: Renderer = (response, data) => {
  const selected = asStringArray(asRecord(response).selectedOptions);
  const options = data?.options ?? [];
  if (options.length === 0) {
    return <TextBox>Opción(es): {selected.join(', ') || '—'}</TextBox>;
  }
  return (
    <div className="space-y-1.5">
      {options.map((opt) => {
        const isSelected = selected.includes(String(opt.id));
        const isCorrect = !!opt.isCorrect;
        return (
          <div key={opt.id} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-xs', choiceClass(isSelected, isCorrect))}>
            <span aria-hidden>{isSelected ? '●' : '○'}</span>
            <span>{opt.text}</span>
            {isCorrect && <span className={cn('ml-auto', HINT)}>✓ correcta</span>}
          </div>
        );
      })}
    </div>
  );
};

const trueFalse: Renderer = (response, data) => {
  const answer = asRecord(response).answer;
  const said = String(answer).toLowerCase();
  const userTrue = answer === true || said === 'true' || said === 'verdadero';
  const userFalse = answer === false || said === 'false' || said === 'falso';
  const correct = data?.options?.find((o) => o.isCorrect);
  const correctIsTrue = [correct?.id, correct?.text].some((v) => ['true', 'verdadero'].includes(String(v).toLowerCase()));
  return (
    <div className="flex gap-2">
      {(['Verdadero', 'Falso'] as const).map((label) => {
        const isTrue = label === 'Verdadero';
        const isSelected = isTrue ? userTrue : userFalse;
        const isCorrect = isTrue ? correctIsTrue : !correctIsTrue;
        return (
          <div key={label} className={cn('px-4 py-2 rounded-lg text-xs', choiceClass(isSelected, isCorrect), isSelected && 'font-semibold')}>
            {label}
          </div>
        );
      })}
    </div>
  );
};

const fillBlanks: Renderer = (response, data) => {
  const blanks = asStringArray(asRecord(response).blanks);
  if (blanks.length === 0) return <Empty />;
  const expected = data?.blanks ?? [];
  return (
    <div className="flex flex-wrap gap-2">
      {blanks.map((value, i) => {
        const answers = expected[i]?.correctAnswers ?? [];
        const ok = answers.length > 0
          ? answers.some((a) => a.trim().toLowerCase() === value.trim().toLowerCase())
          : null;
        return (
          <span key={i} className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs', gradedClass(ok))}>
            <span className="text-muted-foreground">[{i + 1}]</span>
            <span className="font-medium">{value || '—'}</span>
            {ok === false && answers.length > 0 && <span className={cn('ml-1', HINT)}>✓ {answers[0]}</span>}
          </span>
        );
      })}
    </div>
  );
};

const matching: Renderer = (response, data) => {
  const pairs = asRecord(asRecord(response).pairs);
  const entries = Object.entries(pairs);
  if (entries.length === 0) return <Empty />;
  const items = data?.items ?? [];
  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => {
        const item = items.find((it) => it.id === key);
        const ok = item?.matchingPair === value;
        return (
          <div key={key} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', gradedClass(ok))}>
            <span className="font-medium">{item?.content ?? key}</span>
            <span className="text-muted-foreground">→</span>
            <span>{String(value)}</span>
            {!ok && item?.matchingPair && <span className={cn('ml-auto', HINT)}>✓ {item.matchingPair}</span>}
          </div>
        );
      })}
    </div>
  );
};

const ordering: Renderer = (response, data) => {
  const order = asStringArray(asRecord(response).order);
  if (order.length === 0) return <Empty />;
  const items = data?.items ?? [];
  return (
    <div className="space-y-1">
      {order.map((id, index) => {
        const item = items.find((it) => it.id === id);
        const expected = item?.correctPosition;
        const ok = expected !== undefined ? expected === index : null;
        return (
          <div key={id} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', gradedClass(ok))}>
            <span className="text-muted-foreground font-mono">#{index + 1}</span>
            <span>{item?.content ?? id}</span>
            {ok === false && expected !== undefined && <span className={cn('ml-auto', HINT)}>✓ pos {expected + 1}</span>}
          </div>
        );
      })}
    </div>
  );
};

const dragDrop: Renderer = (response, data) => {
  // positions: { [itemId]: zoneIndex }
  // Zone indexes may be stored as numbers or numeric strings.
  const positions = Object.entries(asRecord(asRecord(response).positions))
    .map(([itemId, zone]) => [itemId, Number(zone)] as const)
    .filter(([, zone]) => Number.isInteger(zone))
    .sort(([, a], [, b]) => a - b);
  if (positions.length === 0) return <Empty />;
  const items = data?.items ?? [];
  return (
    <div className="space-y-1">
      {positions.map(([itemId, zone]) => {
        const item = items.find((it) => String(it.id) === itemId);
        const expected = item?.correctPosition;
        const ok = expected !== undefined ? expected === zone : null;
        return (
          <div key={itemId} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', gradedClass(ok))}>
            <span className="text-muted-foreground font-mono shrink-0">Zona {zone + 1}</span>
            <span className="flex-1">{item?.content ?? `Item ${itemId}`}</span>
            {ok === false && expected !== undefined && <span className={cn('ml-auto shrink-0', HINT)}>✓ Zona {expected + 1}</span>}
          </div>
        );
      })}
    </div>
  );
};

const fileUpload: Renderer = (response) => {
  const r = asRecord(response);
  const url = firstString(r.fileUrl, r.url);
  if (!url) return <Empty>Sin archivo</Empty>;
  return (
    <a
      href={toBrowserMediaUrl(url)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700/40 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 transition-colors"
    >
      📎 Ver archivo adjunto
    </a>
  );
};

const writtenText: Renderer = (response) => {
  const r = asRecord(response);
  const text = typeof response === 'string' ? response : firstString(r.text, r.answer, r.essay);
  return <TextBox>{text || 'Sin texto'}</TextBox>;
};

const audio: Renderer = (response) => {
  const r = asRecord(response);
  const rawUrl = firstString(r.audioUrl, r.url, r.audio_url);
  const url = rawUrl ? toBrowserMediaUrl(rawUrl) : '';
  const transcription = firstString(r.transcription, r.text);
  if (!url && !transcription) return <Empty>Sin audio registrado</Empty>;
  return (
    <div className="space-y-2">
      {url && (
        <div className="bg-muted/40 border border-border rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground mb-1.5">🔊 Audio del candidato</p>
          <audio controls className="w-full dark:[color-scheme:dark]">
            <source src={url} type="audio/webm" />
            <source src={url} />
          </audio>
        </div>
      )}
      {transcription && (
        <div className="bg-muted/40 border border-border rounded-lg px-3 py-2">
          <p className="text-xs text-muted-foreground mb-1">Transcripción</p>
          <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{transcription}</p>
        </div>
      )}
    </div>
  );
};

const fallback: Renderer = (response) => {
  const text = typeof response === 'string' ? response : JSON.stringify(response);
  return (
    <div className="bg-muted/40 border border-border rounded-lg px-3 py-2">
      <p className="text-xs text-muted-foreground font-mono break-all">
        {text.length > 200 ? `${text.slice(0, 200)}…` : text}
      </p>
    </div>
  );
};

const RENDERERS: Record<string, Renderer> = {
  multiple_choice: multipleChoice,
  single_choice: multipleChoice,
  true_false: trueFalse,
  fill_blanks: fillBlanks,
  fill_blank: fillBlanks,
  matching,
  ordering,
  drag_drop: dragDrop,
  file_upload: fileUpload,
  essay: writtenText,
  open_text: writtenText,
  audio_response: audio,
  speaking: audio,
};

interface QuestionResponseViewProps {
  questionType: string | undefined;
  response: unknown;
  questionData?: ReviewQuestionData;
}

/** Renders a candidate's answer the way its question type is answered, marking right and wrong parts. */
export function QuestionResponseView({ questionType, response, questionData }: QuestionResponseViewProps) {
  const parsed = parseResponse(response);
  if (isEmpty(parsed)) return <Empty>Sin respuesta registrada</Empty>;
  const render = (questionType && RENDERERS[questionType]) || fallback;
  return <>{render(parsed, questionData)}</>;
}
