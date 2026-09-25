/**
 * Exam-result LLM interpretation: the Groq prompt and the deterministic
 * fallback must treat `passed` as 3-state (true / false / pending) and give
 * placement exams no pass/fail verdict. Pending must never read as failed.
 */

import {
  buildExamResultFallback,
  buildExamResultMessages,
  EXAM_VERDICT,
  resolveExamVerdict,
} from '../src/services/llm-exam-result.prompt';
import type { InterpretationConfig } from '../src/services/llm-interpretation.service';

const ES: InterpretationConfig = { language: 'spanish', depth: 'detailed', focus: 'academic' };
const EN: InterpretationConfig = { language: 'english', depth: 'detailed', focus: 'academic' };

function buildData(result: Record<string, unknown>) {
  return {
    student: { firstName: 'Ana', lastName: 'Pérez' },
    result: {
      examTitle: 'Final B1',
      level: 'B1',
      percentage: 64,
      passingScore: 70,
      duration: 45,
      ...result,
    },
    competencyScores: [
      { competency: 'listening', percentage: 80, score: 8, maxScore: 10 },
      { competency: 'writing', percentage: 48, score: 4.8, maxScore: 10 },
    ],
  };
}

function userPrompt(data: unknown, config = ES): string {
  const messages = buildExamResultMessages(data, config);
  return messages.find(m => m.role === 'user')!.content;
}

describe('resolveExamVerdict', () => {
  it('maps passed true/false/null/undefined and placement', () => {
    expect(resolveExamVerdict({ passed: true })).toBe(EXAM_VERDICT.PASSED);
    expect(resolveExamVerdict({ passed: false })).toBe(EXAM_VERDICT.FAILED);
    expect(resolveExamVerdict({ passed: null })).toBe(EXAM_VERDICT.PENDING);
    expect(resolveExamVerdict({})).toBe(EXAM_VERDICT.PENDING);
    expect(resolveExamVerdict(undefined)).toBe(EXAM_VERDICT.PENDING);
    expect(resolveExamVerdict({ passed: false, examType: 'placement' })).toBe(EXAM_VERDICT.PLACEMENT);
  });
});

describe('buildExamResultMessages', () => {
  it('passed=true → APROBADO status and no failure concerns', () => {
    const prompt = userPrompt(buildData({ passed: true, percentage: 82 }));
    expect(prompt).toContain('Estado:      APROBADO — superó el mínimo por 12.0%');
    expect(prompt).toContain('"concerns": []');
  });

  it('passed=false → NO APROBADO status and failure concerns', () => {
    const prompt = userPrompt(buildData({ passed: false }));
    expect(prompt).toContain('NO APROBADO — le faltaron 6.0% para alcanzar el mínimo');
    expect(prompt).toContain('impidió la aprobación');
  });

  it('passed=null (pending review) → EN REVISIÓN, never NO APROBADO, no failure concerns', () => {
    const prompt = userPrompt(buildData({ passed: null }));
    expect(prompt).toContain('EN REVISIÓN — aún sin veredicto final');
    expect(prompt).not.toContain('NO APROBADO');
    expect(prompt).not.toContain('impidió la aprobación');
    expect(prompt).toContain('"concerns": []');
    expect(prompt).toContain('NO digas que aprobó ni que reprobó');
    expect(prompt).not.toContain('Mínimo req.');
  });

  it('pending in English → UNDER REVIEW, never DID NOT PASS', () => {
    const prompt = userPrompt(buildData({ passed: undefined }), EN);
    expect(prompt).toContain('UNDER REVIEW — no final verdict yet');
    expect(prompt).not.toContain('DID NOT PASS');
    expect(prompt).toContain('"concerns": []');
    expect(prompt).not.toContain('Min score');
  });

  it('placement → recommended level, no verdict, no minimum score line', () => {
    const prompt = userPrompt(buildData({ examType: 'placement', recommendedLevel: 'B2', passed: null, passingScore: null }));
    expect(prompt).toContain('Nivel recomendado: B2');
    expect(prompt).not.toContain('NO APROBADO');
    expect(prompt).not.toMatch(/Estado:\s+APROBADO/);
    expect(prompt).not.toContain('Mínimo req.');
    expect(prompt).toContain('"concerns": []');
  });

  it('keeps the minimum line for passed/failed verdicts', () => {
    expect(userPrompt(buildData({ passed: true }))).toContain('Mínimo req.: 70%');
    expect(userPrompt(buildData({ passed: false }))).toContain('Mínimo req.: 70%');
  });

  it('treats a recommendedLevel without examType as placement (W2)', () => {
    expect(resolveExamVerdict({ recommendedLevel: 'B1', passed: false })).toBe(EXAM_VERDICT.PLACEMENT);
  });

  it('uses the documented default when passingScore is missing', () => {
    const prompt = userPrompt(buildData({ passed: false, passingScore: undefined }));
    expect(prompt).toContain('Mínimo req.: 70%');
  });
});

describe('buildExamResultFallback', () => {
  it('passed=true → congratulates, no concerns', () => {
    const out = buildExamResultFallback(buildData({ passed: true, percentage: 82 }), ES);
    expect(out.summary).toContain('¡Aprobaste superando el mínimo por 12.0%!');
    expect(out.concerns).toEqual([]);
  });

  it('passed=false → not-passed wording and failure concerns', () => {
    const out = buildExamResultFallback(buildData({ passed: false }), ES);
    expect(out.summary).toContain('No alcanzaste el mínimo requerido (70%)');
    expect(out.concerns).toHaveLength(2);
    expect(out.recommendations.join(' ')).toContain('antes de reintentar la evaluación');
  });

  it('passed=null → pending wording, neutral recommendations, no concerns', () => {
    const out = buildExamResultFallback(buildData({ passed: null }), ES);
    const text = [out.summary, ...out.keyInsights, ...out.recommendations, ...out.trends].join(' ');
    expect(out.summary).toContain('Tu resultado está en revisión');
    expect(text).not.toContain('No alcanzaste');
    expect(text).not.toContain('reintentar');
    expect(text).not.toContain('Aprobaste');
    expect(out.concerns).toEqual([]);
  });

  it('placement → recommended level, no pass/fail wording, no concerns', () => {
    const out = buildExamResultFallback(
      buildData({ examType: 'placement', recommendedLevel: 'A2', passed: null, passingScore: null }),
      EN
    );
    const text = [out.summary, ...out.keyInsights, ...out.recommendations, ...out.trends].join(' ');
    expect(out.summary).toContain('Your recommended level is A2.');
    expect(text).not.toMatch(/passed|did not meet/i);
    expect(out.concerns).toEqual([]);
  });
});
