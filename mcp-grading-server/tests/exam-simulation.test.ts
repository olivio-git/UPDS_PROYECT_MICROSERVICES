/**
 * Monte Carlo exam simulation through the real grading pipeline.
 *
 * A bank of auto-graded questions across the six MCER competencies, an A2 exam
 * with the default section weights, and a cohort of simulated candidates whose
 * chance of answering correctly follows an item-response model
 * P(correct) = 1 / (1 + e^-(ability - difficulty)). Every answer is built from
 * the student view (no answer key), stored as a response and graded by gradeExam.
 * The checks are invariants that must hold for every candidate, plus cohort-level
 * properties (better candidates score higher, pass/mastery agree with the rules).
 */
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { fakeCollection, installFakeMongo } from './helpers/fake-mongo.js';
import { toStudentQuestion } from '../../exam-service/src/utils/studentQuestionView.js';

process.env.JWT_SECRET ??= 'test-secret';
process.env.SERVICE_TOKEN ??= 'test-service-token';
process.env.MONGO_DB_NAME = 'cba_platform';
process.env.MONGO_CANDIDATES_DB_NAME = 'cba_identity_db';
process.env.NOTIFICATION_SERVICE_URL = 'http://127.0.0.1:9';
process.env.KAFKA_BROKER = '127.0.0.1:9';
process.env.GROQ_API_KEY = '';

installFakeMongo();
const { connectDB } = await import('../src/db/connection.js');
const { gradeExam } = await import('../src/tools/grade-exam.js');

function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = seeded(7);
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;

const DB = 'cba_platform';
const PASSING = 60;
const SECTIONS = [
  { competency: 'reading', weight: 20, count: 10 },
  { competency: 'listening', weight: 20, count: 8 },
  { competency: 'grammar', weight: 10, count: 10 },
  { competency: 'vocabulary', weight: 10, count: 10 },
  { competency: 'writing', weight: 20, count: 4 },
  { competency: 'speaking', weight: 20, count: 4 },
] as const;
const TYPES = ['multiple_choice', 'true_false', 'fill_blanks', 'matching', 'ordering', 'drag_drop'] as const;
const CANDIDATES = 120;

// ── Bank ──────────────────────────────────────────────────────────────────────
type Q = { _id: ObjectId; type: string; competency: string; difficulty: number; metadata: { points: number }; content: any };
function makeQuestion(competency: string): Q {
  const type = pick(TYPES);
  const difficulty = 1 + Math.floor(rand() * 5);
  const points = pick([1, 1, 2, 3]);
  let content: any;
  switch (type) {
    case 'multiple_choice':
      content = { question: 'q', options: ['A', 'B', 'C', 'D'].map((id, i) => ({ id, text: `o${i}`, isCorrect: i === 0 })) };
      break;
    case 'true_false': {
      const t = rand() < 0.5;
      content = { question: 's.', options: [{ id: 'true', text: 'True', isCorrect: t }, { id: 'false', text: 'False', isCorrect: !t }] };
      break;
    }
    case 'fill_blanks':
      content = { question: 'f', template: '___ and ___', blanks: [{ position: 0, correctAnswers: ['went'] }, { position: 1, correctAnswers: ["isn't"] }] };
      break;
    case 'matching':
      content = { question: 'm', items: [1, 2, 3, 4].map((n) => ({ id: `m${n}`, content: `L${n}`, matchingPair: `R${n}` })) };
      break;
    default:
      content = { question: 'o', items: [1, 2, 3, 4, 5].map((n) => ({ id: `${type[0]}${n}`, content: `w${n}`, correctPosition: n })) };
  }
  return { _id: new ObjectId(), type, competency, difficulty, metadata: { points }, content };
}

/**
 * How a candidate answers one question: right with probability p; otherwise a
 * plausible mistake (wrong option, a typo-free wrong word, a swapped pair...).
 * Correct answers are sometimes typed the messy way real students type them.
 */
function answer(stored: Q, p: number): { answer: unknown; fraction: number } {
  const view = toStudentQuestion(stored, rand) as any;
  const right = rand() < p;
  switch (stored.type) {
    case 'multiple_choice': {
      const correct = stored.content.options.find((o: any) => o.isCorrect).id;
      const wrong = view.content.options.find((o: any) => o.id !== correct).id;
      return { answer: { selectedOptions: [right ? correct : wrong] }, fraction: right ? 1 : 0 };
    }
    case 'true_false': {
      const truth = stored.content.options[0].isCorrect;
      return { answer: { answer: right ? truth : !truth }, fraction: right ? 1 : 0 };
    }
    case 'fill_blanks': {
      const second = right || rand() < 0.5;
      return {
        answer: { blanks: [right ? ' Went.' : 'go', second ? 'isn’t' : 'is'] },
        fraction: (right ? 0.5 : 0) + (second ? 0.5 : 0),
      };
    }
    case 'matching': {
      const pairs: Record<string, string> = Object.fromEntries(stored.content.items.map((i: any) => [i.id, i.matchingPair]));
      if (!right) [pairs.m1, pairs.m2] = [pairs.m2!, pairs.m1!];
      return { answer: { pairs }, fraction: right ? 1 : 0.5 };
    }
    default: {
      const ids = stored.content.items.map((i: any) => i.id);
      if (!right) [ids[0], ids[1]] = [ids[1], ids[0]];
      const answer = stored.type === 'ordering' ? { order: ids } : { positions: Object.fromEntries(ids.map((id: string, i: number) => [id, i + 1])) };
      return { answer, fraction: right ? 1 : 0.8 };
    }
  }
}

// ── Cohort ────────────────────────────────────────────────────────────────────
interface Candidate { id: ObjectId; attempt: ObjectId; ability: number; expected: number; blank?: boolean; perfect?: boolean }
const examId = new ObjectId();
const sessionId = new ObjectId();
const bank = new Map<string, Q[]>();
const cohort: Candidate[] = [];
const results = new Map<string, any>();

before(async () => {
  await connectDB();
  for (const s of SECTIONS) bank.set(s.competency, Array.from({ length: s.count }, () => makeQuestion(s.competency)));
  fakeCollection(DB, 'questions').docs.push(...[...bank.values()].flat());
  fakeCollection(DB, 'exams').docs.push({
    _id: examId, name: 'Simulación A2', type: 'final', targetLevel: 'A2',
    structure: { passingScore: PASSING, sections: SECTIONS.map((s) => ({ name: s.competency, competency: s.competency, weight: s.weight, questionCount: s.count, duration: 10 })) },
  });
  fakeCollection(DB, 'levels').docs.push({
    code: 'A2', isActive: true, overallMinScore: PASSING,
    competencyRequirements: Object.fromEntries(SECTIONS.map((s) => [s.competency, { minScore: 50 }])),
  });

  for (let c = 0; c < CANDIDATES; c++) {
    const cand: Candidate = { id: new ObjectId(), attempt: new ObjectId(), ability: c === 0 ? 9 : c === 1 ? -9 : 1.2 * gauss(), expected: 0 };
    if (c === 0) cand.perfect = true;
    if (c === 1) cand.blank = true;
    let weighted = 0;
    for (const s of SECTIONS) {
      let got = 0;
      let max = 0;
      for (const qn of bank.get(s.competency)!) {
        max += qn.metadata.points;
        if (cand.blank) continue;
        const p = cand.perfect ? 1 : 1 / (1 + Math.exp(-(cand.ability - (qn.difficulty - 3) * 0.8)));
        const a = answer(qn, p);
        got += a.fraction * qn.metadata.points;
        fakeCollection(DB, 'responses').docs.push({ _id: new ObjectId(), sessionId, candidateId: cand.id, examId, questionId: qn._id, answer: a.answer });
      }
      weighted += (got / max) * s.weight;
    }
    cand.expected = weighted; // weights sum to 100
    fakeCollection('cba_identity_db', 'candidates').docs.push({ _id: cand.id, personalInfo: { firstName: `C${c}`, lastName: 'Sim' } });
    fakeCollection(DB, 'attempts').docs.push({
      _id: cand.attempt, examId, sessionId, candidateId: cand.id, status: 'completed',
      startedAt: new Date(Date.now() - 3e6), finishedAt: new Date(), timeAllowedSeconds: 5400,
      sectionsStructure: SECTIONS.map((s) => ({ id: s.competency, name: s.competency, competency: s.competency, duration: 10, weight: s.weight, questionCount: s.count, questionIds: bank.get(s.competency)!.map((q) => q._id) })),
    });
    cohort.push(cand);
  }
  for (const cand of cohort) {
    await gradeExam(cand.attempt.toString());
    results.set(String(cand.attempt), fakeCollection(DB, 'exam_results').docs.find((r: any) => String(r.attemptId) === String(cand.attempt)));
  }
});

