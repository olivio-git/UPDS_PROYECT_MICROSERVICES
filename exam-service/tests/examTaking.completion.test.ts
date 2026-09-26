/**
 * Every path that finishes an attempt (manual submit, time running out, the
 * adaptive engine running out of questions) must close it the same way —
 * status 'completed' + finishedAt — and publish exam.attempt.finished
 * exactly once, even when two paths race for the same attempt.
 *
 * Regression: time running out used to set status 'expired' and never
 * publish, so those students never got a result.
 *
 * The Attempt model is an in-memory store whose findOneAndUpdate is atomic
 * and conditional like Mongo's: only a doc matching the whole filter
 * (including `status: 'in_progress'`) is updated.
 */

type FakeAttempt = {
  _id: string;
  sessionId: string;
  candidateId: string;
  examId: string;
  status: string;
  startedAt: Date;
  timeAllowedSeconds: number;
  finishedAt?: Date;
  isAdaptive?: boolean;
  adaptiveState?: Record<string, unknown>;
  save: jest.Mock;
  set: jest.Mock;
};

const store: FakeAttempt[] = [];
const sessionState: { status: string } = { status: 'in_progress' };

const matches = (doc: Record<string, unknown>, filter: Record<string, unknown>) =>
  Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));

// Yield to the event loop so concurrent calls genuinely interleave between
// their read (findOne) and their conditional write (findOneAndUpdate).
const tick = () => new Promise((resolve) => setImmediate(resolve));

jest.mock('../src/models/attempt.model', () => ({
  Attempt: {
    findOne: jest.fn(async (filter: Record<string, unknown>) => {
      await tick();
      return store.find((doc) => matches(doc, filter)) ?? null;
    }),
    findOneAndUpdate: jest.fn(
      async (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
        await tick();
        // Match-and-write happen together after the yield: atomic per call.
        const doc = store.find((d) => matches(d, filter));
        if (!doc) return null;
        Object.assign(doc, update.$set);
        return doc;
      },
    ),
  },
}));

jest.mock('../src/models/session.model', () => ({
  Session: {
    findById: jest.fn(() => ({
      select: () => ({ lean: async () => ({ ...sessionState, settings: { browserLockdown: false } }) }),
    })),
  },
}));

jest.mock('../src/models/exam.model', () => ({
  Exam: { findById: jest.fn(async () => ({ _id: 'exam-1', placementConfig: { maxQuestions: 20 } })) },
}));

jest.mock('../src/models/question.model', () => ({
  // Bank exhausted: no question left for any level.
  Question: { find: jest.fn(() => ({ exec: async () => [] })) },
}));

jest.mock('../src/models/response.model', () => ({ Response: {} }));
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../src/config/env', () => ({ env: {} }));
jest.mock('../src/services/kafka.service', () => ({ KafkaService: jest.fn() }));
jest.mock('../src/services/session.service', () => ({
  SessionService: jest.fn().mockImplementation(() => ({
    findById: jest.fn(async () => ({ ...sessionState })),
  })),
}));
jest.mock('../src/services/examEventPublisher', () => ({
  publishExamAttemptFinished: jest.fn(async () => undefined),
}));

import { publishExamAttemptFinished } from '../src/services/examEventPublisher';
import { ExamTakingService } from '../src/services/examTaking.service';

const SESSION = 'session-1';
const CANDIDATE = 'candidate-1';
const publish = publishExamAttemptFinished as jest.Mock;

const makeAttempt = (overrides: Partial<FakeAttempt> = {}): FakeAttempt => {
  const doc: FakeAttempt = {
    _id: 'attempt-1',
    sessionId: SESSION,
    candidateId: CANDIDATE,
    examId: 'exam-1',
    status: 'in_progress',
    startedAt: new Date(Date.now() - 10 * 60_000),
    timeAllowedSeconds: 3600,
    save: jest.fn(async () => undefined),
    set: jest.fn((path: string, value: unknown) => {
      const [root, key] = path.split('.') as [keyof FakeAttempt, string];
      const nested = ((doc[root] as Record<string, unknown> | undefined) ?? {});
      nested[key] = value;
      (doc as unknown as Record<string, unknown>)[root] = nested;
    }),
    ...overrides,
  };
  return doc;
};

