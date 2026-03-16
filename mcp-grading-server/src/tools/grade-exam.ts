import { ObjectId } from 'mongodb';
import { getAttempts, getResponses, getQuestions, getExamResults, getExams, getCandidates } from '../db/collections.js';
import { autoGrade } from '../grading/auto-grader.js';
import { evaluateWithGroq, generateExamFeedback, generatePerQuestionFeedback } from '../grading/groq-evaluator.js';
import { evaluateAudio } from '../grading/audio-delegator.js';
import { sendGradingNotification } from '../services/notification.service.js';
import { AUTO_GRADABLE_TYPES, AI_GRADABLE_TYPES, AUDIO_TYPES } from '../types/index.js';
import type { IQuestionResult, ICompetencyScore, IExamResult, IGradingBreakdown, QuestionType } from '../types/index.js';
import type { GradeExamResponse } from '../schemas/grading.schemas.js';

class GradingError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function gradeExam(attemptId: string, options: { force?: boolean } = {}): Promise<GradeExamResponse> {
  // 1. Fetch attempt
  const attempt = await getAttempts().findOne({ _id: new ObjectId(attemptId) });
  if (!attempt) throw new GradingError(`Attempt ${attemptId} no encontrado`, 404);
  if (attempt.status !== 'completed') {
    throw new GradingError(`Attempt no esta completado (status: ${attempt.status})`);
  }

  // 1.5 Fetch candidate info for email notification (best-effort)
  let candidateEmail: string | undefined;
  let candidateFirstName: string | undefined;
  let candidateLastName: string | undefined;
  try {
    const candidate = await getCandidates().findOne({ _id: attempt.candidateId });
    if (candidate) {
      candidateEmail = (candidate as any).personalInfo?.email;
      candidateFirstName = (candidate as any).personalInfo?.firstName;
      candidateLastName = (candidate as any).personalInfo?.lastName;
    }
  } catch {
    // Candidate lookup is best-effort — never block grading
  }

  // 2. Check if already graded (skip if force=true to allow recalculation)
  const existingResult = await getExamResults().findOne({ attemptId: new ObjectId(attemptId) });
  if (!options.force && existingResult && existingResult.status === 'completed') {
    // Re-send notification for already-graded exams (at-least-once delivery via Kafka)
    sendGradingNotification({
      candidateEmail,
      candidateFirstName,
      candidateLastName,
      candidateId: attempt.candidateId.toString(),
      examName: existingResult.examName,
      examResultId: existingResult._id!.toString(),
      score: existingResult.totalScore,
      maxScore: existingResult.maxScore,
      percentage: existingResult.percentage,
      status: existingResult.status,
    }).catch(() => {});
    return {
      examResultId: existingResult._id!.toString(),
      examName: existingResult.examName,
      examLevel: existingResult.examLevel,
      status: 'completed',
      totalScore: existingResult.totalScore,
      maxScore: existingResult.maxScore,
      percentage: existingResult.percentage,
      questionsGraded: existingResult.questionResults.length,
      autoGraded: existingResult.questionResults.filter(qr => qr.evaluationMethod === 'automatic').length,
      aiGraded: existingResult.questionResults.filter(qr => qr.evaluationMethod === 'ai_grading').length,
      pendingManual: existingResult.questionResults.filter(qr => qr.evaluationMethod === 'manual').length,
      competencyScores: existingResult.competencyScores.map(c => ({
        competency: c.competency,
        score: `${c.totalScore}/${c.maxScore}`,
        percentage: c.percentage,
      })),
      sections: existingResult.sections?.map(s => ({
        name: s.name,
        competency: s.competency,
        score: `${s.score}/${s.maxScore}`,
        percentage: s.percentage,
      })),
      recommendedLevel: existingResult.recommendedLevel,
      placementMode: existingResult.placementMode,
      levelScores: existingResult.levelScores,
    };
  }

