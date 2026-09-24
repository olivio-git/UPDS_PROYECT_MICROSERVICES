import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  Lock,
  Play,
  Save,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/keel/badge";
import { Button } from "@/components/keel/button";
import { Card, CardContent } from "@/components/keel/card";
import { Field, FieldDescription, FieldLabel } from "@/components/keel/field";
import { Input } from "@/components/keel/input";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/keel/item";
import { NativeSelect, NativeSelectOption } from "@/components/keel/native-select";
import { Steps, type StepItem } from "@/components/keel/steps";
import { Switch } from "@/components/keel/switch";
import { useExams } from "../hooks/useExams";
import { useSessions } from "../hooks/useSessions";
import type { Exam, ExamSession, ExamSessionPayload } from "../types";

// Sesiones flexibles (`individual_flexible`) existen en el backend/modelo pero
// no tienen un control en esta UI — el toggle que las activaba ya estaba
// deshabilitado en la versión anterior de este formulario ("TODO: oculto
// hasta implementar sesión flexible completa"). En vez de arrastrar el panel
// avanzado inalcanzable, este rediseño lo elimina y fija el tipo de sesión.
const FIXED_SESSION_TYPE = "group_synchronized" as const;

const sessionSchema = z.object({
  sessionName: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  examId: z.string().min(1, "Debe seleccionar un examen"),
  scheduling: z.object({
    startDate: z.string().min(1, "La fecha y hora de inicio son requeridas"),
    endDate: z.string().min(1, "La fecha y hora de fin son requeridas"),
  }),
  participants: z.object({
    maxCandidates: z
      .number()
      .min(1, "Debe permitir al menos 1 candidato")
      .max(200, "Máximo 200 candidatos"),
  }),
  settings: z.object({
    requireProctor: z.boolean(),
    enableLockdown: z.boolean(),
    allowLateEntry: z.boolean(),
    autoStart: z.boolean(),
    lateEntryMinutes: z.number().min(0).max(60),
  }),
});

type SessionFormData = z.infer<typeof sessionSchema>;