const timedOut = () => makeAttempt({ startedAt: new Date(Date.now() - 70 * 60_000) });

describe('ExamTakingService — shared complete-and-publish path', () => {
  let service: ExamTakingService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    store.length = 0;
    sessionState.status = 'in_progress';
    service = new ExamTakingService();
  });

  it('completes and publishes an attempt whose time ran out, exactly once', async () => {
    store.push(timedOut());

    const first = await service.getTimeRemaining(SESSION, CANDIDATE);
    const second = await service.getTimeRemaining(SESSION, CANDIDATE);

    const attempt = store[0]!;
    expect(attempt.status).toBe('completed');
    expect(attempt.finishedAt).toBeInstanceOf(Date);
    expect(first).toMatchObject({ timeRemaining: 0, attemptStatus: 'completed' });
    expect(second).toMatchObject({ timeRemaining: 0, sessionEnded: true, attemptStatus: 'completed' });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toMatchObject({ attemptId: 'attempt-1', reason: 'expired' });
  });

  it('publishes once when the client finish races the server time-up', async () => {
    store.push(timedOut());

    const [finish] = await Promise.all([
      service.finishExam(SESSION, CANDIDATE),
      service.getTimeRemaining(SESSION, CANDIDATE),
      service.finishExam(SESSION, CANDIDATE),
    ]);

    expect(finish.success).toBe(true);
    expect(store[0]!.status).toBe('completed');
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('returns success without re-publishing when finishing an already completed attempt', async () => {
    store.push(makeAttempt({ status: 'completed', finishedAt: new Date() }));

    const result = await service.finishExam(SESSION, CANDIDATE);

    expect(result.success).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });

  it('completes on time-up when resuming, and reports it as a structured 409', async () => {
    store.push(timedOut());

    await expect(service.resumeExam(SESSION, CANDIDATE)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ATTEMPT_NOT_IN_PROGRESS',
      attemptStatus: 'completed',
    });
    expect(store[0]!.status).toBe('completed');
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('rejects resuming a completed attempt with a structured 409', async () => {
    store.push(makeAttempt({ status: 'completed' }));

    await expect(service.resumeExam(SESSION, CANDIDATE)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ATTEMPT_NOT_IN_PROGRESS',
      attemptStatus: 'completed',
    });
  });

  it('does not auto-submit on time-up when the teacher cancelled the session', async () => {
    store.push(timedOut());
    sessionState.status = 'cancelled';

    await expect(service.resumeExam(SESSION, CANDIDATE)).rejects.toBeDefined();
    expect(store[0]!.status).toBe('in_progress');
    expect(publish).not.toHaveBeenCalled();
  });

  it('completes and publishes an adaptive attempt when the question bank is exhausted', async () => {
    store.push(makeAttempt({
      isAdaptive: true,
      adaptiveState: { currentLevel: 'B1', consecutiveWrong: 0, askedQuestionIds: ['64b000000000000000000001'], levelHistory: [], isFinished: false },
    }));

    const result = await service.resumeAdaptiveExam(SESSION, CANDIDATE);

    expect(result).toMatchObject({ finished: true });
    expect(store[0]!.status).toBe('completed');
    expect(store[0]!.adaptiveState).toMatchObject({ isFinished: true, stopReason: 'max_questions' });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toMatchObject({ reason: 'adaptive_completed' });
  });

  it('rejects resuming a cancelled (kicked) adaptive attempt with a structured 409', async () => {
    store.push(makeAttempt({ isAdaptive: true, status: 'cancelled' }));

    await expect(service.resumeAdaptiveExam(SESSION, CANDIDATE)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ATTEMPT_NOT_IN_PROGRESS',
      attemptStatus: 'cancelled',
    });
    expect(publish).not.toHaveBeenCalled();
  });
});
