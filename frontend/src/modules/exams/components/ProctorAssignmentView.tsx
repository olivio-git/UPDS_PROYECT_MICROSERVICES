import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { AlertCircle, Check, Loader2, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { candidateService, type User } from '../../../services/candidateService';
import { useSessions } from '../hooks/useSessions';
import type { ExamSession } from '../types';

interface ProctorAssignmentModalProps {
  session: ExamSession;
  onClose: () => void;
  onSuccess: () => void;
  loadSessions: () => void;
}

const ProctorAssignmentModal: React.FC<ProctorAssignmentModalProps> = ({
  session,
  onClose,
  loadSessions
}) => {
  const { addProctorsToSession, removeProctorsFromSession } = useSessions();
  const [loading, setLoading] = useState(false);
  const [loadingProctors, setLoadingProctors] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableProctors, setAvailableProctors] = useState<User[]>([]);
  const [selectedProctors, setSelectedProctors] = useState<string[]>([]);
  const [currentProctors, setCurrentProctors] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const baseInput =
    "bg-muted/50 border-border text-foreground placeholder-muted-foreground border-[0.5px] focus:border-blue-500 focus:ring-0 rounded-lg";

  // Cargar proctors desde el backend
  useEffect(() => {
    const loadProctors = async () => {
      setLoadingProctors(true);
      setError(null);

      if (!session._id) {
        setError('La sesión no tiene un ID válido');
        setLoadingProctors(false);
        return;
      }

      try {
        const response = await candidateService.getAvailableProctors(
          session._id,
          { status: 'active' },
          { limit: 100 }
        );
        if (response.success && response.data) {
          const allProctors = response.data.proctors || [];
          const registeredIds = session.participants.proctors || [];

          if (registeredIds.length > 0) {
            // Separar proctors ya asignados de los disponibles
            const currentAssigned = allProctors.filter(
              p => registeredIds.some(id => id.toString() === p._id)
            );
            const available = allProctors.filter(
              p => !registeredIds.some(id => id.toString() === p._id)
            );

            setCurrentProctors(currentAssigned);
            setAvailableProctors(available);
          } else {
            setAvailableProctors(allProctors);
            setCurrentProctors([]);
          }
        }
      } catch (err: any) {
        console.error('Error loading proctors:', err);
        setError('Error al cargar los proctors. Por favor, intente nuevamente.');
        toast.error('Error al cargar los proctors');
      } finally {
        setLoadingProctors(false);
      }
    };

    loadProctors();
  }, [session]);

  const filteredProctors = availableProctors.filter(proctor => {
    const searchLower = searchTerm.toLowerCase();
    return (
      proctor.firstName.toLowerCase().includes(searchLower) ||
      proctor.lastName.toLowerCase().includes(searchLower) ||
      proctor.email.toLowerCase().includes(searchLower) ||
      (proctor.profile?.phone && proctor.profile.phone.includes(searchTerm))
    );
  });

  const handleProctorSelect = (proctorId: string) => {
    setSelectedProctors(prev =>
      prev.includes(proctorId) ? prev.filter(id => id !== proctorId) : [...prev, proctorId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProctors.length === filteredProctors.length) {
      setSelectedProctors([]);
    } else {
      setSelectedProctors(filteredProctors.map(p => p._id));
    }
  };

  const handleAssignProctors = async () => {
    if (selectedProctors.length === 0) {
      toast.error('Debe seleccionar al menos un proctor');
      return;
    }

    setLoading(true);
    try {
      const response = await addProctorsToSession(session._id!, selectedProctors);
      console.log(response, 'RESPONSE-ADD-PROCTORS');

      // Update optimista
      const newlyAssigned = availableProctors.filter(p => selectedProctors.includes(p._id));
      setCurrentProctors(prev => [...prev, ...newlyAssigned]);
      setAvailableProctors(prev => prev.filter(p => !selectedProctors.includes(p._id)));
      setSelectedProctors([]);

      toast.success(`${selectedProctors.length} proctor(es) asignado(s) exitosamente`);
      loadSessions();
    } catch (error: any) {
      console.error('Error assigning proctors:', error);
      toast.error(error.message || 'Error al asignar proctors');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProctor = async (proctorId: string) => {
    try {
      const response = await removeProctorsFromSession(session._id!, [proctorId]);
      console.log(response, 'RESPONSE-REMOVE-PROCTORS');
      
      const removed = currentProctors.find(p => p._id === proctorId);
      if (removed) {
        setCurrentProctors(prev => prev.filter(p => p._id !== proctorId));
        setAvailableProctors(prev => [removed, ...prev]);
      }
      toast.success('Proctor removido de la sesión');
      loadSessions();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'No se pudo remover al proctor');
    }
  };

  const getInitials = (proctor: User) =>
    `${proctor.firstName[0]}${proctor.lastName[0]}`.toUpperCase();

  const getFullName = (proctor: User) =>
    `${proctor.firstName} ${proctor.lastName}`;

  return (
    <section className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground/80">Gestionar Proctors</h3>
          <p className="text-sm text-muted-foreground">Sesión: {session.sessionName}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="border-line text-muted-foreground bg-transparent">
            Cancelar
          </Button>
          <Button
            onClick={handleAssignProctors}
            disabled={loading || selectedProctors.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Asignar Proctors ({selectedProctors.length})
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-muted/40 border border-border rounded-lg p-4">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-blue-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-300">Proctors Asignados</p>
              <p className="text-2xl font-bold text-foreground">{currentProctors.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-muted/40 border border-border rounded-lg p-4">
          <div className="flex items-center">
            <UserPlus className="h-6 w-6 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-300">Disponibles</p>
              <p className="text-2xl font-bold text-foreground">{availableProctors.length}</p>
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

      {/* Loader de proctors */}
      {loadingProctors ? (
        <div className="flex items-center justify-center py-16 bg-card/60 border border-border rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <span className="ml-3 text-muted-foreground">Cargando proctors...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Proctors Asignados */}
          <div className="bg-card/60 border border-border rounded-lg p-4">
            <h4 className="text-md font-medium text-foreground/80 mb-4">
              Proctors Asignados ({currentProctors.length})
            </h4>
            {currentProctors.length === 0 ? (
              <div className="text-center py-10 bg-muted/30 rounded-lg border border-dashed border-border">
                <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-muted-foreground">
                  No hay proctors asignados
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Selecciona proctors de la lista disponible.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {currentProctors.map(proctor => (
                  <div
                    key={proctor._id}
                    className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-lg"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-foreground text-sm font-medium">
                        {getInitials(proctor)}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-foreground">
                          {getFullName(proctor)}
                        </p>
                        <p className="text-xs text-muted-foreground">{proctor.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {proctor.proctorData?.certificationLevel && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/40 text-blue-200 border border-blue-800 mr-2">
                          {proctor.proctorData.certificationLevel}
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveProctor(proctor._id)}
                        className="text-red-300 hover:text-red-200"
                        title="Remover proctor"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Proctors Disponibles */}
          <div className="bg-card/60 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-foreground">
                Proctors Disponibles ({availableProctors.length})
              </h4>
              {filteredProctors.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-300 hover:text-blue-200"
                >
                  {selectedProctors.length === filteredProctors.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                </button>
              )}
            </div>

            {/* Búsqueda */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar proctors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-9 ${baseInput}`}
                />
              </div>
            </div>

            {/* Lista */}
            {availableProctors.length === 0 ? (
              <div className="text-center py-10 bg-muted/30 rounded-lg border border-dashed border-border">
                <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-foreground/80">
                  No hay proctors disponibles
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Todos los proctors activos ya están asignados o no hay proctors registrados.
                </p>
              </div>
            ) : filteredProctors.length === 0 ? (
              <div className="text-center py-10 bg-muted/30 rounded-lg border border-dashed border-border">
                <Search className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-foreground/80">
                  No se encontraron proctors
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">Intenta con otros términos.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredProctors.map(proctor => {
                  const isSelected = selectedProctors.includes(proctor._id);
                  return (
                    <div
                      key={proctor._id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-900/20 border-blue-800'
                          : 'bg-muted/40 border-border hover:bg-muted/60'
                      }`}
                      onClick={() => handleProctorSelect(proctor._id)}
                    >
                      <div className="flex items-center">
                        <div className="flex items-center mr-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleProctorSelect(proctor._id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-border bg-muted text-blue-500 focus:ring-0"
                          />
                        </div>
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {getInitials(proctor)}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-foreground">
                            {getFullName(proctor)}
                          </p>
                          <p className="text-xs text-muted-foreground">{proctor.email}</p>
                          {proctor.profile?.phone && (
                            <p className="text-xs text-muted-foreground">{proctor.profile.phone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {proctor.proctorData?.certificationLevel && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/30 text-purple-200 border border-purple-800">
                            {proctor.proctorData.certificationLevel}
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

      {/* Información de selección */}
      {selectedProctors.length > 0 && (
        <div className="p-4 bg-blue-900/20 border border-blue-800/40 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-200">
                {selectedProctors.length} proctor(es) seleccionado(s)
              </p>
              <p className="text-sm text-blue-300">
                Total después de asignar: {currentProctors.length + selectedProctors.length}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-blue-100">
                {currentProctors.length + selectedProctors.length}
              </p>
              <p className="text-sm text-blue-300">Total proctors</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProctorAssignmentModal;