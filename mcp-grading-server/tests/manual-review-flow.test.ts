import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { fakeCollection, installFakeMongo } from './helpers/fake-mongo.js';

// Config is read at import time: set it before loading the service modules.
process.env.JWT_SECRET ??= 'test-secret';
process.env.SERVICE_TOKEN ??= 'test-service-token';
process.env.MONGO_DB_NAME = 'cba_platform';
process.env.MONGO_CANDIDATES_DB_NAME = 'cba_identity_db';
process.env.NOTIFICATION_SERVICE_URL = 'http://127.0.0.1:9';
process.env.GROQ_API_KEY = '';
process.env.KAFKA_BROKER = '127.0.0.1:9'; // fail fast: notifications are fire-and-forget

installFakeMongo();
const { connectDB } = await import('../src/db/connection.js');
const { gradeExam } = await import('../src/tools/grade-exam.js');
const { getReviewTask, listReviewQueue, submitReview } = await import('../src/tools/manual-review.js');
const { ReviewError, manualRubricScore } = await import('../src/grading/manual-review-scoring.js');

const DB = 'cba_platform';
const ids = {
  exam: new ObjectId(), attempt: new ObjectId(), session: new ObjectId(), candidate: new ObjectId(), rubric: new ObjectId(),
  mc: new ObjectId(), essayManual: new ObjectId(), essayAssisted: new ObjectId(), openManual: new ObjectId(),
};

const RUBRIC_CRITERIA = [
  { name: 'Tarea', description: '', weight: 30, levels: [0, 1, 2, 3].map((score) => ({ score, description: `Tarea ${score}` })) },
  { name: 'Gramática', description: '', weight: 25, levels: [0, 1, 2, 3].map((score) => ({ score, description: `Gramática ${score}` })) },
  { name: 'Vocabulario', description: '', weight: 25, levels: [0, 1, 2, 3].map((score) => ({ score, description: `Vocabulario ${score}` })) },
  { name: 'Coherencia', description: '', weight: 20, levels: [0, 1, 2, 3].map((score) => ({ score, description: `Coherencia ${score}` })) },
];

const question = (id: ObjectId, type: string, extra: Record<string, unknown> = {}) => ({
  _id: id, type, competency: type === 'multiple_choice' ? 'reading' : 'writing', level: 'A2', difficulty: 2,
  content: { question: `Q ${type}` }, metadata: { points: 10 }, isActive: true, ...extra,
});

before(async () => {
  await connectDB();
  fakeCollection(DB, 'exams').docs.push({ _id: ids.exam, name: 'Inglés A2 · Final', type: 'final', targetLevel: 'A2', structure: { passingScore: 60 } });
  fakeCollection(DB, 'sessions').docs.push({ _id: ids.session, sessionName: 'Turno mañana' });
  fakeCollection('cba_identity_db', 'candidates').docs.push({ _id: ids.candidate, personalInfo: { firstName: 'Ana', lastName: 'Gutiérrez', email: 'ana@test' } });
  fakeCollection(DB, 'rubrics').docs.push({ _id: ids.rubric, name: 'Escritura A2', criteria: RUBRIC_CRITERIA, isActive: true });
  fakeCollection(DB, 'questions').docs.push(
    question(ids.mc, 'multiple_choice', { content: { question: 'MC', options: [{ id: 'A', text: 'a', isCorrect: true }, { id: 'B', text: 'b' }] } }),
    question(ids.essayManual, 'essay', { gradingMode: 'manual', metadata: { points: 10, rubricId: ids.rubric }, content: { question: 'Describe the picture', mediaUrl: 'http://img', mediaType: 'image', mediaAlt: 'A park' } }),
    question(ids.essayAssisted, 'essay', { gradingMode: 'assisted' }),
    question(ids.openManual, 'open_text', { gradingMode: 'manual' }),
  );
  fakeCollection(DB, 'attempts').docs.push({
    _id: ids.attempt, examId: ids.exam, sessionId: ids.session, candidateId: ids.candidate, status: 'completed',
    questionIds: [ids.mc, ids.essayManual, ids.essayAssisted, ids.openManual],
    startedAt: new Date(Date.now() - 600000), finishedAt: new Date(), timeAllowedSeconds: 1800,
  });
  const resp = (questionId: ObjectId, answer: unknown) => ({ _id: new ObjectId(), sessionId: ids.session, candidateId: ids.candidate, examId: ids.exam, questionId, answer });
  fakeCollection(DB, 'responses').docs.push(
    resp(ids.mc, { selectedOptions: ['A'] }),
    resp(ids.essayManual, { text: 'There is a park. A woman is reading.' }),
    resp(ids.essayAssisted, { text: 'My favourite place is the park.' }),
    resp(ids.openManual, { text: 'I do not know.' }),
  );
});

