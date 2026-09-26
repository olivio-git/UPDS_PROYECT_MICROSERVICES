/**
 * Pure builders for the exam-result LLM interpretation (Groq prompt + the
 * deterministic fallback used when Groq is unavailable). No I/O, so they are
 * unit-tested directly (tests/llmExamResultPrompt.test.ts).
 *
 * The verdict is 3-state plus placement (spec: grading-pass-fail):
 * - `passed === true`  → passed
 * - `passed === false` → not passed
 * - `passed` null/undefined → pending review — NEVER presented as failed
 * - placement exams → no pass/fail verdict at all; the recommended level is
 *   shown instead.
 */
import type { DataInterpretation, InterpretationConfig } from './llm-interpretation.service';
import { DEFAULT_PASSING_SCORE, PLACEMENT_EXAM_TYPE } from '../utils/passFail';

export interface ExamResultPromptMessage {
  role: 'system' | 'user';
  content: string;
}

export const EXAM_VERDICT = {
  PASSED: 'passed',
  FAILED: 'failed',
  PENDING: 'pending',
  PLACEMENT: 'placement',
} as const;

export type ExamVerdict = (typeof EXAM_VERDICT)[keyof typeof EXAM_VERDICT];

interface ExamResultVerdictInput {
  passed?: boolean | null;
  examType?: string;
  recommendedLevel?: string | null;
}

/**
 * Maps a (PDF-shaped) result to its verdict; missing `passed` means pending.
 * A `recommendedLevel` alone also means placement (only placement results carry it).
 */
export function resolveExamVerdict(result?: ExamResultVerdictInput | null): ExamVerdict {
  if (result?.examType === PLACEMENT_EXAM_TYPE || result?.recommendedLevel) return EXAM_VERDICT.PLACEMENT;
  if (result?.passed === true) return EXAM_VERDICT.PASSED;
  if (result?.passed === false) return EXAM_VERDICT.FAILED;
  return EXAM_VERDICT.PENDING;
}

function resolvePromptPassingScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_PASSING_SCORE;
}

function buildStatusLine(verdict: ExamVerdict, margin: string, recommendedLevel: string, isSpanish: boolean): string {
  switch (verdict) {
    case EXAM_VERDICT.PASSED:
      return isSpanish ? `APROBADO — superó el mínimo por ${margin}%` : `PASSED — exceeded minimum by ${margin}%`;
    case EXAM_VERDICT.FAILED:
      return isSpanish ? `NO APROBADO — le faltaron ${margin}% para alcanzar el mínimo` : `DID NOT PASS — ${margin}% below minimum`;
    case EXAM_VERDICT.PLACEMENT:
      return isSpanish
        ? `EXAMEN DE UBICACIÓN — sin veredicto de aprobación. Nivel recomendado: ${recommendedLevel || 'por determinar'}`
        : `PLACEMENT EXAM — no pass/fail verdict. Recommended level: ${recommendedLevel || 'to be determined'}`;
    default:
      return isSpanish ? 'EN REVISIÓN — aún sin veredicto final' : 'UNDER REVIEW — no final verdict yet';
  }
}

function buildVerdictInstructions(verdict: ExamVerdict, isSpanish: boolean): string {
  if (isSpanish) {
    switch (verdict) {
      case EXAM_VERDICT.PLACEMENT:
        return `- Es un examen de UBICACIÓN: NO digas que aprobó ni que reprobó. Explica el nivel recomendado y qué significa para su plan de estudio.`;
      case EXAM_VERDICT.PENDING:
        return `- El resultado está EN REVISIÓN: NO digas que aprobó ni que reprobó. Indica que el veredicto final llegará cuando termine la revisión y comenta el desempeño observado hasta ahora.`;
      default:
        return `- Si aprobó: resalta sus logros en segunda persona, la competencia más fuerte, y cómo puede seguir creciendo.
- Si no aprobó: sé alentador en segunda persona, señala qué necesita trabajar y qué puede hacer concreto.`;
    }
  }
  switch (verdict) {
    case EXAM_VERDICT.PLACEMENT:
      return `- This is a PLACEMENT exam: do NOT say the student passed or failed. Explain the recommended level and what it means for their study plan.`;
    case EXAM_VERDICT.PENDING:
      return `- The result is UNDER REVIEW: do NOT say the student passed or failed. State that the final verdict will come once the review is finished.`;
    default:
      return '';
  }
}

