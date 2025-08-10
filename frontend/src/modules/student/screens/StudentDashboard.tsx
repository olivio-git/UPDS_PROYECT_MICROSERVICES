import { useState } from "react";
import { MainLayout } from "@/components/layout";
// import { useAuthStore } from "@/modules/auth/services/authStore";
import { useNavigate } from "react-router-dom"; 
import NextExam from "../components/NextExam";
import RecentResults from "../components/RecentResults";
import Performance from "../components/Performance";

const StudentDashboard = () => {
  // const { user } = useAuthStore();
  const navigate = useNavigate();

  // Mock data - En producción vendría de la API
  const [studentData] = useState({
    currentLevel: "B1",
    targetLevel: "B2",
    levelProgress: 65,
    completedExams: 8,
    totalExams: 12,
    nextExam: {
      id: 1,
      name: "Examen de Progreso B1-B2",
      date: "2025-08-15",
      time: "10:00 AM",
      duration: "120 min",
      level: "B1",
    },
    recentResults: [
      {
        id: 1,
        examName: "Evaluación B1 - Sesión 3",
        date: "2025-07-20",
        score: 78,
        level: "B1",
        competencies: {
          listening: 85,
          reading: 72,
          writing: 75,
          speaking: 80,
        },
      },
      {
        id: 2,
        examName: "Evaluación B1 - Sesión 2",
        date: "2025-07-10",
        score: 82,
        level: "B1",
        competencies: {
          listening: 88,
          reading: 78,
          writing: 80,
          speaking: 82,
        },
      },
    ],
    stats: {
      averageScore: 80,
      improvementRate: 12,
      studyStreak: 15,
      totalStudyHours: 120,
    },
  });

  const handleStartExam = (examId: number) => {
    navigate(`/student/exam/${examId}/preparation`);
  };

  const handleViewResults = (resultId: number) => {
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
    <MainLayout gradientVariant="primary">
      <div className="max-w-5xl mx-auto space-y-8 mt-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Información Rápida
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Panel Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Próximo Examen */}
            <NextExam studentData={studentData} formatDate={formatDate} handleStartExam={handleStartExam} />
            {/* Resultados Recientes */}
            <RecentResults studentData={studentData} formatDate={formatDate} handleViewResults={handleViewResults} />
          </div>

          {/* Panel Lateral */}
          <div className="space-y-6">
            {/* Estadísticas de Rendimiento */} 
            <Performance studentData={studentData} />
            {/* Acciones Rápidas */}
            {/* <Card className="bg-box backdrop-blur-sm border border-line">
              <CardHeader>
                <CardTitle className="text-white">Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start bg-gradient-to-r from-green-500/20 to-teal-600/20 border-green-500/30 text-white hover:from-green-500/30 hover:to-teal-600/30"
                  onClick={() => navigate("/student/exams")}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Mis Exámenes
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start bg-gradient-to-r from-blue-500/20 to-purple-600/20 border-blue-500/30 text-white hover:from-blue-500/30 hover:to-purple-600/30"
                  onClick={() => navigate("/student/results")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Mis Resultados
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start bg-gradient-to-r from-gray-500/20 to-slate-600/20 border-gray-500/30 text-white hover:from-gray-500/30 hover:to-slate-600/30"
                  onClick={() => navigate("/student/profile")}
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Mi Perfil
                </Button>
              </CardContent>
            </Card> */}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default StudentDashboard;
