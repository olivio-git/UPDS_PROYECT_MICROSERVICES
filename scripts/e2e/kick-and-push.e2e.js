/*
 * End-to-end check of the kick-candidate real-time push pipeline against a
 * running stack:
 *   - exam-service.kickCandidate publishes `session.candidate.kicked` on
 *     exam-events (legacy producer path, same as the other session.* events).
 *   - notifications-service consumes it, creates an in-app notification for
 *     the candidate, and pushes the `session.candidate.kicked` socket event
 *     to BOTH the candidate's room and the session's proctors/creator rooms.
 *   - the kicked attempt is left `cancelled`, and a subsequent submitAnswer
 *     call returns 409 with `code: 'ATTEMPT_NOT_IN_PROGRESS'`.
 *   - session.time.extended also reaches proctors (recipient resolution
 *     extended to include participants.proctors + createdBy, not just
 *     enrolled candidates).
 *   - kick hygiene: kicking a candidate not enrolled in the session is
 *     refused (404); a proctor NOT assigned to the session gets 403 on both
 *     kick and extend-time, even though their role would otherwise qualify.
 *   - a candidate kicked BEFORE ever starting is persisted
 *     (session.participants.kickedCandidates) and start() refuses them with
 *     403 CANDIDATE_REMOVED — not just a cancelled in-progress attempt.
 *   - resuming a kicked (cancelled) attempt returns 409
 *     ATTEMPT_NOT_IN_PROGRESS instead of silently succeeding.
 *
 * Connects socket.io-client sockets to notifications-service the same way
 * the frontend's notificationSocket does: `io(origin, { auth: (cb) =>
 * cb({ token }), transports: ['websocket','polling'] })`. The server (see
 * notifications-service/src/services/socket.service.ts) verifies the token
 * with jsonwebtoken (HS256, issuer 'cba-auth-service', audience
 * 'cba-platform' — matching identity-service/src/auth/services/jwt.service.ts)
 * and joins `user:<decoded.userId>` itself; it no longer trusts a `userId`
 * the client hands it directly. Tokens here are signed with the same
 * issuer/audience so the socket handshake succeeds exactly like a real
 * access token would. In dev (NODE_ENV !== 'production') exam-service's HTTP
 * auth only verifies the JWT locally and never looks the user up in
 * identity-service's DB (see auth.middleware.ts), so the proctor/creator
 * here are synthetic ids + locally-signed JWTs — no user/candidate
 * documents are created for them, only for the student (whose exam-taking
 * routes DO look up a candidate document via searchRefs).
 *
 * Also verifies the fix: a socket that connects with an unverified
 * `auth: { userId: <victim> } ` (no/invalid token, the old client contract)
 * is rejected by the server and never receives the victim's push.
 *
 * socket.io-client is not a dependency of exam-service's image; it was
 * installed on top with `npm install socket.io-client@4 --no-save` inside
 * the running container for this test run only (not persisted to the image
 * or package.json).
 *
 * Run inside the exam-service container:
 *   docker cp scripts/e2e/kick-and-push.e2e.js exam-service:/app/exam-service/kick-and-push.e2e.js
 *   docker exec -w /app/exam-service exam-service node kick-and-push.e2e.js
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
const NOTIF_URL = process.env.E2E_NOTIF_WS_URL || 'http://notification-service:3001';
const TAG = `e2e-kick-${Date.now()}`;
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

// PR10: exam-taking start now blocks a brand-new attempt unless the
// candidate has a passing technical verification on file (session-manager
// enforces this server-side). Drive the real public API — same as a
// student's browser would — so this suite keeps exercising start() as an
// authenticated, verified candidate instead of tripping the new 403
// TECHNICAL_VERIFICATION_REQUIRED gate.
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

async function waitFor(fn, timeoutMs, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
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

// Matches the frontend's notificationSocket contract: token-only auth, the
// server derives the room from the verified token.
function connectSocket(token) {
  const socket = io(NOTIF_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

// Simulates a client trying the OLD (pre-fix) unverified contract: naming a
// victim's userId directly with no valid token.
function connectAsAttacker(victimUserId) {
  const socket = io(NOTIF_URL, {
    auth: { userId: victimUserId },
    transports: ['websocket', 'polling'],
    reconnection: false,
  });
  return socket;
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

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('ABORT: NODE_ENV=production re-validates tokens against identity-service; test tokens would be rejected.');
    process.exitCode = 2;
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
  const exams = mongoose.connection.db; // exam database (cba_platform)
  const people = mongoose.connection.client.db(process.env.MONGO_UMS_DB_NAME || 'cba_identity_db');
  const notif = mongoose.connection.client.db(process.env.MONGO_NOTIFICATION_DB_NAME || 'cba_notification_db');
  const created = { studentId: null, studentId2: null, sessionId: null, examId: null };

  let studentSocket = null;
  let proctorSocket = null;
  let attackerSocket = null;

  try {
    // ---- Setup: exam, session, student (+ synthetic proctor/creator) -----
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
      _id: examId, name: TAG, description: 'E2E kick-and-push throwaway exam', type: 'practice', targetLevel: pick._id.level,
      structure: {
        sections: [{ name: 'E2E', competency: pick._id.competency, duration: 30, questionCount: 1, weight: 100 }],
        totalDuration: 30, passingScore: 60,
      },
      configuration: { randomizeQuestions: false, allowReview: true, showResults: true, attemptsAllowed: 1, timeBetweenAttempts: 0 },
      isActive: true, isTemplate: false, createdBy: new ObjectId(), createdAt: new Date(), updatedAt: new Date(),
    });
    created.examId = examId;
    const exam = await exams.collection('exams').findOne({ _id: examId });

    // Throwaway student — needs a real candidate document (searchRefs looks
    // it up by authServiceUserId on the exam-taking routes).
    const studentId = new ObjectId();
    const email = `${TAG}-student@example.com`;
    await people.collection('users').insertOne({
      _id: studentId, authServiceUserId: String(studentId), email, firstName: 'E2E', lastName: 'Student',
      role: 'student', isActive: true, status: 'active', createdAt: new Date(),
    });
    await people.collection('candidates').insertOne({
      _id: studentId, userId: studentId, personalInfo: { firstName: 'E2E', lastName: 'Student', email },
      academicInfo: { currentLevel: exam.targetLevel, targetLevel: exam.targetLevel }, createdAt: new Date(),
    });
    created.studentId = studentId;
    const studentToken = signToken({ userId: String(studentId), email, role: 'student' });

    // Second student — enrolled but never starts, used for the
    // "kicked-before-starting" check (CANDIDATE_REMOVED).
    const studentId2 = new ObjectId();
    const email2 = `${TAG}-student2@example.com`;
    await people.collection('users').insertOne({
      _id: studentId2, authServiceUserId: String(studentId2), email: email2, firstName: 'E2E', lastName: 'Student2',
      role: 'student', isActive: true, status: 'active', createdAt: new Date(),
    });
    await people.collection('candidates').insertOne({
      _id: studentId2, userId: studentId2, personalInfo: { firstName: 'E2E', lastName: 'Student2', email: email2 },
      academicInfo: { currentLevel: exam.targetLevel, targetLevel: exam.targetLevel }, createdAt: new Date(),
    });
    created.studentId2 = studentId2;
    const studentToken2 = signToken({ userId: String(studentId2), email: email2, role: 'student' });

    // Throwaway proctor + creator — synthetic ids, no DB record needed (see
    // header comment): only used as session.participants.proctors /
    // session.createdBy and as the socket room id / JWT subject.
    const proctorId = new ObjectId();
    const proctorToken = signToken({ userId: String(proctorId), email: `${TAG}-proctor@example.com`, role: 'proctor' });
    const creatorId = new ObjectId();
    // A proctor that exists but is NOT assigned to this session — used for
    // the "not assigned" authorization checks (kick/extend must 403 them
    // even though their role otherwise qualifies).
    const otherProctorId = new ObjectId();
    const otherProctorToken = signToken({ userId: String(otherProctorId), email: `${TAG}-other-proctor@example.com`, role: 'proctor' });
    // A candidate id nobody enrolled — used for the "kick a non-enrolled
    // candidate" check.
    const notEnrolledId = new ObjectId();

    const sessionId = new ObjectId();
    const now = Date.now();
    await exams.collection('sessions').insertOne({
      _id: sessionId, examId: exam._id, sessionName: TAG,
      scheduling: { startDate: new Date(now - 60_000), endDate: new Date(now + 3_600_000), timeZone: 'America/La_Paz', timeSlots: [] },
      participants: { maxCandidates: 5, registeredCandidates: [studentId, studentId2], proctors: [proctorId], currentActive: 0 },
      settings: { requireProctor: true, recordSession: false, browserLockdown: false, allowLateEntry: true, autoStart: false, lateEntryMinutes: 30 },
      status: 'in_progress', createdBy: creatorId, createdAt: new Date(), updatedAt: new Date(),
    });
    created.sessionId = sessionId;
    const sid = String(sessionId);

    // ---- Student starts the attempt ---------------------------------------
    await submitPassingVerification(studentToken, sid, String(studentId));
    const startRes = await api('POST', `/api/v1/exam-taking/${sid}/start`, studentToken);
    check('candidate can start', startRes.status === 200, `HTTP ${startRes.status}${startRes.json?.message ? ` ${startRes.json.message}` : ''}`);
    if (startRes.status !== 200) throw new Error('start failed');

    const attemptBefore = await exams.collection('attempts').findOne({ sessionId });
    check('attempt exists and is in_progress', !!attemptBefore && attemptBefore.status === 'in_progress');

    // ---- Connect both sockets, exactly like the frontend does -------------
    studentSocket = connectSocket(studentToken);
    proctorSocket = connectSocket(proctorToken);
    const [studentConnected, proctorConnected] = await Promise.all([
      waitForConnect(studentSocket),
      waitForConnect(proctorSocket),
    ]);
    check('student socket connected', studentConnected);
    check('proctor socket connected', proctorConnected);

    // ---- Security check: unverified userId-only auth is rejected ----------
    // Old (broken) contract: a client could join anyone's room just by
    // naming a userId, no proof required. The server must now reject a
    // handshake that has no valid token, regardless of what userId it claims.
    attackerSocket = connectAsAttacker(String(studentId));
    const attackerConnectErrorWait = new Promise((resolve) => {
      attackerSocket.once('connect_error', (err) => resolve(err));
    });
    const attackerConnected = await waitForConnect(attackerSocket, 5000);
    const attackerConnectError = attackerConnected ? null : await Promise.race([
      attackerConnectErrorWait,
      new Promise((resolve) => setTimeout(() => resolve(null), 1000)),
    ]);
    check('unverified userId-only handshake is rejected (never connects)', !attackerConnected, `connected=${attackerConnected}`);
    check('rejected handshake gets a connect_error', !!attackerConnectError, attackerConnectError ? attackerConnectError.message : 'none');

    // ---- Kick hygiene: authorization + enrollment checks -------------------
    // A proctor that exists but isn't assigned to THIS session must be
    // refused (403) on both kick and extend-time, even though the 'proctor'
    // role would otherwise qualify under requireRole().
    const unassignedKickRes = await api(
      'POST', `/api/v1/sessions/${sid}/candidates/${String(studentId)}/kick`, otherProctorToken, { reason: 'should be refused' }
    );
    check('unassigned proctor is refused on kick (403)', unassignedKickRes.status === 403, `HTTP ${unassignedKickRes.status}`);
    const unassignedExtendRes = await api('POST', `/api/v1/sessions/${sid}/extend`, otherProctorToken, { minutes: 5 });
    check('unassigned proctor is refused on extend (403)', unassignedExtendRes.status === 403, `HTTP ${unassignedExtendRes.status}`);

    // Kicking a candidate who was never enrolled in this session is refused
    // (400/404), not silently accepted or a 500.
    const notEnrolledKickRes = await api(
      'POST', `/api/v1/sessions/${sid}/candidates/${String(notEnrolledId)}/kick`, proctorToken, { reason: 'not enrolled' }
    );
    check(
      'kicking a non-enrolled candidate is refused (400/404)',
      notEnrolledKickRes.status === 400 || notEnrolledKickRes.status === 404,
      `HTTP ${notEnrolledKickRes.status} ${JSON.stringify(notEnrolledKickRes.json)}`
    );

    // ---- A candidate kicked BEFORE ever starting can't start afterward ----
    const preStartKickRes = await api(
      'POST', `/api/v1/sessions/${sid}/candidates/${String(studentId2)}/kick`, proctorToken, { reason: 'kicked before starting' }
    );
    check('proctor can kick a candidate who never started', preStartKickRes.status === 200, `HTTP ${preStartKickRes.status}`);
    const attemptForStudent2 = await exams.collection('attempts').findOne({ sessionId, candidateId: studentId2 });
    check('no attempt exists for the pre-start-kicked candidate', !attemptForStudent2, JSON.stringify(attemptForStudent2));
    const startAfterPreKick = await api('POST', `/api/v1/exam-taking/${sid}/start`, studentToken2);
    check(
      'start() refuses a candidate kicked before starting (403 CANDIDATE_REMOVED)',
      startAfterPreKick.status === 403 && startAfterPreKick.json?.code === 'CANDIDATE_REMOVED',
      `HTTP ${startAfterPreKick.status} code=${startAfterPreKick.json?.code}`
    );

    // ---- Kick the candidate -------------------------------------------
    const studentKickWait = waitForEvent(studentSocket, 'session.candidate.kicked', 10000);
    const proctorKickWait = waitForEvent(proctorSocket, 'session.candidate.kicked', 10000);
    const attackerKickWait = waitForEvent(attackerSocket, 'session.candidate.kicked', 6000);

    const kickRes = await api('POST', `/api/v1/sessions/${sid}/candidates/${String(studentId)}/kick`, proctorToken, {
      reason: 'e2e test kick',
    });
    check('proctor can kick candidate', kickRes.status === 200, `HTTP ${kickRes.status}`);

    const [studentKickEvent, proctorKickEvent, attackerKickEvent] = await Promise.all([studentKickWait, proctorKickWait, attackerKickWait]);
    check('student socket receives session.candidate.kicked within 10s', !!studentKickEvent, JSON.stringify(studentKickEvent));
    check(
      'student event carries sessionId/candidateId/reason',
      !!studentKickEvent && String(studentKickEvent.sessionId) === sid && String(studentKickEvent.candidateId) === String(studentId) && studentKickEvent.reason === 'e2e test kick'
    );
    check('proctor socket receives session.candidate.kicked within 10s', !!proctorKickEvent, JSON.stringify(proctorKickEvent));
    check('rejected attacker socket never receives the victim push', !attackerKickEvent, JSON.stringify(attackerKickEvent));

    // ---- Attempt is cancelled server-side ----------------------------------
    const attemptAfter = await exams.collection('attempts').findOne({ sessionId, candidateId: studentId });
    check('attempt status is cancelled after kick', attemptAfter?.status === 'cancelled', `status=${attemptAfter?.status}`);

    // ---- In-app notification created for the candidate --------------------
    const inAppNotif = await waitFor(
      () => notif.collection('user_notifications').findOne({ recipientId: String(studentId), type: 'session.candidate.kicked' }),
      10_000,
      1000
    );
    check('in-app notification created for kicked candidate', !!inAppNotif);

    // ---- Subsequent submitAnswer returns 409 ATTEMPT_NOT_IN_PROGRESS ------
    const questionId = String(attemptBefore?.questionIds?.[0] ?? '');
    const answerRes = await api('POST', `/api/v1/exam-taking/${sid}/answer`, studentToken, {
      questionId, answer: { selectedOptions: ['e2e-choice'] },
    });
    check('submitAnswer after kick returns 409', answerRes.status === 409, `HTTP ${answerRes.status}`);
    check(
      '409 body carries code=ATTEMPT_NOT_IN_PROGRESS and attemptStatus=cancelled',
      answerRes.json?.code === 'ATTEMPT_NOT_IN_PROGRESS' && answerRes.json?.attemptStatus === 'cancelled',
      JSON.stringify(answerRes.json)
    );

    // ---- Resuming the kicked (cancelled) attempt is refused, not silent ---
    const resumeRes = await api('GET', `/api/v1/exam-taking/${sid}/resume`, studentToken);
    check('resume of a cancelled attempt returns 409', resumeRes.status === 409, `HTTP ${resumeRes.status}`);
    check(
      'resume 409 carries code=ATTEMPT_NOT_IN_PROGRESS and attemptStatus=cancelled',
      resumeRes.json?.code === 'ATTEMPT_NOT_IN_PROGRESS' && resumeRes.json?.attemptStatus === 'cancelled',
      JSON.stringify(resumeRes.json)
    );

    // ---- Extend session time — proctor must get the push -------------------
    const proctorExtendWait = waitForEvent(proctorSocket, 'session.time.extended', 10000);
    const extendRes = await api('POST', `/api/v1/sessions/${sid}/extend`, proctorToken, { minutes: 5 });
    check('proctor can extend session time', extendRes.status === 200, `HTTP ${extendRes.status}`);
    const proctorExtendEvent = await proctorExtendWait;
    check('proctor socket receives session.time.extended within 10s', !!proctorExtendEvent, JSON.stringify(proctorExtendEvent));
  } finally {
    if (studentSocket) studentSocket.disconnect();
    if (proctorSocket) proctorSocket.disconnect();
    if (attackerSocket) attackerSocket.disconnect();

    if (created.sessionId) {
      const ids = (await exams.collection('attempts').find({ sessionId: created.sessionId }).project({ _id: 1 }).toArray()).map((a) => a._id);
      await exams.collection('exam_results').deleteMany({ $or: [{ attemptId: { $in: ids } }, { sessionId: created.sessionId }] });
      await exams.collection('responses').deleteMany({ sessionId: created.sessionId });
      await exams.collection('attempts').deleteMany({ sessionId: created.sessionId });
      await exams.collection('sessions').deleteOne({ _id: created.sessionId });
    }
    if (created.examId) await exams.collection('exams').deleteOne({ _id: created.examId });
    if (created.studentId) {
      await notif.collection('user_notifications').deleteMany({ recipientId: String(created.studentId) });
      await people.collection('candidates').deleteMany({ _id: created.studentId });
      await people.collection('users').deleteMany({ _id: created.studentId });
    }
    if (created.studentId2) {
      await notif.collection('user_notifications').deleteMany({ recipientId: String(created.studentId2) });
      await people.collection('candidates').deleteMany({ _id: created.studentId2 });
      await people.collection('users').deleteMany({ _id: created.studentId2 });
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
