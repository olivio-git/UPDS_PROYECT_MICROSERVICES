import Groq from 'groq-sdk';
import { config } from '../config.js';
import type { IQuestion, AIGradeResult } from '../types/index.js';

let groqClient: Groq | null = null;

function getGroq(): Groq {
  if (!groqClient) {
    if (!config.groq.apiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }
    groqClient = new Groq({ apiKey: config.groq.apiKey });
  }
  return groqClient;
}

/**
 * Evaluate open-ended questions (essay, open_text) using GROQ AI.
 */
export async function evaluateWithGroq(
  question: IQuestion,
  response: any,
  maxScore?: number
): Promise<AIGradeResult> {
  const points = maxScore ?? question.metadata?.points ?? 10;
  const userText = extractUserText(response);

  if (!userText || userText.trim().length === 0) {
    return {
      score: 0,
      maxScore: points,
      feedback: 'No se proporcionó respuesta',
      criteria: {},
      suggestions: ['Debes proporcionar una respuesta para ser evaluado.'],
    };
  }

  const prompt = buildEvaluationPrompt(question, userText, points);

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        {
          role: 'system',
          content: `Eres un evaluador experto de examenes de idiomas (ingles) siguiendo el Marco Comun Europeo de Referencia (MCER).
Evaluas respuestas de estudiantes de forma justa y constructiva.
SIEMPRE respondes en formato JSON valido, sin texto adicional fuera del JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: config.groq.temperature,
      max_tokens: config.groq.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return fallbackResult(points, 'No se obtuvo respuesta del evaluador');
    }

    return parseGroqResponse(content, points);
  } catch (error: any) {
    const msg = error?.message || 'Error desconocido';
    return fallbackResult(points, `Error en evaluacion IA: ${msg}`);
  }
}

/**
 * Generate comprehensive feedback for a completed exam.
 */
export async function generateExamFeedback(
  examData: {
    examName: string;
    examLevel: string;
    competencyScores: Array<{ competency: string; percentage: number; totalScore: number; maxScore: number }>;
    totalPercentage: number;
    questionSummaries: Array<{ type: string; competency: string; score: number; maxScore: number; feedback?: string }>;
  },
  language: 'es' | 'en' = 'es'
): Promise<{ overallFeedback: string; recommendations: string[]; competencyFeedback: Record<string, string> }> {
  const lang = language === 'es' ? 'español' : 'English';

  const prompt = `Analiza los resultados de este examen de idiomas y genera feedback constructivo en ${lang}.

Examen: ${examData.examName} (Nivel ${examData.examLevel})
Puntaje total: ${examData.totalPercentage.toFixed(1)}%

Resultados por competencia:
${examData.competencyScores.map(c => `- ${c.competency}: ${c.totalScore}/${c.maxScore} (${c.percentage.toFixed(1)}%)`).join('\n')}

Resumen de preguntas:
${examData.questionSummaries.slice(0, 20).map(q => `- [${q.type}/${q.competency}] ${q.score}/${q.maxScore}${q.feedback ? ': ' + q.feedback : ''}`).join('\n')}

Responde SOLO en JSON con esta estructura:
{
  "overallFeedback": "Feedback general del examen (2-3 oraciones)",
  "recommendations": ["recomendacion 1", "recomendacion 2", "recomendacion 3"],
  "competencyFeedback": {
    "competency_name": "Feedback especifico para esa competencia"
  }
}`;

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        {
          role: 'system',
          content: `Eres un tutor de idiomas experto. Generas feedback educativo constructivo siguiendo el MCER. Respondes SOLO en JSON valido.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: config.groq.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { overallFeedback: 'No se pudo generar feedback', recommendations: [], competencyFeedback: {} };
    }

    const parsed = JSON.parse(content);
    return {
      overallFeedback: parsed.overallFeedback || '',
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      competencyFeedback: parsed.competencyFeedback || {},
    };
  } catch {
    return { overallFeedback: 'Error generando feedback', recommendations: [], competencyFeedback: {} };
  }
}

/**
 * Generate per-question AI feedback for auto-graded questions (batch call).
 */
