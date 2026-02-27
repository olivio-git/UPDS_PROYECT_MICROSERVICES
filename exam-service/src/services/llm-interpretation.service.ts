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

export class LLMInterpretationService {
  private ollamaUrl: string;
  private model: string;
  private timeout: number;

  constructor() {
    // Using the same Ollama configuration as AI-grading service
    this.ollamaUrl = process.env.OLLAMA_URL || 'https://ollama-354865198391.us-central1.run.app';
    this.model = process.env.OLLAMA_MODEL || 'qwen2.5:3b-instruct';
    this.timeout = parseInt(process.env.LLM_TIMEOUT || '60') * 1000;
  }

  /**
   * Interpreta datos de competencias para generar insights
   */
  async interpretCompetencyData(data: any, config: InterpretationConfig = {
    language: 'spanish',
    depth: 'detailed',
    focus: 'academic'
  }): Promise<DataInterpretation> {
    const prompt = this.buildCompetencyPrompt(data, config);
    return await this.processWithLLM(prompt, config);
  }

  /**
   * Interpreta estadísticas de estudiantes
   */
  async interpretStudentStats(data: any, config: InterpretationConfig = {
    language: 'spanish',
    depth: 'detailed',
    focus: 'academic'
  }): Promise<DataInterpretation> {
    const prompt = this.buildStudentStatsPrompt(data, config);
    return await this.processWithLLM(prompt, config);
  }

  /**
   * Interpreta datos de próximas sesiones
   */
  async interpretUpcomingSessions(data: any, config: InterpretationConfig = {
    language: 'spanish',
    depth: 'detailed',
    focus: 'administrative'
  }): Promise<DataInterpretation> {
    const prompt = this.buildUpcomingSessionsPrompt(data, config);
    return await this.processWithLLM(prompt, config);
  }

  /**
   * Interpreta historial de estudiante individual
   */
  async interpretStudentHistory(data: any, config: InterpretationConfig = {
    language: 'spanish',
    depth: 'detailed',
    focus: 'academic'
  }): Promise<DataInterpretation> {
    const prompt = this.buildStudentHistoryPrompt(data, config);
    return await this.processWithLLM(prompt, config);
  }

  /**
   * Interpreta resultado individual de examen
   */
  async interpretExamResult(data: any, config: InterpretationConfig = {
    language: 'spanish',
    depth: 'detailed',
    focus: 'academic'
  }): Promise<DataInterpretation> {
    const prompt = this.buildExamResultPrompt(data, config);
    return await this.processWithLLM(prompt, config);
  }

  /**
   * Construye prompt para análisis de competencias
   */
  private buildCompetencyPrompt(data: any, config: InterpretationConfig): string {
    const language = config.language === 'spanish' ? 'español' : 'English';
    const depthInstructions = config.depth === 'detailed'
      ? 'Proporciona un análisis detallado y exhaustivo'
      : 'Proporciona un análisis conciso y directo';

    return `Actúa como un experto analista educativo. Analiza los siguientes datos de competencias académicas y proporciona insights valiosos en ${language}.

${depthInstructions}.

DATOS DE COMPETENCIAS:
${JSON.stringify(data, null, 2)}

Proporciona tu análisis en el siguiente formato JSON:
{
  "summary": "Resumen ejecutivo de los hallazgos principales",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"],
  "trends": ["Tendencia 1", "Tendencia 2"],
  "concerns": ["Preocupación 1", "Preocupación 2"],
  "visualizationSuggestions": ["Sugerencia visual 1", "Sugerencia visual 2"]
}

Enfócate en:
- Rendimiento por competencias
- Identificación de fortalezas y debilidades
- Patrones de dificultad
- Recomendaciones pedagógicas
- Áreas de mejora prioritarias`;
  }

  /**
   * Construye prompt para estadísticas de estudiantes
   */
  private buildStudentStatsPrompt(data: any, config: InterpretationConfig): string {
    const language = config.language === 'spanish' ? 'español' : 'English';
    const depthInstructions = config.depth === 'detailed'
      ? 'Proporciona un análisis detallado y exhaustivo'
      : 'Proporciona un análisis conciso y directo';

    return `Actúa como un experto analista educativo. Analiza las siguientes estadísticas de estudiantes y proporciona insights valiosos en ${language}.

${depthInstructions}.

ESTADÍSTICAS DE ESTUDIANTES:
${JSON.stringify(data, null, 2)}

Proporciona tu análisis en el siguiente formato JSON:
{
  "summary": "Resumen ejecutivo del rendimiento estudiantil",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"],
  "trends": ["Tendencia 1", "Tendencia 2"],
  "concerns": ["Preocupación 1", "Preocupación 2"],
  "visualizationSuggestions": ["Sugerencia visual 1", "Sugerencia visual 2"]
}

Enfócate en:
- Distribución de rendimiento
- Análisis de progresión
- Identificación de estudiantes en riesgo
- Patrones de tiempo y eficiencia
- Recomendaciones de intervención`;
  }

