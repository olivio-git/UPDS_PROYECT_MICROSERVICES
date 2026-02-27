import { Button } from "@/components/atoms/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/atoms/collapsible";
import { Input } from "@/components/atoms/input";
import { Switch } from "@/components/atoms/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Calendar, ChevronDown, Clock, Database, Save, Settings, Users, Zap } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useExams } from "../hooks/useExams";
import { useSessions } from "../hooks/useSessions";
import type { Exam, ExamSession } from "../types";

const sessionSchema = z.object({
  sessionName: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  examId: z.string().min(1, "Debe seleccionar un examen"),
  // NUEVO: Tipo de sesión
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
  // NUEVO: Configuración avanzada para sesiones flexibles
  timing: z.object({
    sessionWindow: z.object({
      start: z.string().min(1, "La fecha/hora de inicio es requerida"),
      end: z.string().min(1, "La fecha/hora de fin es requerida")
    }).optional(),
    examDuration: z.number().min(1, "Duración mínima 1 minuto").max(480, "Duración máxima 8 horas").optional(),
    lateJoinPolicy: z.enum(['guaranteed', 'remaining', 'sliding']).optional(),
    maxLateness: z.number().min(0, "No puede ser negativo").max(120, "Máximo 2 horas").optional(),
    autoSaveInterval: z.number().min(10, "Mínimo 10 segundos").max(300, "Máximo 5 minutos").optional(),
    guaranteedTime: z.boolean().optional()
  }).optional()
});

type SessionFormData = z.infer<typeof sessionSchema>;

interface Props {
  session?: ExamSession | null;
  onCancel: () => void;
  onSaved: () => void;
}

