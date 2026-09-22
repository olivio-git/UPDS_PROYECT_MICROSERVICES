import type { ExamSession } from '../../types';
import { creatorName, formatDateLong } from './sessionDisplay';

function Meta({ label, children, mono }: { label: string; children: string; mono?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground/60">{label}</span>
      <span className={mono ? 'font-mono text-muted-foreground select-all' : 'text-muted-foreground'}>{children}</span>
    </span>
  );
}

export function SessionMetaFooter({ session }: { session: ExamSession }) {
  const creator = creatorName(session.createdBy);
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground px-1">
      {session._id && <Meta label="ID" mono>{session._id}</Meta>}
      {creator && <Meta label="Creado por">{creator}</Meta>}
      {session.createdAt && <Meta label="Creación">{formatDateLong(session.createdAt)}</Meta>}
      {session.updatedAt && <Meta label="Actualización">{formatDateLong(session.updatedAt)}</Meta>}
    </div>
  );
}
