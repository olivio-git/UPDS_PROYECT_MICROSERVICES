import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { UserAvatar } from '@/components/atoms/UserAvatar';
import {
  AlertCircle, Check, Loader2, Search,
  UserMinus, UserPlus, Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { candidateService, type Candidate } from '../../../services/candidateService';
import { useSessions } from '../hooks/useSessions';
import type { ExamSession } from '../types';

interface CandidateAssignmentModalProps {
  session: ExamSession;
  onClose: () => void;
  onSuccess: () => void;
  loadSessions: () => void;
}

const CandidateAssignmentModal: React.FC<CandidateAssignmentModalProps> = ({
  session,
  onClose,
  loadSessions,
}) => {
  const { addCandidatesToSession, removeCandidatesFromSession } = useSessions();
  const [loading, setLoading] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableCandidates, setAvailableCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [currentCandidates, setCurrentCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCandidates = async () => {
      setLoadingCandidates(true);
      setError(null);
      try {
        const response = await candidateService.getAvailableCandidates(
          session._id,
          { status: 'active' },
          { limit: 100 },
        );
        if (response.success && response.data) {
          const allCandidates = response.data.items || [];
          const registeredIds = session.participants.registeredCandidates || [];

          if (registeredIds.length > 0) {
            try {
              const registeredResponse = await candidateService.getCandidatesByIds(
                registeredIds.map(id => id.toString()),
              );
              if (registeredResponse.success && registeredResponse.data) {
                setCurrentCandidates(registeredResponse.data);
                setAvailableCandidates(
                  allCandidates.filter(c => !registeredIds.some(id => id.toString() === c._id)),
                );
              } else {
                setAvailableCandidates(allCandidates);
                setCurrentCandidates([]);
              }
            } catch {
              setAvailableCandidates(allCandidates);
              setCurrentCandidates([]);
            }
          } else {
            setAvailableCandidates(allCandidates);
            setCurrentCandidates([]);
          }
        }
      } catch {
        setError('Error al cargar los candidatos. Por favor, intente nuevamente.');
        toast.error('Error al cargar los candidatos');
      } finally {
        setLoadingCandidates(false);
      }
    };
    loadCandidates();
  }, [session]);

  const filteredCandidates = availableCandidates.filter(c => {
    const q = searchTerm.toLowerCase();
    return (
      c.personalInfo.firstName.toLowerCase().includes(q) ||
      c.personalInfo.lastName.toLowerCase().includes(q) ||
      c.personalInfo.email.toLowerCase().includes(q) ||
      (c.personalInfo.phone && c.personalInfo.phone.includes(searchTerm))
    );
  });

  const toggleCandidate = (id: string) =>
    setSelectedCandidates(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

  const handleSelectAll = () =>
    setSelectedCandidates(
      selectedCandidates.length === filteredCandidates.length
        ? []
        : filteredCandidates.map(c => c._id),
    );

  const handleAssign = async () => {
    if (selectedCandidates.length === 0) {
      toast.error('Debe seleccionar al menos un candidato');
      return;
    }
    if (currentCandidates.length + selectedCandidates.length > session.participants.maxCandidates) {
      toast.error(`Excede la capacidad máxima de ${session.participants.maxCandidates}`);
      return;
    }
    setLoading(true);
    try {
      await addCandidatesToSession(session._id!, selectedCandidates);
      const newlyAssigned = availableCandidates.filter(c => selectedCandidates.includes(c._id));
      setCurrentCandidates(prev => [...prev, ...newlyAssigned]);
      setAvailableCandidates(prev => prev.filter(c => !selectedCandidates.includes(c._id)));
      setSelectedCandidates([]);
      toast.success(`${newlyAssigned.length} candidato(s) asignado(s)`);
      loadSessions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Error al asignar');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (candidateId: string) => {
    try {
      await removeCandidatesFromSession(session._id!, [candidateId]);
      const removed = currentCandidates.find(c => c._id === candidateId);
      if (removed) {
        setCurrentCandidates(prev => prev.filter(c => c._id !== candidateId));
        setAvailableCandidates(prev => [removed, ...prev]);
      }
      toast.success('Candidato removido de la sesión');
      loadSessions();
    } catch (err: any) {
      toast.error(err.message || 'No se pudo remover al candidato');
    }
  };

  const max = session.participants.maxCandidates;
  const assigned = currentCandidates.length;
  const selected = selectedCandidates.length;
  const remaining = max - assigned;
  const fillPct = Math.min(((assigned + selected) / max) * 100, 100);
  const overCapacity = assigned + selected > max;

  const getFullName = (c: Candidate) =>
    `${c.personalInfo.firstName} ${c.personalInfo.lastName}`;

  const baseInput =
    'bg-muted/50 border-border text-foreground placeholder:text-muted-foreground border-[0.5px] focus:border-primary focus:ring-0 rounded-lg';

  return (
    <section className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Gestionar Candidatos
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{session.sessionName}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-border text-foreground/80 bg-transparent"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAssign}
            disabled={loading || selected === 0 || overCapacity}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <UserPlus className="h-4 w-4 mr-2" />}
            Asignar{selected > 0 ? ` (${selected})` : ''}
          </Button>
        </div>
      </div>

      {/* ── Stats + capacity bar ── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Asignados', value: assigned, color: 'text-primary' },
            { label: 'Libres', value: remaining, color: 'text-green-600 dark:text-green-400' },
            { label: 'Capacidad', value: max, color: 'text-muted-foreground' },
          ].map(stat => (
            <div key={stat.label} className="bg-muted/40 rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
                {stat.label}
              </p>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{assigned + selected} de {max} ocupados</span>
            <span>{Math.round(fillPct)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                overCapacity ? 'bg-red-500' : fillPct > 85 ? 'bg-amber-500' : 'bg-primary'
              }`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800/30">
          <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* ── Over capacity warning ── */}
      {overCapacity && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800/30">
          <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-300">
            La selección excede la capacidad máxima de {max} candidatos.
          </p>
        </div>
      )}

      {/* ── Full capacity info ── */}
      {remaining === 0 && selected === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/30">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            La sesión ha alcanzado su capacidad máxima.
          </p>
        </div>
      )}

      {/* ── Loader ── */}
      {loadingCandidates ? (
        <div className="flex items-center justify-center py-16 bg-card border border-border rounded-xl">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2.5 text-sm text-muted-foreground">Cargando candidatos...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Asignados ── */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Asignados
                <span className="text-xs font-normal text-muted-foreground">
                  ({assigned})
                </span>
              </h4>
            </div>

            {assigned === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Sin candidatos asignados</p>
                <p className="text-xs text-muted-foreground">
                  Selecciona candidatos de la lista disponible.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {currentCandidates.map(c => (
                  <div key={c._id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        avatarUrl={c.avatarUrl}
                        firstName={c.personalInfo.firstName}
                        lastName={c.personalInfo.lastName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{getFullName(c)}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.personalInfo.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.academicInfo?.currentLevel && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30">
                          {c.academicInfo.currentLevel}
                        </span>
                      )}
                      <button
                        onClick={() => handleRemove(c._id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                        title="Remover candidato"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Disponibles ── */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                Disponibles
                <span className="text-xs font-normal text-muted-foreground">
                  ({availableCandidates.length})
                </span>
              </h4>
              {filteredCandidates.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-primary hover:text-primary/80 font-medium shrink-0 transition-colors"
                >
                  {selectedCandidates.length === filteredCandidates.length
                    ? 'Deseleccionar todo'
                    : 'Seleccionar todo'}
                </button>
              )}
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre, email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`pl-8 text-sm h-8 ${baseInput}`}
                />
              </div>
            </div>

            {/* List */}
            {availableCandidates.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Sin candidatos disponibles</p>
                <p className="text-xs text-muted-foreground">
                  Todos los candidatos activos ya están asignados.
                </p>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Sin resultados</p>
                <p className="text-xs text-muted-foreground">Intenta con otros términos.</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {filteredCandidates.map(c => {
                  const isSelected = selectedCandidates.includes(c._id);
                  return (
                    <div
                      key={c._id}
                      onClick={() => toggleCandidate(c._id)}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary/5 dark:bg-primary/10'
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Custom checkbox */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'border-primary bg-primary'
                              : 'border-border bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                        </div>

                        {/* Avatar */}
                        <UserAvatar
                          avatarUrl={c.avatarUrl}
                          firstName={c.personalInfo.firstName}
                          lastName={c.personalInfo.lastName}
                          size="sm"
                          className={isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                        />

                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{getFullName(c)}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.personalInfo.email}</p>
                        </div>
                      </div>

                      {c.academicInfo?.currentLevel && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30 shrink-0 ml-2">
                          {c.academicInfo.currentLevel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer counter */}
            {selected > 0 && (
              <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {selected} seleccionado{selected !== 1 ? 's' : ''}
                </span>
                <span className={`text-xs font-semibold ${overCapacity ? 'text-red-500' : 'text-primary'}`}>
                  {assigned + selected} / {max}
                </span>
              </div>
            )}
          </div>

        </div>
      )}
    </section>
  );
};

export default CandidateAssignmentModal;
