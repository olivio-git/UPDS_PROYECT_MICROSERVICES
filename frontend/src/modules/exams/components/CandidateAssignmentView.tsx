import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { AlertCircle, Check, Loader2, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { candidateService, type Candidate } from '../../../services/candidateService';
import { useSessions } from '../hooks/useSessions';
import type { ExamSession } from '../types';

interface CandidateAssignmentModalProps {
  session: ExamSession;
  onClose: () => void;        // lo mantengo para no romper el uso, actúa como "Cancelar"
  onSuccess: () => void;      // no lo toco por compatibilidad
  loadSessions: () => void;
}

const CandidateAssignmentModal: React.FC<CandidateAssignmentModalProps> = ({
  session,
  onClose,
  // onSuccess,
  loadSessions
}) => {
  const { addCandidatesToSession, removeCandidatesFromSession } = useSessions();
  const [loading, setLoading] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableCandidates, setAvailableCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [currentCandidates, setCurrentCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  // estilos coherentes con SessionForm
  const baseInput =
    "bg-muted/50 border-border text-foreground placeholder-muted-foreground border-[0.5px] focus:border-blue-500 focus:ring-0 rounded-lg";

  // Cargar candidatos desde el backend (misma lógica)
  useEffect(() => {
    const loadCandidates = async () => {
      setLoadingCandidates(true);
      setError(null);
      try {
        const response = await candidateService.getAvailableCandidates(
          session._id,
          { status: 'active' },
          { limit: 100 }
        );
        if (response.success && response.data) {
          const allCandidates = response.data.items || [];
          const registeredIds = session.participants.registeredCandidates || [];

          if (registeredIds.length > 0) {
            try {
              const registeredResponse = await candidateService.getCandidatesByIds(
                registeredIds.map(id => id.toString())
              );

              if (registeredResponse.success && registeredResponse.data) {
                setCurrentCandidates(registeredResponse.data);
                const available = allCandidates.filter(
                  c => !registeredIds.some(id => id.toString() === c._id)
                );
                setAvailableCandidates(available);
              } else {
                setAvailableCandidates(allCandidates);
                setCurrentCandidates([]);
              }
            } catch (err) {
              console.error('Error fetching registered candidates:', err);
              setAvailableCandidates(allCandidates);
              setCurrentCandidates([]);
            }
          } else {
            setAvailableCandidates(allCandidates);
            setCurrentCandidates([]);
          }
        }
      } catch (err: any) {
        console.error('Error loading candidates:', err);
        setError('Error al cargar los candidatos. Por favor, intente nuevamente.');
        toast.error('Error al cargar los candidatos');
      } finally {
        setLoadingCandidates(false);
      }
    };

    loadCandidates();
  }, [session]);

  const filteredCandidates = availableCandidates.filter(candidate => {
    const searchLower = searchTerm.toLowerCase();
    return (
      candidate.personalInfo.firstName.toLowerCase().includes(searchLower) ||
      candidate.personalInfo.lastName.toLowerCase().includes(searchLower) ||
      candidate.personalInfo.email.toLowerCase().includes(searchLower) ||
      (candidate.personalInfo.phone && candidate.personalInfo.phone.includes(searchTerm))
    );
  });

  const handleCandidateSelect = (candidateId: string) => {
    setSelectedCandidates(prev =>
      prev.includes(candidateId) ? prev.filter(id => id !== candidateId) : [...prev, candidateId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCandidates.length === filteredCandidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(filteredCandidates.map(c => c._id));
    }
  };

  const handleAssignCandidates = async () => {
    if (selectedCandidates.length === 0) {
      toast.error('Debe seleccionar al menos un candidato');
      return;
    }

    const totalAfterAssignment = currentCandidates.length + selectedCandidates.length;
    if (totalAfterAssignment > session.participants.maxCandidates) {
      toast.error(
        `No se pueden asignar ${selectedCandidates.length} candidatos. ` +
        `Capacidad máxima: ${session.participants.maxCandidates}`
      );
      return;
    }

    setLoading(true);
    try {
      const response = await addCandidatesToSession(session._id!, selectedCandidates);
      console.log(response, 'RESPONSE-ADD-CANDIDATES');

      // Update optimista (sin tocar la lógica original, solo manteniéndola como en tu último snippet)
      const newlyAssigned = availableCandidates.filter(c => selectedCandidates.includes(c._id));
      setCurrentCandidates(prev => [...prev, ...newlyAssigned]);
      setAvailableCandidates(prev => prev.filter(c => !selectedCandidates.includes(c._id)));
      setSelectedCandidates([]);

      toast.success(`${selectedCandidates.length} candidato(s) asignado(s) exitosamente`);
      loadSessions();
    } catch (error: any) {
      console.error('Error assigning candidates:', error);
      toast.error(error.message || 'Error al asignar candidatos');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCandidate = async (candidateId: string) => {
    try {
      const response = await removeCandidatesFromSession(session._id!, [candidateId]);
      console.log(response, 'RESPONSE-REMOVE-CANDIDATES');
      // Mantengo la actualización optimista como mostraste
      const removed = currentCandidates.find(c => c._id === candidateId);
      if (removed) {
        setCurrentCandidates(prev => prev.filter(c => c._id !== candidateId));
        setAvailableCandidates(prev => [removed, ...prev]);
      }
      toast.success('Candidato removido de la sesión');
      // Opcional: loadSessions();
      loadSessions();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'No se pudo remover al candidato');
    }
  };

  const remainingSlots = session.participants.maxCandidates - currentCandidates.length;

  const getInitials = (candidate: Candidate) =>
    `${candidate.personalInfo.firstName[0]}${candidate.personalInfo.lastName[0]}`.toUpperCase();

  const getFullName = (candidate: Candidate) =>
    `${candidate.personalInfo.firstName} ${candidate.personalInfo.lastName}`;

  // ======== RENDER NO MODAL (sección/panel) ========
  return (
    <section className="space-y-6">
      {/* Encabezado estilo hermanos */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground/80">Gestionar Candidatos</h3>
          <p className="text-sm text-muted-foreground">Sesión: {session.sessionName}</p>
        </div>
        {/* Botón cancelar para respetar onClose sin modal */}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="border-line text-muted-foreground bg-transparent">
            Cancelar
          </Button>
          <Button
            onClick={handleAssignCandidates}
            disabled={
              loading ||
              selectedCandidates.length === 0 ||
              currentCandidates.length + selectedCandidates.length > session.participants.maxCandidates
            }
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Asignar Candidatos ({selectedCandidates.length})
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted/40 border border-border rounded-lg p-4">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-blue-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-300">Asignados</p>
              <p className="text-2xl font-bold text-foreground">{currentCandidates.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-muted/40 border border-border rounded-lg p-4">
          <div className="flex items-center">
            <UserPlus className="h-6 w-6 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-300">Espacios libres</p>
              <p className="text-2xl font-bold text-foreground">{remainingSlots}</p>
            </div>
          </div>
        </div>

        <div className="bg-muted/40 border border-border rounded-lg p-4">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-muted-foreground" />
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">Capacidad</p>
              <p className="text-2xl font-bold text-foreground">
                {session.participants.maxCandidates}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* Loader de candidatos */}
      {loadingCandidates ? (
        <div className="flex items-center justify-center py-16 bg-card/60 border border-border rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <span className="ml-3 text-muted-foreground">Cargando candidatos...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Candidatos Asignados */}
          <div className="bg-card/60 border border-border rounded-lg p-4">
            <h4 className="text-md font-medium text-foreground/80 mb-4">
              Candidatos Asignados ({currentCandidates.length})
            </h4>
            {currentCandidates.length === 0 ? (
              <div className="text-center py-10 bg-muted/30 rounded-lg border border-dashed border-border">
                <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-muted-foreground">
                  No hay candidatos asignados
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Selecciona candidatos de la lista disponible.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {currentCandidates.map(candidate => (
                  <div
                    key={candidate._id}
                    className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-lg"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-foreground text-sm font-medium">
                        {getInitials(candidate)}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-foreground">
                          {getFullName(candidate)}
                        </p>
                        <p className="text-xs text-muted-foreground">{candidate.personalInfo.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {candidate.academicInfo?.currentLevel && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/40 text-blue-200 border border-blue-800 mr-2">
                          {candidate.academicInfo.currentLevel}
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveCandidate(candidate._id)}
                        className="text-red-300 hover:text-red-200"
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

          {/* Candidatos Disponibles */}
          <div className="bg-card/60 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-foreground/80">
                Candidatos Disponibles ({availableCandidates.length})
              </h4>
              {filteredCandidates.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-300 hover:text-blue-200"
                >
                  {selectedCandidates.length === filteredCandidates.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                </button>
              )}
            </div>

            {/* Búsqueda */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar candidatos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-9 ${baseInput}`}
                />
              </div>
            </div>

            {/* Lista */}
            {availableCandidates.length === 0 ? (
              <div className="text-center py-10 bg-muted/30 rounded-lg border border-dashed border-border">
                <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-muted-foreground">
                  No hay candidatos disponibles
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Todos los candidatos activos ya están asignados o no hay candidatos registrados.
                </p>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="text-center py-10 bg-muted/30 rounded-lg border border-dashed border-border">
                <Search className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-muted-foreground">
                  No se encontraron candidatos
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">Intenta con otros términos.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredCandidates.map(candidate => {
                  const isSelected = selectedCandidates.includes(candidate._id);
                  return (
                    <div
                      key={candidate._id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-900/20 border-blue-800'
                          : 'bg-muted/40 border-border hover:bg-muted/60'
                      }`}
                      onClick={() => handleCandidateSelect(candidate._id)}
                    >
                      <div className="flex items-center">
                        <div className="flex items-center mr-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleCandidateSelect(candidate._id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-border bg-muted text-blue-500 focus:ring-0"
                          />
                        </div>
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-foreground text-sm font-medium">
                          {getInitials(candidate)}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-foreground">
                            {getFullName(candidate)}
                          </p>
                          <p className="text-xs text-muted-foreground">{candidate.personalInfo.email}</p>
                          {candidate.personalInfo.phone && (
                            <p className="text-xs text-muted-foreground">{candidate.personalInfo.phone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {candidate.academicInfo?.currentLevel && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-200 border border-green-800">
                            {candidate.academicInfo.currentLevel}
                          </span>
                        )}
                        {isSelected && <Check className="h-4 w-4 text-blue-300 ml-2" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Información de capacidad */}
      {selectedCandidates.length > 0 && (
        <div className="p-4 bg-blue-900/20 border border-blue-800/40 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-200">
                {selectedCandidates.length} candidato(s) seleccionado(s)
              </p>
              <p className="text-sm text-blue-300">
                Quedarán {remainingSlots - selectedCandidates.length} espacios disponibles
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-blue-100">
                {currentCandidates.length + selectedCandidates.length} / {session.participants.maxCandidates}
              </p>
              <p className="text-sm text-blue-300">Total después de asignar</p>
            </div>
          </div>
        </div>
      )}

      {/* Advertencias */}
      {currentCandidates.length + selectedCandidates.length > session.participants.maxCandidates && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg">
          <p className="text-sm text-red-200">
            <strong>Advertencia:</strong> La selección actual excede la capacidad máxima de la sesión.
          </p>
        </div>
      )}
      {remainingSlots === 0 && selectedCandidates.length === 0 && (
        <div className="p-4 bg-yellow-900/30 border border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-200">
            <strong>Información:</strong> La sesión ha alcanzado su capacidad máxima.
          </p>
        </div>
      )}
    </section>
  );
};

export default CandidateAssignmentModal;