  // 3. Start timing
  const gradingStartedAt = new Date();
  const t0 = Date.now();
  let autoGradingMs = 0;
  let aiGradingMs = 0;
  let audioGradingMs = 0;

  // 4. Fetch exam info
  const exam = await getExams().findOne({ _id: attempt.examId });
  if (!exam) throw new GradingError(`Exam ${attempt.examId} no encontrado`, 404);

  // 4. Collect all question IDs from sections
  const allQuestionIds: ObjectId[] = [];
  if (attempt.sectionsStructure) {
    for (const section of attempt.sectionsStructure) {
      allQuestionIds.push(...section.questionIds);
    }
  } else if (attempt.questionIds) {
    allQuestionIds.push(...attempt.questionIds);
  }

  // 5. Fetch questions and responses
  const questions = await getQuestions().find({ _id: { $in: allQuestionIds } }).toArray();
  const responses = await getResponses().find({
    sessionId: attempt.sessionId,
    candidateId: attempt.candidateId,
    examId: attempt.examId,
  }).toArray();

  const questionMap = new Map(questions.map(q => [q._id.toString(), q]));
  // Build response lookup by questionId so unanswered questions can be detected in O(1)
  const responseMap = new Map(responses.map(r => [r.questionId.toString(), r]));

  // 6. Grade ALL questions in the attempt (including unanswered ones scored 0).
  // Iterating over `questions` instead of `responses` ensures the denominator
  // (maxScoreTotal) reflects the full exam weight, not just answered questions.
  const questionResults: IQuestionResult[] = [];

  for (const question of questions) {
    const qIdStr = question._id.toString();
    const resp = responseMap.get(qIdStr);
    const maxScore = question.metadata?.points ?? 1;
    const qType = question.type as QuestionType;

    // No response recorded → score 0 for this question
    if (!resp) {
      questionResults.push({
        questionId: question._id,
        questionType: question.type,
        competency: question.competency,
        response: null,
        isCorrect: false,
        score: 0,
        maxScore,
        feedback: 'Sin respuesta',
        evaluationMethod: 'automatic',
        evaluatedAt: new Date(),
      });
      continue;
    }

    // Prefer `answer` (Mixed type, preserves all fields like positions/blanks/pairs/order).
    // `response` uses a strict Mongoose schema that strips unknown fields.
    const answerData = resp.answer || resp.response || {};

    let result: IQuestionResult;

    if (AUTO_GRADABLE_TYPES.includes(qType)) {
      const tAuto = Date.now();
      const gradeResult = autoGrade(question, answerData, maxScore);
      autoGradingMs += Date.now() - tAuto;
      result = {
        questionId: resp.questionId,
        questionType: question.type,
        competency: question.competency,
        response: answerData,
        isCorrect: gradeResult.isCorrect,
        score: gradeResult.score,
        maxScore: gradeResult.maxScore,
        feedback: gradeResult.feedback,
        evaluationMethod: 'automatic',
        evaluatedAt: new Date(),
      };
    } else if (AI_GRADABLE_TYPES.includes(qType)) {
      const tAI = Date.now();
      const aiResult = await evaluateWithGroq(question, answerData, maxScore);
      aiGradingMs += Date.now() - tAI;
      result = {
        questionId: resp.questionId,
        questionType: question.type,
        competency: question.competency,
        response: answerData,
        score: aiResult.score,
        maxScore: aiResult.maxScore,
        feedback: aiResult.feedback,
        evaluationMethod: 'ai_grading',
        evaluatedAt: new Date(),
        aiAnalysis: {
          criteria: aiResult.criteria,
          // feedback omitted here — already stored in result.feedback to avoid duplication in UI
          feedback: '',
          suggestions: aiResult.suggestions,
        },
      };
    } else if (AUDIO_TYPES.includes(qType)) {
      const tAudio = Date.now();
      const audioResult = await evaluateAudio(question, answerData, maxScore);
      audioGradingMs += Date.now() - tAudio;
      result = {
        questionId: resp.questionId,
        questionType: question.type,
        competency: question.competency,
        response: answerData,
        score: audioResult.score,
        maxScore: audioResult.maxScore,
        feedback: audioResult.feedback,
        evaluationMethod: 'ai_grading',
        evaluatedAt: new Date(),
        aiAnalysis: {
          criteria: audioResult.criteria,
          // feedback omitted here — already stored in result.feedback to avoid duplication in UI
          feedback: '',
          suggestions: audioResult.suggestions,
        },
      };
    } else {
      result = {
        questionId: resp.questionId,
        questionType: question.type,
        competency: question.competency,
        response: answerData,
        score: 0,
        maxScore,
        feedback: 'Pendiente de revision manual',
        evaluationMethod: 'manual',
      };
    }

    questionResults.push(result);
  }

