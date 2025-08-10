import { Trophy, ChevronDown, ChevronUp, Crown } from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import { useNavigate } from "react-router-dom";

interface PropsPerformance {
  studentData: {
    currentLevel: string;
    targetLevel: string;
    levelProgress: number;
    completedExams: number;
    totalExams: number;
    nextExam: {
      id: number;
      name: string;
      date: string;
      time: string;
      duration: string;
      level: string;
    };
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
    stats: {
      averageScore: number;
      improvementRate: number;
      studyStreak: number;
      totalStudyHours: number;
    };
  };
  // Nueva prop opcional para controlar el estado inicial
  initiallyExpanded?: boolean;
}

const Performance = ({ studentData, initiallyExpanded = false }: PropsPerformance) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

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
    <Card className="bg-box backdrop-blur-sm border border-line transition-all duration-200 hover:border-line/80">
      <CardHeader 
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <Crown className="h-5 w-5 text-yellow-400" />
            <CardTitle className="text-white flex items-center gap-2 text-lg justify-center">
              Estadísticas de Rendimiento
            </CardTitle>
            <CardDescription className="text-brand-gray text-xs">
              Análisis de tus evaluaciones
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-8 w-8 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Vista resumida cuando está colapsado */}
        {!isExpanded && (
          <div className="flex items-center justify-center gap-4 pt-2">
            <div className="text-center">
              <div className="text-lg font-extralight text-white">
                {studentData.stats.averageScore}%
              </div>
              <div className="text-xs text-brand-gray">Promedio</div>
            </div>
            <div className="text-center">
              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {studentData.currentLevel}
              </Badge>
              <div className="text-xs text-brand-gray mt-1">Nivel</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-extralight text-white">
                {studentData.completedExams}
              </div>
              <div className="text-xs text-brand-gray">Evaluaciones</div>
            </div>
          </div>
        )}
      </CardHeader>

      {/* Contenido expandible con animación */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <CardContent className="space-y-4 pt-0">
          {/* Promedio General */}
          <div className="text-center border-b border-gray-700 pb-4">
            <div className="text-sm text-gray-400 mb-1">Promedio General</div>
            <div className="text-xl font-extralight text-white">
              {studentData.stats.averageScore}%
            </div>
            <div className="text-xs text-brand-gray mt-1">
              Basado en {studentData.completedExams} evaluaciones
            </div>
          </div>

          {/* Estadísticas Detalladas */}
          <div className="space-y-3">
            {/* Exámenes Completados */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Evaluaciones Tomadas</span>
              <span className="text-white font-semibold">
                {studentData.completedExams}
              </span>
            </div>

            {/* Tendencia de Mejora */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Tendencia</span>
              <div className="flex items-center gap-1">
                <span
                  className={`text-sm font-semibold ${
                    studentData.stats.improvementRate > 0
                      ? "text-green-400"
                      : studentData.stats.improvementRate < 0
                      ? "text-red-400"
                      : "text-gray-400"
                  }`}
                >
                  {studentData.stats.improvementRate > 0 ? "+" : ""}
                  {studentData.stats.improvementRate}%
                </span>
                {studentData.stats.improvementRate > 0 && (
                  <div className="w-3 h-3 bg-green-400 rounded-full flex items-center justify-center">
                    <div className="w-1 h-1 bg-green-900 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Nivel Actual Estimado */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Nivel Estimado</span>
              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {studentData.currentLevel}
              </Badge>
            </div>

            {/* Tiempo Total de Estudio */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Tiempo Invertido</span>
              <span className="text-white font-semibold">
                {studentData.stats.totalStudyHours}h
              </span>
            </div>
          </div>

          {/* Distribución por Competencias */}
          <div className="pt-4 border-t border-gray-700">
            <div className="text-sm text-gray-400 mb-3">Rendimiento por Área</div>
            {studentData.recentResults.length > 0 && (
              <div className="space-y-2">
                {Object.entries(studentData.recentResults[0].competencies).map(
                  ([skill, score]) => (
                    <div
                      key={skill}
                      className="flex justify-between items-center"
                    >
                      <span className="text-xs text-gray-400">
                        {getCompetencyName(skill)}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              score >= 80
                                ? "bg-green-500"
                                : score >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{ 
                              width: `${Math.min(score, 100)}%`,
                              transitionDelay: `${Object.keys(studentData.recentResults[0].competencies).indexOf(skill) * 100}ms`
                            }}
                          ></div>
                        </div>
                        <span
                          className={`text-xs font-tiny ${getScoreColor(score)}`}
                        >
                          {score}%
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Botón para ver análisis detallado */}
          <Button
            variant="outline"
            className="w-full mt-4 border-gray-600 text-gray-300 hover:border-yellow-300 bg-box transition-colors hover:cursor-pointer"
            onClick={() => navigate("/student/analytics")}
          >
            <Trophy className="h-4 w-4 mr-2" />
            Ver Análisis Detallado
          </Button>
        </CardContent>
      </div>
    </Card>
  );
};

export default Performance;