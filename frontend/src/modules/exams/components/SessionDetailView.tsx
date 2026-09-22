import type { ExamSession } from '../types';
import { ExamSummaryCard } from './session-detail/ExamSummaryCard';
import { SessionHeader } from './session-detail/SessionHeader';
import { SessionInfoCard } from './session-detail/SessionInfoCard';
import { SessionMetaFooter } from './session-detail/SessionMetaFooter';
import { SessionMetrics } from './session-detail/SessionMetrics';
import { SessionResultsCard } from './session-detail/SessionResultsCard';

interface SessionDetailViewProps {
  session: ExamSession;
  onBack: () => void;
  onEdit: () => void;
  onManageCandidates: () => void;
}

/** Full view of one exam session: schedule, settings, linked exam, and graded results. */
const SessionDetailView: React.FC<SessionDetailViewProps> = ({ session, onBack, onEdit, onManageCandidates }) => (
  <div className="space-y-4">
    <SessionHeader session={session} onBack={onBack} onEdit={onEdit} onManageCandidates={onManageCandidates} />
    <SessionMetrics session={session} />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SessionInfoCard session={session} />
      <ExamSummaryCard session={session} />
    </div>
    {session._id && <SessionResultsCard sessionId={session._id} completed={session.status === 'completed'} />}
    <SessionMetaFooter session={session} />
  </div>
);

export default SessionDetailView;
