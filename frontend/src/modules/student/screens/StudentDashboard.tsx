import { MainLayout } from "@/components/layout";
import { ContinueExamModal } from "@/components/modals/ContinueExamModal";
import { useActiveSessionDetection } from "@/hooks/useActiveSessionDetection";
// import { useAuthStore } from "@/modules/auth/services/authStore";
import { useNavigate } from "react-router-dom";
import NextExam from "../components/NextExam";
import ExamCalendar from "../components/ExamCalendar";
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
        <div className="flex h-full flex-col gap-6 p-4 sm:p-6 xl:p-8">
          <h1 className="shrink-0 text-3xl font-bold text-foreground">Mi Panel</h1>

          {/* At 1280 (xl, 12 cols) the next exam and calendar sit side by
              side and results stack full-width below. At 1920 (2xl) there's
              room for a real third column instead of wider cards — next
              exam, calendar and results all sit in one row. */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:auto-rows-fr xl:grid-cols-12">
            <div className="min-h-0 xl:col-span-8 2xl:col-span-6 xl:h-full">
              <NextExam formatDate={formatDate} onStartExam={handleStartExam} />
            </div>
            <div className="min-h-0 xl:col-span-4 2xl:col-span-3 xl:h-full">
              <ExamCalendar />
            </div>
            <div className="min-h-0 xl:col-span-12 2xl:col-span-3 xl:h-full">
              <RecentResults formatDate={formatDate} handleViewResults={handleViewResults} />
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
