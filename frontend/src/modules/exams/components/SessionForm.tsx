import { Button } from "@/components/atoms/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/atoms/collapsible";
import { Input } from "@/components/atoms/input";
import { Switch } from "@/components/atoms/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { TimePicker } from "@/components/atoms/time-picker";
import {
  AlertCircle, BookOpen, Calendar, ChevronDown, ChevronLeft, ChevronRight,
  Clock, Database, Lock, Play, Save, Settings, Users, Video, Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useExams } from "../hooks/useExams";
import { useSessions } from "../hooks/useSessions";
import type { Exam, ExamSession } from "../types";

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const sessionSchema = z.object({
  sessionName: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  examId: z.string().min(1, "Debe seleccionar un examen"),
  sessionType: z.enum(['group_synchronized', 'individual_flexible']).default('group_synchronized').optional(),
  scheduling: z.object({
    startDate: z.string().min(1, "La fecha de inicio es requerida"),
    endDate: z.string().min(1, "La fecha de fin es requerida"),
    timeSlots: z.array(z.object({
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      capacity: z.number().min(1, "La capacidad debe ser mayor a 0")
    })).optional(),
    timeZone: z.string().optional(),
    duration: z.number().optional()
  }),
  participants: z.object({
    maxCandidates: z.number().min(1, "Debe permitir al menos 1 candidato").max(200, "Máximo 200 candidatos")
  }),
  settings: z.object({
    requireProctor: z.boolean(),
    enableRecording: z.boolean(),
    enableLockdown: z.boolean(),
    allowLateEntry: z.boolean(),
    autoStart: z.boolean(),
    lateEntryMinutes: z.number().min(0).max(60)
  }),
  timing: z.object({
    sessionWindow: z.object({
      start: z.string().min(1),
      end: z.string().min(1)
    }).optional(),
    examDuration: z.number().min(1).max(480).optional(),
    lateJoinPolicy: z.enum(['guaranteed', 'remaining', 'sliding']).optional(),
    maxLateness: z.number().min(0).max(120).optional(),
    autoSaveInterval: z.number().min(10).max(300).optional(),
    guaranteedTime: z.boolean().optional()
  }).optional()
});

type SessionFormData = z.infer<typeof sessionSchema>;

