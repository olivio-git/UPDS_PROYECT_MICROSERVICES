import { UserAvatar } from '@/components/atoms/UserAvatar';
import { Button } from '@/components/atoms/button';
import { X } from 'lucide-react';

export interface StudentIdentity {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  level?: string;
}

export function SelectedStudent({ student, onClear }: { student: StudentIdentity; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2.5">
      <UserAvatar avatarUrl={student.avatarUrl} firstName={student.firstName} lastName={student.lastName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{`${student.firstName} ${student.lastName}`.trim()}</p>
        <p className="text-xs text-muted-foreground truncate">{student.email}</p>
      </div>
      {student.level && (
        <span className="text-xs bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-mono shrink-0">
          {student.level}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        aria-label="Elegir otro estudiante"
        className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
