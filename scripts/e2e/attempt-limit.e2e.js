/*
 * End-to-end check of exam.configuration.attemptsAllowed against a running
 * stack (exam-service utils/attemptLimit.ts, examTaking.service.ts
 * assertAttemptsLeft):
 *   - attemptsAllowed 1 and one finished attempt in an earlier session:
 *     starting a new session is refused with 403 ATTEMPTS_EXHAUSTED.
 *   - a cancelled earlier attempt does not count.
 *   - attemptsAllowed 0 means no limit: the same student can start.
 *
 * Creates one throwaway student (@example.com), one exam and two sessions,
 * and deletes everything it created at the end, even on failure.
 *
 * Run inside the exam-service container:
 *   docker cp scripts/e2e/attempt-limit.e2e.js exam-service:/app/exam-service/attempt-limit.e2e.js
 *   docker exec -w /app/exam-service exam-service node attempt-limit.e2e.js
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

// Same passing technical verification as exam-attempt-scope.e2e.js: start()
// refuses a new attempt without one.
async function submitPassingVerification(token, sessionId, userId) {
  const init = await api('POST', '/api/v1/technical/init', token, { sessionId, userId });
  if (init.status !== 200 || !init.json?.data?.verificationId) {
    throw new Error(`technical/init failed: HTTP ${init.status} ${JSON.stringify(init.json)}`);
  }
  const verificationId = init.json.data.verificationId;
  await api('POST', `/api/v1/technical/${verificationId}/browser`, token, {
    browserInfo: { userAgent: 'Mozilla/5.0 Chrome/120.0', platform: 'Linux', language: 'es-BO', cookieEnabled: true, javaEnabled: false },
    systemInfo: { screen: { width: 1920, height: 1080, colorDepth: 24 }, timezone: 'America/La_Paz', onlineStatus: true },
  });
  await api('POST', `/api/v1/technical/${verificationId}/devices`, token, {
    devices: { audioInputs: [{ deviceId: 'e2e-mic', label: 'E2E Mic' }], videoInputs: [], audioOutputs: [{ deviceId: 'e2e-spk', label: 'E2E Speaker' }] },
  });
  await api('POST', `/api/v1/technical/${verificationId}/permissions`, token, {
    permissions: { microphone: 'granted', camera: 'denied', notifications: 'default' },
  });
  await api('POST', `/api/v1/technical/${verificationId}/network-test`, token);
  await api('POST', `/api/v1/technical/${verificationId}/microphone-test`, token, { audioLevel: 0.5 });
  await api('POST', `/api/v1/technical/${verificationId}/audio-test`, token, { canHear: true });
  await api('POST', `/api/v1/technical/${verificationId}/finalize`, token);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('ABORT: NODE_ENV=production re-validates tokens against identity-service; test tokens would be rejected.');
    process.exitCode = 2;
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
  const exams = mongoose.connection.db;
  const people = mongoose.connection.client.db(process.env.MONGO_UMS_DB_NAME || 'cba_identity_db');
  const created = { personId: null, sessionIds: [], examId: null };

  try {
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

    const id = new ObjectId();
    const email = `${TAG}-carla@example.com`;
    await people.collection('users').insertOne({
      _id: id, authServiceUserId: String(id), email, firstName: 'E2E', lastName: 'carla',
      role: 'student', isActive: true, status: 'active', createdAt: new Date(),
    });
    await people.collection('candidates').insertOne({
      _id: id, userId: id, personalInfo: { firstName: 'E2E', lastName: 'carla', email },
      academicInfo: { currentLevel: pick._id.level, targetLevel: pick._id.level }, createdAt: new Date(),
    });
    created.personId = id;
    const token = jwt.sign({ userId: String(id), email, role: 'student' }, process.env.JWT_SECRET, {
      expiresIn: '10m', issuer: 'cba-auth-service', audience: 'cba-platform',
    });

    const now = Date.now();
    const makeSession = async (status) => {
      const sessionId = new ObjectId();
      await exams.collection('sessions').insertOne({
        _id: sessionId, examId, sessionName: `${TAG}-${created.sessionIds.length}`,
        scheduling: { startDate: new Date(now - 60_000), endDate: new Date(now + 3_600_000), timeZone: 'America/La_Paz', timeSlots: [] },
        participants: { maxCandidates: 5, registeredCandidates: [id], proctors: [], currentActive: 0 },
        settings: { requireProctor: false, recordSession: false, browserLockdown: false, allowLateEntry: true, autoStart: false, lateEntryMinutes: 30 },
        status, createdBy: id, createdAt: new Date(), updatedAt: new Date(),
      });
      created.sessionIds.push(sessionId);
      return sessionId;
    };

    // An earlier session the student already finished.
    const earlier = await makeSession('completed');
    const earlierAttemptId = new ObjectId();
    await exams.collection('attempts').insertOne({
      _id: earlierAttemptId, sessionId: earlier, examId, candidateId: id, status: 'completed',
      questionIds: [], startedAt: new Date(now - 7_200_000), finishedAt: new Date(now - 5_400_000),
      createdAt: new Date(), updatedAt: new Date(),
    });

    const current = await makeSession('in_progress');
    const sid = String(current);
    await submitPassingVerification(token, sid, String(id));

    let r = await api('POST', `/api/v1/exam-taking/${sid}/start`, token);
    check('1 attempt allowed, 1 used: start refused with 403', r.status === 403, `HTTP ${r.status} ${r.json?.message ?? ''}`);
    check('refusal says the exam was already taken', /Ya rendiste/.test(r.json?.message ?? ''), r.json?.message);
    check('no attempt created in the new session', (await exams.collection('attempts').countDocuments({ sessionId: current })) === 0);

    await exams.collection('attempts').updateOne({ _id: earlierAttemptId }, { $set: { status: 'cancelled' } });
    r = await api('POST', `/api/v1/exam-taking/${sid}/start`, token);
    check('a cancelled earlier attempt does not count', r.status === 200, `HTTP ${r.status} ${r.json?.message ?? ''}`);

    // Back to a counted earlier attempt, a fresh session, and no limit.
    await exams.collection('attempts').updateOne({ _id: earlierAttemptId }, { $set: { status: 'completed' } });
    await exams.collection('exams').updateOne({ _id: examId }, { $set: { 'configuration.attemptsAllowed': 0 } });
    const unlimited = await makeSession('in_progress');
    await submitPassingVerification(token, String(unlimited), String(id));
    r = await api('POST', `/api/v1/exam-taking/${String(unlimited)}/start`, token);
    check('attemptsAllowed 0 means no limit: start allowed', r.status === 200, `HTTP ${r.status} ${r.json?.message ?? ''}`);
  } finally {
    if (created.sessionIds.length) {
      const sessionFilter = { sessionId: { $in: created.sessionIds } };
      const ids = (await exams.collection('attempts').find(sessionFilter).project({ _id: 1 }).toArray()).map((a) => a._id);
      await exams.collection('exam_results').deleteMany({ $or: [{ attemptId: { $in: ids } }, sessionFilter] });
      await exams.collection('responses').deleteMany(sessionFilter);
      await exams.collection('attempts').deleteMany(sessionFilter);
      await exams.collection('sessions').deleteMany({ _id: { $in: created.sessionIds } });
    }
    if (created.examId) await exams.collection('exams').deleteOne({ _id: created.examId });
    if (created.personId) {
      await people.collection('candidates').deleteOne({ _id: created.personId });
      await people.collection('users').deleteOne({ _id: created.personId });
    }
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
