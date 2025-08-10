import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { FileText } from "lucide-react";
import { useNavigate } from "react-router";
import GradientWrapper from "@/components/background/GrandWrapperSection";

interface PropsRecentResults {
  studentData: {
    recentResults: Array<{
      id: number;
      examName: string;
      date: string;
      score: number;
      level: string;
      competencies: {
        listening: number;
        reading: number;
        writing: number;
        speaking: number;
      };
    }>;
  };
  formatDate: (date: string) => string;
  handleViewResults: (examId: number) => void;
}
const RecentResults = ({
  studentData,
  formatDate,
  handleViewResults,
}: PropsRecentResults) => {
  const navigate = useNavigate();

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };
  const getCompetencyName = (key: string) => {
    const names = {
      listening: "Comprensión Auditiva",
      reading: "Comprensión Lectora",
      writing: "Expresión Escrita",
      speaking: "Expresión Oral",
    };
    return names[key as keyof typeof names] || key;
  };
  return (
    <GradientWrapper
      intensity="low"
      size="lg"
      position="right"
      animate={false}
      variant="cosmic"
    >   
    <Card className="bg-box backdrop-blur-sm border border-line">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-400" />
          Resultados Recientes
        </CardTitle>
        <CardDescription className="text-gray-300">
          Tus últimas evaluaciones
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {studentData.recentResults.map((result) => (
          <div
            key={result.id}
            className="border border-line rounded-lg p-4 hover:bg-gray-800/10 transition-all cursor-pointer"
            onClick={() => handleViewResults(result.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-white">{result.examName}</h4>
                <p className="text-sm text-gray-400">
                  {formatDate(result.date)}
                </p>
              </div>
              <div className="text-right">
                <div
                  className={`text-xl font-bold ${getScoreColor(result.score)}`}
                >
                  {result.score}%
                </div>
                <Badge
                  variant="secondary"
                  className="bg-blue-500/20 text-blue-300"
                >
                  {result.level}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {Object.entries(result.competencies).map(([skill, score]) => (
                <div key={skill} className=" rounded p-2">
                  <div className="text-xs text-gray-400 mb-1">
                    {getCompetencyName(skill)}
                  </div>
                  <div
                    className={`text-sm font-medium ${getScoreColor(score)}`}
                  >
                    {score}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <Button
          variant="outline"
            className="w-full mt-4 border-gray-600 text-gray-300 hover:border-yellow-300 bg-box transition-colors hover:cursor-pointer"
          onClick={() => navigate("/student/results")}
        >
          Ver Todos los Resultados
        </Button>
      </CardContent>
    </Card>
    </GradientWrapper>
  );
};

export default RecentResults;