interface Props {
  session?: ExamSession | null;
  onCancel: () => void;
  /** Recibe la sesión creada/actualizada — el llamador decide a dónde ir después
   *  (SessionsList abre la gestión de candidatos/proctor sólo al crear). */
  onSaved: (session?: ExamSession) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

const STEPS: StepItem[] = [
  { id: "exam", label: "Examen", description: "Qué se rinde" },
  { id: "when", label: "Cuándo", description: "Fecha y horario" },
  { id: "how", label: "Cómo", description: "Reglas de la sesión" },
];

const SessionForm: React.FC<Props> = ({ session, onCancel, onSaved }) => {
  const { createSession, updateSession } = useSessions();
  const { exams, loadExams } = useExams();
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [step, setStep] = useState(0);

  const isEditing = !!session;

  // Fecha/hora en campos compactos (2 fechas x 2 horas) en vez del calendario
  // de mes completo + drum-picker que tenía este formulario antes. `endDate`
  // sigue a `startDate` automáticamente hasta que el usuario la toca —
  // cubre el caso común (sesión de un día) sin perder soporte para sesiones
  // que cruzan medianoche, que sí existen en datos ya guardados.
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [endDateTouched, setEndDateTouched] = useState(false);

  const { register, handleSubmit, control, watch, setValue, trigger, formState: { errors }, reset } =
    useForm<SessionFormData>({
      resolver: zodResolver(sessionSchema),
      defaultValues: {
        sessionName: "",
        examId: "",
        scheduling: { startDate: "", endDate: "" },
        participants: { maxCandidates: 30 },
        settings: {
          requireProctor: true,
          enableLockdown: false,
          allowLateEntry: false,
          autoStart: true,
          lateEntryMinutes: 0,
        },
      },
    });

  const watchExamId = watch("examId");
  const watchAllowLateEntry = watch("settings.allowLateEntry");

  useEffect(() => { loadExams(); }, [loadExams]);

  const toLocalParts = (isoString: string): [string, string] => {
    const d = new Date(isoString);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return [date, time];
  };

  useEffect(() => {
    if (!session) return;
    const [sDate, sTime] = toLocalParts(session.scheduling.startDate);
    const [eDate, eTime] = toLocalParts(session.scheduling.endDate);
    setStartDate(sDate); setStartTime(sTime);
    setEndDate(eDate); setEndTime(eTime);
    setEndDateTouched(eDate !== sDate);

    reset({
      sessionName: session.sessionName,
      examId: session.examId,
      scheduling: {
        startDate: `${sDate}T${sTime}`,
        endDate: `${eDate}T${eTime}`,
      },
      participants: { maxCandidates: session.participants.maxCandidates },
      settings: {
        requireProctor: session.settings.requireProctor,
        enableLockdown: session.settings.browserLockdown,
        allowLateEntry: session.settings.allowLateEntry,
        autoStart: session.settings.autoStart ?? true,
        lateEntryMinutes: session.settings.lateEntryMinutes ?? 0,
      },
    });
  }, [session, reset]);

  useEffect(() => {
    if (watchExamId) {
      setSelectedExam(exams.find(e => e._id === watchExamId) || null);
    } else {
      setSelectedExam(null);
    }
  }, [watchExamId, exams]);

  const syncScheduling = (sd: string, st: string, ed: string, et: string) => {
    setValue("scheduling.startDate", sd && st ? `${sd}T${st}` : "", { shouldValidate: true });
    setValue("scheduling.endDate", ed && et ? `${ed}T${et}` : "", { shouldValidate: true });
  };

  const handleStartDate = (v: string) => {
    setStartDate(v);
    const nextEndDate = endDateTouched ? endDate : v;
    if (!endDateTouched) setEndDate(v);
    syncScheduling(v, startTime, nextEndDate, endTime);
  };
  const handleStartTime = (v: string) => {
    setStartTime(v);
    syncScheduling(startDate, v, endDate, endTime);
  };
  const handleEndDate = (v: string) => {
    setEndDate(v);
    setEndDateTouched(true);
    syncScheduling(startDate, startTime, v, endTime);
  };
  const handleEndTime = (v: string) => {
    setEndTime(v);
    syncScheduling(startDate, startTime, endDate, v);
  };

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

  const formatDateChip = (d: string) => {
    if (!d) return "";
    return new Date(`${d}T12:00`).toLocaleDateString("es-BO", { day: "numeric", month: "short" });
  };

  const stepValid: [boolean, boolean, boolean] = [
    watch("sessionName").trim().length >= 3 && !!watch("examId"),
    !!startDate && !!startTime && !!endDate && !!endTime && validateDateRange() && isDurationValid(),
    watch("participants.maxCandidates") >= 1,
  ];

  const goNext = async () => {
    const fieldsByStep: (keyof SessionFormData | `${string}.${string}`)[][] = [
      ["sessionName", "examId"],
      ["scheduling.startDate", "scheduling.endDate"],
      ["participants.maxCandidates"],
    ];
    const ok = await trigger(fieldsByStep[step] as any);
    if (ok && stepValid[step]) setStep(s => Math.min(s + 1, STEPS.length - 1));
  };
  const goPrev = () => setStep(s => Math.max(s - 1, 0));

  const onSubmit = async (data: SessionFormData) => {
    setLoading(true);
    try {
      const parseLocalDateTime = (dt: string) => new Date(dt).toISOString();
      const payload: ExamSessionPayload = {
        sessionName: data.sessionName,
        examId: String(data.examId),
        scheduling: {
          startDate: parseLocalDateTime(data.scheduling.startDate),
          endDate: parseLocalDateTime(data.scheduling.endDate),
          duration: 0,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timeSlots: [],
        },
        participants: {
          maxCandidates: data.participants.maxCandidates,
          // Preserva candidatos/proctores existentes al editar — nunca los pisa con []
          ...(isEditing ? {} : { candidates: [] as string[], proctors: [] as string[] }),
        },
        settings: {
          requireProctor: data.settings.requireProctor,
          // La grabación de sesión no existe en este codebase (sin WebRTC en
          // ninguna rama) — el campo se mantiene en el payload porque el
          // modelo del backend lo requiere, pero ya no hay control en la UI
          // para activarlo.
          recordSession: false,
          allowLateEntry: data.settings.allowLateEntry,
          lateEntryMinutes: data.settings.lateEntryMinutes,
          autoStart: data.settings.autoStart,
          browserLockdown: data.settings.enableLockdown,
        },
        sessionType: FIXED_SESSION_TYPE,
      };
      const saved = isEditing && session
        ? await updateSession(session._id!, payload)
        : await createSession(payload);
      onSaved(saved ?? undefined);
    } catch (err) {
      console.error("Error saving session:", err);
    } finally {
      setLoading(false);
    }
  };

  const durationMins = getSessionDurationMinutes();

  const settingsItems = [
    {
      name: "settings.autoStart" as const,
      label: "Inicio automático",
      desc: "La sesión inicia sola a la hora programada",
      icon: <Play className="h-4 w-4 text-green-500" />,
    },
    {
      name: "settings.requireProctor" as const,
      label: "Requiere proctor",
      desc: "Un supervisor debe estar presente",
      icon: <Users className="h-4 w-4 text-blue-500" />,
    },
    {
      // El bloqueo SÍ está implementado: useBrowserLockdown pide pantalla
      // completa, detecta salidas de foco/pestaña y reporta infracciones
      // (exam-service recordInfraction; suite lockdown-infractions.e2e.js).
      // El toggle estaba deshabilitado con el texto "No disponible en
      // navegadores web", así que el docente no podía activar algo que el
      // backend ya respeta — solo se lograba sembrando la sesión por API.
      name: "settings.enableLockdown" as const,
      label: "Bloqueo de navegador",
      desc: "Pantalla completa obligatoria; salir de la pestaña queda registrado",
      icon: <Lock className="h-4 w-4 text-amber-500" />,
    },
  ];

  // Resumen para el footer sticky. El paso "Quién" (candidatos/proctor) pasó
  // a ser una pantalla aparte inmediatamente después de crear — ver
  // SessionsList.tsx — porque asignar candidatos reales requiere el _id de
  // la sesión que el backend recién generó; no existe antes de crear.
  const summaryParts = [
    selectedExam?.targetLevel && `Nivel ${selectedExam.targetLevel}`,
    startDate && startTime && `${formatDateChip(startDate)} ${startTime}${endTime ? `–${endTime}` : ""}`,
    durationMins && durationMins > 0 && formatDuration(durationMins),
    `máx. ${watch("participants.maxCandidates") || 0} candidatos`,
  ].filter(Boolean);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* ── Cabecera discreta: volver + título pequeño (la barra lateral ya dice "Sesiones") ── */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Volver
        </button>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isEditing ? "Editar Sesión" : "Nueva Sesión"}
        </h2>
      </div>

