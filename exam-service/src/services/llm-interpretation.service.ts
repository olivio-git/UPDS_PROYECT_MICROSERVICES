import axios from 'axios';
import { logger } from '../utils/logger';

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
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
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
    const isSpanish = config.language === 'spanish';

    const firstName = data.student?.firstName || '';
    const lastName  = data.student?.lastName  || '';
    const studentName = `${firstName} ${lastName}`.trim() || (isSpanish ? 'el estudiante' : 'the student');

    const percentage   = data.result?.percentage   ?? 0;
    const passed       = data.result?.passed        ?? false;
    const examTitle    = data.result?.examTitle     ?? '';
    const level        = data.result?.level         ?? '';
    const passingScore = data.result?.passingScore  ?? 70;
    const duration     = data.result?.duration      ?? 0;
    const feedback     = data.result?.feedback      ?? '';

    const competencies: string = (data.competencyScores ?? [])
      .map((c: any) => `  • ${c.competency}: ${Number(c.percentage ?? 0).toFixed(1)}% (${c.score}/${c.maxScore} pts)`)
      .join('\n') || (isSpanish ? '  (sin desglose por competencia)' : '  (no competency breakdown)');

    const margin = Math.abs(percentage - passingScore).toFixed(1);
    const statusLine = passed
      ? (isSpanish ? `APROBADO — superó el mínimo por ${margin}%` : `PASSED — exceeded minimum by ${margin}%`)
      : (isSpanish ? `NO APROBADO — le faltaron ${margin}% para alcanzar el mínimo` : `DID NOT PASS — ${margin}% below minimum`);

    const system = isSpanish
      ? `Eres un evaluador académico del Centro Boliviano Americano (CBA), institución de enseñanza de inglés en Bolivia. Tu misión es generar retroalimentación académica directamente dirigida AL estudiante, usando segunda persona (tú/tu). NUNCA hables del estudiante en tercera persona. Escribe como si le estuvieras hablando directamente: "obtuviste", "tu fortaleza es", "te recomendamos", "puedes mejorar". Usa su nombre solo al inicio del resumen como saludo. Responde únicamente con JSON válido con las claves exactas indicadas.`
      : `You are an academic evaluator at an English language institute. Write ALL feedback directly TO the student using second person (you/your). NEVER refer to the student in third person. Write as if speaking directly to them: "you scored", "your strength is", "we recommend you". Use their name only at the start of the summary as a greeting. Respond only with valid JSON using the exact keys indicated.`;

    const user = isSpanish ? `
Genera retroalimentación académica personalizada para este resultado de examen.

DATOS DEL EXAMEN:
  Estudiante:  ${studentName}
  Examen:      ${examTitle}${level ? ` — Nivel ${level}` : ''}
  Puntaje:     ${percentage.toFixed(1)}%
  Estado:      ${statusLine}
  Mínimo req.: ${passingScore}%
  Duración:    ${duration} minutos

RENDIMIENTO POR COMPETENCIAS:
${competencies}

${feedback ? `RETROALIMENTACIÓN PREVIA DEL SISTEMA:\n  "${feedback}"\n` : ''}

INSTRUCCIONES CRÍTICAS:
- Habla DIRECTAMENTE al estudiante en segunda persona: "obtuviste", "tu resultado", "puedes", "te recomendamos". NUNCA en tercera persona.
- Usa su nombre (${firstName || 'el estudiante'}) solo al inicio del resumen como saludo, después usa "tú/tu".
- Usa los porcentajes y datos reales del examen, no inventes cifras.
- Si aprobó: resalta sus logros en segunda persona, la competencia más fuerte, y cómo puede seguir creciendo.
- Si no aprobó: sé alentador en segunda persona, señala qué necesita trabajar y qué puede hacer concreto.
- Las recomendaciones deben ser accionables y específicas (ej: "practica comprensión auditiva con podcasts 20 min al día").
- No repitas la misma información en distintas secciones.

Responde con este JSON exacto:
{
  "summary": "2-3 oraciones describiendo el desempeño general de ${firstName || studentName}. Incluye el puntaje obtenido, si aprobó, y la competencia más destacada.",
  "keyInsights": [
    "Observación específica sobre la competencia con mejor rendimiento (con %) ",
    "Observación sobre la competencia con menor rendimiento (con %)",
    "Observación sobre eficiencia, tiempo, o patrón general de respuestas"
  ],
  "recommendations": [
    "Acción concreta y específica para reforzar la competencia más débil",
    "Estrategia para consolidar y proyectar la competencia más fuerte",
    "Hábito o recurso de estudio concreto para el próximo examen"
  ],
  "trends": [
    "Relación o patrón observado entre las competencias evaluadas",
    "Implicación del resultado para el avance al siguiente nivel"
  ],
  "concerns": ${passed
    ? '[]'
    : `["Competencia específica que impidió la aprobación y requiere atención prioritaria", "Brecha concreta entre el puntaje obtenido y el mínimo requerido"]`
  },
  "visualizationSuggestions": []
}` : `
Generate personalized academic feedback for this exam result.

EXAM DATA:
  Student:   ${studentName}
  Exam:      ${examTitle}${level ? ` — Level ${level}` : ''}
  Score:     ${percentage.toFixed(1)}%
  Status:    ${statusLine}
  Min score: ${passingScore}%
  Duration:  ${duration} minutes

COMPETENCY BREAKDOWN:
${competencies}

${feedback ? `EXISTING SYSTEM FEEDBACK:\n  "${feedback}"\n` : ''}

Respond with this exact JSON:
{
  "summary": "2-3 sentences describing ${firstName || studentName}'s overall performance. Include score, pass/fail status, and top competency.",
  "keyInsights": [
    "Specific observation about best performing competency (with %)",
    "Specific observation about weakest competency (with %)",
    "Observation about efficiency, time usage, or response patterns"
  ],
  "recommendations": [
    "Concrete action to strengthen the weakest competency",
    "Strategy to consolidate the strongest competency",
    "Specific study habit or resource for the next exam"
  ],
  "trends": [
    "Pattern or relationship observed across competencies",
    "Implication of this result for advancing to the next level"
  ],
  "concerns": ${passed ? '[]' : '["Specific competency that prevented passing", "Gap between achieved score and minimum required"]'},
  "visualizationSuggestions": []
}`;

    return [
      { role: 'system', content: system },
      { role: 'user',   content: user   }
    ];
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

    // Fallback específico para resultado de examen
    if (data?.result !== undefined) {
      const percentage  = Number(data.result?.percentage  ?? 0);
      const passed      = data.result?.passed  ?? false;
      const level       = data.result?.level   ?? '';
      const passingScore = data.result?.passingScore ?? 70;
      const firstName   = data.student?.firstName ?? '';
      const name        = `${firstName} ${data.student?.lastName ?? ''}`.trim() || (isSpanish ? 'El estudiante' : 'The student');

      const sorted      = [...(data.competencyScores ?? [])].sort((a, b) => b.percentage - a.percentage);
      const best        = sorted[0];
      const worst       = sorted[sorted.length - 1];
      const margin      = Math.abs(percentage - passingScore).toFixed(1);

      return {
        summary: isSpanish
          ? `${name}, obtuviste un ${percentage.toFixed(1)}% en el examen de nivel ${level}. ${passed ? `¡Aprobaste superando el mínimo por ${margin}%!` : `No alcanzaste el mínimo requerido (${passingScore}%), te faltaron ${margin}%.`}${best ? ` Tu competencia más fuerte fue ${best.competency} con ${Number(best.percentage).toFixed(1)}%.` : ''}`
          : `${name}, you scored ${percentage.toFixed(1)}% on the ${level} level exam. ${passed ? `You passed, exceeding the minimum by ${margin}%!` : `You did not meet the required minimum (${passingScore}%), missing by ${margin}%.`}`,
        keyInsights: [
          best  ? (isSpanish ? `Tu mejor rendimiento fue en ${best.competency} con ${Number(best.percentage).toFixed(1)}%` : `Your best performance was in ${best.competency} at ${Number(best.percentage).toFixed(1)}%`) : '',
          worst && worst !== best ? (isSpanish ? `Tu área a reforzar es ${worst.competency} con ${Number(worst.percentage).toFixed(1)}%` : `Your area to strengthen is ${worst.competency} at ${Number(worst.percentage).toFixed(1)}%`) : '',
          passed
            ? (isSpanish ? `Tu rendimiento muestra dominio del nivel ${level}` : `Your performance shows mastery of ${level} level`)
            : (isSpanish ? `Necesitas refuerzo en las competencias evaluadas antes de tu próxima evaluación` : `You need reinforcement before your next evaluation`)
        ].filter(Boolean),
        recommendations: isSpanish
          ? [
              worst ? `Dedica tiempo adicional a ejercicios de ${worst.competency} para mejorar desde tu ${Number(worst.percentage).toFixed(1)}% actual` : 'Continúa con tu plan de estudio actual',
              passed ? `Considera avanzar al siguiente nivel para seguir desarrollando tus habilidades` : `Repasa los temas del nivel ${level} antes de reintentar la evaluación`,
              'Practica regularmente con materiales del nivel para mantener y mejorar tu rendimiento'
            ]
          : [
              worst ? `Dedicate extra time to ${worst.competency} to improve from your current ${Number(worst.percentage).toFixed(1)}%` : 'Continue with your current study plan',
              passed ? `Consider advancing to the next level` : `Review ${level} level topics before retaking the assessment`,
              'Practice regularly with level-appropriate materials'
            ],
        trends: isSpanish
          ? [
              best && worst && best !== worst
                ? `Hay una diferencia de ${(Number(best.percentage) - Number(worst.percentage)).toFixed(1)}% entre tu competencia más fuerte y la más débil`
                : 'Tu rendimiento es uniforme entre las competencias',
              passed ? `Tu resultado confirma que estás listo para el nivel siguiente` : `Tu resultado indica que necesitas consolidar el nivel ${level}`
            ]
          : ['Your competency performance shows variation worth addressing', passed ? `Your result confirms readiness for the next level` : `Your result indicates you need to consolidate ${level} level`],
        concerns: passed
          ? []
          : isSpanish
            ? [
                worst ? `Tu competencia de ${worst.competency} (${Number(worst.percentage).toFixed(1)}%) requiere atención prioritaria` : 'Necesitas refuerzo general en todas las competencias',
                `Te faltan ${margin}% para alcanzar el puntaje mínimo de aprobación`
              ]
            : [
                worst ? `Your ${worst.competency} (${Number(worst.percentage).toFixed(1)}%) needs priority attention` : 'You need general reinforcement across all competencies',
                `You need ${margin}% more to reach the minimum passing score`
              ],
        visualizationSuggestions: []
      };
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
