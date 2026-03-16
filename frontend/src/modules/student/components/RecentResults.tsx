import { Button } from "@/components/atoms/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import GradientWrapper from "@/components/background/GrandWrapperSection";
import { examResultService, type ExamResultSummary } from "@/services/examResultService";
import { AlertCircle, ChevronRight, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

interface PropsRecentResults {
  studentData?: {
    recentResults: ExamResultSummary[];
  };
  formatDate?: (date: string) => string;
  handleViewResults?: (examId: string) => void;
}

const RecentResults = ({
  studentData,
  formatDate = examResultService.formatDate,
  handleViewResults,
}: PropsRecentResults) => {
  const navigate = useNavigate();
  const [recentResults, setRecentResults] = useState<ExamResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (studentData?.recentResults) {
        setRecentResults(studentData.recentResults);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await examResultService.getMyRecentResults(3);
        setRecentResults(response.recentResults);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching recent results:", err);
        setError(err.message);
        setRecentResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [studentData]);

  const getScoreColor = (score: number) => examResultService.getScoreColor(score);

  const getScoreIndicatorColor = (score: number): string => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const formatShortDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const handleResultClick = (resultId: string) => {
    if (handleViewResults) {
      handleViewResults(resultId);
    } else {
      navigate(`/student/results/${resultId}`);
    }
  };

  return (
    <GradientWrapper
      intensity="medium"
      size="md"
      position="top-left"
      animate={false}
      variant="cosmic"
    >
      <Card className="bg-card backdrop-blur-sm border border-line shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Resultados Recientes
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Tus ultimas evaluaciones
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-1 pt-0">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground text-sm">Cargando resultados...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-6 text-red-500">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">Error: {error}</span>
            </div>
          )}

          {!loading && !error && recentResults.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No tienes resultados de examenes aun</p>
              <p className="text-xs mt-1 text-muted-foreground/70">
                Completa un examen para ver tus resultados aqui
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            recentResults.map((result) => (
              <button
                key={result.id}
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer text-left"
                onClick={() => handleResultClick(result.id)}
                aria-label={`Ver resultado: ${result.examName}`}
              >
                {/* Indicador de color segun score */}
                <span
                  className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${getScoreIndicatorColor(result.score)}`}
                  aria-hidden="true"
                />

                {/* Nombre y fecha */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate leading-tight">
                    {result.examName}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                    {formatShortDate(result.date)}
                  </p>
                </div>

                {/* Score */}
                <span
                  className={`flex-shrink-0 text-sm font-semibold ${getScoreColor(result.score)}`}
                >
                  {result.score}%
                </span>

                {/* Badge de nivel */}
                <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30">
                  {result.level}
                </span>

                {/* Chevron */}
                <ChevronRight
                  className="flex-shrink-0 h-4 w-4 text-muted-foreground/50"
                  aria-hidden="true"
                />
              </button>
            ))}

          <div className="pt-2">
            <Button
              variant="default"
              className="w-full"
              onClick={() => navigate("/student/results")}
            >
              Ver Todos los Resultados
            </Button>
          </div>
        </CardContent>
      </Card>
    </GradientWrapper>
  );
};

export default RecentResults;
