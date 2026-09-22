/*
 * End-to-end check of the technical-verification gate against a running
 * stack (PR10): exam-taking start/adaptive-start must BLOCK creating a new
 * attempt when the candidate has no passing technical verification on file,
 * enforced server-side (session-manager holds the verification, exam-service
 * calls its internal can-proceed endpoint before creating an attempt).
 *
 * Covers:
 *   (a) no verification at all -> start is blocked (403, code
 *       TECHNICAL_VERIFICATION_REQUIRED)
 *   (b) submitting a passing verification through the PUBLIC api/v1/technical
 *       API with the student's own token -> start then succeeds
 *   (c) a verification with a failed microphone test blocks starting an exam
 *       that has a speaking/audio_response question (mic reason present),
 *       but the SAME verification is accepted for an exam with no such
 *       question
 *   (d) another student's token cannot read or write the first student's
 *       verification record (403 both ways)
 *   (e) no token at all on a technical route -> 401
 *   (f) resuming an existing in_progress attempt is never blocked, even
 *       after the verification record is deleted/expired
 *
 * Creates two throwaway students (@example.com — RFC 2606 reserved, so any
 * attempted email is never delivered), one throwaway audio_response
 * question (only created if the bank has none active), two throwaway exams
 * (with/without an audio question) and their sessions, and deletes
 * everything it created — including the session-manager Redis verification
 * keys it wrote — at the end, even on failure.
 *
 * Run inside the exam-service container (it has mongoose, jsonwebtoken and
 * the `redis` client already in node_modules):
 *   docker cp scripts/e2e/technical-gate.e2e.js exam-service:/app/exam-service/technical-gate.e2e.js
 *   docker exec -w /app/exam-service exam-service node technical-gate.e2e.js
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
const TAG = `e2e-techgate-${Date.now()}`;
const { ObjectId } = mongoose.Types;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

async function api(method, path, token, body) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// Same 8 calls a real browser makes from ExamPreparation.tsx, via the public
// gateway-proxied /api/v1/technical/* API — never touches Redis directly.
// Returns the verificationId. `micLevel` below the service's 0.1 threshold
// (default in TechnicalVerificationService.verifyMicrophone) produces a
// FAILED microphone check while everything else still passes.
async function submitVerification(token, sessionId, userId, { micLevel = 0.5 } = {}) {
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
  await api('POST', `/api/v1/technical/${verificationId}/microphone-test`, token, { audioLevel: micLevel });
  await api('POST', `/api/v1/technical/${verificationId}/audio-test`, token, { canHear: true });
  await api('POST', `/api/v1/technical/${verificationId}/finalize`, token);
  return verificationId;
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

  // Same Redis instance session-manager-service writes to (REDIS_HOST=redis
  // for both services in docker-compose.yml, database 0 for both — no `db`
  // option is set by either). Used only to simulate an expired/deleted
  // verification (test f) and to clean up every key this script wrote.
  const redis = createClient({
    socket: { host: process.env.REDIS_HOST || 'redis', port: parseInt(process.env.REDIS_PORT || '6379', 10) },
    password: process.env.REDIS_PASSWORD || undefined,
  });
  redis.on('error', () => {}); // avoid unhandled 'error' events during teardown races
  await redis.connect();

  const created = { personIds: [], sessionIds: [], examIds: [], questionIds: [], verificationIds: [] };

  try {
    // ── Throwaway question bank ────────────────────────────────────────────
    const [pick] = await exams.collection('questions').aggregate([
      { $match: { isActive: true, type: 'multiple_choice' } },
      { $group: { _id: { level: '$level', competency: '$competency' }, n: { $sum: 1 } } },
      { $match: { n: { $gte: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]).toArray();
    if (!pick) throw new Error('the question bank has no level/competency with an active multiple-choice question');
    const level = pick._id.level;

    // Throwaway audio_response question — created regardless of what's
    // already in the bank, so this suite doesn't depend on the fixture data
    // happening to include a speaking question at this level.
    const audioQuestionId = new ObjectId();
    await exams.collection('questions').insertOne({
      _id: audioQuestionId, type: 'audio_response', competency: 'speaking', level, difficulty: 1,
      content: { question: `${TAG} say hello`, expectedResponseType: 'sentence' },
      metadata: { points: 1 },
      statistics: { timesUsed: 0, averageScore: 0, averageTime: 0, difficulty: 1 },
      isActive: true, createdBy: new ObjectId(), createdAt: new Date(), updatedAt: new Date(),
    });
    created.questionIds.push(audioQuestionId);

    const makeExam = async (name, { withAudio }) => {
      const examId = new ObjectId();
      const sections = [{ name: 'E2E', competency: pick._id.competency, duration: 30, questionCount: 1, weight: withAudio ? 50 : 100 }];
      if (withAudio) sections.push({ name: 'E2E-Speaking', competency: 'speaking', duration: 30, questionCount: 1, weight: 50 });
      await exams.collection('exams').insertOne({
        _id: examId, name: `${TAG}-${name}`, description: 'E2E throwaway exam', type: 'practice', targetLevel: level,
        structure: { sections, totalDuration: 30, passingScore: 60 },
        configuration: { randomizeQuestions: false, allowReview: true, showResults: true, attemptsAllowed: 1, timeBetweenAttempts: 0 },
        isActive: true, isTemplate: false, createdBy: new ObjectId(), createdAt: new Date(), updatedAt: new Date(),
      });
      created.examIds.push(examId);
      return examId;
    };
    const examNoAudioId = await makeExam('no-audio', { withAudio: false });
    const examAudioId = await makeExam('audio', { withAudio: true });

    // ── Throwaway students ──────────────────────────────────────────────────
    const makeStudent = async (who) => {
      const id = new ObjectId();
      const email = `${TAG}-${who}@example.com`;
      await people.collection('users').insertOne({
        _id: id, authServiceUserId: String(id), email, firstName: 'E2E', lastName: who,
        role: 'student', isActive: true, status: 'active', createdAt: new Date(),
      });
      await people.collection('candidates').insertOne({
        _id: id, userId: id, personalInfo: { firstName: 'E2E', lastName: who, email },
        academicInfo: { currentLevel: level, targetLevel: level }, createdAt: new Date(),
      });
      created.personIds.push(id);
      // issuer/audience required: session-manager-service's authenticate
      // middleware verifies these strictly (same as identity-service's
      // jwt.service.ts), unlike exam-service's own authMiddleware which
      // only checks the secret.
      const token = jwt.sign({ userId: String(id), email, role: 'student' }, process.env.JWT_SECRET, {
        expiresIn: '10m',
        issuer: 'cba-auth-service',
        audience: 'cba-platform',
      });
      return { who, id, token };
    };
    const a = await makeStudent('a'); // no verification, then a passing one; also the resume test
    const b = await makeStudent('b'); // mic-failed verification
    const c = await makeStudent('c'); // attacker for the ownership checks

    const makeSession = async (examId, candidateIds) => {
      const sessionId = new ObjectId();
      const now = Date.now();
      await exams.collection('sessions').insertOne({
        _id: sessionId, examId, sessionName: TAG,
        scheduling: { startDate: new Date(now - 60_000), endDate: new Date(now + 3_600_000), timeZone: 'America/La_Paz', timeSlots: [] },
        participants: { maxCandidates: 5, registeredCandidates: candidateIds, proctors: [], currentActive: 0 },
        settings: { requireProctor: false, recordSession: false, browserLockdown: false, allowLateEntry: true, autoStart: false, lateEntryMinutes: 30 },
        status: 'in_progress', createdBy: candidateIds[0], createdAt: new Date(), updatedAt: new Date(),
      });
      created.sessionIds.push(sessionId);
      return String(sessionId);
    };
    const sidNoAudio = await makeSession(examNoAudioId, [a.id, b.id, c.id]);
    const sidAudio = await makeSession(examAudioId, [b.id]);

    // ── (a) no verification at all -> blocked ───────────────────────────────
    const blockedA = await api('POST', `/api/v1/exam-taking/${sidNoAudio}/start`, a.token);
    check('(a) no verification -> start blocked', blockedA.status === 403 && blockedA.json?.code === 'TECHNICAL_VERIFICATION_REQUIRED',
      `HTTP ${blockedA.status} code=${blockedA.json?.code}`);
    check('(a) reasons include NOT_FOUND', (blockedA.json?.reasons || []).some((r) => r.code === 'NOT_FOUND'),
      JSON.stringify(blockedA.json?.reasons));
    const attemptsAfterBlockedA = await exams.collection('attempts').countDocuments({ sessionId: created.sessionIds[0], candidateId: a.id });
    check('(a) no attempt was created while blocked', attemptsAfterBlockedA === 0, `${attemptsAfterBlockedA}`);

    // ── (b) passing verification via the public API -> start succeeds ──────
    const verifA = await submitVerification(a.token, sidNoAudio, String(a.id));
    created.verificationIds.push({ verificationId: verifA, userId: String(a.id) });
    const startA = await api('POST', `/api/v1/exam-taking/${sidNoAudio}/start`, a.token);
    check('(b) passing verification -> start succeeds', startA.status === 200, `HTTP ${startA.status} ${JSON.stringify(startA.json?.message || '')}`);

    // ── (c) mic-failed verification: blocked with audio, allowed without ───
    const verifB = await submitVerification(b.token, sidAudio, String(b.id), { micLevel: 0.01 });
    created.verificationIds.push({ verificationId: verifB, userId: String(b.id) });
    const blockedC = await api('POST', `/api/v1/exam-taking/${sidAudio}/start`, b.token);
    check('(c) mic failed + audio exam -> blocked', blockedC.status === 403 && blockedC.json?.code === 'TECHNICAL_VERIFICATION_REQUIRED',
      `HTTP ${blockedC.status} code=${blockedC.json?.code}`);
    check('(c) reasons include MICROPHONE_FAILED', (blockedC.json?.reasons || []).some((r) => r.code === 'MICROPHONE_FAILED'),
      JSON.stringify(blockedC.json?.reasons));
    const allowedC = await api('POST', `/api/v1/exam-taking/${sidNoAudio}/start`, b.token);
    check('(c) same verification + no-audio exam -> allowed', allowedC.status === 200, `HTTP ${allowedC.status} ${JSON.stringify(allowedC.json?.message || '')}`);

    // ── (d) ownership: another student cannot read or write the record ─────
    const readOther = await api('GET', `/api/v1/technical/${verifA}`, c.token);
    check('(d) other student cannot READ the verification', readOther.status === 403, `HTTP ${readOther.status}`);
    const writeOther = await api('POST', `/api/v1/technical/${verifA}/audio-test`, c.token, { canHear: true });
    check('(d) other student cannot WRITE the verification', writeOther.status === 403, `HTTP ${writeOther.status}`);

    // ── (e) no token at all -> 401 ───────────────────────────────────────────
    const noToken = await api('GET', `/api/v1/technical/${verifA}`, null);
    check('(e) no token -> 401', noToken.status === 401, `HTTP ${noToken.status}`);

    // ── (f) resume ignores a deleted/expired verification ──────────────────
    // `a` already has an in_progress attempt on sidNoAudio from (b). Delete
    // their verification record entirely, then start() again (re-entry —
    // no existing-attempt-blocking path) must still succeed.
    await redis.del(`tech_verify:${verifA}`);
    await redis.del(`user_tech:${String(a.id)}`);
    const resumeA = await api('POST', `/api/v1/exam-taking/${sidNoAudio}/start`, a.token);
    check('(f) resume works after verification is deleted', resumeA.status === 200, `HTTP ${resumeA.status} ${JSON.stringify(resumeA.json?.message || '')}`);
  } finally {
    // ── Cleanup: Mongo ───────────────────────────────────────────────────────
    for (const sessionId of created.sessionIds) {
      const ids = (await exams.collection('attempts').find({ sessionId }).project({ _id: 1 }).toArray()).map((a) => a._id);
      await exams.collection('exam_results').deleteMany({ $or: [{ attemptId: { $in: ids } }, { sessionId }] });
      await exams.collection('responses').deleteMany({ sessionId });
      await exams.collection('attempts').deleteMany({ sessionId });
      await exams.collection('sessions').deleteOne({ _id: sessionId });
    }
    if (created.examIds.length) await exams.collection('exams').deleteMany({ _id: { $in: created.examIds } });
    if (created.questionIds.length) await exams.collection('questions').deleteMany({ _id: { $in: created.questionIds } });
    if (created.personIds.length) {
      await people.collection('candidates').deleteMany({ _id: { $in: created.personIds } });
      await people.collection('users').deleteMany({ _id: { $in: created.personIds } });
    }

    // ── Cleanup: session-manager's Redis verification keys ─────────────────
    for (const { verificationId, userId } of created.verificationIds) {
      await redis.del(`tech_verify:${verificationId}`).catch(() => {});
      await redis.del(`user_tech:${userId}`).catch(() => {});
    }
    await redis.quit().catch(() => {});

    console.log('cleanup done');
    await mongoose.disconnect();
  }

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
}

main().catch(async (e) => {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => {});
});
