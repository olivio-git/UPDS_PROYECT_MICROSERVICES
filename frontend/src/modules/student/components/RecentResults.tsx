import { Button } from "@/components/keel/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/keel/card";
import GradientWrapper from "@/components/background/GrandWrapperSection";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/keel/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/keel/item";
import { Spinner } from "@/components/keel/spinner";
import { examResultService, type ExamResultSummary } from "@/services/examResultService";
import { AlertCircle, ChevronRight, FileText } from "lucide-react";
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
      className="h-full"
      intensity="medium"
      size="md"
      position="top-left"
      animate={false}
      variant="cosmic"
    >
      <Card className="flex h-full flex-col bg-card backdrop-blur-sm border border-line shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Resultados Recientes
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Tus ultimas evaluaciones
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col justify-center space-y-1 pt-0">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Spinner className="h-5 w-5 text-muted-foreground mr-2" />
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
            <Empty className="border-0 py-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>Aún no tienes resultados</EmptyTitle>
                <EmptyDescription>
                  Completa un examen para ver tus resultados aquí.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!loading && !error && recentResults.length > 0 && (
            <ItemGroup className="gap-1">
              {recentResults.map((result) => (
                <Item
                  key={result.id}
                  size="sm"
                  render={<button type="button" aria-label={`Ver resultado: ${result.examName}`} />}
                  onClick={() => handleResultClick(result.id)}
                  className="cursor-pointer text-left hover:bg-muted/40"
                >
                  <ItemMedia>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${getScoreIndicatorColor(result.score)}`}
                      aria-hidden="true"
                    />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{result.examName}</ItemTitle>
                    <ItemDescription>{formatShortDate(result.date)}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span className={`shrink-0 text-sm font-semibold ${getScoreColor(result.score)}`}>
                      {result.score}%
                    </span>
                    <span className="shrink-0 rounded border border-blue-200 bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300">
                      {result.level}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}

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
