import { Button } from '@/components/atoms/button';
import { MainLayout } from '@/components/layout';
import ExportOptionsModal from '@/components/modals/ExportOptionsModal';
import type { Candidate } from '@/services/candidateService';
import type { ExportOptions, StudentHistoryData } from '@/services/reportsService';
import { AlertTriangle, ChevronLeft, Download, Loader2, User } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CandidateSearch } from '../components/student-history/CandidateSearch';
import { CompetencyProgress } from '../components/student-history/CompetencyProgress';
import { ExamDetailDialog } from '../components/student-history/ExamDetailDialog';
import { ExamHistoryTable, type ExamEntry } from '../components/student-history/ExamHistoryTable';
import { HistoryRecommendations } from '../components/student-history/HistoryRecommendations';
import { HistorySummary } from '../components/student-history/HistorySummary';
import { SelectedStudent, type StudentIdentity } from '../components/student-history/SelectedStudent';
import { useExportStudentHistory, useStudentHistory } from '../hooks/useStudentHistoryQueries';

const BASE_PATH = '/student-history';

/** Carried in router state when a student is picked from the search box. */
interface LocationState {
  candidate?: Candidate;
}

/**
 * Who the page is about. A candidate picked from search carries avatar and
 * level; arriving by URL (e.g. from Reports) only has what the history returns.
 */
function identify(candidateId: string, fromSearch: Candidate | undefined, history: StudentHistoryData | undefined): StudentIdentity | null {
  if (fromSearch && fromSearch._id === candidateId) {
    return {
      firstName: fromSearch.personalInfo.firstName,
      lastName: fromSearch.personalInfo.lastName,
      email: fromSearch.personalInfo.email,
      avatarUrl: fromSearch.avatarUrl,
      level: fromSearch.academicInfo.currentLevel,
    };
  }
  if (!history) return null;
  const [firstName = '', ...rest] = history.studentInfo.name.split(' ');
  return { firstName, lastName: rest.join(' '), email: history.studentInfo.email };
}

function Message({ icon, title, children }: { icon: ReactNode; title?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
      {icon}
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      <p className="text-xs text-muted-foreground max-w-xs">{children}</p>
    </div>
  );
}

const StudentHistoryScreen: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { state } = useLocation() as { state: LocationState | null };

  const history = useStudentHistory(studentId);
  const exportHistory = useExportStudentHistory();
  const [selectedExam, setSelectedExam] = useState<ExamEntry | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const selectCandidate = (candidate: Candidate) =>
    navigate(`${BASE_PATH}/${candidate._id}`, { state: { candidate } satisfies LocationState });
  const clearStudent = () => navigate(BASE_PATH);
  // Stable so the table's column definitions are not rebuilt on every render.
  const openExam = useCallback((exam: ExamEntry) => setSelectedExam(exam), []);

  const handleExport = (format: 'csv' | 'pdf', options?: ExportOptions) => {
    if (!studentId) return;
    exportHistory.mutate(
      { candidateId: studentId, format, options },
      {
        onSuccess: () => {
          toast.success(`Exportado como ${format.toUpperCase()}`);
          setExportOpen(false);
        },
        onError: () => toast.error('Error exportando el historial'),
      },
    );
  };

  const student = studentId ? identify(studentId, state?.candidate, history.data) : null;
  const data = history.data;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Volver"
              className="h-7 w-7 flex items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Historial de Estudiante</h1>
              <p className="text-xs text-muted-foreground">Progreso académico individual</p>
            </div>
          </div>
          {data && (
            <Button onClick={() => setExportOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">
              <Download className="h-3 w-3 mr-1" />Exportar
            </Button>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          {student
            ? <SelectedStudent student={student} onClear={clearStudent} />
            : <CandidateSearch onSelect={selectCandidate} />}
        </div>

        {!studentId && (
          <Message icon={<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><User className="h-6 w-6 text-muted-foreground" /></div>} title="Busca un estudiante">
            Escribe nombre o email para ver el historial académico completo
          </Message>
        )}

        {studentId && history.isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 mr-2" />
            <span className="text-sm text-muted-foreground">Cargando historial...</span>
          </div>
        )}

        {studentId && history.isError && (
          <Message icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}>
            No se pudo cargar el historial de este estudiante.{' '}
            <button type="button" onClick={() => history.refetch()} className="underline hover:text-foreground">Reintentar</button>
          </Message>
        )}

        {data && (
          <>
            <HistorySummary summary={data.summary} />
            <CompetencyProgress progress={data.competencyProgress} />
            {/* Keyed by student so filters from the previous student do not carry over. */}
            <ExamHistoryTable key={studentId} exams={data.examHistory} onOpenExam={openExam} />
            <HistoryRecommendations recommendations={data.recommendations} />
          </>
        )}

        <ExportOptionsModal
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          onExport={handleExport}
          reportType="student-history"
          isLoading={exportHistory.isPending}
        />
      </div>

      <ExamDetailDialog exam={selectedExam} onClose={() => setSelectedExam(null)} />
    </MainLayout>
  );
};

export default StudentHistoryScreen;