const spearman = (a: number[], b: number[]) => {
  const rank = (v: number[]) => { const s = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]); const r = Array(v.length); s.forEach(([, i], k) => (r[i] = k)); return r as number[]; };
  const ra = rank(a); const rb = rank(b); const n = a.length;
  const d2 = ra.reduce((sum, r, i) => sum + (r - rb[i]!) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
};

describe(`exam simulation: ${CANDIDATES} candidates, ${SECTIONS.reduce((n, s) => n + s.count, 0)} questions each`, () => {
  test('every exam is graded, scores stay in range and add up', () => {
    for (const cand of cohort) {
      const r = results.get(String(cand.attempt));
      assert.ok(r, 'result stored');
      assert.equal(r.status, 'completed');
      assert.ok(r.percentage >= 0 && r.percentage <= 100);
      assert.ok(r.totalScore <= r.maxScore + 1e-9);
      const sum = r.questionResults.reduce((s: number, q: any) => s + q.score, 0);
      assert.ok(Math.abs(sum - r.totalScore) < 0.01, `total ${r.totalScore} vs sum ${sum}`);
    }
  });

  test('the final percentage is the weighted section score the candidate actually earned', () => {
    for (const cand of cohort) {
      const r = results.get(String(cand.attempt));
      assert.ok(Math.abs(r.percentage - cand.expected) <= 0.1, `expected ${cand.expected.toFixed(2)} got ${r.percentage}`);
    }
  });

  test('a perfect candidate gets 100 and passes; a blank one gets 0, fails and does not crash', () => {
    const perfect = results.get(String(cohort[0]!.attempt));
    const blank = results.get(String(cohort[1]!.attempt));
    assert.equal(perfect.percentage, 100);
    assert.equal(perfect.passed, true);
    assert.equal(blank.percentage, 0);
    assert.equal(blank.passed, false);
  });

  test('pass/fail and mastery follow the configured thresholds for everyone', () => {
    for (const cand of cohort) {
      const r = results.get(String(cand.attempt));
      assert.equal(r.passed, r.percentage >= PASSING);
      const comp = new Map(r.competencyScores.map((c: any) => [c.competency, c.percentage]));
      for (const m of r.competencyMastery.competencies) assert.equal(m.achieved, (comp.get(m.competency) as number) >= 50);
      assert.equal(r.competencyMastery.overall.achieved, r.percentage >= PASSING);
    }
  });

  test('better candidates score higher (rank correlation ability ↔ score)', () => {
    const live = cohort.slice(2);
    const rho = spearman(live.map((c) => c.ability), live.map((c) => results.get(String(c.attempt)).percentage));
    assert.ok(rho > 0.8, `spearman ${rho.toFixed(3)}`);
  });

  test('regrading the same attempt gives the same result', async () => {
    const cand = cohort[5]!;
    const before = results.get(String(cand.attempt)).percentage;
    await gradeExam(cand.attempt.toString(), { force: true });
    const after = fakeCollection(DB, 'exam_results').docs.find((r: any) => String(r.attemptId) === String(cand.attempt))!;
    assert.equal(after.percentage, before);
  });
});
