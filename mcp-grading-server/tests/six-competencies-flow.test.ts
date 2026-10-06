import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { fakeCollection, installFakeMongo } from './helpers/fake-mongo.js';

process.env.JWT_SECRET ??= 'test-secret';
process.env.SERVICE_TOKEN ??= 'test-service-token';
process.env.MONGO_DB_NAME = 'cba_platform';
process.env.MONGO_CANDIDATES_DB_NAME = 'cba_identity_db';
process.env.NOTIFICATION_SERVICE_URL = 'http://127.0.0.1:9';
process.env.KAFKA_BROKER = '127.0.0.1:9'; // fail fast: notifications are fire-and-forget
process.env.GROQ_API_KEY = '';

installFakeMongo();
const { connectDB } = await import('../src/db/connection.js');
const { gradeExam } = await import('../src/tools/grade-exam.js');

const DB = 'cba_platform';
// MCER default split: the four skills 20% each, grammar and vocabulary 10% each.
const PLAN = [
  { competency: 'listening', weight: 20, correct: false },
  { competency: 'reading', weight: 20, correct: true },
  { competency: 'grammar', weight: 10, correct: true },
  { competency: 'vocabulary', weight: 10, correct: false },
  { competency: 'writing', weight: 20, correct: true },
  { competency: 'speaking', weight: 20, correct: true },
] as const;

const exam = new ObjectId();
const attempt = new ObjectId();
const session = new ObjectId();
const candidate = new ObjectId();
const qIds = PLAN.map(() => new ObjectId());

before(async () => {
  await connectDB();
  fakeCollection(DB, 'exams').docs.push({
    _id: exam, name: 'Inglés A2 · Final', type: 'final', targetLevel: 'A2',
    structure: { passingScore: 60, sections: PLAN.map((p) => ({ name: p.competency, competency: p.competency, weight: p.weight, questionCount: 1, duration: 10 })) },
  });
  fakeCollection(DB, 'levels').docs.push({
    code: 'A2', isActive: true, overallMinScore: 60,
    competencyRequirements: Object.fromEntries(PLAN.map((p) => [p.competency, { minScore: 50 }])),
  });
  fakeCollection('cba_identity_db', 'candidates').docs.push({ _id: candidate, personalInfo: { firstName: 'Ana', lastName: 'G' } });
  PLAN.forEach((p, i) => {
    fakeCollection(DB, 'questions').docs.push({
      _id: qIds[i], type: 'multiple_choice', competency: p.competency, level: 'A2', difficulty: 2, metadata: { points: 10 },
      content: { question: `${p.competency} q`, options: [{ id: 'A', text: 'right', isCorrect: true }, { id: 'B', text: 'wrong' }] },
    });
    fakeCollection(DB, 'responses').docs.push({
      _id: new ObjectId(), sessionId: session, candidateId: candidate, examId: exam, questionId: qIds[i],
      answer: { selectedOptions: [p.correct ? 'A' : 'B'] },
    });
  });
  fakeCollection(DB, 'attempts').docs.push({
    _id: attempt, examId: exam, sessionId: session, candidateId: candidate, status: 'completed',
    startedAt: new Date(Date.now() - 6e5), finishedAt: new Date(), timeAllowedSeconds: 3600,
    sectionsStructure: PLAN.map((p, i) => ({ id: p.competency, name: p.competency, competency: p.competency, duration: 10, weight: p.weight, questionCount: 1, questionIds: [qIds[i]] })),
  });
});

describe('six MCER competencies (grading-service, in-memory DB)', () => {
  test('grammar and vocabulary get their own scores, weights and mastery', async () => {
    const graded = await gradeExam(attempt.toString());
    const r = fakeCollection(DB, 'exam_results').docs[0]!;

    assert.equal(graded.status, 'completed');
    assert.equal(r.scoringMethod, 'weighted_sections');
    // 20 (reading) + 10 (grammar) + 20 (writing) + 20 (speaking) = 70; raw would be 4/6 = 66.7.
    assert.equal(r.percentage, 70);
    assert.equal(r.passed, true);

    const comp = Object.fromEntries(r.competencyScores.map((c: any) => [c.competency, c.percentage]));
    assert.deepEqual(Object.keys(comp).sort(), ['grammar', 'listening', 'reading', 'speaking', 'vocabulary', 'writing']);
    assert.equal(comp.grammar, 100);
    assert.equal(comp.vocabulary, 0);

    const sections = Object.fromEntries(r.sections.map((s: any) => [s.competency, s.weightedPercentage]));
    assert.equal(sections.grammar, 10);
    assert.equal(sections.vocabulary, 0);

    const mastery = Object.fromEntries(r.competencyMastery.competencies.map((c: any) => [c.competency, c.achieved]));
    assert.equal(mastery.grammar, true);
    assert.equal(mastery.vocabulary, false);
    assert.equal(r.competencyMastery.overall.achieved, true);
  });
});