function buildConcernsTemplate(verdict: ExamVerdict, isSpanish: boolean): string {
  // Only a real "not passed" verdict produces failure concerns.
  if (verdict !== EXAM_VERDICT.FAILED) return '[]';
  return isSpanish
    ? `["Competencia específica que impidió la aprobación y requiere atención prioritaria", "Brecha concreta entre el puntaje obtenido y el mínimo requerido"]`
    : '["Specific competency that prevented passing", "Gap between achieved score and minimum required"]';
}

function buildSummaryTemplate(verdict: ExamVerdict, who: string, isSpanish: boolean): string {
  if (isSpanish) {
    switch (verdict) {
      case EXAM_VERDICT.PLACEMENT:
        return `2-3 oraciones describiendo el desempeño general de ${who}. Incluye el puntaje obtenido, el nivel recomendado y la competencia más destacada.`;
      case EXAM_VERDICT.PENDING:
        return `2-3 oraciones describiendo el desempeño general de ${who}. Incluye el puntaje obtenido, que el resultado está en revisión, y la competencia más destacada.`;
      default:
        return `2-3 oraciones describiendo el desempeño general de ${who}. Incluye el puntaje obtenido, si aprobó, y la competencia más destacada.`;
    }
  }
  switch (verdict) {
    case EXAM_VERDICT.PLACEMENT:
      return `2-3 sentences describing ${who}'s overall performance. Include score, recommended level, and top competency.`;
    case EXAM_VERDICT.PENDING:
      return `2-3 sentences describing ${who}'s overall performance. Include score, that the result is under review, and top competency.`;
    default:
      return `2-3 sentences describing ${who}'s overall performance. Include score, pass/fail status, and top competency.`;
  }
}

/** Builds the Groq system+user messages for an exam result (PDF-shaped `data`). */
export function buildExamResultMessages(data: any, config: InterpretationConfig): ExamResultPromptMessage[] {
  const isSpanish = config.language === 'spanish';

  const firstName = data.student?.firstName || '';
  const lastName  = data.student?.lastName  || '';
  const studentName = `${firstName} ${lastName}`.trim() || (isSpanish ? 'el estudiante' : 'the student');

  const verdict          = resolveExamVerdict(data.result);
  const percentage       = data.result?.percentage       ?? 0;
  const examTitle        = data.result?.examTitle        ?? '';
  const level            = data.result?.level            ?? '';
  const recommendedLevel = data.result?.recommendedLevel ?? '';
  const passingScore     = resolvePromptPassingScore(data.result?.passingScore);
  const duration         = data.result?.duration         ?? 0;
  const feedback         = data.result?.feedback         ?? '';

  const competencies: string = (data.competencyScores ?? [])
    .map((c: any) => `  • ${c.competency}: ${Number(c.percentage ?? 0).toFixed(1)}% (${c.score}/${c.maxScore} pts)`)
    .join('\n') || (isSpanish ? '  (sin desglose por competencia)' : '  (no competency breakdown)');

  const margin = Math.abs(percentage - passingScore).toFixed(1);
  const statusLine = buildStatusLine(verdict, margin, recommendedLevel, isSpanish);
  const isPlacement = verdict === EXAM_VERDICT.PLACEMENT;
  // The minimum line only accompanies a final verdict: placement exams have no
  // threshold, and pending results must not be framed against one yet.
  const showMinLine = verdict === EXAM_VERDICT.PASSED || verdict === EXAM_VERDICT.FAILED;
  const minLineEs = showMinLine ? `\n  Mínimo req.: ${passingScore}%` : '';
  const minLineEn = showMinLine ? `\n  Min score: ${passingScore}%` : '';
  const who = firstName || studentName;

  const system = isSpanish
    ? `Eres un evaluador académico del Centro Boliviano Americano (CBA), institución de enseñanza de inglés en Bolivia. Tu misión es generar retroalimentación académica directamente dirigida AL estudiante, usando segunda persona (tú/tu). NUNCA hables del estudiante en tercera persona. Escribe como si le estuvieras hablando directamente: "obtuviste", "tu fortaleza es", "te recomendamos", "puedes mejorar". Usa su nombre solo al inicio del resumen como saludo. Responde únicamente con JSON válido con las claves exactas indicadas.`
    : `You are an academic evaluator at an English language institute. Write ALL feedback directly TO the student using second person (you/your). NEVER refer to the student in third person. Write as if speaking directly to them: "you scored", "your strength is", "we recommend you". Use their name only at the start of the summary as a greeting. Respond only with valid JSON using the exact keys indicated.`;

  const verdictInstructions = buildVerdictInstructions(verdict, isSpanish);

  const user = isSpanish ? `
Genera retroalimentación académica personalizada para este resultado de examen.

DATOS DEL EXAMEN:
  Estudiante:  ${studentName}
  Examen:      ${examTitle}${level ? ` — Nivel ${level}` : ''}
  Puntaje:     ${percentage.toFixed(1)}%
  Estado:      ${statusLine}${minLineEs}
  Duración:    ${duration} minutos

RENDIMIENTO POR COMPETENCIAS:
${competencies}

${feedback ? `RETROALIMENTACIÓN PREVIA DEL SISTEMA:\n  "${feedback}"\n` : ''}

INSTRUCCIONES CRÍTICAS:
- Habla DIRECTAMENTE al estudiante en segunda persona: "obtuviste", "tu resultado", "puedes", "te recomendamos". NUNCA en tercera persona.
- Usa su nombre (${firstName || 'el estudiante'}) solo al inicio del resumen como saludo, después usa "tú/tu".
- Usa los porcentajes y datos reales del examen, no inventes cifras.
${verdictInstructions}
- Las recomendaciones deben ser accionables y específicas (ej: "practica comprensión auditiva con podcasts 20 min al día").
- No repitas la misma información en distintas secciones.

Responde con este JSON exacto:
{
  "summary": "${buildSummaryTemplate(verdict, who, true)}",
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
    "${isPlacement ? 'Implicación del nivel recomendado para tu plan de estudio' : 'Implicación del resultado para el avance al siguiente nivel'}"
  ],
  "concerns": ${buildConcernsTemplate(verdict, true)},
  "visualizationSuggestions": []
}` : `
Generate personalized academic feedback for this exam result.

EXAM DATA:
  Student:   ${studentName}
  Exam:      ${examTitle}${level ? ` — Level ${level}` : ''}
  Score:     ${percentage.toFixed(1)}%
  Status:    ${statusLine}${minLineEn}
  Duration:  ${duration} minutes

COMPETENCY BREAKDOWN:
${competencies}

${feedback ? `EXISTING SYSTEM FEEDBACK:\n  "${feedback}"\n` : ''}
${verdictInstructions ? `CRITICAL INSTRUCTIONS:\n${verdictInstructions}\n` : ''}
Respond with this exact JSON:
{
  "summary": "${buildSummaryTemplate(verdict, who, false)}",
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
    "${isPlacement ? 'Implication of the recommended level for the study plan' : 'Implication of this result for advancing to the next level'}"
  ],
  "concerns": ${buildConcernsTemplate(verdict, false)},
  "visualizationSuggestions": []
}`;

  return [
    { role: 'system', content: system },
    { role: 'user',   content: user   }
  ];
}