interface Props {
  session?: ExamSession | null;
  onCancel: () => void;
  onSaved: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateToStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const SessionForm: React.FC<Props> = ({ session, onCancel, onSaved }) => {
  const { createSession, updateSession } = useSessions();
  const { exams, loadExams } = useExams();
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const isEditing = !!session;

  // Split date/time state
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');

  // Calendar state
  const [viewDate, setViewDate] = useState(() => new Date());
  const [multiDay, setMultiDay] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'start' | 'end'>('start');
  const calendarInitialized = useRef(false);

  const { register, handleSubmit, control, watch, setValue, formState: { errors }, reset } = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      sessionName: "",
      examId: "",
      scheduling: { startDate: "", endDate: "", timeSlots: [] },
      participants: { maxCandidates: 30 },
      settings: {
        requireProctor: true, enableRecording: false,
        enableLockdown: false, allowLateEntry: false,
        autoStart: true, lateEntryMinutes: 0
      },
      sessionType: 'group_synchronized',
      timing: {
        examDuration: 60, lateJoinPolicy: 'remaining',
        maxLateness: 15, autoSaveInterval: 30, guaranteedTime: false
      }
    }
  });

  const watchExamId = watch("examId");
  const watchAllowLateEntry = watch("settings.allowLateEntry");
  const watchSessionType = watch("sessionType");
  const isFlexibleSession = watchSessionType === 'individual_flexible';

  useEffect(() => { loadExams(); }, [loadExams]);

  const toLocalInputFormat = (isoString: string): string => {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    if (session) {
      const startLocal = toLocalInputFormat(session.scheduling.startDate);
      const endLocal   = toLocalInputFormat(session.scheduling.endDate);
      const [sDate, sTime] = startLocal.split('T');
      const [eDate, eTime] = endLocal.split('T');
      setStartDate(sDate); setStartTime(sTime);
      setEndDate(eDate);   setEndTime(eTime);

      if (!calendarInitialized.current) {
        const d = new Date(sDate);
        setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
        if (sDate !== eDate) setMultiDay(true);
        calendarInitialized.current = true;
      }

      reset({
        sessionName: session.sessionName,
        examId: session?.examId,
        scheduling: { startDate: startLocal, endDate: endLocal, timeSlots: session.scheduling.timeSlots || [] },
        participants: { maxCandidates: session.participants.maxCandidates },
        settings: {
          requireProctor: session.settings.requireProctor,
          enableRecording: session.settings.recordSession,
          enableLockdown: session.settings.browserLockdown,
          allowLateEntry: session.settings.allowLateEntry,
          autoStart: session.settings.autoStart ?? true,
          lateEntryMinutes: session.settings.lateEntryMinutes
        },
        sessionType: (session as any).sessionType || 'group_synchronized',
        timing: {
          examDuration: (session as any).timing?.examDuration || 60,
          lateJoinPolicy: (session as any).timing?.lateJoinPolicy || 'remaining',
          maxLateness: (session as any).timing?.maxLateness || 15,
          autoSaveInterval: (session as any).timing?.autoSaveInterval || 30,
          guaranteedTime: (session as any).timing?.guaranteedTime || false
        }
      });
    }
  }, [session, reset]);

  useEffect(() => {
    if (watchExamId) {
      const exam = exams.find(e => e._id === watchExamId);
      setSelectedExam(exam || null);
    } else {
      setSelectedExam(null);
    }
  }, [watchExamId, exams]);

  // Time-only handlers (date is set by calendar)
  const handleStartTime = (val: string) => {
    setStartTime(val);
    setValue('scheduling.startDate', startDate && val ? `${startDate}T${val}` : '', { shouldValidate: true });
  };
  const handleEndTime = (val: string) => {
    setEndTime(val);
    setValue('scheduling.endDate', endDate && val ? `${endDate}T${val}` : '', { shouldValidate: true });
  };

  // Calendar: click a day to pick date(s)
  const handleDayClick = (day: number) => {
    const dateStr = dateToStr(new Date(year, month, day));

    if (!multiDay) {
      // Single-day mode: both start and end = clicked day
      setStartDate(dateStr);
      setEndDate(dateStr);
      setValue('scheduling.startDate', startTime ? `${dateStr}T${startTime}` : '', { shouldValidate: true });
      setValue('scheduling.endDate', endTime ? `${dateStr}T${endTime}` : '', { shouldValidate: true });
    } else if (calendarMode === 'start') {
      setStartDate(dateStr);
      setValue('scheduling.startDate', startTime ? `${dateStr}T${startTime}` : '', { shouldValidate: true });
      // If existing end is before new start, push end forward
      if (endDate && endDate < dateStr) {
        setEndDate(dateStr);
        setValue('scheduling.endDate', endTime ? `${dateStr}T${endTime}` : '', { shouldValidate: true });
      }
      setCalendarMode('end');
    } else {
      // Picking end date
      if (dateStr >= startDate) {
        setEndDate(dateStr);
        setValue('scheduling.endDate', endTime ? `${dateStr}T${endTime}` : '', { shouldValidate: true });
      } else {
        // Clicked before start → swap
        const oldStart = startDate;
        setStartDate(dateStr);
        setEndDate(oldStart);
        setValue('scheduling.startDate', startTime ? `${dateStr}T${startTime}` : '', { shouldValidate: true });
        setValue('scheduling.endDate', endTime ? `${oldStart}T${endTime}` : '', { shouldValidate: true });
      }
      setCalendarMode('start');
    }
  };

  // Calendar dimensions
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const todayStr = dateToStr(new Date());

  const getDayState = (day: number): 'start' | 'end' | 'range' | 'today' | 'past' | 'normal' => {
    const dStr = dateToStr(new Date(year, month, day));
    if (startDate && dStr === startDate) return 'start';
    if (multiDay && endDate && endDate !== startDate && dStr === endDate) return 'end';
    if (multiDay && startDate && endDate && dStr > startDate && dStr < endDate) return 'range';
    if (dStr === todayStr) return 'today';
    if (dStr < todayStr) return 'past';
    return 'normal';
  };

  const isSingleDay = !multiDay || startDate === endDate;

  // Validation
  const validateDateRange = () => {
    const sd = watch("scheduling.startDate");
    const ed = watch("scheduling.endDate");
    if (sd && ed) return new Date(sd) < new Date(ed);
    return true;
  };

  const getSessionDurationMinutes = (): number | null => {
    const sd = watch("scheduling.startDate");
    const ed = watch("scheduling.endDate");
    if (!sd || !ed) return null;
    const diff = (new Date(ed).getTime() - new Date(sd).getTime()) / 60000;
    return diff > 0 ? diff : null;
  };

  const isDurationValid = () => {
    if (!selectedExam) return true;
    const mins = getSessionDurationMinutes();
    if (mins === null) return true;
    return mins >= selectedExam.structure.totalDuration;
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const onSubmit = async (data: SessionFormData) => {
    setLoading(true);
    try {
      const parseLocalDateTime = (dt: string) => new Date(dt).toISOString();
      const payload: Partial<ExamSession> = {
        sessionName: data.sessionName,
        examId: String(data.examId),
        scheduling: {
          startDate: parseLocalDateTime(data.scheduling.startDate),
          endDate: parseLocalDateTime(data.scheduling.endDate),
          duration: typeof data.scheduling.duration === 'number' ? data.scheduling.duration : 0,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timeSlots: data.scheduling.timeSlots ?? []
        },
        participants: {
          maxCandidates: data.participants.maxCandidates,
          // Preserve existing candidates/proctors on edit — never overwrite with empty arrays
          ...(isEditing ? {} : { candidates: [], proctors: [] }),
        },
        settings: {
          requireProctor: data.settings.requireProctor,
          recordSession: data.settings.enableRecording,
          allowLateEntry: data.settings.allowLateEntry,
          lateEntryMinutes: data.settings.lateEntryMinutes,
          autoStart: data.settings.autoStart,
          browserLockdown: data.settings.enableLockdown
        },
        sessionType: data.sessionType,
        timing: data.sessionType === 'individual_flexible' ? {
          sessionWindow: {
            start: parseLocalDateTime(data.scheduling.startDate),
            end: parseLocalDateTime(data.scheduling.endDate)
          },
          examDuration: data.timing?.examDuration || 60,
          lateJoinPolicy: data.timing?.lateJoinPolicy || 'remaining',
          maxLateness: data.timing?.maxLateness || 15,
          autoSaveInterval: data.timing?.autoSaveInterval || 30,
          guaranteedTime: data.timing?.guaranteedTime || false
        } : undefined
      };
      if (isEditing && session) {
        await updateSession(session._id!, payload);
      } else {
        await createSession(payload);
      }
      onSaved();
    } catch (err) {
      console.error("Error saving session:", err);
    } finally {
      setLoading(false);
    }
  };

  const baseInput = "bg-muted/50 border-border text-foreground placeholder:text-muted-foreground border-[0.5px] focus:border-primary focus:ring-0 rounded-lg";

  const settingsItems = [
    {
      name: "settings.autoStart" as const,
      label: "Inicio Automático",
      desc: "La sesión inicia sola a la hora programada",
      icon: <Play className="h-4 w-4 text-green-500" />,
    },
    {
      name: "settings.requireProctor" as const,
      label: "Requiere Proctor",
      desc: "Un supervisor debe estar presente",
      icon: <Users className="h-4 w-4 text-blue-500" />,
    },
    {
      name: "settings.enableRecording" as const,
      label: "Grabación de Sesión",
      desc: "Graba video durante el examen",
      icon: <Video className="h-4 w-4 text-red-500" />,
    },
    {
      name: "settings.enableLockdown" as const,
      label: "Bloqueo de Navegador",
      desc: "No disponible en navegadores web",
      icon: <Lock className="h-4 w-4 text-muted-foreground/40" />,
      disabled: true,
    },
  ];

  const durationMins = getSessionDurationMinutes();
  const hasSelection = !!startDate;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Two-column layout: Calendar LEFT · Fields RIGHT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

        {/* ─── LEFT: Date picker + time range ─── */}
        <div className="space-y-4">

          {/* Inline Calendar */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">

            {/* Calendar header */}
            <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Fecha de la Sesión</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewDate(new Date(year, month - 1, 1))}
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-medium text-foreground px-1 min-w-[120px] text-center">
                    {MONTHS[month]} {year}
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewDate(new Date(year, month + 1, 1))}
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Multi-day toggle + hint */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {multiDay
                    ? calendarMode === 'start'
                      ? '① Elige fecha de inicio'
                      : '② Elige fecha de fin'
                    : 'Clic para seleccionar el día'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Multi-día</span>
                  <Switch
                    checked={multiDay}
                    onCheckedChange={(v) => {
                      setMultiDay(v);
                      setCalendarMode('start');
                      if (!v && endDate !== startDate) {
                        setEndDate(startDate);
                        setValue('scheduling.endDate', endTime ? `${startDate}T${endTime}` : '', { shouldValidate: true });
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="p-3">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: startOffset }).map((_, i) => <div key={`off-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dStr = dateToStr(new Date(year, month, day));
                  const isPast = dStr < todayStr;
                  const state = getDayState(day);

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => !isPast && handleDayClick(day)}
                      className={[
                        'flex items-center justify-center rounded-lg text-xs transition-all h-8 w-full',
                        state === 'start' && isSingleDay
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                          : '',
                        state === 'start' && !isSingleDay
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                          : '',
                        state === 'end'
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                          : '',
                        state === 'range'
                          ? 'bg-primary/15 text-primary'
                          : '',
                        state === 'today'
                          ? 'ring-1 ring-inset ring-primary text-primary font-bold'
                          : '',
                        state === 'normal'
                          ? 'text-foreground hover:bg-muted cursor-pointer'
                          : '',
                        state === 'past'
                          ? 'opacity-30 text-muted-foreground cursor-not-allowed'
                          : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Selected date label */}
              {hasSelection && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium text-foreground">
                      {startDate === endDate || !endDate
                        ? new Date(`${startDate}T12:00`).toLocaleDateString('es-BO', {
                            weekday: 'long', day: 'numeric', month: 'long'
                          })
                        : `${new Date(`${startDate}T12:00`).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })} → ${new Date(`${endDate}T12:00`).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      }
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Time range picker */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Horario</span>
            </div>

            {/* Hidden RHF fields */}
            <input type="hidden" {...register("scheduling.startDate")} />
            <input type="hidden" {...register("scheduling.endDate")} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Inicio</label>
                <TimePicker
                  value={startTime}
                  onChange={handleStartTime}
                  placeholder="Hora inicio"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fin</label>
                <TimePicker
                  value={endTime}
                  onChange={handleEndTime}
                  placeholder="Hora fin"
                />
              </div>
            </div>

            {errors.scheduling?.startDate && (
              <p className="text-xs text-red-400">{errors.scheduling.startDate.message}</p>
            )}
            {errors.scheduling?.endDate && (
              <p className="text-xs text-red-400">{errors.scheduling.endDate.message}</p>
            )}
            {!validateDateRange() && (
              <p className="text-xs text-red-400">La hora de fin debe ser posterior al inicio</p>
            )}

            {/* Duration chip */}
            {durationMins !== null && durationMins > 0 && (
              <div className={[
                'flex items-center gap-2 text-xs px-3 py-2 rounded-lg border',
                isDurationValid()
                  ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800/30 dark:text-green-400'
                  : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400',
              ].join(' ')}>
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Duración: <strong>{formatDuration(durationMins)}</strong></span>
                {selectedExam && !isDurationValid() && (
                  <span className="ml-auto flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Mín. {formatDuration(selectedExam.structure.totalDuration)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Form fields ─── */}
        <div className="space-y-4">

          {/* Basic info */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Información Básica
            </h4>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nombre de la Sesión *</label>
              <Input
                type="text"
                placeholder="Ej: Evaluación Nivel B1 — Marzo 2026"
                {...register("sessionName")}
                className={baseInput}
              />
              {errors.sessionName && <p className="mt-1 text-xs text-red-400">{errors.sessionName.message}</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Examen *</label>
              <Controller
                name="examId"
                control={control}
                render={({ field }) => (
                  <select {...field} className={`w-full px-3 py-2 text-sm ${baseInput}`}>
                    <option value="">Seleccionar examen...</option>
                    {exams.map(exam => (
                      <option key={exam._id} value={exam._id}>
                        {exam.name} ({exam.type} - {exam.targetLevel})
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.examId && <p className="mt-1 text-xs text-red-400">{errors.examId.message}</p>}
            </div>

            {selectedExam && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Tipo', value: selectedExam.type },
                  { label: 'Nivel', value: selectedExam.targetLevel },
                  { label: 'Duración', value: `${selectedExam.structure.totalDuration} min` },
                  // { label: 'Preguntas', value: String(selectedExam.structure.totalQuestions) }, // TODO: oculto hasta fix
                ].map(item => (
                  <div key={item.label} className="bg-muted/40 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
                      {item.label}
                    </p>
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session type + participants */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Participantes
            </h4>

            {/* TODO: oculto hasta implementar sesión flexible completa
            <Controller
              name="sessionType"
              control={control}
              render={({ field }) => (
                <div className="bg-muted/30 border border-border rounded-lg p-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {field.value === 'group_synchronized' ? 'Grupal Sincronizada' : 'Individual Flexible'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {field.value === 'group_synchronized'
                        ? 'Todos inician y terminan al mismo tiempo'
                        : 'Horarios flexibles dentro de la ventana programada'}
                    </p>
                  </div>
                  <Switch
                    checked={field.value === 'individual_flexible'}
                    onCheckedChange={checked =>
                      field.onChange(checked ? 'individual_flexible' : 'group_synchronized')
                    }
                  />
                </div>
              )}
            />
            */}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Máximo de Candidatos *
              </label>
              <Input
                type="number" min={1} max={200}
                {...register("participants.maxCandidates", { valueAsNumber: true })}
                className={baseInput}
              />
              {errors.participants?.maxCandidates && (
                <p className="mt-1 text-xs text-red-400">{errors.participants.maxCandidates.message}</p>
              )}
            </div>
          </div>

          {/* Settings toggles */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Configuración
            </h4>

            <div className="space-y-2">
              {settingsItems.map(item => (
                <Controller
                  key={item.name}
                  name={item.name}
                  control={control}
                  render={({ field }) => (
                    <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/30 border border-border ${'disabled' in item && item.disabled ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                      <Switch
                        checked={field.value as boolean}
                        disabled={'disabled' in item && item.disabled}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
              ))}

              {/* Late entry with inline minutes */}
              <Controller
                name="settings.allowLateEntry"
                control={control}
                render={({ field }) => (
                  <div className="rounded-lg bg-muted/30 border border-border overflow-hidden">
                    <div className="flex items-center justify-between py-2.5 px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Clock className="h-4 w-4 text-orange-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Entrada Tardía</p>
                          <p className="text-xs text-muted-foreground">Permite entrar después de iniciada la sesión</p>
                        </div>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                    {watchAllowLateEntry && (
                      <div className="px-3 pb-3 pt-1 border-t border-border">
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Minutos de tolerancia</label>
                        <Input
                          type="number" min={0} max={60}
                          {...register("settings.lateEntryMinutes", { valueAsNumber: true })}
                          className={baseInput}
                        />
                      </div>
                    )}
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Flexible session advanced config ── */}
      {isFlexibleSession && (
        <Collapsible defaultOpen={false}>
          <div className="space-y-3">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/30 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                  Configuración Avanzada — Sesión Flexible
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-purple-500 transition-transform" />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="bg-purple-50 border border-purple-200 dark:bg-purple-900/10 dark:border-purple-800/20 rounded-xl p-5 space-y-5">
                <div>
                  <label className="text-xs font-medium text-purple-700 dark:text-purple-200 mb-1.5 block">
                    Duración del Examen (minutos)
                  </label>
                  <Input
                    type="number" min={1} max={480} placeholder="60"
                    {...register("timing.examDuration", { valueAsNumber: true })}
                    className={baseInput}
                  />
                  <p className="mt-1 text-xs text-purple-500 dark:text-purple-400">
                    Tiempo máximo que cada estudiante tendrá para completar el examen
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-purple-700 dark:text-purple-200 mb-1.5 block">
                    Política de Entrada Tardía
                  </label>
                  <Controller
                    name="timing.lateJoinPolicy"
                    control={control}
                    render={({ field }) => (
                      <select {...field} className={`w-full px-3 py-2 text-sm ${baseInput}`}>
                        <option value="remaining">Tiempo Restante — Solo el tiempo que queda</option>
                        <option value="guaranteed">Tiempo Garantizado — Tiempo completo siempre</option>
                        <option value="sliding">Ventana Deslizante — Se ajusta dinámicamente</option>
                      </select>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-purple-700 dark:text-purple-200 mb-1.5 block">
                      Máximo Retraso (min)
                    </label>
                    <Input
                      type="number" min={0} max={120} placeholder="15"
                      {...register("timing.maxLateness", { valueAsNumber: true })}
                      className={baseInput}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-purple-700 dark:text-purple-200 mb-1.5 block flex items-center gap-1">
                      <Database className="h-3.5 w-3.5" />
                      Auto-guardado (seg)
                    </label>
                    <Input
                      type="number" min={10} max={300} placeholder="30"
                      {...register("timing.autoSaveInterval", { valueAsNumber: true })}
                      className={baseInput}
                    />
                  </div>
                </div>

                <Controller
                  name="timing.guaranteedTime"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between p-3 bg-purple-100/50 dark:bg-purple-800/20 rounded-lg border border-purple-200 dark:border-purple-700/30">
                      <div>
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-200">
                          Garantizar Tiempo Completo
                        </p>
                        <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">
                          Todos los estudiantes tendrán el tiempo completo del examen
                        </p>
                      </div>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* ── Action buttons ── */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-border text-foreground/80 bg-transparent"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading || !validateDateRange() || !isDurationValid()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {loading
            ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            : <Save className="h-4 w-4 mr-2" />
          }
          {isEditing ? "Actualizar" : "Crear"} Sesión
        </Button>
      </div>
    </form>
  );
};

export default SessionForm;
