import { ObjectId } from 'mongodb';
import { getCandidates, getExamResults, getQuestions, getRubrics, getSessions } from '../db/collections.js';
import type { IExamResult, IQuestion, IQuestionResult } from '../types/index.js';
import { manualRubricScore, percentToLevel, readResponse, ReviewError, validatePlainScore } from '../grading/manual-review-scoring.js';
export { ReviewError } from '../grading/manual-review-scoring.js';
import type { ReviewStatus } from '../grading/manual-review-scoring.js';
import { isPendingManual } from '../types/index.js';
import { gradeExam } from './grade-exam.js';

// ── Queries ───────────────────────────────────────────────────────────────────

function oid(id: string, label: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new ReviewError(`${label} inválido`, 400);
  return new ObjectId(id);
}

async function namesFor(results: IExamResult[]) {
  const candidateIds = [...new Set(results.map((r) => r.candidateId.toString()))].map((id) => new ObjectId(id));
  const sessionIds = [...new Set(results.map((r) => r.sessionId?.toString()).filter(Boolean) as string[])].map((id) => new ObjectId(id));
  const [candidates, sessions] = await Promise.all([
    candidateIds.length ? getCandidates().find({ _id: { $in: candidateIds } }, { projection: { personalInfo: 1 } }).toArray() : [],
    sessionIds.length ? getSessions().find({ _id: { $in: sessionIds } }, { projection: { sessionName: 1 } }).toArray() : [],
  ]);
  const student = new Map(
    candidates.map((c: any) => [c._id.toString(), [c.personalInfo?.firstName, c.personalInfo?.lastName].filter(Boolean).join(' ') || 'Estudiante']),
  );
  const session = new Map(sessions.map((s: any) => [s._id.toString(), s.sessionName ?? '']));
  return { student, session };
}

/** Manual/assisted answers, pending or already reviewed. */
export async function listReviewQueue(status: ReviewStatus, limit = 500) {
  const results = await getExamResults()
    .find({ 'questionResults.evaluationMethod': 'manual' })
    .sort({ evaluatedAt: 1 })
    .limit(2000)
    .toArray();
  const items = results.flatMap((r) =>
    r.questionResults
      .map((qr, index) => ({ r, qr, index }))
      .filter(({ qr }) => qr.evaluationMethod === 'manual' && (status === 'pending' ? isPendingManual(qr) : !!qr.review)),
  );
  const page = items.slice(0, limit);
  const questions = await getQuestions()
    .find({ _id: { $in: [...new Set(page.map((i) => i.qr.questionId.toString()))].map((id) => new ObjectId(id)) } }, { projection: { level: 1, gradingMode: 1 } })
    .toArray();
  const qMap = new Map(questions.map((q) => [q._id.toString(), q]));
  const { student, session } = await namesFor([...new Set(page.map((i) => i.r))]);

  return page.map(({ r, qr, index }) => ({
    resultId: r._id!.toString(),
    questionId: qr.questionId.toString(),
    studentName: student.get(r.candidateId.toString()) ?? 'Estudiante',
    examTitle: r.examName ?? 'Examen',
    sessionName: session.get(r.sessionId?.toString() ?? '') ?? '',
    questionNumber: index + 1,
    questionType: qr.questionType,
    competency: qr.competency,
    level: qMap.get(qr.questionId.toString())?.level ?? r.examLevel ?? '',
    submittedAt: (r.evaluatedAt ?? r.gradingStartedAt ?? new Date()).toISOString?.() ?? new Date().toISOString(),
    mode: qr.aiSuggestion ? 'assisted' : 'manual',
    status,
    score: qr.review ? qr.review.score : undefined,
    maxScore: qr.maxScore,
  }));
}

async function loadPair(resultId: string, questionId: string): Promise<{ result: IExamResult; qr: IQuestionResult; index: number; question: IQuestion | null }> {
  const result = await getExamResults().findOne({ _id: oid(resultId, 'resultId') });
  if (!result) throw new ReviewError('Resultado no encontrado', 404);
  const index = result.questionResults.findIndex((q) => q.questionId.toString() === questionId);
  const qr = result.questionResults[index];
  if (!qr) throw new ReviewError('La pregunta no pertenece a este resultado', 404);
  if (qr.evaluationMethod !== 'manual') throw new ReviewError('Esta respuesta no es de corrección manual', 409);
  const question = await getQuestions().findOne({ _id: oid(questionId, 'questionId') });
  return { result, qr, index, question };
}