  // 6.5. Generate per-question AI feedback for auto-graded questions (best-effort batch call)
  const autoGradedIndices: number[] = [];
  const autoGradedInputs: Parameters<typeof generatePerQuestionFeedback>[0] = [];

  for (let i = 0; i < questionResults.length; i++) {
    const qr = questionResults[i]!;
    if (qr.evaluationMethod === 'automatic') {
      const q = questionMap.get(qr.questionId.toString());
      autoGradedIndices.push(i);
      autoGradedInputs.push({
        questionType: qr.questionType,
        competency: qr.competency,
        level: q?.level ?? 'B1',
        questionText: q?.content.question ?? '',
        score: qr.score,
        maxScore: qr.maxScore,
        isCorrect: qr.isCorrect,
        autoFeedback: qr.feedback,
      });
    }
  }

  const questionsMs = Date.now() - t0;

  let perQuestionFeedbackMs = 0;
  if (autoGradedInputs.length > 0) {
    const tPQF = Date.now();
    const perQuestionFeedbacks = await generatePerQuestionFeedback(autoGradedInputs).catch(() =>
      autoGradedInputs.map(() => ({ feedback: '', suggestions: [] }))
    );
    perQuestionFeedbackMs = Date.now() - tPQF;
    for (let k = 0; k < autoGradedIndices.length; k++) {
      const idx = autoGradedIndices[k]!;
      const fb = perQuestionFeedbacks[k];
      if (fb && (fb.feedback || fb.suggestions.length > 0)) {
        questionResults[idx]!.aiAnalysis = {
          criteria: {},
          feedback: fb.feedback,
          suggestions: fb.suggestions,
        };
      }
    }
  }

  // 7. Calculate competency scores
  const competencyMap = new Map<string, { total: number; max: number; count: number; auto: number; ai: number; pending: number }>();
  for (const qr of questionResults) {
    const c = competencyMap.get(qr.competency) || { total: 0, max: 0, count: 0, auto: 0, ai: 0, pending: 0 };
    c.total += qr.score;
    c.max += qr.maxScore;
    c.count++;
    if (qr.evaluationMethod === 'automatic') c.auto++;
    else if (qr.evaluationMethod === 'ai_grading') c.ai++;
    else c.pending++;
    competencyMap.set(qr.competency, c);
  }

  const competencyScores: ICompetencyScore[] = Array.from(competencyMap.entries()).map(([comp, data]) => ({
    competency: comp,
    totalScore: data.total,
    maxScore: data.max,
    percentage: data.max > 0 ? Math.round((data.total / data.max) * 100 * 10) / 10 : 0,
    questionCount: data.count,
    autoEvaluatedCount: data.auto,
    aiEvaluatedCount: data.ai,
    pendingEvaluationCount: data.pending,
  }));

  // 8. Calculate totals
  const totalScore = Math.round(questionResults.reduce((sum, qr) => sum + qr.score, 0) * 100) / 100;
  const maxScoreTotal = questionResults.reduce((sum, qr) => sum + qr.maxScore, 0);
  const percentage = maxScoreTotal > 0 ? Math.round((totalScore / maxScoreTotal) * 100 * 10) / 10 : 0;

