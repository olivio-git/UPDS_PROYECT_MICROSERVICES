/**
 * result-visibility: Student Endpoint Respects showResults / Admin-Teacher
 * Endpoint Always Full / Pending AI Review Is Never Shown As Final, plus the
 * adaptive-exam and attempts-list response trimming.
 */
import { isResultVisible, toAttemptSummary, toStudentAdaptiveView, toStudentView } from '../src/utils/resultVisibility';

describe('isResultVisible', () => {
  it('is visible when configuration.showResults is true', () => {
    expect(isResultVisible({ configuration: { showResults: true } })).toBe(true);
  });

  it('is visible when the exam is missing (backward compat)', () => {
    expect(isResultVisible(null)).toBe(true);
    expect(isResultVisible(undefined)).toBe(true);
  });

  it('is visible when configuration.showResults is absent (backward compat)', () => {
    expect(isResultVisible({ configuration: {} })).toBe(true);
    expect(isResultVisible({})).toBe(true);
  });

  it('is hidden only when configuration.showResults is exactly false', () => {
    expect(isResultVisible({ configuration: { showResults: false } })).toBe(false);
  });
});

describe('toStudentView', () => {
  const completedResult = {
    id: 'r1',
    examName: 'Exam A',
    level: 'B1',
    date: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    duration: 1800,
    timeAllowed: 3600,
    score: 82.5,
    passed: true,
    passingScore: 70,
    competencies: { reading: 90 },
    questionResults: [{ id: 'q1' }, { id: 'q2' }],
  };

  it('passes the result through unchanged when visible', () => {
    const view = toStudentView(completedResult, { configuration: { showResults: true } });
    expect(view).toBe(completedResult);
  });

  it('passes the result through unchanged when the exam is missing (backward compat)', () => {
    const view = toStudentView(completedResult, null);
    expect(view).toEqual(completedResult);
  });

  it('strips score, passed and breakdown when showResults is false', () => {
    const view = toStudentView(completedResult, { configuration: { showResults: false } });
    expect(view).toEqual({
      status: 'completed',
      resultsHidden: true,
      id: 'r1',
      examName: 'Exam A',
      level: 'B1',
      date: '2026-01-01T00:00:00.000Z',
      duration: 1800,
      timeAllowed: 3600,
      totalQuestions: 2,
    });
    expect(view.score).toBeUndefined();
    expect(view.passed).toBeUndefined();
    expect(view.competencies).toBeUndefined();
  });

  it('preserves the caller-supplied field names (examLevel/evaluatedAt vs level/date)', () => {
    const raw = { _id: 'r2', examName: 'Exam B', examLevel: 'B2', evaluatedAt: '2026-02-01', examDuration: 900, timeAllowed: 1200, status: 'completed', questionResults: [] };
    const view = toStudentView(raw, { configuration: { showResults: false } });
    expect(view).toMatchObject({ _id: 'r2', examLevel: 'B2', evaluatedAt: '2026-02-01', examDuration: 900, totalQuestions: 0 });
    expect(view.level).toBeUndefined();
  });

  it('never shows pending_ai_review as final, even when showResults is true', () => {
    const pending = { ...completedResult, status: 'pending_ai_review', passed: undefined, percentage: 40, totalScore: 4, breakdown: [{}] };
    const visibleView = toStudentView(pending, { configuration: { showResults: true } });
    expect(visibleView).toEqual({
      status: 'pending_ai_review',
      pending: true,
      id: 'r1',
      examName: 'Exam A',
      level: 'B1',
      date: '2026-01-01T00:00:00.000Z',
      duration: 1800,
      timeAllowed: 3600,
      totalQuestions: 2,
    });
    expect(visibleView.resultsHidden).toBeUndefined();
    expect(visibleView.score).toBeUndefined();
    expect(visibleView.percentage).toBeUndefined();
    expect(visibleView.totalScore).toBeUndefined();
    expect(visibleView.breakdown).toBeUndefined();
    // Absent exam (spec default: visible) behaves the same for pending.
    expect(toStudentView(pending, null).pending).toBe(true);
  });

  it('level-mastery-indicator: carries competencyMastery through untouched when visible (no rename needed — the full view is the result object as-is)', () => {
    const withMastery = {
      ...completedResult,
      competencyMastery: { levelCode: 'B1', overall: { minScore: 60, percentage: 82.5, achieved: true }, competencies: [] },
    };
    const view = toStudentView(withMastery, { configuration: { showResults: true } });
    expect(view).toBe(withMastery);
    expect(view.competencyMastery).toEqual(withMastery.competencyMastery);
  });

  it('level-mastery-indicator: strips competencyMastery when showResults is false', () => {
    const withMastery = {
      ...completedResult,
      competencyMastery: { levelCode: 'B1', overall: { minScore: 60, percentage: 82.5, achieved: true }, competencies: [] },
    };
    const view = toStudentView(withMastery, { configuration: { showResults: false } });
    expect(view.competencyMastery).toBeUndefined();
  });

  it('flags a hidden pending result with both resultsHidden and pending', () => {
    const pending = { ...completedResult, status: 'pending_ai_review', passed: undefined };
    const hiddenView = toStudentView(pending, { configuration: { showResults: false } });
    expect(hiddenView.status).toBe('pending_ai_review');
    expect(hiddenView.resultsHidden).toBe(true);
    expect(hiddenView.pending).toBe(true);
    expect(hiddenView.passed).toBeUndefined();
    expect(hiddenView.score).toBeUndefined();
  });
});

