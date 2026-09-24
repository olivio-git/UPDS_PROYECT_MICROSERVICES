import type { UpcomingSessionsData } from '@/services/reportsService';
import { UserCheck } from 'lucide-react';

export function ProctorWorkload({ workload }: { workload: UpcomingSessionsData['proctorWorkload'] }) {
  if (workload.length === 0) return null;
  return (
    <div className="bg-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          Carga de Proctors
        </h3>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {workload.map((p) => (
          <div key={p.proctorId} className="bg-muted/30 border border-border rounded-lg px-3 py-2.5">
            <p className="text-sm font-medium text-foreground mb-1.5 truncate">{p.proctorName}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{p.assignedSessions} sesión{p.assignedSessions !== 1 ? 'es' : ''}</span>
              <span className="font-medium text-foreground">{p.upcomingHours.toFixed(1)}h</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
