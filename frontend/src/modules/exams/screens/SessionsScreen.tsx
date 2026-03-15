import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { ArrowLeft, Check, Search, UserMinus, UserPlus, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSessions } from "../hooks/useSessions";
import type { ExamSession } from "../types";

// Simulación de candidatos (igual que antes)
interface Candidate {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  level?: string;
  status: "active" | "inactive";
}

interface Props {
  session: ExamSession;
  onBack: () => void;
  onSuccess: () => void;
}

const CandidateAssignmentView: React.FC<Props> = ({ session, onBack, onSuccess }) => {
  const { addCandidatesToSession } = useSessions();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableCandidates, setAvailableCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [currentCandidates, setCurrentCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    const mockCandidates: Candidate[] = [
      { _id: "1", firstName: "Ana", lastName: "García", email: "ana.garcia@email.com", level: "B1", status: "active" },
      { _id: "2", firstName: "Carlos", lastName: "López", email: "carlos.lopez@email.com", level: "B2", status: "active" },
      { _id: "3", firstName: "María", lastName: "Rodríguez", email: "maria.rodriguez@email.com", level: "A2", status: "active" },
      { _id: "4", firstName: "Juan", lastName: "Martínez", email: "juan.martinez@email.com", level: "B1", status: "active" },
      { _id: "5", firstName: "Laura", lastName: "Sánchez", email: "laura.sanchez@email.com", level: "C1", status: "active" }
    ];

    const registeredIds = session.participants.registeredCandidates || [];
    const available = mockCandidates.filter(c => !registeredIds.includes(c._id as any));
    const current = mockCandidates.filter(c => registeredIds.includes(c._id as any));

    setAvailableCandidates(available);
    setCurrentCandidates(current);
  }, [session]);

  const filteredCandidates = availableCandidates.filter((c) => {
    const t = searchTerm.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(t) ||
      c.lastName.toLowerCase().includes(t) ||
      c.email.toLowerCase().includes(t)
    );
  });

  const handleCandidateSelect = (id: string) => {
    setSelectedCandidates((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedCandidates.length === filteredCandidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(filteredCandidates.map(c => c._id));
    }
  };

  const remainingSlots = session.participants.maxCandidates - currentCandidates.length;

  const handleAssignCandidates = async () => {
    if (selectedCandidates.length === 0) {
      toast.error("Debe seleccionar al menos un candidato");
      return;
    }
    const totalAfter = currentCandidates.length + selectedCandidates.length;
    if (totalAfter > session.participants.maxCandidates) {
      toast.error(`No se pueden asignar ${selectedCandidates.length} candidatos. Capacidad máxima: ${session.participants.maxCandidates}`);
      return;
    }

    setLoading(true);
    try {
      await addCandidatesToSession(session._id!, selectedCandidates);
      onSuccess();
    } catch (err) {
      console.error("Error assigning candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  const baseInput = "bg-muted/50 border-border text-foreground placeholder:text-muted-foreground border-[0.5px] focus:border-blue-500 focus:ring-0 rounded-lg";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Gestionar Candidatos</h3>
            <p className="text-sm text-muted-foreground">Sesión: {session.sessionName}</p>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-300" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-300">Asignados</p>
              <p className="text-2xl font-bold text-blue-100">{currentCandidates.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
          <div className="flex items-center">
            <UserPlus className="h-8 w-8 text-green-300" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-300">Disponibles</p>
              <p className="text-2xl font-bold text-green-100">{remainingSlots}</p>
            </div>
          </div>
        </div>
        <div className="bg-muted/20 border border-border rounded-lg p-4">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">Capacidad</p>
              <p className="text-2xl font-bold text-foreground">{session.participants.maxCandidates}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dos columnas: asignados / disponibles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asignados */}
        <div>
          <h4 className="text-md font-medium text-foreground mb-4">
            Candidatos Asignados ({currentCandidates.length})
          </h4>

          {currentCandidates.length === 0 ? (
            <div className="text-center py-8 bg-muted/20 rounded-lg border border-border">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No hay candidatos asignados</h3>
              <p className="mt-1 text-sm text-muted-foreground">Selecciona candidatos de la lista disponible.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {currentCandidates.map((c) => (
                <div key={c._id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-foreground">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {c.level && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-300 mr-2 border border-blue-800/30">
                        {c.level}
                      </span>
                    )}
                    <button className="text-red-400 hover:text-red-300" title="Remover candidato">
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disponibles */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-foreground">
              Candidatos Disponibles ({availableCandidates.length})
            </h4>
            {filteredCandidates.length > 0 && (
              <button onClick={handleSelectAll} className="text-sm text-blue-300 hover:text-blue-200">
                {selectedCandidates.length === filteredCandidates.length ? "Deseleccionar Todo" : "Seleccionar Todo"}
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
                className={`pl-10 pr-3 w-full ${baseInput}`}
              />
            </div>
          </div>

          {/* Lista disponibles */}
          {filteredCandidates.length === 0 ? (
            <div className="text-center py-8 bg-muted/20 rounded-lg border border-border">
              <Search className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No se encontraron candidatos</h3>
              <p className="mt-1 text-sm text-muted-foreground">Intenta con diferentes términos de búsqueda.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCandidates.map((c) => {
                const selected = selectedCandidates.includes(c._id);
                return (
                  <div
                    key={c._id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selected ? "bg-blue-900/20 border-blue-800/30" : "bg-transparent border-border hover:bg-muted/40"
                    }`}
                    onClick={() => handleCandidateSelect(c._id)}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => handleCandidateSelect(c._id)}
                        className="h-4 w-4 mr-3 rounded border-border"
                      />
                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {c.firstName[0]}{c.lastName[0]}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-foreground">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {c.level && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/20 text-green-300 border border-green-800/30">
                          {c.level}
                        </span>
                      )}
                      {selected && <Check className="h-4 w-4 text-blue-300 ml-2" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Info capacidad y acciones */}
      {selectedCandidates.length > 0 && (
        <div className="p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-200">{selectedCandidates.length} candidato(s) seleccionado(s)</p>
              <p className="text-sm text-blue-300">Quedarán {remainingSlots - selectedCandidates.length} espacios disponibles</p>
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

      {currentCandidates.length + selectedCandidates.length > session.participants.maxCandidates && (
        <div className="p-4 bg-red-900/20 border border-red-800/30 rounded-lg">
          <p className="text-sm text-red-300">
            <strong>Advertencia:</strong> La selección actual excede la capacidad máxima de la sesión.
          </p>
        </div>
      )}

      {remainingSlots === 0 && selectedCandidates.length === 0 && (
        <div className="p-4 bg-yellow-900/20 border border-yellow-800/30 rounded-lg">
          <p className="text-sm text-yellow-300">
            <strong>Información:</strong> La sesión ha alcanzado su capacidad máxima.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-line">
        <Button variant="outline" onClick={onBack} className="border-line text-muted-foreground bg-transparent">Cancelar</Button>
        <Button
          onClick={handleAssignCandidates}
          disabled={
            loading ||
            selectedCandidates.length === 0 ||
            (currentCandidates.length + selectedCandidates.length > session.participants.maxCandidates)
          }
          className="bg-blue-600 hover:bg-blue-700"
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
  );
};

export default CandidateAssignmentView;