describe('toStudentAdaptiveView', () => {
  const hiddenExam = { configuration: { showResults: false } };
  const submitResponse = {
    finished: false,
    stopReason: undefined,
    gradeResult: { isCorrect: true, score: 1, maxScore: 1, feedback: 'ok' },
    nextQuestion: { _id: 'q2' },
    adaptiveState: {
      currentLevel: 'B2',
      questionsAnswered: 3,
      maxQuestions: 20,
      consecutiveWrongThreshold: 3,
      consecutiveWrong: 0,
      isFinished: false,
    },
  };

  it('passes the response through unchanged when visible or exam missing', () => {
    expect(toStudentAdaptiveView(submitResponse, { configuration: { showResults: true } })).toBe(submitResponse);
    expect(toStudentAdaptiveView(submitResponse, null)).toBe(submitResponse);
  });

  it('drops gradeResult and level info from a submit response when hidden', () => {
    const view = toStudentAdaptiveView(submitResponse, hiddenExam);
    expect(view).toEqual({
      resultsHidden: true,
      finished: false,
      nextQuestion: { _id: 'q2' },
      questionsAnswered: 3,
      adaptiveState: { questionsAnswered: 3, maxQuestions: 20, isFinished: false },
    });
    expect(view.gradeResult).toBeUndefined();
    expect(view.adaptiveState.currentLevel).toBeUndefined();
    expect(view.adaptiveState.consecutiveWrong).toBeUndefined();
  });

  it('drops stopReason when hidden (consecutive_wrong would reveal wrong answers)', () => {
    const view = toStudentAdaptiveView({ ...submitResponse, finished: true, stopReason: 'consecutive_wrong', nextQuestion: null }, hiddenExam);
    expect(view.stopReason).toBeUndefined();
    expect(view.finished).toBe(true);
  });

  it('trims a finished resume response carrying the raw levelHistory', () => {
    const resume = {
      finished: true,
      adaptiveState: {
        currentLevel: 'C1',
        consecutiveWrong: 3,
        askedQuestionIds: ['q1', 'q2'],
        levelHistory: [
          { questionId: 'q1', level: 'B1', isCorrect: true, score: 1, maxScore: 1 },
          { questionId: 'q2', level: 'B2', isCorrect: false, score: 0, maxScore: 1 },
        ],
        isFinished: true,
        stopReason: 'consecutive_wrong',
      },
    };
    const view = toStudentAdaptiveView(resume, hiddenExam);
    expect(view).toEqual({
      resultsHidden: true,
      finished: true,
      questionsAnswered: 2,
      adaptiveState: { questionsAnswered: 2, isFinished: true },
    });
  });
});

describe('toAttemptSummary', () => {
  it('keeps only non-score attempt fields', () => {
    const attempt = {
      _id: 'a1',
      sessionId: 's1',
      examId: 'e1',
      candidateId: 'c1',
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-01-02',
      timeAllowedSeconds: 3600,
      isAdaptive: true,
      adaptiveState: { currentLevel: 'B2', levelHistory: [{ score: 1 }] },
      integrity: { infractionCount: 2 },
    };
    expect(toAttemptSummary(attempt)).toEqual({
      _id: 'a1',
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-01-02',
      sessionId: 's1',
      examId: 'e1',
    });
  });
});