/**
 * Deterministic interpretation used when Groq fails. Same 3-state + placement
 * rules as the prompt: pending/placement never produce failure concerns or
 * "not passed" wording.
 */
export function buildExamResultFallback(data: any, config: InterpretationConfig): DataInterpretation {
  const isSpanish = config.language === 'spanish';

  const verdict          = resolveExamVerdict(data?.result);
  const passed           = verdict === EXAM_VERDICT.PASSED;
  const failed           = verdict === EXAM_VERDICT.FAILED;
  const isPlacement      = verdict === EXAM_VERDICT.PLACEMENT;
  const percentage       = Number(data?.result?.percentage ?? 0);
  const level            = data?.result?.level ?? '';
  const recommendedLevel = data?.result?.recommendedLevel ?? '';
  const passingScore     = resolvePromptPassingScore(data?.result?.passingScore);
  const firstName        = data?.student?.firstName ?? '';
  const name             = `${firstName} ${data?.student?.lastName ?? ''}`.trim() || (isSpanish ? 'El estudiante' : 'The student');

  const sorted = [...(data?.competencyScores ?? [])].sort((a: any, b: any) => b.percentage - a.percentage);
  const best   = sorted[0];
  const worst  = sorted[sorted.length - 1];
  const margin = Math.abs(percentage - passingScore).toFixed(1);

  const verdictSentenceEs = passed
    ? `¡Aprobaste superando el mínimo por ${margin}%!`
    : failed
      ? `No alcanzaste el mínimo requerido (${passingScore}%), te faltaron ${margin}%.`
      : isPlacement
        ? `Tu nivel recomendado es ${recommendedLevel || 'por determinar'}.`
        : 'Tu resultado está en revisión; recibirás el veredicto final cuando termine.';
  const verdictSentenceEn = passed
    ? `You passed, exceeding the minimum by ${margin}%!`
    : failed
      ? `You did not meet the required minimum (${passingScore}%), missing by ${margin}%.`
      : isPlacement
        ? `Your recommended level is ${recommendedLevel || 'to be determined'}.`
        : 'Your result is under review; you will receive the final verdict once it is finished.';

  const examLabelEs = isPlacement ? 'el examen de ubicación' : `el examen de nivel ${level}`;
  const examLabelEn = isPlacement ? 'the placement exam' : `the ${level} level exam`;

  const outlookInsightEs = passed
    ? `Tu rendimiento muestra dominio del nivel ${level}`
    : failed
      ? 'Necesitas refuerzo en las competencias evaluadas antes de tu próxima evaluación'
      : isPlacement
        ? `Tu desempeño te ubica en el nivel ${recommendedLevel || 'por determinar'}`
        : 'Tu desempeño hasta ahora se confirmará al concluir la revisión';
  const outlookInsightEn = passed
    ? `Your performance shows mastery of ${level} level`
    : failed
      ? 'You need reinforcement before your next evaluation'
      : isPlacement
        ? `Your performance places you at level ${recommendedLevel || 'to be determined'}`
        : 'Your performance so far will be confirmed once the review is finished';

  const nextStepEs = passed
    ? 'Considera avanzar al siguiente nivel para seguir desarrollando tus habilidades'
    : failed
      ? `Repasa los temas del nivel ${level} antes de reintentar la evaluación`
      : isPlacement
        ? `Inscríbete en el nivel ${recommendedLevel || 'recomendado'} y refuerza sus contenidos desde el inicio`
        : 'Mientras se completa la revisión, sigue practicando las competencias evaluadas';
  const nextStepEn = passed
    ? 'Consider advancing to the next level'
    : failed
      ? `Review ${level} level topics before retaking the assessment`
      : isPlacement
        ? `Enroll in level ${recommendedLevel || 'recommended'} and reinforce its content from the start`
        : 'While the review is completed, keep practicing the assessed competencies';

  const trendEs = passed
    ? 'Tu resultado confirma que estás listo para el nivel siguiente'
    : failed
      ? `Tu resultado indica que necesitas consolidar el nivel ${level}`
      : isPlacement
        ? `Tu resultado sugiere comenzar en el nivel ${recommendedLevel || 'recomendado'}`
        : 'La tendencia se confirmará con el veredicto final';
  const trendEn = passed
    ? 'Your result confirms readiness for the next level'
    : failed
      ? `Your result indicates you need to consolidate ${level} level`
      : isPlacement
        ? `Your result suggests starting at level ${recommendedLevel || 'recommended'}`
        : 'The trend will be confirmed with the final verdict';

  return {
    summary: isSpanish
      ? `${name}, obtuviste un ${percentage.toFixed(1)}% en ${examLabelEs}. ${verdictSentenceEs}${best ? ` Tu competencia más fuerte fue ${best.competency} con ${Number(best.percentage).toFixed(1)}%.` : ''}`
      : `${name}, you scored ${percentage.toFixed(1)}% on ${examLabelEn}. ${verdictSentenceEn}`,
    keyInsights: [
      best  ? (isSpanish ? `Tu mejor rendimiento fue en ${best.competency} con ${Number(best.percentage).toFixed(1)}%` : `Your best performance was in ${best.competency} at ${Number(best.percentage).toFixed(1)}%`) : '',
      worst && worst !== best ? (isSpanish ? `Tu área a reforzar es ${worst.competency} con ${Number(worst.percentage).toFixed(1)}%` : `Your area to strengthen is ${worst.competency} at ${Number(worst.percentage).toFixed(1)}%`) : '',
      isSpanish ? outlookInsightEs : outlookInsightEn
    ].filter(Boolean),
    recommendations: isSpanish
      ? [
          worst ? `Dedica tiempo adicional a ejercicios de ${worst.competency} para mejorar desde tu ${Number(worst.percentage).toFixed(1)}% actual` : 'Continúa con tu plan de estudio actual',
          nextStepEs,
          'Practica regularmente con materiales del nivel para mantener y mejorar tu rendimiento'
        ]
      : [
          worst ? `Dedicate extra time to ${worst.competency} to improve from your current ${Number(worst.percentage).toFixed(1)}%` : 'Continue with your current study plan',
          nextStepEn,
          'Practice regularly with level-appropriate materials'
        ],
    trends: isSpanish
      ? [
          best && worst && best !== worst
            ? `Hay una diferencia de ${(Number(best.percentage) - Number(worst.percentage)).toFixed(1)}% entre tu competencia más fuerte y la más débil`
            : 'Tu rendimiento es uniforme entre las competencias',
          trendEs
        ]
      : ['Your competency performance shows variation worth addressing', trendEn],
    // Failure concerns only for a real "not passed" verdict — never for
    // pending review or placement.
    concerns: !failed
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
