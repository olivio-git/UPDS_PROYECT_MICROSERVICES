/**
 * Regression test: operations on an exam attempt must be scoped to the
 * candidate making the request, not just to the session.
 *
 * Previously every post-start operation looked the attempt up with
 * `Attempt.findOne({ sessionId })`. With several candidates in one session,
 * that returns whichever attempt Mongo finds first, so one candidate's answers,
 * audio, timer and finish action landed on another candidate's attempt.
 *
 * The Attempt model is replaced by an in-memory store whose findOne matches a
 * filter the way Mongo does: every key in the filter must match.
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
  save: jest.Mock;
};

const store: FakeAttempt[] = [];

const matches = (doc: Record<string, unknown>, filter: Record<string, unknown>) =>
  Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));

jest.mock('../src/models/attempt.model', () => ({
  Attempt: {
    findOne: jest.fn(async (filter: Record<string, unknown>) =>
      store.find((doc) => matches(doc, filter)) ?? null,
    ),
    find: jest.fn((filter: Record<string, unknown>) => ({
      sort: () => ({ exec: async () => store.filter((doc) => matches(doc, filter)) }),
    })),
  },
}));

jest.mock('../src/models/question.model', () => ({
  Question: {
    findById: jest.fn(async (id: string) => ({ _id: id, type: 'multiple_choice', competency: 'reading' })),
  },
}));

jest.mock('../src/models/response.model', () => ({
  Response: {
    findOneAndUpdate: jest.fn(async () => ({ _id: 'response-1' })),
  },
}));

jest.mock('../src/models/exam.model', () => ({ Exam: {} }));
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../src/config/env', () => ({
  env: { GRADING_SERVICE_URL: 'http://grading-service:3007' },
}));
jest.mock('../src/services/session.service', () => ({
  SessionService: jest.fn().mockImplementation(() => ({
    findById: jest.fn(async () => ({ status: 'in_progress' })),
  })),
}));
jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn(() => Promise.resolve({ data: {} })) },
}));

import axios from 'axios';
import { Response as ResponseModel } from '../src/models/response.model';
import { ExamTakingService } from '../src/services/examTaking.service';

const SESSION = 'session-1';
const ALICE = 'candidate-alice';
const BOB = 'candidate-bob';

const attempt = (id: string, candidateId: string, startedMinutesAgo: number): FakeAttempt => ({
  _id: id,
  sessionId: SESSION,
  candidateId,
  examId: 'exam-1',
  status: 'in_progress',
  startedAt: new Date(Date.now() - startedMinutesAgo * 60_000),
  timeAllowedSeconds: 3600,
  save: jest.fn(async () => undefined),
});

describe('ExamTakingService — attempt lookup is scoped to the candidate', () => {
  let service: ExamTakingService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    store.length = 0;
    // Alice started first, so an unscoped findOne({ sessionId }) returns her attempt.
    store.push(attempt('attempt-alice', ALICE, 30), attempt('attempt-bob', BOB, 10));
    service = new ExamTakingService();
  });

  it('saves an answer under the submitting candidate, not the first one in the session', async () => {
    await service.submitAnswer(SESSION, BOB, 'question-1', { selected: 'B' });

    expect(ResponseModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter] = (ResponseModel.findOneAndUpdate as jest.Mock).mock.calls[0];
    expect(filter).toMatchObject({ candidateId: BOB, questionId: 'question-1' });
  });

  it("finishes and sends for grading the caller's own attempt", async () => {
    const result = await service.finishExam(SESSION, BOB);

    expect(result.attemptId).toBe('attempt-bob');
    expect(store.find((a) => a._id === 'attempt-bob')?.status).toBe('completed');
    expect(store.find((a) => a._id === 'attempt-alice')?.status).toBe('in_progress');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/grading/exam'),
      { attemptId: 'attempt-bob' },
      expect.anything(),
    );
  });

  it("reports the caller's own remaining time", async () => {
    const alice = await service.getTimeRemaining(SESSION, ALICE);
    const bob = await service.getTimeRemaining(SESSION, BOB);

    // Alice started 30 min ago, Bob 10 min ago, both with 60 min allowed.
    expect(alice.timeRemaining).toBeLessThanOrEqual(30 * 60);
    expect(bob.timeRemaining).toBeGreaterThan(49 * 60);
  });

  it('counts only the caller\'s attempts against the attempt limit', async () => {
    const { attempts } = await service.attempts(SESSION, BOB, 1);

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?._id).toBe('attempt-bob');
  });

  it('rejects operations from a candidate with no attempt in the session', async () => {
    await expect(service.finishExam(SESSION, 'candidate-mallory')).rejects.toThrow('Attempt not found');
    expect(axios.post).not.toHaveBeenCalled();
  });
});
