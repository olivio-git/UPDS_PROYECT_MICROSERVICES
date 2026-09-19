/*
 * End-to-end check against a running stack: two students take the same exam
 * session through the real API (via the nginx gateway), and each student's
 * answers, timer and finish action must land on their OWN attempt.
 *
 * It also exercises "one person, one id": each student's JWT id, profile _id
 * and candidate _id are the same value, with no translation in between.
 *
 * Creates two throwaway students (@example.com), one exam built from the
 * question bank and one in-progress session, and deletes everything it created
 * at the end, even on failure.
 *
 * Run inside the exam-service container:
 *   docker cp scripts/e2e/exam-attempt-scope.e2e.js exam-service:/app/e2e.js
 *   docker exec -w /app exam-service node e2e.js
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
const TAG = `e2e-${Date.now()}`;
const { ObjectId } = mongoose.Types;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

async function api(method, path, token, body) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('ABORT: NODE_ENV=production re-validates tokens with auth-service; test tokens would be rejected.');
    process.exitCode = 2;
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
  const exams = mongoose.connection.db; // exam database (cba_platform)
  const people = mongoose.connection.client.db(process.env.MONGO_UMS_DB_NAME || 'cba_user_management_db');
  const created = { personIds: [], sessionId: null, examId: null };

  try {
    // A throwaway exam built on whatever the question bank can cover, so the
    // test does not depend on exams existing in the database.
    const [pick] = await exams.collection('questions').aggregate([
      { $match: { isActive: true, type: 'multiple_choice' } },
      { $group: { _id: { level: '$level', competency: '$competency' }, n: { $sum: 1 } } },
      { $match: { n: { $gte: 2 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]).toArray();
    if (!pick) throw new Error('the question bank has no level/competency with 2+ active multiple-choice questions');
    const examId = new ObjectId();
    await exams.collection('exams').insertOne({
      _id: examId, name: TAG, description: 'E2E throwaway exam', type: 'practice', targetLevel: pick._id.level,
      structure: {
        sections: [{ name: 'E2E', competency: pick._id.competency, duration: 30, questionCount: 2, weight: 100 }],
        totalDuration: 30, passingScore: 60,
      },
      configuration: { randomizeQuestions: false, allowReview: true, showResults: true, attemptsAllowed: 1, timeBetweenAttempts: 0 },
      isActive: true, isTemplate: false, createdBy: new ObjectId(), createdAt: new Date(), updatedAt: new Date(),
    });
    created.examId = examId;
    const exam = await exams.collection('exams').findOne({ _id: examId });
    console.log(`Throwaway exam: level ${exam.targetLevel}, ${pick._id.competency}, 2 questions`);

    const students = [];
    for (const who of ['alice', 'bob']) {
      // One person, one id.
      const id = new ObjectId();
      const email = `${TAG}-${who}@example.com`;
      await people.collection('users').insertOne({
        _id: id, authServiceUserId: String(id), email, firstName: 'E2E', lastName: who,
        role: 'student', isActive: true, createdAt: new Date(),
      });
      await people.collection('candidates').insertOne({
        _id: id, userId: id, personalInfo: { firstName: 'E2E', lastName: who, email },
        academicInfo: { currentLevel: exam.targetLevel, targetLevel: exam.targetLevel }, createdAt: new Date(),
      });
      created.personIds.push(id);
      const token = jwt.sign({ userId: String(id), email, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '10m' });
      students.push({ who, id, token });
    }
    const [alice, bob] = students;

    const sessionId = new ObjectId();
    const now = Date.now();
    await exams.collection('sessions').insertOne({
      _id: sessionId, examId: exam._id, sessionName: TAG,
      scheduling: { startDate: new Date(now - 60_000), endDate: new Date(now + 3_600_000), timeZone: 'America/La_Paz', timeSlots: [] },
      participants: { maxCandidates: 5, registeredCandidates: [alice.id, bob.id], proctors: [], currentActive: 0 },
      settings: { requireProctor: false, recordSession: false, browserLockdown: false, allowLateEntry: true, autoStart: false, lateEntryMinutes: 30 },
      status: 'in_progress', createdBy: alice.id, createdAt: new Date(), updatedAt: new Date(),
    });
    created.sessionId = sessionId;
    const sid = String(sessionId);

    for (const s of [alice, bob]) {
      const r = await api('POST', `/api/v1/exam-taking/${sid}/start`, s.token);
      check(`${s.who} can start (JWT id used directly as candidate id)`, r.status === 200, `HTTP ${r.status}${r.json?.message ? ` ${r.json.message}` : ''}`);
      if (r.status !== 200) throw new Error(`start failed for ${s.who}`);
    }

    const attempts = await exams.collection('attempts').find({ sessionId }).toArray();
    check('one attempt per student', attempts.length === 2, `${attempts.length}`);
    const attemptOf = (s) => attempts.find((a) => String(a.candidateId) === String(s.id));
    check('attempt candidateId is the person id', !!attemptOf(alice) && !!attemptOf(bob));
    const questionId = String(attemptOf(alice)?.questionIds?.[0] ?? '');
    if (!questionId) throw new Error('attempt has no questions');

    for (const s of [alice, bob]) {
      const r = await api('POST', `/api/v1/exam-taking/${sid}/answer`, s.token, { questionId, answer: { selectedOptions: [`${s.who}-choice`] } });
      check(`${s.who} can answer`, r.status === 200, `HTTP ${r.status}`);
    }
    const responses = await exams.collection('responses').find({ sessionId, questionId: new ObjectId(questionId) }).toArray();
    check('two separate responses', responses.length === 2, `${responses.length}`);
    for (const s of [alice, bob]) {
      const mine = responses.find((r) => String(r.candidateId) === String(s.id));
      check(`${s.who}'s answer stored under ${s.who}`, mine?.answer?.selectedOptions?.[0] === `${s.who}-choice`);
    }

    const fin = await api('POST', `/api/v1/exam-taking/${sid}/finish`, bob.token);
    check('bob can finish', fin.status === 200, `HTTP ${fin.status}`);
    const after = await exams.collection('attempts').find({ sessionId }).toArray();
    const bobA = after.find((a) => String(a.candidateId) === String(bob.id));
    const aliceA = after.find((a) => String(a.candidateId) === String(alice.id));
    check("finish closed bob's attempt", bobA?.status === 'completed', bobA?.status);
    check("alice's attempt stays open", aliceA?.status === 'in_progress', aliceA?.status);

    for (let i = 0; i < 20; i++) {
      if (await exams.collection('exam_results').countDocuments({ attemptId: bobA._id })) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    if (created.sessionId) {
      const ids = (await exams.collection('attempts').find({ sessionId: created.sessionId }).project({ _id: 1 }).toArray()).map((a) => a._id);
      await exams.collection('exam_results').deleteMany({ $or: [{ attemptId: { $in: ids } }, { sessionId: created.sessionId }] });
      await exams.collection('responses').deleteMany({ sessionId: created.sessionId });
      await exams.collection('attempts').deleteMany({ sessionId: created.sessionId });
      await exams.collection('sessions').deleteOne({ _id: created.sessionId });
    }
    if (created.examId) await exams.collection('exams').deleteOne({ _id: created.examId });
    await people.collection('candidates').deleteMany({ _id: { $in: created.personIds } });
    await people.collection('users').deleteMany({ _id: { $in: created.personIds } });
    console.log('cleanup done');
    await mongoose.disconnect();
  }

  if (results.length) {
    const failed = results.filter((ok) => !ok).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed`);
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(async (e) => { console.error('ERROR:', e.message); process.exitCode = 1; await mongoose.disconnect().catch(() => {}); });
