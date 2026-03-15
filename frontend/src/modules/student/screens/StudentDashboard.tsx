import { MainLayout } from "@/components/layout";
import { ContinueExamModal } from "@/components/modals/ContinueExamModal";
import { useActiveSessionDetection } from "@/hooks/useActiveSessionDetection";
// import { useAuthStore } from "@/modules/auth/services/authStore";
import { useNavigate } from "react-router-dom";
import NextExam from "../components/NextExam";
import Performance from "../components/Performance";
import RecentResults from "../components/RecentResults";

const StudentDashboard = () => {
  // const { user } = useAuthStore();
  const navigate = useNavigate();

  // Active session detection
  const {
    activeSession,
    showContinueModal,
    continueExam,
    dismissModal
  } = useActiveSessionDetection({
    checkOnMount: true,
    showModal: true,
    onActiveSessionFound: (session) => {
      console.log('🎯 Found active session in dashboard:', session);
    }
  });


  const handleStartExam = (sessionId: string) => {
    // const preparationExists =
    navigate(`/student/exam/${sessionId}/preparation`);
  };

  const handleViewResults = (resultId: string) => {
    navigate(`/student/results/${resultId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <MainLayout gradientVariant="primary" showGradient={true}>
        <div className="max-w-5xl mx-auto space-y-8 mt-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Mi Panel
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Panel Principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Próximo Examen */}
              <NextExam formatDate={formatDate} onStartExam={handleStartExam} />
              {/* Resultados Recientes */}
              <RecentResults formatDate={formatDate} handleViewResults={handleViewResults} />
            </div>

            {/* Panel Lateral */}
            <div className="space-y-6">
              {/* Estadísticas de Rendimiento */}
              <Performance />
            </div>
          </div>
        </div>
      </MainLayout>

      {/* Continue Exam Modal */}
      <ContinueExamModal
        isOpen={showContinueModal}
        onClose={dismissModal}
        onContinue={continueExam}
        sessionData={activeSession}
      />
    </>
  );
};

export default StudentDashboard;