async function rubricFor(question: IQuestion | null) {
  const id = question?.metadata?.rubricId?.toString();
  if (!id || !ObjectId.isValid(id)) return null;
  const rubric = await getRubrics().findOne({ _id: new ObjectId(id) });
  return rubric && rubric.criteria?.length ? rubric : null;
}

/** Everything the review desk shows for one answer. */
export async function getReviewTask(resultId: string, questionId: string) {
  const { result, qr, index, question } = await loadPair(resultId, questionId);
  const rubric = await rubricFor(question);
  const { student, session } = await namesFor([result]);
  const content = question?.content;

  const aiSuggestion = qr.aiSuggestion
    ? {
        score: qr.aiSuggestion.score,
        rationale: qr.aiSuggestion.rationale,
        // Shown on the rubric as levels; without a rubric the list is informative only.
        criteria: rubric
          ? rubric.criteria.flatMap((c) => {
              const ai = qr.aiSuggestion!.criteria.find((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
              return ai ? [{ name: c.name, score: percentToLevel(c, ai.score) }] : [];
            })
          : [],
      }
    : undefined;

  return {
    resultId,
    questionId,
    studentName: student.get(result.candidateId.toString()) ?? 'Estudiante',
    examTitle: result.examName ?? 'Examen',
    sessionName: session.get(result.sessionId?.toString() ?? '') ?? '',
    questionNumber: index + 1,
    questionType: qr.questionType,
    competency: qr.competency,
    level: question?.level ?? result.examLevel ?? '',
    submittedAt: (result.evaluatedAt ?? new Date()).toISOString?.() ?? new Date().toISOString(),
    mode: qr.aiSuggestion ? 'assisted' : 'manual',
    status: qr.review ? 'reviewed' : 'pending',
    maxScore: qr.maxScore,
    question: {
      question: content?.question ?? '',
      instructions: content?.instructions,
      context: qr.competency === 'listening' ? undefined : content?.context,
      mediaUrl: content?.mediaUrl,
      mediaType: content?.mediaType,
      mediaAlt: content?.mediaAlt,
    },
    response: readResponse(qr.response),
    rubric: rubric
      ? { name: rubric.name, criteria: rubric.criteria.map((c) => ({ name: c.name, description: c.description, weight: c.weight, levels: c.levels.map((l) => ({ score: l.score, description: l.description })) })) }
      : undefined,
    aiSuggestion,
    review: qr.review ? { ...qr.review, reviewedAt: new Date(qr.review.reviewedAt).toISOString() } : undefined,
  };
}

export interface SubmitReviewInput {
  score?: number;
  criteria?: Record<string, number>;
  feedback?: string;
}

/**
 * Saves a teacher's grade and recomputes the exam result (totals, sections,
 * pass/fail, level) without re-running the AI. The score is computed here
 * from the rubric picks; a client-sent score is only used when there is no
 * rubric.
 */
export async function submitReview(resultId: string, questionId: string, input: SubmitReviewInput, reviewerId: string) {
  const { result, qr, question } = await loadPair(resultId, questionId);
  const rubric = await rubricFor(question);
  const feedback = (input.feedback ?? '').trim().slice(0, 4000);

  const score = rubric
    ? manualRubricScore(rubric.criteria, input.criteria ?? {}, qr.maxScore)
    : validatePlainScore(input.score, qr.maxScore);

  const review = {
    score,
    ...(rubric ? { criteria: Object.fromEntries(rubric.criteria.map((c) => [c.name, input.criteria![c.name]!])) } : {}),
    feedback,
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
  };

  // Positional update: two teachers grading different questions of the same
  // result don't overwrite each other.
  await getExamResults().updateOne(
    { _id: result._id, 'questionResults.questionId': qr.questionId },
    {
      $set: {
        'questionResults.$.review': review,
        'questionResults.$.score': score,
        'questionResults.$.feedback': feedback,
        'questionResults.$.evaluatedAt': review.reviewedAt,
      },
    },
  );

  const graded = await gradeExam(result.attemptId.toString(), { reuseScored: true });
  return { score, status: graded.status, percentage: graded.percentage, pendingManual: graded.pendingManual };
}