  // 9. Calculate section scores
  const sections = attempt.sectionsStructure?.map(sec => {
    const sectionQIds = new Set(sec.questionIds.map(id => id.toString()));
    const sectionResults = questionResults.filter(qr => sectionQIds.has(qr.questionId.toString()));
    const secTotal = sectionResults.reduce((s, qr) => s + qr.score, 0);
    const secMax = sectionResults.reduce((s, qr) => s + qr.maxScore, 0);
    return {
      name: sec.name,
      competency: sec.competency,
      score: secTotal,
      maxScore: secMax,
      percentage: secMax > 0 ? Math.round((secTotal / secMax) * 100 * 10) / 10 : 0,
    };
  });

  // 9.5. Placement exam: compute levelScores and recommendedLevel
  const PLACEMENT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  let recommendedLevel: string | undefined;
  let placementMode: 'static' | 'adaptive' | undefined;
  let levelScores: Array<{ level: string; totalScore: number; maxScore: number; percentage: number; questionCount: number }> | undefined;

  if (exam.type === 'placement') {
    const levelPassingThreshold = exam.placementConfig?.levelPassingThreshold ?? 60;
    placementMode = exam.placementConfig?.mode ?? 'static';

    if (placementMode === 'adaptive' && attempt.adaptiveState?.levelHistory && attempt.adaptiveState.levelHistory.length > 0) {
      // Adaptive: build level scores from levelHistory stored in attempt
      const levelMap = new Map<string, { total: number; max: number; count: number }>();
      for (const entry of attempt.adaptiveState.levelHistory) {
        const ls = levelMap.get(entry.level) || { total: 0, max: 0, count: 0 };
        ls.total += entry.score;
        ls.max += entry.maxScore;
        ls.count++;
        levelMap.set(entry.level, ls);
      }
      levelScores = Array.from(levelMap.entries()).map(([level, data]) => ({
        level,
        totalScore: data.total,
        maxScore: data.max,
        percentage: data.max > 0 ? Math.round((data.total / data.max) * 100 * 10) / 10 : 0,
        questionCount: data.count,
      }));
    } else {
      // Static: group questionResults by question.level
      const levelMap = new Map<string, { total: number; max: number; count: number }>();
      for (const qr of questionResults) {
        const q = questionMap.get(qr.questionId.toString());
        const level = (q as any)?.level ?? 'A1';
        const ls = levelMap.get(level) || { total: 0, max: 0, count: 0 };
        ls.total += qr.score;
        ls.max += qr.maxScore;
        ls.count++;
        levelMap.set(level, ls);
      }
      levelScores = Array.from(levelMap.entries()).map(([level, data]) => ({
        level,
        totalScore: data.total,
        maxScore: data.max,
        percentage: data.max > 0 ? Math.round((data.total / data.max) * 100 * 10) / 10 : 0,
        questionCount: data.count,
      }));
    }

    // Determine recommended level: highest level where candidate passed threshold
    const passed = levelScores.filter(ls => ls.percentage >= levelPassingThreshold);
    passed.sort((a, b) => PLACEMENT_LEVELS.indexOf(b.level) - PLACEMENT_LEVELS.indexOf(a.level));
    recommendedLevel = passed[0]?.level ?? 'A1';
  }

  // 10. Determine status
  const hasPending = questionResults.some(qr => qr.evaluationMethod === 'manual' && qr.score === 0);
  const status = hasPending ? 'pending_ai_review' : 'completed';