  /**
   * Construye prompt para próximas sesiones
   */
  private buildUpcomingSessionsPrompt(data: any, config: InterpretationConfig): string {
    const language = config.language === 'spanish' ? 'español' : 'English';
    const depthInstructions = config.depth === 'detailed'
      ? 'Proporciona un análisis detallado y exhaustivo'
      : 'Proporciona un análisis conciso y directo';

    return `Actúa como un experto en gestión académica. Analiza los siguientes datos de próximas sesiones de examen y proporciona insights valiosos en ${language}.

${depthInstructions}.

DATOS DE PRÓXIMAS SESIONES:
${JSON.stringify(data, null, 2)}

Proporciona tu análisis en el siguiente formato JSON:
{
  "summary": "Resumen ejecutivo de la planificación de sesiones",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"],
  "trends": ["Tendencia 1", "Tendencia 2"],
  "concerns": ["Preocupación 1", "Preocupación 2"],
  "visualizationSuggestions": ["Sugerencia visual 1", "Sugerencia visual 2"]
}

Enfócate en:
- Utilización de capacidad
- Distribución de carga de trabajo
- Planificación de recursos
- Identificación de cuellos de botella
- Optimización de horarios`;
  }

  /**
   * Construye prompt para historial de estudiante
   */
  private buildStudentHistoryPrompt(data: any, config: InterpretationConfig): string {
    const language = config.language === 'spanish' ? 'español' : 'English';
    const depthInstructions = config.depth === 'detailed'
      ? 'Proporciona un análisis detallado y exhaustivo'
      : 'Proporciona un análisis conciso y directo';

    return `Actúa como un consejero académico experto. Analiza el siguiente historial académico de un estudiante y proporciona insights personalizados en ${language}.

${depthInstructions}.

HISTORIAL DEL ESTUDIANTE:
${JSON.stringify(data, null, 2)}

Proporciona tu análisis en el siguiente formato JSON:
{
  "summary": "Resumen del progreso académico del estudiante",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"],
  "trends": ["Tendencia 1", "Tendencia 2"],
  "concerns": ["Preocupación 1", "Preocupación 2"],
  "visualizationSuggestions": ["Sugerencia visual 1", "Sugerencia visual 2"]
}

Enfócate en:
- Evolución del rendimiento
- Fortalezas y debilidades por competencia
- Patrones de progreso
- Recomendaciones personalizadas
- Estrategias de mejora`;
  }

  /**
   * Construye prompt para resultado individual de examen
   */
  private buildExamResultPrompt(data: any, config: InterpretationConfig): string {
    const language = config.language === 'spanish' ? 'español' : 'English';
    const depthInstructions = config.depth === 'detailed'
      ? 'Proporciona un análisis detallado y exhaustivo'
      : 'Proporciona un análisis conciso y directo';

    return `Actúa como un tutor académico experto y consejero educativo. Analiza ESPECÍFICAMENTE los resultados de examen de este estudiante y proporciona feedback personalizado basado en su desempeño real en ${language}.

${depthInstructions}.

DATOS ESPECÍFICOS DEL ESTUDIANTE:
${JSON.stringify(data, null, 2)}

INSTRUCCIONES DE ANÁLISIS:
1. Revisa el puntaje total obtenido (result.percentage) y compáralo con el puntaje de aprobación
2. Analiza el rendimiento por cada competencia (competencyScores) - identifica fortalezas y debilidades
3. Si hay datos de preguntas individuales (questionResults), analiza patrones de aciertos/errores
4. Considera el tiempo utilizado vs tiempo permitido para evaluar eficiencia
5. Revisa cualquier feedback de IA ya existente (aiAnalysis) para complementar el análisis

Proporciona tu análisis en el siguiente formato JSON:
{
  "summary": "Resumen personalizado basado en el puntaje X% obtenido y el rendimiento específico por competencias",
  "keyInsights": ["Fortaleza específica: X competencia con Y%", "Debilidad identificada: Z competencia con W%", "Patrón observado en las respuestas"],
  "recommendations": ["Práctica específica para competencia débil", "Estrategia para mantener fortaleza", "Recurso concreto de estudio"],
  "trends": ["Competencia con mejor rendimiento: X", "Área que necesita más trabajo: Y"],
  "concerns": ["Competencia por debajo del 60%: especificar cuál", "Patrón de errores en tipo de pregunta específico"],
  "visualizationSuggestions": ["Gráfico de barras por competencia", "Comparación vs promedio de aprobación"]
}

ANALIZA ESPECÍFICAMENTE:
- ¿Qué competencias (Reading, Writing, Listening, Speaking) tuvieron mejor/peor rendimiento?
- ¿El estudiante aprobó o no? ¿Por cuánto margen?
- ¿Hay patrones en los tipos de preguntas que respondió bien/mal?
- ¿Qué estrategias específicas necesita para mejorar las áreas débiles?
- ¿Cómo puede mantener y potenciar sus fortalezas?

IMPORTANTE:
- Base TODO tu análisis en los datos numéricos específicos proporcionados
- Menciona porcentajes y competencias concretas
- Sé específico sobre QUÉ debe practicar y CÓMO
- Este feedback es personalizado para ESTE estudiante específico`;
  }