const result = () => fakeCollection(DB, 'exam_results').docs[0]!;
const qr = (id: ObjectId) => result().questionResults.find((q: any) => String(q.questionId) === String(id));

describe('manual review flow (grading-service, in-memory DB)', () => {
  test('grading leaves manual and assisted answers pending, auto ones scored', async () => {
    const graded = await gradeExam(ids.attempt.toString());
    assert.equal(graded.status, 'pending_ai_review');
    assert.equal(graded.pendingManual, 3);
    assert.equal(qr(ids.mc).evaluationMethod, 'automatic');
    assert.equal(qr(ids.mc).score, 10);
    assert.equal(qr(ids.essayManual).evaluationMethod, 'manual');
    assert.equal(qr(ids.essayAssisted).evaluationMethod, 'manual');
    assert.ok(qr(ids.essayAssisted).aiSuggestion, 'assisted keeps the AI proposal');
    assert.equal(result().passed, undefined, 'no pass/fail while pending');
  });

  test('the queue lists the three pending answers with names', async () => {
    const queue = await listReviewQueue('pending');
    assert.equal(queue.length, 3);
    assert.ok(queue.every((i) => i.studentName === 'Ana Gutiérrez' && i.sessionName === 'Turno mañana'));
    assert.equal(queue.find((i) => i.questionId === ids.essayAssisted.toString())?.mode, 'assisted');
  });

  test('a task carries prompt, image description, answer and rubric', async () => {
    const task = await getReviewTask(result()._id.toString(), ids.essayManual.toString());
    assert.equal(task.question.mediaAlt, 'A park');
    assert.equal(task.response.text, 'There is a park. A woman is reading.');
    assert.equal(task.rubric?.criteria.length, 4);
    assert.equal(task.status, 'pending');
  });

  test('rubric review: the server computes the score from the picks', async () => {
    const picks = { Tarea: 3, Gramática: 2, Vocabulario: 2, Coherencia: 2 };
    const out = await submitReview(result()._id.toString(), ids.essayManual.toString(), { score: 10, criteria: picks, feedback: 'Bien' }, 'teacher-1');
    assert.equal(out.score, manualRubricScore(RUBRIC_CRITERIA, picks, 10));
    assert.equal(out.score, 7.67, 'a client-sent score is ignored when there is a rubric');
    assert.equal(out.status, 'pending_ai_review');
    assert.equal(out.pendingManual, 2);
    assert.equal(qr(ids.essayManual).review.reviewedBy, 'teacher-1');
  });

  test('invalid reviews are rejected', async () => {
    const id = result()._id.toString();
    await assert.rejects(submitReview(id, ids.essayManual.toString(), { criteria: { Tarea: 3 } }, 't'), ReviewError);
    await assert.rejects(submitReview(id, ids.openManual.toString(), { score: 11 }, 't'), ReviewError);
    await assert.rejects(submitReview(id, ids.mc.toString(), { score: 1 }, 't'), ReviewError);
  });

  test('a reviewed 0 counts as graded and the last review completes the exam', async () => {
    const id = result()._id.toString();
    await submitReview(id, ids.openManual.toString(), { score: 0, feedback: 'Sin contenido' }, 'teacher-1');
    const last = await submitReview(id, ids.essayAssisted.toString(), { score: 8, feedback: 'Muy bien' }, 'teacher-1');
    assert.equal(last.status, 'completed');
    assert.equal(last.pendingManual, 0);
    const r = result();
    assert.equal(r.totalScore, 10 + 7.67 + 8 + 0);
    assert.equal(r.maxScore, 40);
    assert.equal(r.percentage, Math.round((25.67 / 40) * 1000) / 10);
    assert.equal(typeof r.passed, 'boolean');
    assert.ok(r.competencyScores.every((c: any) => c.pendingEvaluationCount === 0));
    assert.equal(qr(ids.essayAssisted).feedback, 'Muy bien');
  });

  test('a full regrade keeps every teacher grade', async () => {
    const before = result().totalScore;
    const graded = await gradeExam(ids.attempt.toString(), { force: true });
    assert.equal(graded.status, 'completed');
    assert.equal(result().totalScore, before);
    assert.equal(qr(ids.openManual).score, 0);
    assert.equal(qr(ids.essayManual).review.criteria.Tarea, 3);
  });

  test('queues reflect the reviews', async () => {
    assert.equal((await listReviewQueue('pending')).length, 0);
    const reviewed = await listReviewQueue('reviewed');
    assert.equal(reviewed.length, 3);
    assert.deepEqual(reviewed.map((i) => i.score).sort(), [0, 7.67, 8]);
  });
});