  // 11. Calculate exam duration
  const examDuration = attempt.finishedAt && attempt.startedAt
    ? Math.round((new Date(attempt.finishedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000)
    : 0;

  // 11.5. Generate AI overall feedback (best-effort — never blocks completion)
  const tOverallFeedback = Date.now();
  const aiFeedback = await generateExamFeedback({
    examName: exam.name,
    examLevel: exam.targetLevel,
    competencyScores: competencyScores.map(c => ({
      competency: c.competency,
      percentage: c.percentage,
      totalScore: c.totalScore,
      maxScore: c.maxScore,
    })),
    totalPercentage: percentage,
    questionSummaries: questionResults.map(qr => ({
      type: qr.questionType,
      competency: qr.competency,
      score: qr.score,
      maxScore: qr.maxScore,
      feedback: qr.feedback,
    })),
  }).catch(() => ({ overallFeedback: '', recommendations: [], competencyFeedback: {} }));

  const overallFeedbackMs = Date.now() - tOverallFeedback;
  const gradingCompletedAt = new Date();
  const gradingDurationMs = Date.now() - t0;

  const gradingBreakdown: IGradingBreakdown = {
    questionsMs,
    autoGradingMs,
    aiGradingMs,
    audioGradingMs,
    perQuestionFeedbackMs,
    overallFeedbackMs,
  };

  console.info(
    `[Grading] attemptId=${attemptId} | total=${gradingDurationMs}ms | ` +
    `auto=${autoGradingMs}ms | ai=${aiGradingMs}ms | audio=${audioGradingMs}ms | ` +
    `perQFeedback=${perQuestionFeedbackMs}ms | overallFeedback=${overallFeedbackMs}ms`
  );

  // 12. Create or update ExamResult
  const examResult: Omit<IExamResult, '_id'> = {
    attemptId: attempt._id,
    candidateId: attempt.candidateId,
    examId: attempt.examId,
    sessionId: attempt.sessionId,
    totalScore,
    maxScore: maxScoreTotal,
    percentage,
    questionResults,
    competencyScores,
    status,
    evaluatedAt: new Date(),
    completedAt: status === 'completed' ? new Date() : undefined,
    examDuration,
    timeAllowed: attempt.timeAllowedSeconds,
    examName: exam.name,
    examLevel: exam.targetLevel,
    sections,
    overallFeedback: aiFeedback.overallFeedback || undefined,
    recommendations: aiFeedback.recommendations.length > 0 ? aiFeedback.recommendations : undefined,
    competencyFeedback: Object.keys(aiFeedback.competencyFeedback).length > 0
      ? aiFeedback.competencyFeedback
      : undefined,
    recommendedLevel,
    placementMode,
    levelScores,
    gradingStartedAt,
    gradingCompletedAt,
    gradingDurationMs,
    gradingBreakdown,
  };

  let resultId: string;
  if (existingResult) {
    await getExamResults().updateOne(
      { _id: existingResult._id },
      { $set: examResult }
    );
    resultId = existingResult._id!.toString();
  } else {
    const inserted = await getExamResults().insertOne(examResult as any);
    resultId = inserted.insertedId.toString();
  }

  // 13. Send notification (best-effort)
  sendGradingNotification({
    candidateId: attempt.candidateId.toString(),
    candidateEmail,
    candidateFirstName,
    candidateLastName,
    examName: exam.name,
    examResultId: resultId,
    score: totalScore,
    maxScore: maxScoreTotal,
    percentage,
    status,
  }).catch(() => {});

  // 14. Return structured response
  return {
    examResultId: resultId,
    examName: exam.name,
    examLevel: exam.targetLevel,
    status,
    totalScore,
    maxScore: maxScoreTotal,
    percentage,
    questionsGraded: questionResults.length,
    autoGraded: questionResults.filter(qr => qr.evaluationMethod === 'automatic').length,
    aiGraded: questionResults.filter(qr => qr.evaluationMethod === 'ai_grading').length,
    pendingManual: questionResults.filter(qr => qr.evaluationMethod === 'manual').length,
    competencyScores: competencyScores.map(c => ({
      competency: c.competency,
      score: `${c.totalScore}/${c.maxScore}`,
      percentage: c.percentage,
    })),
    sections: sections?.map(s => ({
      name: s.name,
      competency: s.competency,
      score: `${s.score}/${s.maxScore}`,
      percentage: s.percentage,
    })),
  };
}