  /**
   * Procesa datos con el LLM y parsea la respuesta
   */
  private async processWithLLM(prompt: string, config: InterpretationConfig): Promise<DataInterpretation> {
    try {
      logger.info('Iniciando interpretación con LLM', {
        model: this.model,
        language: config.language,
        depth: config.depth
      });

      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Más determinístico para análisis
          top_p: 0.9,
          max_tokens: 2048
        }
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.response) {
        const interpretation = this.parseInterpretationResponse(response.data.response);
        logger.info('Interpretación completada exitosamente');
        return interpretation;
      } else {
        throw new Error('Respuesta inválida del LLM');
      }
    } catch (error) {
      // Fix circular structure error by only logging the error message and code
      const errorInfo = {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        status: (error as any)?.response?.status,
        statusText: (error as any)?.response?.statusText
      };
      logger.error('Error en interpretación LLM:', errorInfo);

      // Fallback: interpretación básica sin LLM
      return this.generateFallbackInterpretation(config);
    }
  }

  /**
   * Parsea la respuesta JSON del LLM
   */
  private parseInterpretationResponse(response: string): DataInterpretation {
    try {
      // Buscar JSON en la respuesta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validar estructura
        return {
          summary: parsed.summary || 'Análisis completado',
          keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          trends: Array.isArray(parsed.trends) ? parsed.trends : [],
          concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
          visualizationSuggestions: Array.isArray(parsed.visualizationSuggestions) ? parsed.visualizationSuggestions : []
        };
      } else {
        throw new Error('No se encontró JSON válido en la respuesta');
      }
    } catch (error) {
      logger.warn('Error parseando respuesta LLM, usando fallback:', error);

      // Fallback: extraer insights de texto libre
      return this.extractInsightsFromText(response);
    }
  }

  /**
   * Extrae insights del texto libre si falla el parseo JSON
   */
  private extractInsightsFromText(text: string): DataInterpretation {
    const lines = text.split('\n').filter(line => line.trim());

    return {
      summary: lines.length > 0 ? (lines[0] || 'Análisis completado') : 'Análisis completado',
      keyInsights: lines.slice(1, 4),
      recommendations: lines.slice(4, 7),
      trends: lines.slice(7, 9),
      concerns: lines.slice(9, 11),
      visualizationSuggestions: lines.slice(11, 13)
    };
  }

  /**
   * Genera interpretación básica cuando falla el LLM
   */
  private generateFallbackInterpretation(config: InterpretationConfig): DataInterpretation {
    const isSpanish = config.language === 'spanish';

    return {
      summary: isSpanish
        ? 'Análisis de datos completado. Los datos han sido procesados y están listos para revisión.'
        : 'Data analysis completed. The data has been processed and is ready for review.',
      keyInsights: isSpanish
        ? ['Datos procesados correctamente', 'Información disponible para análisis', 'Métricas calculadas']
        : ['Data processed successfully', 'Information available for analysis', 'Metrics calculated'],
      recommendations: isSpanish
        ? ['Revisar los resultados detalladamente', 'Considerar tendencias históricas', 'Implementar mejoras basadas en datos']
        : ['Review results in detail', 'Consider historical trends', 'Implement data-driven improvements'],
      trends: isSpanish
        ? ['Datos disponibles para análisis de tendencias', 'Patrones identificables en la información']
        : ['Data available for trend analysis', 'Identifiable patterns in the information'],
      concerns: isSpanish
        ? ['Revisar calidad de datos', 'Validar métricas importantes']
        : ['Review data quality', 'Validate important metrics'],
      visualizationSuggestions: isSpanish
        ? ['Incluir gráficos de tendencias', 'Agregar tablas comparativas']
        : ['Include trend charts', 'Add comparative tables']
    };
  }

  /**
   * Verifica si el servicio LLM está disponible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('LLM service no disponible:', error);
      return false;
    }
  }
}

export const llmInterpretationService = new LLMInterpretationService();