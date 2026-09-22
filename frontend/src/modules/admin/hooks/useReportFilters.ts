import type { ReportFilters } from '@/services/reportsService';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';
import type { TrendPeriod } from '../components/reports/constants';

const DATE_FORMAT = 'yyyy-MM-dd';

/** Drops empty values so they are neither sent to the API nor part of query keys. */
function compact(filters: ReportFilters): ReportFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) =>
        value !== '' && value !== undefined && value !== null &&
        !(Array.isArray(value) && value.length === 0),
    ),
  ) as ReportFilters;
}

const toggle = (list: string[] | undefined, item: string) =>
  list?.includes(item) ? list.filter((x) => x !== item) : [...(list ?? []), item];

/**
 * Filter state for the reports screen.
 *
 * `draft` is what the filter bar is editing; `applied` is what the queries use.
 * They only sync when the user presses "Aplicar", so toggling several chips
 * does not fire a round of requests per click.
 */
export function useReportFilters() {
  const [draft, setDraft] = useState<ReportFilters>({});
  const [applied, setApplied] = useState<ReportFilters>({});
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('month');

  // Derived from the stored strings rather than kept as separate state.
  // parseISO reads 'yyyy-MM-dd' as local midnight; `new Date('yyyy-MM-dd')`
  // would read it as UTC and shift the date back a day in Bolivia (UTC-4).
  const dateRange: DateRange | undefined = draft.startDate
    ? { from: parseISO(draft.startDate), to: draft.endDate ? parseISO(draft.endDate) : undefined }
    : undefined;

  return {
    draft,
    applied,
    trendPeriod,
    dateRange,

    setGestion: (gestion: number | undefined) =>
      setDraft((prev) => ({ ...prev, gestion, semestre: undefined, startDate: '', endDate: '' })),

    toggleSemestre: (semestre: 'H1' | 'H2') =>
      setDraft((prev) => ({
        ...prev,
        semestre: prev.semestre === semestre ? undefined : semestre,
        startDate: '',
        endDate: '',
      })),

    setSessionId: (sessionId: string | undefined) =>
      setDraft((prev) => ({ ...prev, sessionId })),

    /** A free date range replaces the gestion/semestre shortcuts. */
    setDateRange: (range: DateRange | undefined) =>
      setDraft((prev) => ({
        ...prev,
        startDate: range?.from ? format(range.from, DATE_FORMAT) : '',
        endDate: range?.to ? format(range.to, DATE_FORMAT) : '',
        ...(range ? { gestion: undefined, semestre: undefined } : {}),
      })),

    toggleLevel: (level: string) =>
      setDraft((prev) => ({ ...prev, levels: toggle(prev.levels, level) })),

    toggleCompetency: (competency: string) =>
      setDraft((prev) => ({ ...prev, competencies: toggle(prev.competencies, competency) })),

    setTrendPeriod,

    apply: () => {
      if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
        toast.error('La fecha de inicio no puede ser posterior a la fecha de fin');
        return;
      }
      setApplied(compact(draft));
    },

    clear: () => {
      setDraft({});
      setApplied({});
      setTrendPeriod('month');
    },
  };
}

export type ReportFiltersState = ReturnType<typeof useReportFilters>;
