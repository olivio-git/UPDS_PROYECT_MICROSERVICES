import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import {
  examResultService,
  type EvaluationStats,
} from '@/services/examResultService';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Crown,
  Loader2,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PropsPerformance {
  initiallyExpanded?: boolean;
}

const Performance = ({ initiallyExpanded = false }: PropsPerformance) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [stats, setStats] = useState<EvaluationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch evaluation stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const evaluationStats = await examResultService.getMyEvaluationStats();
        setStats(evaluationStats);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching evaluation stats:', err);
        setError(err.message);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCompetencyName = (key: string) => {
    const names = {
      listening: 'Comprensión Auditiva',
      reading: 'Comprensión Lectora',
      writing: 'Expresión Escrita',
      speaking: 'Expresión Oral',
    };
    return names[key as keyof typeof names] || key;
  };

  return (
    <GradientWrapper
      intensity="low"
      size="lg"
      position="bottom"
      animate={false}
      variant="cosmic"
    >
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
          {!isExpanded && !loading && stats && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="text-center">
                <div className="text-lg font-extralight text-white">
                  {stats.averageScore}%
                </div>
                <div className="text-xs text-brand-gray">Promedio</div>
              </div>
              <div className="text-center">
                <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {stats.currentLevel}
                </Badge>
                <div className="text-xs text-brand-gray mt-1">Nivel</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-extralight text-white">
                  {stats.totalEvaluations}
                </div>
                <div className="text-xs text-brand-gray">Evaluaciones</div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {!isExpanded && loading && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">Cargando...</span>
            </div>
          )}

          {/* Error state */}
          {!isExpanded && error && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-xs text-red-400">Error al cargar</span>
            </div>
          )}
        </CardHeader>

        {/* Contenido expandible con animación */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <CardContent className="space-y-4 pt-0">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                <span className="text-gray-400">Cargando estadísticas...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center py-8 text-red-400">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>Error: {error}</span>
              </div>
            )}

            {!loading && !error && stats && stats.totalEvaluations === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Crown className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Aún no has completado evaluaciones</p>
                <p className="text-sm">
                  Realiza tu primera evaluación para ver estadísticas
                </p>
              </div>
            )}

            {!loading && !error && stats && stats.totalEvaluations > 0 && (
              <>
                {/* Promedio General */}
                <div className="text-center border-b border-gray-700 pb-4">
                  <div className="text-sm text-gray-400 mb-1">
                    Promedio General
                  </div>
                  <div className="text-xl font-extralight text-white">
                    {stats.averageScore}%
                  </div>
                  <div className="text-xs text-brand-gray mt-1">
                    Basado en {stats.totalEvaluations} evaluaciones
                  </div>
                </div>

                {/* Estadísticas Detalladas */}
                <div className="space-y-3">
                  {/* Evaluaciones Completadas */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">
                      Evaluaciones Tomadas
                    </span>
                    <span className="text-white font-semibold">
                      {stats.totalEvaluations}
                    </span>
                  </div>

                  {/* Tendencia de Mejora */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Tendencia</span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-sm font-semibold ${
                          stats.improvementRate > 0
                            ? 'text-green-400'
                            : stats.improvementRate < 0
                            ? 'text-red-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {stats.improvementRate > 0 ? '+' : ''}
                        {stats.improvementRate}%
                      </span>
                      {stats.improvementRate > 0 && (
                        <div className="w-3 h-3 bg-green-400 rounded-full flex items-center justify-center">
                          <div className="w-1 h-1 bg-green-900 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nivel Actual Estimado */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">
                      Nivel Estimado
                    </span>
                    <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {stats.currentLevel}
                    </Badge>
                  </div>

                  {/* Frecuencia de Evaluación */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Frecuencia</span>
                    <span className="text-white font-semibold">
                      {stats.evaluationFrequency}/mes
                    </span>
                  </div>

                  {/* Tiempo Promedio */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">
                      Tiempo Promedio
                    </span>
                    <span className="text-white font-semibold">
                      {Math.round(stats.averageTimePerEvaluation / 60)}min
                    </span>
                  </div>
                </div>

                {/* Distribución por Competencias */}
                <div className="pt-4 border-t border-gray-700">
                  <div className="text-sm text-gray-400 mb-3">
                    Rendimiento por Área
                  </div>
                  {Object.keys(stats.competencyAverages).length > 0 && (
                    <div className="space-y-2">
                      {Object.entries(stats.competencyAverages).map(
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
                                    (score || 0) >= 80
                                      ? 'bg-green-500'
                                      : (score || 0) >= 60
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(score || 0, 100)}%`,
                                    transitionDelay: `${
                                      Object.keys(
                                        stats.competencyAverages
                                      ).indexOf(skill) * 100
                                    }ms`,
                                  }}
                                ></div>
                              </div>
                              <span
                                className={`text-xs font-tiny ${getScoreColor(
                                  score || 0
                                )}`}
                              >
                                {score || 0}%
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
                  onClick={() => navigate('/student/analytics')}
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Ver Análisis Detallado
                </Button>
              </>
            )}
          </CardContent>
        </div>
      </Card>
    </GradientWrapper>
  );
};

export default Performance;