const SessionForm: React.FC<Props> = ({ session, onCancel, onSaved }) => {
  const { createSession, updateSession } = useSessions();
  const { exams, loadExams } = useExams();
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const isEditing = !!session;

  // Local state for split date/time inputs (datetime-local is unreliable on Firefox/Linux)
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
    reset
  } = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      sessionName: "",
      examId: "",
      scheduling: {
        startDate: "",
        endDate: "",
        timeSlots: []
      },
      participants: {
        maxCandidates: 30
      },
      settings: {
        requireProctor: true,
        enableRecording: false,
        enableLockdown: false,
        allowLateEntry: false,
        autoStart: true,
        lateEntryMinutes: 0
      },
      // NUEVO: Valores por defecto
      sessionType: 'group_synchronized',
      timing: {
        examDuration: 60,
        lateJoinPolicy: 'remaining',
        maxLateness: 15,
        autoSaveInterval: 30,
        guaranteedTime: false
      }
    }
  });

  const watchExamId = watch("examId");
  const watchAllowLateEntry = watch("settings.allowLateEntry");
  // NUEVO: Watch para tipo de sesión
  const watchSessionType = watch("sessionType");
  const isFlexibleSession = watchSessionType === 'individual_flexible';

  useEffect(() => { loadExams(); }, [loadExams]);

  useEffect(() => {
    if (session) {
      const startIso = new Date(session.scheduling.startDate).toISOString().slice(0, 16);
      const endIso   = new Date(session.scheduling.endDate).toISOString().slice(0, 16);
      const [sDate, sTime] = startIso.split('T');
      const [eDate, eTime] = endIso.split('T');
      setStartDate(sDate); setStartTime(sTime);
      setEndDate(eDate);   setEndTime(eTime);

      reset({
        sessionName: session.sessionName,
        examId: session?.examId,
        scheduling: {
          startDate: startIso,
          endDate: endIso,
          timeSlots: session.scheduling.timeSlots || []
        },
        participants: {
          maxCandidates: session.participants.maxCandidates
        },
        settings: {
          requireProctor: session.settings.requireProctor,
          enableRecording: session.settings.recordSession,
            enableLockdown: session.settings.browserLockdown,
          allowLateEntry: session.settings.allowLateEntry,
          autoStart: session.settings.autoStart ?? true,
          lateEntryMinutes: session.settings.lateEntryMinutes
        },
        // NUEVO: Cargar datos de sesión dual
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

  // Combine separate date + time parts into a datetime-local string for RHF
  const handleStartDate = (val: string) => {
    setStartDate(val);
    const combined = val && startTime ? `${val}T${startTime}` : '';
    setValue('scheduling.startDate', combined, { shouldValidate: true });
  };
  const handleStartTime = (val: string) => {
    setStartTime(val);
    const combined = startDate && val ? `${startDate}T${val}` : '';
    setValue('scheduling.startDate', combined, { shouldValidate: true });
  };
  const handleEndDate = (val: string) => {
    setEndDate(val);
    const combined = val && endTime ? `${val}T${endTime}` : '';
    setValue('scheduling.endDate', combined, { shouldValidate: true });
  };
  const handleEndTime = (val: string) => {
    setEndTime(val);
    const combined = endDate && val ? `${endDate}T${val}` : '';
    setValue('scheduling.endDate', combined, { shouldValidate: true });
  };

  const validateDateRange = () => {
    const sd = watch("scheduling.startDate");
    const ed = watch("scheduling.endDate");
    if (sd && ed) return new Date(sd) < new Date(ed);
    return true;
  };

  const onSubmit = async (data: SessionFormData) => {
    setLoading(true);
    try { 
      // Función para convertir datetime-local a formato con zona horaria
      const parseLocalDateTime = (dateTimeLocal: string): string => {
        // datetime-local viene como "2025-08-27T16:25"
        // Agregar segundos y milisegundos, luego la zona horaria Bolivia
        return dateTimeLocal + ':00.000-04:00'; // Bolivia es UTC-4
      };

      const payload: Partial<ExamSession> = {
        sessionName: data.sessionName,
        examId: String(data.examId),
        scheduling: {
          startDate: parseLocalDateTime(data.scheduling.startDate),
          endDate: parseLocalDateTime(data.scheduling.endDate),
          duration: typeof data.scheduling.duration === 'number' ? data.scheduling.duration : 0,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Zona horaria real del usuario
          timeSlots: data.scheduling.timeSlots ?? []
        },
        participants: {
          maxCandidates: data.participants.maxCandidates,
          candidates: [],
          proctors: []
        },
        settings: {
          requireProctor: data.settings.requireProctor,
          recordSession: data.settings.enableRecording,
          allowLateEntry: data.settings.allowLateEntry,
          lateEntryMinutes: data.settings.lateEntryMinutes,
          autoStart: data.settings.autoStart,
          browserLockdown: data.settings.enableLockdown
        },
        // NUEVO: Agregar configuración dual
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
  const baseInput = "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 border-[0.5px] focus:border-blue-500 focus:ring-0 rounded-lg";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Información básica */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-200 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-2000" />
          Información Básica
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Nombre de la Sesión *</label>
            <Input
              type="text"
              placeholder="Ej: Evaluación Nivel B1 - Enero 2025"
              {...register("sessionName")}
              className={baseInput}
            />
            {errors.sessionName && <p className="mt-1 text-sm text-red-400">{errors.sessionName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Examen *</label>
            <select
              {...register("examId")}
              className={`w-full px-3 py-2 text-sm ${baseInput}`}
            >
              <option value="">Seleccionar examen...</option>
              {exams.map((exam) => (
                <option key={exam._id} value={exam._id}>
                  {exam.name} ({exam.type} - {exam.targetLevel})
                </option>
              ))}
            </select>
            {errors.examId && <p className="mt-1 text-sm text-red-400">{errors.examId.message}</p>}
          </div>
        </div>

        {selectedExam && (
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-md p-3">
            <h5 className="text-sm font-medium text-blue-300 mb-2">Detalles del Examen</h5>
            <div className="text-sm text-blue-200 space-y-1">
              <p><strong>Tipo:</strong> {selectedExam.type}</p>
              <p><strong>Nivel:</strong> {selectedExam.targetLevel}</p>
              <p><strong>Duración:</strong> {selectedExam.structure.totalDuration} minutos</p>
              <p><strong>Preguntas:</strong> {selectedExam.structure.totalQuestions}</p>
            </div>
          </div>
        )}
      </div>

      {/* NUEVO: Tipo de Sesión */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-200 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-200" />
          Tipo de Sesión
        </h4>
        
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <Controller
            name="sessionType"
            control={control}
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">
                      {field.value === 'group_synchronized' ? 'Grupal Sincronizada' : 'Individual Flexible'}
                    </span>
                    {field.value === 'individual_flexible' && (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {field.value === 'group_synchronized' 
                      ? 'Todos los estudiantes inician y terminan al mismo tiempo'
                      : 'Los estudiantes pueden entrar en horarios flexibles dentro de la ventana programada'
                    }
                  </p>
                </div>
                <Switch
                  checked={field.value === 'individual_flexible'}
                  onCheckedChange={(checked) => 
                    field.onChange(checked ? 'individual_flexible' : 'group_synchronized')
                  }
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-blue-500"
                />
              </div>
            )}
          />
        </div>
      </div>

      {/* Programación */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-200 flex items-center gap-2">
          <Calendar className="w-5 h-5s text-gray-200" />
          Programación
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inicio: date + time separados */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Fecha y Hora de Inicio *</label>
            {/* Hidden field keeps RHF validation working */}
            <input type="hidden" {...register("scheduling.startDate")} />
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={e => handleStartDate(e.target.value)}
                className={`flex-1 px-3 py-2 text-sm ${baseInput}`}
              />
              <input
                type="time"
                value={startTime}
                onChange={e => handleStartTime(e.target.value)}
                className={`w-32 px-3 py-2 text-sm ${baseInput}`}
              />
            </div>
            {errors.scheduling?.startDate && (
              <p className="mt-1 text-sm text-red-400">{errors.scheduling.startDate.message}</p>
            )}
          </div>

          {/* Fin: date + time separados */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Fecha y Hora de Fin *</label>
            <input type="hidden" {...register("scheduling.endDate")} />
            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={e => handleEndDate(e.target.value)}
                className={`flex-1 px-3 py-2 text-sm ${baseInput}`}
              />
              <input
                type="time"
                value={endTime}
                onChange={e => handleEndTime(e.target.value)}
                className={`w-32 px-3 py-2 text-sm ${baseInput}`}
              />
            </div>
            {errors.scheduling?.endDate && (
              <p className="mt-1 text-sm text-red-400">{errors.scheduling.endDate.message}</p>
            )}
            {!validateDateRange() && (
              <p className="mt-1 text-sm text-red-400">La fecha de fin debe ser posterior a la de inicio</p>
            )}
          </div>
        </div>
      </div>

      {/* Participantes */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-200 flex items-center gap-2">
          <Users className="w-5 h-5 text-green-400 text-white" />
          Participantes
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Máximo de Candidatos *</label>
            <Input
              type="number"
              min={1}
              max={200}
              {...register("participants.maxCandidates", { valueAsNumber: true })}
              className={baseInput}
            />
            {errors.participants?.maxCandidates && (
              <p className="mt-1 text-sm text-red-400">{errors.participants.maxCandidates.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* NUEVO: Configuraciones Avanzadas para Sesiones Flexibles */}
      {isFlexibleSession && (
        <Collapsible defaultOpen={false}>
          <div className="space-y-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-purple-900/20 border border-purple-800/30 rounded-lg hover:bg-purple-900/30 transition-colors">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                <h4 className="text-md font-semibold text-purple-300">Configuración Avanzada - Sesión Flexible</h4>
              </div>
              <ChevronDown className="w-4 h-4 text-purple-400 transition-transform" />
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="bg-purple-900/10 border border-purple-800/20 rounded-lg p-6 space-y-6">
                {/* Duración del Examen */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Duración del Examen (minutos)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={480}
                    placeholder="60"
                    {...register("timing.examDuration", { valueAsNumber: true })}
                    className="bg-purple-900/20 border-purple-700/50 text-purple-100 placeholder-purple-400 border-[0.5px] focus:border-purple-400 focus:ring-0 rounded-lg"
                  />
                  <p className="mt-1 text-xs text-purple-400">Tiempo máximo que cada estudiante tendrá para completar el examen</p>
                  {errors.timing?.examDuration && (
                    <p className="mt-1 text-sm text-red-400">{errors.timing.examDuration.message}</p>
                  )}
                </div>

                {/* Política de Late Join */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">Política de Entrada Tardía</label>
                  <Controller
                    name="timing.lateJoinPolicy"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="w-full px-3 py-2 text-sm bg-purple-900/20 border-purple-700/50 text-purple-100 border-[0.5px] focus:border-purple-400 focus:ring-0 rounded-lg"
                      >
                        <option value="remaining">Tiempo Restante - Solo el tiempo que queda de la sesión</option>
                        <option value="guaranteed">Tiempo Garantizado - Tiempo completo sin importar cuándo entre</option>
                        <option value="sliding">Ventana Deslizante - Tiempo completo si hay suficiente ventana</option>
                      </select>
                    )}
                  />
                  <p className="mt-1 text-xs text-purple-400">
                    {watchSessionType === 'individual_flexible' && (
                      <span>
                        {control._defaultValues.timing?.lateJoinPolicy === 'remaining' && 'Los estudiantes solo tendrán el tiempo restante de la sesión global'}
                        {control._defaultValues.timing?.lateJoinPolicy === 'guaranteed' && 'Los estudiantes tendrán el tiempo completo del examen, extiende la sesión si es necesario'}
                        {control._defaultValues.timing?.lateJoinPolicy === 'sliding' && 'Se ajusta dinámicamente según el tiempo disponible'}
                      </span>
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Máximo Retraso */}
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">Máximo Retraso (minutos)</label>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      placeholder="15"
                      {...register("timing.maxLateness", { valueAsNumber: true })}
                      className="bg-purple-900/20 border-purple-700/50 text-purple-100 placeholder-purple-400 border-[0.5px] focus:border-purple-400 focus:ring-0 rounded-lg"
                    />
                    <p className="mt-1 text-xs text-purple-400">Tiempo máximo después del inicio que se permite entrar</p>
                  </div>

                  {/* Intervalo de Auto-guardado */}
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Database className="w-4 h-4 inline mr-1" />
                      Auto-guardado (segundos)
                    </label>
                    <Input
                      type="number"
                      min={10}
                      max={300}
                      placeholder="30"
                      {...register("timing.autoSaveInterval", { valueAsNumber: true })}
                      className="bg-purple-900/20 border-purple-700/50 text-purple-100 placeholder-purple-400 border-[0.5px] focus:border-purple-400 focus:ring-0 rounded-lg"
                    />
                    <p className="mt-1 text-xs text-purple-400">Frecuencia de guardado automático del progreso</p>
                  </div>
                </div>

                {/* Tiempo Garantizado Toggle */}
                <div className="bg-purple-800/20 border border-purple-700/30 rounded-md p-3">
                  <Controller
                    name="timing.guaranteedTime"
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-purple-200">Garantizar Tiempo Completo</span>
                          <p className="text-xs text-purple-400 mt-1">
                            Fuerza que todos los estudiantes tengan el tiempo completo del examen
                          </p>
                        </div>
                        <Switch
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-500"
                        />
                      </div>
                    )}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Configuración */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-200 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          Configuración
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Controller
                name="settings.autoStart"
                control={control}
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4 rounded border-gray-600" />
                )}
              />
              <span className="text-sm text-gray-200">Habilitar Inicio Automático</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Controller
                name="settings.requireProctor"
                control={control}
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4 rounded border-gray-600" />
                )}
              />
              <span className="text-sm text-gray-200">Requiere Proctor</span>
            </div>

            <div className="flex items-center gap-2">
              <Controller
                name="settings.enableRecording"
                control={control}
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4 rounded border-gray-600" />
                )}
              />
              <span className="text-sm text-gray-200">Habilitar Grabación</span>
            </div>

            <div className="flex items-center gap-2">
              <Controller
                name="settings.enableLockdown"
                control={control}
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4 rounded border-gray-600" />
                )}
              />
              <span className="text-sm text-gray-200">Modo Bloqueo de Navegador</span>
            </div> 
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Controller
                name="settings.allowLateEntry"
                control={control}
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4 rounded border-gray-600" />
                )}
              />
              <span className="text-sm text-gray-200">Permitir Entrada Tardía</span>
            </div>

            {watchAllowLateEntry && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Minutos de Tolerancia</label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  {...register("settings.lateEntryMinutes", { valueAsNumber: true })}
                  className={baseInput}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={onCancel} className="border-line text-gray-300 bg-transparent">
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || !validateDateRange()} className="bg-blue-600 hover:bg-blue-700 text-white">
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isEditing ? "Actualizar" : "Crear"} Sesión
        </Button>
      </div>
    </form>
  );
};

export default SessionForm;