      <Steps steps={STEPS} current={step} onStepClick={(i) => i <= step && setStep(i)} />

      {/* ── Paso 1: Examen ── */}
      {step === 0 && (
        <Card flat>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="sessionName">Nombre de la sesión *</FieldLabel>
              <Input
                id="sessionName"
                type="text"
                placeholder="Ej: Evaluación Nivel B1 — Marzo 2026"
                {...register("sessionName")}
              />
              {errors.sessionName && (
                <p className="text-xs text-destructive">{errors.sessionName.message}</p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="examId">Examen *</FieldLabel>
              <Controller
                name="examId"
                control={control}
                render={({ field }) => (
                  <NativeSelect id="examId" {...field}>
                    <NativeSelectOption value="">Seleccionar examen...</NativeSelectOption>
                    {exams.map(exam => (
                      <NativeSelectOption key={exam._id} value={exam._id}>
                        {exam.name} ({exam.type} - {exam.targetLevel})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              />
              {errors.examId && <p className="text-xs text-destructive">{errors.examId.message}</p>}
            </Field>

            {selectedExam && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Tipo", value: selectedExam.type },
                  { label: "Nivel", value: selectedExam.targetLevel },
                  { label: "Duración", value: `${selectedExam.structure.totalDuration} min` },
                  {
                    label: "Preguntas",
                    // Exams created outside ExamForm.tsx (seed scripts, older
                    // data) can leave structure.totalQuestions unset — show a
                    // dash instead of the literal string "undefined".
                    value: selectedExam.structure.totalQuestions != null
                      ? String(selectedExam.structure.totalQuestions)
                      : "—",
                  },
                ].map(item => (
                  <div key={item.label} className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="mb-0.5 text-[10px] leading-none tracking-wide text-muted-foreground uppercase">
                      {item.label}
                    </p>
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Paso 2: Cuándo ── */}
      {step === 1 && (
        <Card flat>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="startDate">Inicio</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={e => handleStartDate(e.target.value)}
                  />
                  <Input
                    aria-label="Hora inicio"
                    type="time"
                    value={startTime}
                    onChange={e => handleStartTime(e.target.value)}
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">Fin</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={e => handleEndDate(e.target.value)}
                  />
                  <Input
                    aria-label="Hora fin"
                    type="time"
                    value={endTime}
                    onChange={e => handleEndTime(e.target.value)}
                  />
                </div>
              </Field>
            </div>

            <input type="hidden" {...register("scheduling.startDate")} />
            <input type="hidden" {...register("scheduling.endDate")} />

            {!validateDateRange() && (
              <p className="text-xs text-destructive">La fecha/hora de fin debe ser posterior al inicio</p>
            )}

            {durationMins !== null && durationMins > 0 && (
              <div
                className={[
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                  isDurationValid()
                    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800/30 dark:bg-green-900/20 dark:text-green-400"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-400",
                ].join(" ")}
              >
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
          </CardContent>
        </Card>
      )}

      {/* ── Paso 3: Cómo ── */}
      {step === 2 && (
        <Card flat>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="maxCandidates" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Máximo de candidatos *
              </FieldLabel>
              <Input
                id="maxCandidates"
                type="number"
                min={1}
                max={200}
                className="max-w-40"
                {...register("participants.maxCandidates", { valueAsNumber: true })}
              />
              {errors.participants?.maxCandidates && (
                <p className="text-xs text-destructive">{errors.participants.maxCandidates.message}</p>
              )}
              <FieldDescription>Los candidatos se asignan en el siguiente paso, después de crear la sesión.</FieldDescription>
            </Field>

            <div className="flex flex-col gap-2">
              {settingsItems.map(item => (
                <Controller
                  key={item.name}
                  name={item.name}
                  control={control}
                  render={({ field }) => (
                    <Item variant="muted">
                      <ItemMedia variant="icon">{item.icon}</ItemMedia>
                      <ItemContent>
                        <ItemTitle>{item.label}</ItemTitle>
                        <ItemDescription>{item.desc}</ItemDescription>
                      </ItemContent>
                      <Switch
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                      />
                    </Item>
                  )}
                />
              ))}

              <Controller
                name="settings.allowLateEntry"
                control={control}
                render={({ field }) => (
                  <div className="overflow-hidden rounded-lg border border-transparent bg-muted/50">
                    <Item variant="muted">
                      <ItemMedia variant="icon"><Clock className="h-4 w-4 text-orange-500" /></ItemMedia>
                      <ItemContent>
                        <ItemTitle>Entrada tardía</ItemTitle>
                        <ItemDescription>Permite entrar después de iniciada la sesión</ItemDescription>
                      </ItemContent>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </Item>
                    {watchAllowLateEntry && (
                      <div className="border-t border-border px-3 pt-2 pb-3">
                        <FieldLabel htmlFor="lateEntryMinutes" className="mb-1.5">Minutos de tolerancia</FieldLabel>
                        <Input
                          id="lateEntryMinutes"
                          type="number"
                          min={0}
                          max={60}
                          className="max-w-32"
                          {...register("settings.lateEntryMinutes", { valueAsNumber: true })}
                        />
                      </div>
                    )}
                  </div>
                )}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Footer sticky: resumen + navegación ── */}
      <div className="sticky bottom-0 -mx-4 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {summaryParts.length > 0 ? (
            summaryParts.map((part, i) => (
              <Badge key={i} variant="outline" className="text-muted-foreground">{part}</Badge>
            ))
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
              Completa los datos para ver el resumen
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button key="next" type="button" onClick={goNext} disabled={!stepValid[step]}>
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            // type="button" a propósito. Un <button> dentro de un <form>
            // sin atributo type vale type="submit" por defecto (HTML
            // estándar), y el Button de keel no fija ninguno: por eso el
            // "Siguiente" del paso anterior enviaba el formulario en el
            // mismo clic con que avanzaba de paso. Se envía de forma
            // explícita con handleSubmit para que solo este botón cree la
            // sesión.
            <Button key="submit" type="button" onClick={handleSubmit(onSubmit)} disabled={loading || !stepValid[2]}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isEditing ? "Actualizar" : "Crear"} Sesión
            </Button>
          )}
        </div>
      </div>
    </form>
  );
};

export default SessionForm;
