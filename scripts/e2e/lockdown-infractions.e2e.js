/*
 * End-to-end check of the browser-lockdown infraction pipeline against a
 * running stack:
 *   - exam-taking POST /:sessionId/infractions is candidate-scoped (via
 *     searchRefs, same as start/answer/finish) and only accepts infractions
 *     for an `in_progress` attempt (409 ATTEMPT_NOT_IN_PROGRESS otherwise,
 *     same code/shape as the other exam-taking routes — see
 *     kick-and-push.e2e.js for that pattern).
 *   - Server-side rate limit: infractions faster than 1/sec per attempt are
 *     accepted (HTTP 200) but NOT counted (`accepted: false`, unchanged
 *     infractionCount) — see ExamTakingService.recordInfraction.
 *   - Accepted infractions persist on the attempt as
 *     `integrity.{infractionCount,lastInfractionAt,events[]}`.
 *   - exam-service publishes `session.candidate.infraction` on exam-events
 *     (legacy producer path, same as session.candidate.kicked), throttled to
 *     at most once per attempt per 10s. notifications-service consumes it
 *     and pushes a socket event to the session's proctors + creator ONLY —
 *     never to the candidate, and with no in-app notification row (that
 *     would spam the proctor's bell icon on every infraction).
 *   - Another candidate's token cannot post infractions against this
 *     session/attempt (searchRefs resolves candidateId from the JWT, so a
 *     second student's token records against — or fails to find — their OWN
 *     attempt, never the first student's).
 *   - infractions after finish() return 409 (attempt no longer in_progress).
 *   - GET /sessions/:id/progress surfaces infractionCount for the candidate.
 *
 * Modeled on kick-and-push.e2e.js (same throwaway-fixture / socket-auth /
 * cleanup conventions) and technical-gate.e2e.js (submitPassingVerification
 * helper — PR10's technical-verification gate must be satisfied before
 * exam-taking start() creates a new attempt).
 *
 * Run inside the exam-service container:
 *   docker cp scripts/e2e/lockdown-infractions.e2e.js exam-service:/app/exam-service/lockdown-infractions.e2e.js
 *   docker exec -w /app/exam-service exam-service node lockdown-infractions.e2e.js
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
const NOTIF_URL = process.env.E2E_NOTIF_WS_URL || 'http://notification-service:3001';
const TAG = `e2e-lockdown-${Date.now()}`;
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

// PR10: exam-taking start blocks a brand-new attempt unless the candidate
// has a passing technical verification on file.
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
  return verificationId;
}

function waitFor(fn, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  return (async () => {
    for (;;) {
      const value = await fn();
      if (value) return value;
      if (Date.now() > deadline) return null;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
}

const JWT_ISSUER = 'cba-auth-service';
const JWT_AUDIENCE = 'cba-platform';

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '10m',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

function connectSocket(token) {
  return io(NOTIF_URL, { auth: { token }, transports: ['websocket', 'polling'] });
}

function waitForConnect(socket, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (socket.connected) return resolve(true);
    const timer = setTimeout(() => resolve(false), timeoutMs);
    socket.once('connect', () => { clearTimeout(timer); resolve(true); });
    socket.once('connect_error', () => { clearTimeout(timer); resolve(false); });
  });
}

function waitForEvent(socket, event, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
  });
}

// Collects every occurrence of `event` seen within `windowMs`, for asserting
// the 10s publish-throttle coalesces a burst into <= 1 push.
function collectEvents(socket, event, windowMs) {
  const seen = [];
  const handler = (data) => seen.push(data);
  socket.on(event, handler);
  return new Promise((resolve) => {
    setTimeout(() => {
      socket.off(event, handler);
      resolve(seen);
    }, windowMs);
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('ABORT: NODE_ENV=production re-validates tokens against identity-service; test tokens would be rejected.');
    process.exitCode = 2;
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
  const exams = mongoose.connection.db; // exam database (cba_platform)
  const people = mongoose.connection.client.db(process.env.MONGO_UMS_DB_NAME || 'cba_identity_db');
  const created = { studentAId: null, studentBId: null, sessionId: null, examId: null };

  let studentASocket = null;
  let proctorSocket = null;

  try {
    // ---- Setup: exam (browserLockdown ON), session, two students, proctor ----
    const [pick] = await exams.collection('questions').aggregate([
      { $match: { isActive: true, type: 'multiple_choice' } },
      { $group: { _id: { level: '$level', competency: '$competency' }, n: { $sum: 1 } } },
      { $match: { n: { $gte: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]).toArray();
    if (!pick) throw new Error('the question bank has no level/competency with an active multiple-choice question');

    const examId = new ObjectId();
    await exams.collection('exams').insertOne({
      _id: examId, name: TAG, description: 'E2E lockdown-infractions throwaway exam', type: 'practice', targetLevel: pick._id.level,
      structure: {
        sections: [{ name: 'E2E', competency: pick._id.competency, duration: 30, questionCount: 1, weight: 100 }],
        totalDuration: 30, passingScore: 60,
      },
      configuration: { randomizeQuestions: false, allowReview: true, showResults: true, attemptsAllowed: 1, timeBetweenAttempts: 0 },
      isActive: true, isTemplate: false, createdBy: new ObjectId(), createdAt: new Date(), updatedAt: new Date(),
    });
    created.examId = examId;
    const exam = await exams.collection('exams').findOne({ _id: examId });

    async function makeStudent(tag) {
      const id = new ObjectId();
      const email = `${tag}@example.com`;
      await people.collection('users').insertOne({
        _id: id, authServiceUserId: String(id), email, firstName: 'E2E', lastName: tag,
        role: 'student', isActive: true, status: 'active', createdAt: new Date(),
      });
      await people.collection('candidates').insertOne({
        _id: id, userId: id, personalInfo: { firstName: 'E2E', lastName: tag, email },
        academicInfo: { currentLevel: exam.targetLevel, targetLevel: exam.targetLevel }, createdAt: new Date(),
      });
      const token = signToken({ userId: String(id), email, role: 'student' });
      return { id, token };
    }

    const studentA = await makeStudent(`${TAG}-student-a`);
    const studentB = await makeStudent(`${TAG}-student-b`);
    created.studentAId = studentA.id;
    created.studentBId = studentB.id;

    const proctorId = new ObjectId();
    const proctorToken = signToken({ userId: String(proctorId), email: `${TAG}-proctor@example.com`, role: 'proctor' });
    const creatorId = new ObjectId();

    const sessionId = new ObjectId();
    const now = Date.now();
    await exams.collection('sessions').insertOne({
      _id: sessionId, examId: exam._id, sessionName: TAG,
      scheduling: { startDate: new Date(now - 60_000), endDate: new Date(now + 3_600_000), timeZone: 'America/La_Paz', timeSlots: [] },
      participants: { maxCandidates: 5, registeredCandidates: [studentA.id, studentB.id], proctors: [proctorId], currentActive: 0 },
      settings: { requireProctor: true, recordSession: false, browserLockdown: true, allowLateEntry: true, autoStart: false, lateEntryMinutes: 30 },
      status: 'in_progress', createdBy: creatorId, createdAt: new Date(), updatedAt: new Date(),
    });
    created.sessionId = sessionId;
    const sid = String(sessionId);

    // ---- Student A starts the attempt ----
    await submitPassingVerification(studentA.token, sid, String(studentA.id));
    const startRes = await api('POST', `/api/v1/exam-taking/${sid}/start`, studentA.token);
    check('candidate A can start (browserLockdown=true session)', startRes.status === 200, `HTTP ${startRes.status}${startRes.json?.message ? ` ${startRes.json.message}` : ''}`);
    if (startRes.status !== 200) throw new Error('start failed');
    check('start response carries browserLockdown=true', startRes.json?.data?.browserLockdown === true, JSON.stringify(startRes.json?.data?.browserLockdown));

    // ---- Sockets ----
    studentASocket = connectSocket(studentA.token);
    proctorSocket = connectSocket(proctorToken);
    const [studentAConnected, proctorConnected] = await Promise.all([
      waitForConnect(studentASocket),
      waitForConnect(proctorSocket),
    ]);
    check('student A socket connected', studentAConnected);
    check('proctor socket connected', proctorConnected);

    // ---- Student A posts a burst of 3 infractions quickly (rate limit: >1/sec ignored) ----
    // Start collecting proctor-side infraction events for a 10s window BEFORE
    // firing the burst, so we can assert the throttle coalesces it to <= 1 push.
    const proctorInfractionCollector = collectEvents(proctorSocket, 'session.candidate.infraction', 10_500);
    const studentAInfractionCollector = collectEvents(studentASocket, 'session.candidate.infraction', 10_500);

    const infractionRes1 = await api('POST', `/api/v1/exam-taking/${sid}/infractions`, studentA.token, {
      type: 'fullscreen_exit', occurredAt: new Date().toISOString(),
    });
    check('infraction 1 accepted (HTTP 200)', infractionRes1.status === 200, `HTTP ${infractionRes1.status}`);
    check('infraction 1 counted (accepted=true, count=1)', infractionRes1.json?.data?.accepted === true && infractionRes1.json?.data?.infractionCount === 1, JSON.stringify(infractionRes1.json?.data));

    const infractionRes2 = await api('POST', `/api/v1/exam-taking/${sid}/infractions`, studentA.token, {
      type: 'tab_hidden', occurredAt: new Date().toISOString(),
    });
    check('infraction 2 (fired <1s later) is rate-limited (accepted=false)', infractionRes2.status === 200 && infractionRes2.json?.data?.accepted === false, JSON.stringify(infractionRes2.json?.data));
    check('infraction 2 count unchanged at 1', infractionRes2.json?.data?.infractionCount === 1, JSON.stringify(infractionRes2.json?.data));

    const infractionRes3 = await api('POST', `/api/v1/exam-taking/${sid}/infractions`, studentA.token, {
      type: 'context_menu', occurredAt: new Date().toISOString(),
    });
    check('infraction 3 (fired <1s later) is also rate-limited', infractionRes3.status === 200 && infractionRes3.json?.data?.accepted === false, JSON.stringify(infractionRes3.json?.data));

    // ---- Persisted on the attempt ----
    const attemptAfterBurst = await exams.collection('attempts').findOne({ sessionId, candidateId: studentA.id });
    check('attempt.integrity.infractionCount reflects only the accepted infraction (1)', attemptAfterBurst?.integrity?.infractionCount === 1, `count=${attemptAfterBurst?.integrity?.infractionCount}`);
    check('attempt.integrity.events has exactly 1 event', Array.isArray(attemptAfterBurst?.integrity?.events) && attemptAfterBurst.integrity.events.length === 1, `events=${attemptAfterBurst?.integrity?.events?.length}`);

    // ---- Wait out the 1s rate-limit window, post one more distinct infraction ----
    await new Promise((r) => setTimeout(r, 1100));
    const infractionRes4 = await api('POST', `/api/v1/exam-taking/${sid}/infractions`, studentA.token, {
      type: 'paste_blocked', occurredAt: new Date().toISOString(),
    });
    check('infraction 4 (after 1.1s) is accepted and count=2', infractionRes4.status === 200 && infractionRes4.json?.data?.accepted === true && infractionRes4.json?.data?.infractionCount === 2, JSON.stringify(infractionRes4.json?.data));

    // ---- Proctor push: throttled to <= 1 event within the 10s collection window ----
    const proctorInfractionEvents = await proctorInfractionCollector;
    check('proctor socket receives session.candidate.infraction (at least once)', proctorInfractionEvents.length >= 1, `received=${proctorInfractionEvents.length}`);
    check('proctor push is throttled: at most 1 event across the burst + follow-up within the 10s window', proctorInfractionEvents.length <= 1, `received=${proctorInfractionEvents.length}: ${JSON.stringify(proctorInfractionEvents)}`);
    if (proctorInfractionEvents[0]) {
      check(
        'proctor event carries sessionId/candidateId/current infractionCount',
        String(proctorInfractionEvents[0].sessionId) === sid &&
        String(proctorInfractionEvents[0].candidateId) === String(studentA.id) &&
        typeof proctorInfractionEvents[0].infractionCount === 'number',
        JSON.stringify(proctorInfractionEvents[0])
      );
    }

    // ---- Student is never pushed the event, and gets no in-app notification ----
    const studentAInfractionEvents = await studentAInfractionCollector;
    check('student socket never receives session.candidate.infraction', studentAInfractionEvents.length === 0, `received=${studentAInfractionEvents.length}`);

    // ---- Another candidate cannot post infractions "for" this attempt ----
    // Student B has no attempt on this session at all, so searchRefs resolves
    // their own candidateId and the service looks up (sessionId, studentB.id)
    // — finding no attempt — confirming candidate-scoping (their token can
    // never touch student A's attempt/session progress regardless).
    const otherRes = await api('POST', `/api/v1/exam-taking/${sid}/infractions`, studentB.token, {
      type: 'blocked_shortcut', occurredAt: new Date().toISOString(),
    });
    check(
      "another candidate's token cannot post infractions against student A's attempt (no attempt found for B -> error, not 200 accepted)",
      otherRes.status !== 200 || otherRes.json?.success === false,
      `HTTP ${otherRes.status} ${JSON.stringify(otherRes.json)}`
    );
    const attemptAfterOther = await exams.collection('attempts').findOne({ sessionId, candidateId: studentA.id });
    check("student A's infractionCount unaffected by student B's request", attemptAfterOther?.integrity?.infractionCount === 2, `count=${attemptAfterOther?.integrity?.infractionCount}`);

    // ---- Progress endpoint surfaces infractionCount ----
    const progressRes = await api('GET', `/api/v1/sessions/${sid}/progress`, proctorToken);
    check('progress endpoint returns 200', progressRes.status === 200, `HTTP ${progressRes.status}`);
    const candidateProgress = progressRes.json?.data?.candidates?.find((c) => String(c.candidateId) === String(studentA.id));
    check('progress endpoint includes candidate A infractionCount=2', candidateProgress?.infractionCount === 2, JSON.stringify(candidateProgress));

    // ---- Finish the exam, then infractions return 409 ----
    const finishRes = await api('POST', `/api/v1/exam-taking/${sid}/finish`, studentA.token);
    check('student A can finish the exam', finishRes.status === 200, `HTTP ${finishRes.status}`);

    const postFinishInfractionRes = await api('POST', `/api/v1/exam-taking/${sid}/infractions`, studentA.token, {
      type: 'window_blur', occurredAt: new Date().toISOString(),
    });
    check(
      'infraction after finish returns 409 ATTEMPT_NOT_IN_PROGRESS',
      postFinishInfractionRes.status === 409 && postFinishInfractionRes.json?.code === 'ATTEMPT_NOT_IN_PROGRESS',
      `HTTP ${postFinishInfractionRes.status} ${JSON.stringify(postFinishInfractionRes.json)}`
    );
  } finally {
    if (studentASocket) studentASocket.disconnect();
    if (proctorSocket) proctorSocket.disconnect();

    if (created.sessionId) {
      const ids = (await exams.collection('attempts').find({ sessionId: created.sessionId }).project({ _id: 1 }).toArray()).map((a) => a._id);
      await exams.collection('exam_results').deleteMany({ $or: [{ attemptId: { $in: ids } }, { sessionId: created.sessionId }] });
      await exams.collection('responses').deleteMany({ sessionId: created.sessionId });
      await exams.collection('attempts').deleteMany({ sessionId: created.sessionId });
      await exams.collection('sessions').deleteOne({ _id: created.sessionId });
    }
    if (created.examId) await exams.collection('exams').deleteOne({ _id: created.examId });
    for (const studentId of [created.studentAId, created.studentBId]) {
      if (!studentId) continue;
      await people.collection('candidates').deleteMany({ _id: studentId });
      await people.collection('users').deleteMany({ _id: studentId });
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