export async function generatePerQuestionFeedback(
  questions: Array<{
    questionType: string;
    competency: string;
    level: string;
    questionText: string;
    score: number;
    maxScore: number;
    isCorrect?: boolean;
    autoFeedback?: string;
  }>
): Promise<Array<{ feedback: string; suggestions: string[] }>> {
  if (questions.length === 0) return [];

  const prompt = `Eres un tutor de idiomas (inglés) experto. Para cada pregunta de examen evaluada automáticamente, genera feedback educativo breve y constructivo en español.

Preguntas evaluadas:
${questions.map((q, i) => `${i + 1}. [${q.questionType}/${q.competency}/Nivel ${q.level}] Puntaje: ${q.score}/${q.maxScore} (${q.isCorrect ? 'Correcta' : 'Incorrecta'}). Feedback automático: "${q.autoFeedback || ''}". Texto de la pregunta: "${q.questionText.slice(0, 120)}"`).join('\n')}

Responde SOLO en JSON con esta estructura exacta:
{
  "results": [
    {
      "feedback": "Feedback educativo breve (1-2 oraciones) sobre la respuesta",
      "suggestions": ["Una sugerencia de mejora concreta"]
    }
  ]
}
El array "results" debe tener exactamente ${questions.length} elementos, uno por pregunta en el mismo orden.`;

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        {
          role: 'system',
          content: 'Eres un tutor de idiomas experto. Generas feedback educativo breve y constructivo. Respondes SOLO en JSON valido.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: Math.min(200 * questions.length, 4000),
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return questions.map(() => ({ feedback: '', suggestions: [] }));

    const parsed = JSON.parse(content);
    const results = Array.isArray(parsed.results) ? parsed.results : [];

    return questions.map((_, i) => ({
      feedback: results[i]?.feedback || '',
      suggestions: Array.isArray(results[i]?.suggestions) ? results[i].suggestions : [],
    }));
  } catch {
    return questions.map(() => ({ feedback: '', suggestions: [] }));
  }
}

function buildEvaluationPrompt(question: IQuestion, userText: string, maxScore: number): string {
  const parts: string[] = [];

  parts.push(`Tipo: ${question.type === 'essay' ? 'Ensayo/Essay' : 'Texto abierto'}`);
  parts.push(`Competencia: ${question.competency}`);
  parts.push(`Nivel MCER: ${question.level}`);
  parts.push(`Puntaje maximo: ${maxScore}`);
  parts.push(`\nPregunta: ${question.content.question}`);

  if (question.content.instructions) {
    parts.push(`Instrucciones: ${question.content.instructions}`);
  }
  if (question.content.context) {
    parts.push(`Contexto: ${question.content.context}`);
  }
  if (question.content.sampleAnswer) {
    parts.push(`Respuesta de referencia: ${question.content.sampleAnswer}`);
  }
  if (question.content.keywords?.length) {
    parts.push(`Palabras clave esperadas: ${question.content.keywords.join(', ')}`);
  }

  parts.push(`\nRespuesta del estudiante:\n"${userText}"`);

  parts.push(`\nEvalua la respuesta considerando:`);
  parts.push(`- Contenido y relevancia (responde a la pregunta?)`);
  parts.push(`- Gramatica y uso del lenguaje`);
  parts.push(`- Riqueza y corrección del vocabulario (usar vocabulario más avanzado que el nivel ${question.level} es positivo, no penaliza)`);
  parts.push(`- Coherencia y organizacion`);
  parts.push(`IMPORTANTE: si el estudiante usa vocabulario o estructuras más avanzadas que el nivel ${question.level}, esto indica un nivel más alto y debe valorarse positivamente, nunca reducir el puntaje.`);

  parts.push(`\nResponde SOLO en JSON con esta estructura exacta:`);
  parts.push(`{
  "score": <numero entre 0 y ${maxScore}>,
  "maxScore": ${maxScore},
  "feedback": "<feedback constructivo en 2-3 oraciones>",
  "criteria": {
    "content": <0-100>,
    "grammar": <0-100>,
    "vocabulary": <0-100>,
    "coherence": <0-100>
  },
  "suggestions": ["sugerencia 1", "sugerencia 2"]
}`);

  return parts.join('\n');
}

function extractUserText(response: any): string {
  if (typeof response === 'string') return response;
  return response?.text || response?.answer || response?.response?.text || response?.response?.answer || '';
}

function parseGroqResponse(content: string, maxScore: number): AIGradeResult {
  try {
    const parsed = JSON.parse(content);
    const score = Math.min(Math.max(0, Number(parsed.score) || 0), maxScore);

    return {
      score,
      maxScore,
      feedback: parsed.feedback || 'Sin feedback',
      criteria: parsed.criteria || {},
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return fallbackResult(maxScore, 'Error al procesar respuesta del evaluador');
  }
}

function fallbackResult(maxScore: number, feedback: string): AIGradeResult {
  return {
    score: 0,
    maxScore,
    feedback,
    criteria: {},
    suggestions: [],
  };
}
