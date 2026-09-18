import { Button } from '@/components/atoms/button';
import { cn } from '@/lib/utils';
import { ArrowLeft, BookOpen, Edit, UserPlus } from 'lucide-react';
import type { ExamSession } from '../../types';
import { ExtendTimeMenu } from './ExtendTimeMenu';
import { sessionStatus } from '../../sessionStatus';

interface SessionHeaderProps {
  session: ExamSession;
  onBack: () => void;
  onEdit: () => void;
  onManageCandidates: () => void;
}

export function SessionHeader({ session, onBack, onEdit, onManageCandidates }: SessionHeaderProps) {
  const status = sessionStatus(session.status);
  const editable = session.status !== 'completed' && session.status !== 'cancelled';
  const canExtend = session._id && (session.status === 'in_progress' || session.status === 'scheduled');

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <Button
          onClick={onBack}
          variant="outline"
          size="sm"
          className="mt-0.5 shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Volver atrás"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-foreground leading-tight">{session.sessionName}</h1>
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', status.badge)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
              {status.label}
            </span>
          </div>
          {session.exam?.name && (
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              {session.exam.name}
            </p>
          )}
        </div>
      </div>

      {editable && (
        <div className="flex gap-2 shrink-0 pl-10 sm:pl-0 flex-wrap">
          {canExtend && <ExtendTimeMenu sessionId={session._id as string} />}
          <Button onClick={onManageCandidates} size="sm" className="bg-brand-blue hover:bg-brand-blue/90 text-white" aria-label="Gestionar candidatos">
            <UserPlus className="w-4 h-4 mr-1.5" />
            Candidatos
          </Button>
          <Button onClick={onEdit} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" aria-label="Editar sesión">
            <Edit className="w-4 h-4 mr-1.5" />
            Editar
          </Button>
        </div>
      )}
    </div>
  );
}
