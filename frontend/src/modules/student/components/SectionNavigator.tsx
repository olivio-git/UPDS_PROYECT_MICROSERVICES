import React from 'react';
import {
  Bookmark,
  CheckCircle,
  Timer,
  BookOpen,
  PenTool,
  Headphones,
  Mic,
  Play,
} from 'lucide-react';

export interface QuestionState {
  id: string;
  answered: boolean;
  text?: string;
  flagged?: boolean;
}

export interface SectionStat {
  id: string;
  name: string;
  competency: string;
  answered: number;
  total: number;
  progress: number;
  questionStates: QuestionState[];
}

interface SectionNavigatorProps {
  sections: SectionStat[];
  currentSectionIndex: number;
  currentQuestionIndex: number;
  onSectionChange: (sectionIndex: number) => void;
  onQuestionJump: (sectionIndex: number, questionIndex: number) => void;
  className?: string;
}

const competencyIcons: { [key: string]: React.ComponentType<{ className?: string }> } = {
  reading: BookOpen,
  writing: PenTool,
  listening: Headphones,
  speaking: Mic,
  general: Play,
};

const competencyAccent: Record<string, { activeBg: string; activeIcon: string }> = {
  reading:    { activeBg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/50',   activeIcon: 'text-blue-600 dark:text-blue-400' },
  writing:    { activeBg: 'bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/50', activeIcon: 'text-purple-600 dark:text-purple-400' },
  listening:  { activeBg: 'bg-green-50 dark:bg-green-500/10 border-green-300 dark:border-green-500/50',  activeIcon: 'text-green-600 dark:text-green-400' },
  speaking:   { activeBg: 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/50', activeIcon: 'text-orange-600 dark:text-orange-400' },
  general:    { activeBg: 'bg-slate-50 dark:bg-slate-500/10 border-slate-300 dark:border-slate-500/50', activeIcon: 'text-slate-600 dark:text-slate-400' },
};

/** A single numbered chip in the question palette. Colour alone never carries
 * the state: current also gets a ring + solid fill, answered gets a check
 * glyph, flagged gets a bookmark dot layered on top of whatever else is
 * true — so colour-blind users read state from shape/icon too. */
const PaletteChip: React.FC<{
  index: number;
  answered: boolean;
  flagged: boolean;
  isCurrent: boolean;
  onClick: () => void;
}> = ({ index, answered, flagged, isCurrent, onClick }) => {
  const label = `Pregunta ${index + 1}${isCurrent ? ', actual' : ''}${answered ? ', respondida' : ', sin responder'}${flagged ? ', marcada para revisar' : ''}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={isCurrent ? 'true' : undefined}
      className={[
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-semibold tabular-nums transition-all duration-150',
        isCurrent
          ? 'border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30 ring-offset-1 ring-offset-card'
          : answered
          ? 'border-primary/50 bg-primary/10 text-primary hover:border-primary hover:bg-primary/15'
          : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/50',
      ].join(' ')}
    >
      {index + 1}
      {flagged && (
        <span
          className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-500 bg-amber-400 dark:bg-amber-500"
          title="Marcada para revisar"
        >
          <Bookmark className="h-2 w-2 fill-white text-white" />
        </span>
      )}
    </button>
  );
};

export const SectionNavigator: React.FC<SectionNavigatorProps> = ({
  sections,
  currentSectionIndex,
  currentQuestionIndex,
  onSectionChange,
  onQuestionJump,
  className = '',
}) => {
  const totalAnswered = sections.reduce((s, sec) => s + sec.answered, 0);
  const totalQuestions = sections.reduce((s, sec) => s + sec.total, 0);
  const overallPct = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  // Flattened, ordered list of every question in the exam — drives the
  // segmented bar at the foot, one thin segment per question regardless of
  // which section it belongs to.
  const flatQuestions = sections.flatMap((section, sIdx) =>
    section.questionStates.map((q, qIdx) => ({
      ...q,
      sectionIndex: sIdx,
      questionIndex: qIdx,
      isCurrent: sIdx === currentSectionIndex && qIdx === currentQuestionIndex,
    }))
  );

  return (
    <div className={`flex flex-col overflow-hidden border border-border bg-card ${className}`}>
      {/* Scrollable palette — long sections scroll in here, never the page */}
      <div className="flex-1 overflow-y-auto">
        {sections.map((section, sIdx) => {
          const Icon = competencyIcons[section.competency] || Play;
          const accent = competencyAccent[section.competency] || competencyAccent.general;
          const isActive = sIdx === currentSectionIndex;
          const isCompleted = section.answered === section.total && section.total > 0;
          const isStarted = section.answered > 0 && !isCompleted;

          return (
            <div key={section.id} className="border-b border-border last:border-b-0">
              {/* Section header — click to jump to this section */}
              <button
                type="button"
                onClick={() => onSectionChange(sIdx)}
                className={[
                  'flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors duration-150',
                  isActive ? accent.activeBg : 'border-transparent hover:bg-muted/40',
                ].join(' ')}
              >
                <div className={`shrink-0 ${isActive ? accent.activeIcon : 'text-muted-foreground'}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={`flex-1 truncate text-xs font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {section.name}
                </span>
                <span className={`shrink-0 text-[10px] tabular-nums ${isActive ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                  {section.answered}/{section.total}
                </span>
                {isCompleted ? (
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : isStarted ? (
                  <Timer className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                ) : null}
              </button>

              {/* Numbered chip grid for this section's questions */}
              {isActive && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 px-3 pb-3 pt-1">
                  {section.questionStates.map((q, qIdx) => (
                    <PaletteChip
                      key={q.id}
                      index={qIdx}
                      answered={q.answered}
                      flagged={Boolean(q.flagged)}
                      isCurrent={isActive && qIdx === currentQuestionIndex}
                      onClick={() => {
                        onSectionChange(sIdx);
                        onQuestionJump(sIdx, qIdx);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend + segmented progress bar, pinned to the foot */}
      <div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-primary bg-primary" /> Actual
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-primary/50 bg-primary/10" /> Respondida
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-border bg-card" /> Sin responder
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border border-amber-500 bg-amber-400 dark:bg-amber-500" /> Marcada
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {totalAnswered}/{totalQuestions}
          </span>
          <div className="flex h-2 flex-1 gap-px overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={overallPct} aria-valuemin={0} aria-valuemax={100}>
            {flatQuestions.map((q) => (
              <div
                key={q.id}
                className={[
                  'h-full flex-1 rounded-[1px] transition-colors',
                  q.isCurrent ? 'bg-primary' : q.answered ? 'bg-primary/50' : 'bg-border',
                  q.flagged && !q.isCurrent ? 'bg-amber-400 dark:bg-amber-500' : '',
                ].join(' ')}
              />
            ))}
          </div>
          <span className="shrink-0 text-[10px] font-bold text-foreground">{overallPct}%</span>
        </div>
      </div>
    </div>
  );
};

export default SectionNavigator;
