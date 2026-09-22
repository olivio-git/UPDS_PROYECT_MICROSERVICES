import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  CheckCircle,
  Timer,
  BookOpen,
  PenTool,
  Headphones,
  Mic,
  Play,
  ChevronDown,
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

export const SectionNavigator: React.FC<SectionNavigatorProps> = ({
  sections,
  currentSectionIndex,
  currentQuestionIndex,
  onSectionChange,
  onQuestionJump,
  className = '',
}) => {
  // Track which sections are expanded; active section always expands
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([currentSectionIndex]));

  useEffect(() => {
    setExpanded(prev => new Set([...prev, currentSectionIndex]));
  }, [currentSectionIndex]);

  const totalAnswered = sections.reduce((s, sec) => s + sec.answered, 0);
  const totalQuestions = sections.reduce((s, sec) => s + sec.total, 0);
  const overallPct = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  const toggleExpand = (index: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className={`bg-card border border-border rounded-xl overflow-hidden flex flex-col ${className}`}>
      {/* Section list with accordion questions */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {sections.map((section, sIdx) => {
          const Icon = competencyIcons[section.competency] || Play;
          const accent = competencyAccent[section.competency] || competencyAccent.general;
          const isActive = sIdx === currentSectionIndex;
          const isExpanded = expanded.has(sIdx);
          const isCompleted = section.answered === section.total && section.total > 0;
          const isStarted = section.answered > 0 && !isCompleted;

          return (
            <div key={section.id}>
              {/* Section header row */}
              <button
                onClick={() => {
                  onSectionChange(sIdx);
                  toggleExpand(sIdx);
                }}
                className={[
                  'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-150 border-l-2',
                  isActive ? `${accent.activeBg}` : 'border-transparent hover:bg-muted/40',
                ].join(' ')}
              >
                <div className={`shrink-0 ${isActive ? accent.activeIcon : 'text-muted-foreground'}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className={`flex-1 text-xs font-semibold truncate ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {section.name}
                </span>
                <span className={`text-[10px] tabular-nums shrink-0 ${isActive ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                  {section.answered}/{section.total}
                </span>
                {isCompleted ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                ) : isStarted ? (
                  <Timer className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </button>

              {/* Questions list (expanded) — tree style */}
              {isExpanded && section.questionStates?.length > 0 && (
                <div className="pl-4 pr-2 pt-0.5 pb-2">
                  {/* Vertical connector line */}
                  <div className="relative border-l border-border/60 ml-1.5 flex flex-col gap-0.5">
                    {(section.questionStates ?? []).map((q, qIdx) => {
                      const isCurrent = isActive && qIdx === currentQuestionIndex;
                      return (
                        <button
                          key={q.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSectionChange(sIdx);
                            onQuestionJump(sIdx, qIdx);
                          }}
                          className={[
                            'relative flex items-start gap-2.5 pl-4 pr-2 py-1.5 rounded-r-lg text-left transition-all duration-150 group',
                            isCurrent
                              ? `${accent.activeBg}`
                              : 'hover:bg-muted/50',
                            '',
                          ].join(' ')}
                        >
                          {/* Horizontal connector tick */}
                          <span className="absolute left-0 top-[13px] w-3 border-t border-border/60" />
                          {/* Node dot */}
                          <span className={[
                            'absolute left-[-4.5px] top-[10px] w-2.5 h-2.5 rounded-full border-2 shrink-0 transition-all',
                            isCurrent
                              ? `${accent.activeIcon} border-current bg-card`
                              : q.flagged
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/20'
                              : q.answered
                              ? 'border-green-500 bg-green-500'
                              : 'border-border bg-card group-hover:border-muted-foreground',
                          ].join(' ')} />
                          {/* Number */}
                          <span className={[
                            'shrink-0 text-[10px] tabular-nums font-semibold mt-0.5 w-4 text-right',
                            isCurrent ? accent.activeIcon : q.flagged ? 'text-amber-500' : q.answered ? 'text-green-500' : 'text-muted-foreground/50',
                          ].join(' ')}>
                            {qIdx + 1}.
                          </span>
                          {/* Text */}
                          <span className={[
                            'flex-1 text-[11px] leading-snug line-clamp-2',
                            isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground group-hover:text-foreground/80',
                          ].join(' ')}>
                            {q.text?.trim() || `Pregunta ${qIdx + 1}`}
                          </span>
                          {/* Flag icon */}
                          {q.flagged && (
                            <Bookmark
                              className="shrink-0 w-3 h-3 text-amber-500 mt-0.5 fill-amber-500/30"
                              title="Marcada para revisar"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall progress */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/20 border-t border-border shrink-0">
        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
          {totalAnswered}/{totalQuestions}
        </span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-foreground shrink-0">{overallPct}%</span>
      </div>
    </div>
  );
};

export default SectionNavigator;