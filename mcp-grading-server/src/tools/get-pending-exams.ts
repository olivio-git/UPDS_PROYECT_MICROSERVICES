import { getAttempts, getExamResults, getExams } from '../db/collections.js';
import type { GetPendingExamsResponse } from '../schemas/grading.schemas.js';

export async function getPendingExams(params: { limit?: number }): Promise<GetPendingExamsResponse> {
  const limit = params.limit || 20;

  // 1. Find completed attempts
  const completedAttempts = await getAttempts()
    .find({ status: 'completed' })
    .sort({ finishedAt: -1 })
    .limit(limit * 2)
    .toArray();

  // 2. Check which ones have ExamResults
  const attemptIds = completedAttempts.map(a => a._id);
  const existingResults = await getExamResults()
    .find({ attemptId: { $in: attemptIds } })
    .toArray();

  const gradedAttemptIds = new Set(existingResults.map(r => r.attemptId.toString()));

  // 3. Ungraded attempts
  const ungradedAttempts = completedAttempts.filter(a => !gradedAttemptIds.has(a._id.toString()));

  // 4. Partially graded results
  const partialResults = await getExamResults()
    .find({ status: { $in: ['partial', 'pending_ai_review'] } })
    .sort({ evaluatedAt: -1 })
    .limit(limit)
    .toArray();

  // 5. Fetch exam names
  const examIds = [
    ...ungradedAttempts.map(a => a.examId),
    ...partialResults.map(r => r.examId),
  ];
  const exams = await getExams().find({ _id: { $in: examIds } }).toArray();
  const examNameMap = new Map(exams.map(e => [e._id.toString(), e.name]));

  // 6. Build response
  const pending = [
    ...ungradedAttempts.slice(0, limit).map(a => ({
      type: 'ungraded' as const,
      attemptId: a._id.toString(),
      candidateId: a.candidateId.toString(),
      examId: a.examId.toString(),
      examName: examNameMap.get(a.examId.toString()) || 'Desconocido',
      finishedAt: a.finishedAt,
      questionsCount: a.sectionsStructure?.reduce((sum: number, s: any) => sum + s.questionIds.length, 0) || a.questionIds?.length || 0,
    })),
    ...partialResults.map(r => ({
      type: 'partial' as const,
      attemptId: r.attemptId.toString(),
      examResultId: r._id?.toString(),
      candidateId: r.candidateId.toString(),
      examId: r.examId.toString(),
      examName: r.examName,
      status: r.status,
      currentScore: `${r.totalScore}/${r.maxScore}`,
      percentage: r.percentage,
      pendingQuestions: r.questionResults.filter((qr: any) => qr.evaluationMethod === 'manual' && qr.score === 0).length,
    })),
  ];

  return {
    total: pending.length,
    ungraded: ungradedAttempts.length,
    partiallyGraded: partialResults.length,
    exams: pending.slice(0, limit),
  };
}
