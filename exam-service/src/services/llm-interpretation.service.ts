import axios from 'axios';
import { logger } from '../utils/logger';
import { buildExamResultFallback, buildExamResultMessages } from './llm-exam-result.prompt';

export interface DataInterpretation {
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  trends: string[];
  concerns: string[];
  visualizationSuggestions: string[];
}

export interface InterpretationConfig {
  language: 'spanish' | 'english';
  depth: 'brief' | 'detailed';
  focus: 'academic' | 'administrative' | 'strategic';
}

interface GroqMessage {
  role: 'system' | 'user';
  content: string;
}

export class LLMInterpretationService {
  private groqApiKey: string;
  private model: string;
  private timeout: number;
  private readonly groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    // llama-3.3-70b-versatile was retired by GROQ (404). See grading-service's config.ts.
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    this.timeout = parseInt(process.env.LLM_TIMEOUT || '30') * 1000;
  }

  async interpretCompetencyData(data: any, config: InterpretationConfig = { language: 'spanish', depth: 'detailed', focus: 'academic' }): Promise<DataInterpretation> {
    const messages = this.buildCompetencyMessages(data, config);
    return this.processWithGroq(messages, config, data);
  }

  async interpretStudentStats(data: any, config: InterpretationConfig = { language: 'spanish', depth: 'detailed', focus: 'academic' }): Promise<DataInterpretation> {
    const messages = this.buildStudentStatsMessages(data, config);
    return this.processWithGroq(messages, config, data);
  }

  async interpretUpcomingSessions(data: any, config: InterpretationConfig = { language: 'spanish', depth: 'detailed', focus: 'administrative' }): Promise<DataInterpretation> {
    const messages = this.buildUpcomingSessionsMessages(data, config);
    return this.processWithGroq(messages, config, data);
  }

  async interpretStudentHistory(data: any, config: InterpretationConfig = { language: 'spanish', depth: 'detailed', focus: 'academic' }): Promise<DataInterpretation> {
    const messages = this.buildStudentHistoryMessages(data, config);
    return this.processWithGroq(messages, config, data);
  }

  async interpretExamResult(data: any, config: InterpretationConfig = { language: 'spanish', depth: 'detailed', focus: 'academic' }): Promise<DataInterpretation> {
    const messages = this.buildExamResultMessages(data, config);
    return this.processWithGroq(messages, config, data);
  }

  // ─── BUILDERS ────────────────────────────────────────────────────────────────

  private buildExamResultMessages(data: any, config: InterpretationConfig): GroqMessage[] {
    // Pure, unit-tested builder (3-state verdict + placement) — see llm-exam-result.prompt.ts.
    return buildExamResultMessages(data, config);
  }

  private buildCompetencyMessages(data: any, config: InterpretationConfig): GroqMessage[] {
    const isSpanish = config.language === 'spanish';

    const competencies = Object.entries(data.competencyBreakdown ?? {})
      .map(([name, d]: [string, any]) =>
        `  • ${name}: ${Number(d.averageScore ?? 0).toFixed(1)}% promedio — ${d.studentsEvaluated ?? 0} estudiantes — dificultad: ${d.difficulty}`
      ).join('\n') || '  (sin datos de competencias)';

    const system = isSpanish
      ? `Eres un analista educativo experto del Centro Boliviano Americano. Genera análisis precisos y accionables sobre rendimiento por competencias en inglés. Responde únicamente con JSON válido.`
      : `You are an expert educational analyst. Generate precise and actionable analysis about English competency performance. Respond only with valid JSON.`;

    const user = isSpanish ? `
Analiza el rendimiento por competencias académicas:

ESTADÍSTICAS GENERALES:
  Total exámenes: ${data.overallStats?.totalExams ?? 0}
  Estudiantes:    ${data.overallStats?.totalStudents ?? 0}
  Promedio gral.: ${Number(data.overallStats?.averageOverallScore ?? 0).toFixed(1)}%
  Tasa completación: ${Number(data.overallStats?.completionRate ?? 0).toFixed(1)}%

COMPETENCIAS:
${competencies}

Mejor competencia:  ${data.comparativeAnalysis?.bestPerforming ?? 'N/A'}
Más desafiante:     ${data.comparativeAnalysis?.mostChallenging ?? 'N/A'}
Áreas de mejora:    ${(data.comparativeAnalysis?.improvementAreas ?? []).join(', ') || 'ninguna'}

Responde con este JSON:
{
  "summary": "2-3 oraciones sobre el estado general del rendimiento por competencias.",
  "keyInsights": ["Fortaleza destacada con datos", "Debilidad principal con datos", "Patrón transversal observado"],
  "recommendations": ["Acción pedagógica para competencia débil", "Estrategia para aprovechar fortalezas", "Intervención institucional sugerida"],
  "trends": ["Tendencia entre competencias", "Implicaciones para el programa"],
  "concerns": ["Competencia con promedio crítico (< 60%)", "Riesgo institucional identificado"],
  "visualizationSuggestions": []
}` : `Analyze the competency performance data and respond with valid JSON using keys: summary, keyInsights, recommendations, trends, concerns, visualizationSuggestions.`;

    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  private buildStudentStatsMessages(data: any, config: InterpretationConfig): GroqMessage[] {
    const isSpanish = config.language === 'spanish';

    const dist = data.performanceDistribution ?? {};
    const total = data.evaluatedStudents || 1;

    const system = isSpanish
      ? `Eres un analista educativo experto. Genera análisis claros sobre estadísticas estudiantiles. Responde únicamente con JSON válido.`
      : `You are an expert educational analyst. Respond only with valid JSON.`;

    const user = isSpanish ? `
Analiza las estadísticas de estudiantes:

RESUMEN:
  Total estudiantes:    ${data.totalStudents ?? 0}
  Evaluados:            ${data.evaluatedStudents ?? 0}
  Promedio general:     ${Number(data.averageScore ?? 0).toFixed(1)}%

DISTRIBUCIÓN:
  Excelente (>85%):     ${dist.excellent ?? 0} (${((dist.excellent ?? 0) / total * 100).toFixed(1)}%)
  Bueno (70-85%):       ${dist.good ?? 0} (${((dist.good ?? 0) / total * 100).toFixed(1)}%)
  Aceptable (60-70%):   ${dist.acceptable ?? 0} (${((dist.acceptable ?? 0) / total * 100).toFixed(1)}%)
  Necesita mejora (<60%): ${dist.needsImprovement ?? 0} (${((dist.needsImprovement ?? 0) / total * 100).toFixed(1)}%)

TIEMPO:
  Duración promedio:   ${data.timeAnalysis?.averageDuration ?? 0} min
  Eficiencia temporal: ${data.timeAnalysis?.timeEfficiency ?? 0}%

Responde con JSON:
{
  "summary": "Estado general del rendimiento estudiantil con cifras concretas.",
  "keyInsights": ["Segmento predominante con %", "Estudiantes en riesgo con %", "Eficiencia temporal observada"],
  "recommendations": ["Intervención para estudiantes con < 60%", "Estrategia para elevar el grupo 60-70%", "Refuerzo para mantener excelentes"],
  "trends": ["Distribución y su implicación", "Eficiencia tiempo vs rendimiento"],
  "concerns": ["Porcentaje de estudiantes que necesitan mejora", "Riesgos institucionales"],
  "visualizationSuggestions": []
}` : `Analyze student statistics and respond with valid JSON using keys: summary, keyInsights, recommendations, trends, concerns, visualizationSuggestions.`;

    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  private buildUpcomingSessionsMessages(data: any, config: InterpretationConfig): GroqMessage[] {
    const isSpanish = config.language === 'spanish';

    const system = isSpanish
      ? `Eres un gestor académico experto. Analiza datos de programación de sesiones y genera observaciones operativas. Responde únicamente con JSON válido.`
      : `You are an expert academic manager. Analyze session scheduling data and generate operational insights. Respond only with valid JSON.`;

    const user = isSpanish ? `
Analiza la programación de sesiones:

  Total próximas sesiones: ${data.totalUpcomingSessions ?? 0}
  Esta semana:             ${data.sessionsThisWeek ?? 0}
  Próxima semana:          ${data.sessionsNextWeek ?? 0}
  Candidatos registrados:  ${data.summary?.totalCandidatesRegistered ?? 0}
  Utilización de capacidad: ${data.summary?.averageCapacityUtilization ?? 0}%
  Sesiones sin proctors:   ${data.summary?.sessionsNeedingProctors ?? 0}

Responde con JSON:
{
  "summary": "Estado de la programación con cifras clave.",
  "keyInsights": ["Carga de sesiones esta semana", "Utilización de capacidad", "Déficit de proctors si aplica"],
  "recommendations": ["Acción operativa prioritaria", "Optimización de recursos", "Prevención de cuellos de botella"],
  "trends": ["Distribución de carga semanal", "Patrón de registro de candidatos"],
  "concerns": ["Riesgo operativo principal", "Sesiones en riesgo por falta de proctors"],
  "visualizationSuggestions": []
}` : `Analyze upcoming sessions data and respond with valid JSON using keys: summary, keyInsights, recommendations, trends, concerns, visualizationSuggestions.`;

    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  private buildStudentHistoryMessages(data: any, config: InterpretationConfig): GroqMessage[] {
    const isSpanish = config.language === 'spanish';

    const studentName = data.studentInfo?.name || (isSpanish ? 'el estudiante' : 'the student');
    const summary = data.summary ?? {};
    const exams = (data.examHistory ?? []).slice(0, 5)
      .map((e: any) => `  • ${e.examTitle} (${e.level}): ${Number(e.percentage ?? 0).toFixed(1)}% — ${new Date(e.completedAt).toLocaleDateString('es-BO')}`)
      .join('\n') || '  (sin historial)';

    const competencyLines = Object.entries(data.competencyProgress ?? {})
      .map(([comp, d]: [string, any]) => `  • ${comp}: ${Number(d.averageScore ?? 0).toFixed(1)}% (${d.trend})`)
      .join('\n') || '  (sin datos)';

    const system = isSpanish
      ? `Eres un consejero académico del Centro Boliviano Americano. Analiza el historial académico de un estudiante y genera retroalimentación personalizada de progreso. Responde únicamente con JSON válido.`
      : `You are an academic counselor. Analyze a student's academic history and generate personalized progress feedback. Respond only with valid JSON.`;

    const user = isSpanish ? `
Analiza el historial académico de ${studentName}:

RESUMEN:
  Total exámenes: ${summary.totalExams ?? 0}
  Promedio:       ${Number(summary.averageScore ?? 0).toFixed(1)}%
  Mejor puntaje:  ${Number(summary.bestScore ?? 0).toFixed(1)}%
  Peor puntaje:   ${Number(summary.worstScore ?? 0).toFixed(1)}%
  Tiempo total:   ${summary.totalTimeSpent ?? 0} min

ÚLTIMOS EXÁMENES:
${exams}

PROGRESO POR COMPETENCIAS:
${competencyLines}

Responde con JSON:
{
  "summary": "Trayectoria académica de ${studentName} con datos concretos de progreso.",
  "keyInsights": ["Competencia con mejor trayectoria", "Competencia con mayor oscilación o caída", "Patrón de rendimiento a lo largo del tiempo"],
  "recommendations": ["Foco de estudio para la próxima evaluación", "Competencia a consolidar", "Estrategia a largo plazo"],
  "trends": ["Tendencia general: mejorando/estable/declinando", "Competencia con tendencia más clara"],
  "concerns": ["Competencia en declive si aplica", "Riesgo de estancamiento si aplica"],
  "visualizationSuggestions": []
}` : `Analyze student history and respond with valid JSON.`;

    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  // ─── GROQ CORE ───────────────────────────────────────────────────────────────

  private async processWithGroq(
    messages: GroqMessage[],
    config: InterpretationConfig,
    rawData?: any
  ): Promise<DataInterpretation> {
    if (!this.groqApiKey) {
      logger.warn('GROQ_API_KEY no configurada — usando fallback');
      return this.generateFallbackInterpretation(config, rawData);
    }

    try {
      logger.info('Llamando a GROQ para interpretación', { model: this.model });

      const response = await axios.post(this.groqUrl, {
        model: this.model,
        messages,
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      }, {
        timeout: this.timeout,
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Respuesta vacía de GROQ');

      const parsed = JSON.parse(content);
      logger.info('Interpretación GROQ completada');

      return {
        summary:                 parsed.summary                 || '',
        keyInsights:             Array.isArray(parsed.keyInsights)             ? parsed.keyInsights             : [],
        recommendations:         Array.isArray(parsed.recommendations)         ? parsed.recommendations         : [],
        trends:                  Array.isArray(parsed.trends)                  ? parsed.trends                  : [],
        concerns:                Array.isArray(parsed.concerns)                ? parsed.concerns                : [],
        visualizationSuggestions: Array.isArray(parsed.visualizationSuggestions) ? parsed.visualizationSuggestions : []
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Error en GROQ — usando fallback:', { message: msg });
      return this.generateFallbackInterpretation(config, rawData);
    }
  }

  // ─── FALLBACK INTELIGENTE ─────────────────────────────────────────────────────

  private generateFallbackInterpretation(config: InterpretationConfig, data?: any): DataInterpretation {
    const isSpanish = config.language === 'spanish';

    // Fallback específico para resultado de examen (pure, unit-tested — 3-state
    // verdict + placement; see llm-exam-result.prompt.ts).
    if (data?.result !== undefined) {
      return buildExamResultFallback(data, config);
    }

    // Fallback genérico para otros tipos de reporte
    return {
      summary:         isSpanish ? 'Análisis completado con los datos disponibles.' : 'Analysis completed with available data.',
      keyInsights:     isSpanish ? ['Los datos han sido procesados correctamente', 'Métricas calculadas y disponibles'] : ['Data processed successfully', 'Metrics calculated and available'],
      recommendations: isSpanish ? ['Revisar los resultados detalladamente', 'Implementar mejoras basadas en los datos'] : ['Review results in detail', 'Implement data-driven improvements'],
      trends:          [],
      concerns:        [],
      visualizationSuggestions: []
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.groqApiKey) return false;
    try {
      const res = await axios.get('https://api.groq.com/openai/v1/models', {
        timeout: 5000,
        headers: { 'Authorization': `Bearer ${this.groqApiKey}` }
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }
}

export const llmInterpretationService = new LLMInterpretationService();
