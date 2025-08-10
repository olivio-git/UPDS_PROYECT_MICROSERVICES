import { useState } from "react";
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Download,
  Eye,
  BarChart3,
  Target,
  Clock,
  FileText,
  Award,
  ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import { Progress } from "@/components/atoms/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/select";
import { MainLayout } from "@/components/layout";
import { ContentGradientSection } from "@/components/background";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface ExamResult {
  id: number;
  examName: string;
  examType: 'placement' | 'progress' | 'final';
  date: string;
  duration: number;
  level: string;
  overallScore: number;
  passed: boolean;
  competencies: {
    listening: { score: number; feedback: string };
    reading: { score: number; feedback: string };
    writing: { score: number; feedback: string };
    speaking: { score: number; feedback: string };
  };
  feedback: string;
  recommendations: string[];
  certificateGenerated: boolean;
  nextLevel?: string;
}

const StudentResults = () => {
  const navigate = useNavigate();
  const { resultId } = useParams();
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");

  // Mock data - En producción vendría de la API
  const [results] = useState<ExamResult[]>([
    {
      id: 1,
      examName: "Evaluación B1 - Sesión 3",
      examType: 'progress',
      date: "2025-07-20",
      duration: 120,
      level: "B1",
      overallScore: 78,
      passed: true,
      competencies: {
        listening: { score: 85, feedback: "Excelente comprensión de conversaciones cotidianas" },
        reading: { score: 72, feedback: "Buen nivel de comprensión, mejorar vocabulario técnico" },
        writing: { score: 75, feedback: "Estructura clara, trabajar en conectores" },
        speaking: { score: 80, feedback: "Fluidez adecuada, pronunciación clara" }
      },
      feedback: "Has mostrado un progreso consistente en todas las competencias. Tu nivel B1 está bien consolidado.",
      recommendations: [
        "Practicar más vocabulario técnico para mejorar la comprensión lectora",
        "Trabajar con conectores avanzados en la escritura",
        "Continuar con ejercicios de listening de nivel B2"
      ],
      certificateGenerated: true,
      nextLevel: "B2"
    },
    {
      id: 2,
      examName: "Evaluación B1 - Sesión 2",
      examType: 'progress',
      date: "2025-07-10",
      duration: 120,
      level: "B1",
      overallScore: 82,
      passed: true,
      competencies: {
        listening: { score: 88, feedback: "Comprensión excelente en contextos variados" },
        reading: { score: 78, feedback: "Mejora notable en textos académicos" },
        writing: { score: 80, feedback: "Coherencia y cohesión mejoradas" },
        speaking: { score: 82, feedback: "Mayor confianza y fluidez" }
      },
      feedback: "Excelente progreso. Estás listo para desafíos de nivel B2.",
      recommendations: [
        "Comenzar con materiales de nivel B2",
        "Practicar escritura académica",
        "Expandir vocabulario avanzado"
      ],
      certificateGenerated: true,
      nextLevel: "B2"
    }
  ]);

  const [currentResult, setCurrentResult] = useState<ExamResult | null>(
    resultId ? results.find(r => r.id === parseInt(resultId)) || null : null
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 text-green-300 border-green-500/30';
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    return 'bg-red-500/20 text-red-300 border-red-500/30';
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'placement':
        return <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">Ubicación</Badge>;
      case 'progress':
        return <Badge className="bg-orange-500/20 text-orange-300 border border-orange-500/30">Progreso</Badge>;
      case 'final':
        return <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Final</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCompetencyName = (key: string) => {
    const names = {
      listening: 'Comprensión Auditiva',
      reading: 'Comprensión Lectora',
      writing: 'Expresión Escrita',
      speaking: 'Expresión Oral'
    };
    return names[key as keyof typeof names] || key;
  };

  const handleDownloadCertificate = (resultId: number) => {
    toast.success("Descargando certificado...");
  };

  const handleViewDetails = (result: ExamResult) => {
    setCurrentResult(result);
  };

  const calculateProgress = () => {
    if (results.length < 2) return 0;
    const latest = results[0].overallScore;
    const previous = results[1].overallScore;
    return latest - previous;
  };

  const getAverageScore = () => {
    return Math.round(results.reduce((sum, result) => sum + result.overallScore, 0) / results.length);
  };

  const filteredResults = results.filter(result => {
    const levelMatch = selectedLevel === "all" || result.level === selectedLevel;
    const periodMatch = selectedPeriod === "all" || 
      (selectedPeriod === "recent" && new Date(result.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    return levelMatch && periodMatch;
  });

  if (currentResult) {
    // Vista detallada de un resultado específico
    return (
      <MainLayout gradientVariant="primary">
        <div className="max-w-6xl mx-auto space-y-8">
          <ContentGradientSection variant="secondary" position="top-right" className="mb-8">
            <div className="text-center space-y-6 m-6">
              <div className="space-y-2">
                <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                  Resultado del{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
                    Examen
                  </span>
                </h1>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto font-portfolio">
                  Análisis detallado de tu desempeño
                </p>
              </div>
            </div>
          </ContentGradientSection>

          <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">{currentResult.examName}</CardTitle>
                  <CardDescription className="text-gray-300">
                    {formatDate(currentResult.date)} • {currentResult.duration} minutos
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentResult(null)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a Resultados
                  </Button>
                  {getTypeBadge(currentResult.examType)}
                  {currentResult.certificateGenerated && (
                    <Button
                      onClick={() => handleDownloadCertificate(currentResult.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Certificado
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getScoreColor(currentResult.overallScore)} mb-2`}>
                    {currentResult.overallScore}%
                  </div>
                  <p className="text-gray-300">Puntuación General</p>
                  <Badge className={`mt-2 ${getScoreBadgeColor(currentResult.overallScore)}`}>
                    {currentResult.passed ? 'APROBADO' : 'NO APROBADO'}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-400 mb-2">
                    {currentResult.level}
                  </div>
                  <p className="text-gray-300">Nivel Evaluado</p>
                  {currentResult.nextLevel && (
                    <Badge className="mt-2 bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Siguiente: {currentResult.nextLevel}
                    </Badge>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-400 mb-2">
                    {currentResult.duration}
                  </div>
                  <p className="text-gray-300">Minutos</p>
                  <Badge className="mt-2 bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Completado
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-400" />
                    Desglose por Competencias
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(currentResult.competencies).map(([skill, data]) => (
                    <div key={skill} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-white">{getCompetencyName(skill)}</h4>
                        <span className={`font-bold ${getScoreColor(data.score)}`}>
                          {data.score}%
                        </span>
                      </div>
                      <Progress value={data.score} className="w-full" />
                      <p className="text-sm text-gray-400">{data.feedback}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-400" />
                    Retroalimentación General
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 mb-4">{currentResult.feedback}</p>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-white">Recomendaciones para Mejorar:</h4>
                    <ul className="space-y-2">
                      {currentResult.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                          <Target className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Acciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentResult.certificateGenerated && (
                    <Button
                      onClick={() => handleDownloadCertificate(currentResult.id)}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      <Award className="h-4 w-4 mr-2" />
                      Descargar Certificado
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                    onClick={() => toast.info("Próximamente disponible")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar Reporte PDF
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                    onClick={() => navigate('/student/exams')}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Ver Próximos Exámenes
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Vista principal de todos los resultados
  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-7xl mx-auto space-y-8">
        <ContentGradientSection variant="secondary" position="top-right" className="mb-8">
          <div className="text-center space-y-6 m-6">
            <div className="space-y-2">
              <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                Mis{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
                  Resultados
                </span>
              </h1>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto font-portfolio">
                Historial de evaluaciones y progreso académico
              </p>
            </div>
          </div>
        </ContentGradientSection>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">Promedio General</p>
                  <p className={`text-2xl font-bold ${getScoreColor(getAverageScore())}`}>
                    {getAverageScore()}%
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">Progreso</p>
                  <div className="flex items-center gap-2">
                    <p className={`text-2xl font-bold ${
                      calculateProgress() >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {calculateProgress() >= 0 ? '+' : ''}{calculateProgress()}%
                    </p>
                    {calculateProgress() >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                </div>
                <Trophy className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">Exámenes</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {results.length}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">Certificados</p>
                  <p className="text-2xl font-bold text-green-400">
                    {results.filter(r => r.certificateGenerated).length}
                  </p>
                </div>
                <Award className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
          <CardHeader>
            <CardTitle className="text-white">Filtrar Resultados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Período</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los períodos</SelectItem>
                    <SelectItem value="recent">Últimos 30 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Nivel</label>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los niveles</SelectItem>
                    <SelectItem value="A1">A1</SelectItem>
                    <SelectItem value="A2">A2</SelectItem>
                    <SelectItem value="B1">B1</SelectItem>
                    <SelectItem value="B2">B2</SelectItem>
                    <SelectItem value="C1">C1</SelectItem>
                    <SelectItem value="C2">C2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredResults.map((result) => (
            <Card
              key={result.id}
              className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50 hover:border-gray-600/50 transition-all cursor-pointer"
              onClick={() => handleViewDetails(result)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg mb-2">{result.examName}</CardTitle>
                    <CardDescription className="text-gray-300">
                      {formatDate(result.date)} • {result.duration} min
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2">
                    {getTypeBadge(result.examType)}
                    <Badge className={getScoreBadgeColor(result.overallScore)}>
                      {result.overallScore}%
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-gray-300">Nivel {result.level}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-300">{result.duration} min</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Progreso General</span>
                    <span>{result.overallScore}%</span>
                  </div>
                  <Progress value={result.overallScore} className="w-full" />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    {result.passed ? (
                      <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">
                        APROBADO
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">
                        NO APROBADO
                      </Badge>
                    )}
                    {result.certificateGenerated && (
                      <Award className="h-4 w-4 text-green-400" />
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(result);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalles
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredResults.length === 0 && (
          <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No hay resultados</h3>
              <p className="text-gray-400">No se encontraron resultados con los filtros seleccionados.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default StudentResults;