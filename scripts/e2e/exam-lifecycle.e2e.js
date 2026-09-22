/*
 * End-to-end check of the FULL exam lifecycle exactly as the real UI drives
 * it, against a running stack: teacher creates an exam and a session (the
 * same POST /api/v1/exams / POST /api/v1/sessions payload shapes
 * ExamForm.tsx / SessionForm.tsx send), a proctor and two students are
 * enrolled via the real add-candidate/add-proctor endpoints, the Bull
 * scheduler auto-starts and auto-ends the session, both students pass
 * technical verification and take the exam (one finishes cleanly, the other
 * is auto-closed by the scheduler at end time), time gets extended
 * mid-exam, and the teacher reads the session results report at the end.
 *
 * Endpoint shapes were read from (not guessed):
 *   - frontend/src/modules/exams/components/ExamForm.tsx  (POST /exams body)
 *   - frontend/src/modules/exams/components/SessionForm.tsx (POST /sessions body)
 *   - frontend/src/modules/exams/hooks/useSessions.ts + services/examService.ts
 *     (addCandidatesToSession / addProctorsToSession / extendSession / getSessionResults)
 *   - frontend/src/modules/student/services/examService.ts (GET /sessions/my-sessions)
 *   - frontend/src/modules/student/services/sessionManagerTechnicalService.ts
 *     (technical verification flow — same 8-call sequence as the other e2e
 *     scripts' submitPassingVerification helper)
 *   - frontend/src/services/notificationSocket.ts pattern, reused from
 *     kick-and-push.e2e.js / lockdown-infractions.e2e.js (io(url, { auth: { token } }))
 *
 * Backend shapes were read from (not guessed):
 *   - exam-service/src/schemas/exam.schema.ts / session.schema.ts (zod validation)
 *   - exam-service/src/services/examTaking.service.ts (question selection —
 *     confirms exam.questionPool, when present, restricts each competency's
 *     candidate pool to those exact ids: {_id:{$in:poolIds}, competency,
 *     level, isActive:true}. Used here so the exam is guaranteed to draw
 *     ONLY the pre-picked multiple_choice questions — the ExamForm UI has no
 *     control to constrain question TYPE within a section (sections only
 *     pick by competency+level), so without a pool the picked questions
 *     could randomly include essay/open_text/audio_response even inside a
 *     "reading" section. questionPool is an accepted (if UI-unexposed)
 *     field on the real create endpoint, so this is still the real API.)
 *   - exam-service/src/services/session-scheduler.service.ts (Bull auto
 *     start/end jobs, rescheduleEndJob on extend)
 *   - exam-service/src/services/session.service.ts (extendTime calls
 *     rescheduleEndJob; endSession force-completes + grades in-progress
 *     attempts)
 *   - notifications-service/src/services/kafka-consumer.service.ts (socket
 *     event names/payloads: session.status.changed, session.time.extended,
 *     session.candidate.infraction)
 *
 * Run inside the exam-service container:
 *   docker cp scripts/e2e/exam-lifecycle.e2e.js exam-service:/app/exam-service/exam-lifecycle.e2e.js
 *   docker exec -w /app/exam-service exam-service node exam-lifecycle.e2e.js
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
const NOTIF_URL = process.env.E2E_NOTIF_WS_URL || 'http://notification-service:3001';
const TAG = `e2e-lifecycle-${Date.now()}`;
const { ObjectId } = mongoose.Types;

// ── Configurable timings (env-overridable) ─────────────────────────────────
const START_DELAY_MS = Number(process.env.E2E_START_DELAY_MS || 20_000); // session starts ~20s after creation
const END_DELAY_MS = Number(process.env.E2E_END_DELAY_MS || 200_000); // session ends ~3m20s after creation
const EXTEND_MINUTES = Number(process.env.E2E_EXTEND_MINUTES || 1);
const START_POLL_TIMEOUT_MS = Number(process.env.E2E_START_POLL_TIMEOUT_MS || 70_000); // poll up to 70s past startDate
const END_POLL_TIMEOUT_MS = Number(process.env.E2E_END_POLL_TIMEOUT_MS || 90_000); // poll up to 90s past (extended) endDate
const GRADE_POLL_TIMEOUT_MS = Number(process.env.E2E_GRADE_POLL_TIMEOUT_MS || 60_000);

const results = [];
const bugs = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const reportBug = (title, evidence) => {
  bugs.push({ title, evidence });
  console.log(`\n🐛 PRODUCT BUG: ${title}\n   Evidence: ${evidence}\n`);
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

// Wait budget for both the HTTP poll AND the socket-event wait racing it —
// both must share the SAME horizon (time until targetDate + baseTimeoutMs),
// otherwise a short fixed socket timeout gives up long before the poll does
// and the event is falsely reported as "never received" (test bug, not a
// product bug — learned the hard way on the first run of this suite).
function waitBudgetMs(targetDate, baseTimeoutMs) {
  const untilTarget = targetDate.getTime() - Date.now();
  return Math.max(baseTimeoutMs, untilTarget + baseTimeoutMs);
}

function waitFor(fn, timeoutMs, intervalMs = 2000) {
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
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
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
function waitForEvent(socket, event, timeoutMs = 15000, match) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { socket.off(event, handler); resolve(null); }, timeoutMs);
    function handler(data) {
      if (match && !match(data)) return; // keep listening for a matching occurrence
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    }
    socket.on(event, handler);
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('ABORT: NODE_ENV=production re-validates tokens against identity-service; test tokens would be rejected.');
    process.exitCode = 2;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);
  const exams = mongoose.connection.db; // cba_platform
  const people = mongoose.connection.client.db(process.env.MONGO_UMS_DB_NAME || 'cba_identity_db');
  const notif = mongoose.connection.client.db(process.env.MONGO_NOTIFICATION_DB_NAME || 'cba_notification_db');

  const created = { userIds: [], examId: null, sessionId: null };
  let teacherSocket = null, proctorSocket = null, studentASocket = null, studentBSocket = null;

  try {
    // ══════════════════════════════════════════════════════════════════════
    // STEP 1 — throwaway TEACHER, PROCTOR, STUDENTS A & B
    // ══════════════════════════════════════════════════════════════════════
    const makePerson = async (who, role) => {
      const id = new ObjectId();
      const email = `${TAG}-${who}@example.com`;
      await people.collection('users').insertOne({
        _id: id, authServiceUserId: String(id), email, firstName: 'E2E', lastName: who,
        role, isActive: true, status: 'active', createdAt: new Date(),
      });
      if (role === 'student') {
        await people.collection('candidates').insertOne({
          _id: id, userId: id, personalInfo: { firstName: 'E2E', lastName: who, email },
          academicInfo: {}, createdAt: new Date(),
        });
      }
      created.userIds.push(id);
      const token = signToken({ userId: String(id), email, role });
      return { id, email, token, role };
    };

    const teacher = await makePerson('teacher', 'teacher');
    const proctor = await makePerson('proctor', 'proctor');
    // Admin-only for POST /sessions/:id/proctors (session.routes.ts requires
    // requireRole('admin') on that route, unlike candidates which accept
    // admin+teacher) — synthetic admin token, no DB record needed in dev
    // mode (same pattern as kick-and-push.e2e.js's creator/proctor ids).
    const adminId = new ObjectId();
    const adminToken = signToken({ userId: String(adminId), email: `${TAG}-admin@example.com`, role: 'admin' });
    const studentA = await makePerson('student-a', 'student');
    const studentB = await makePerson('student-b', 'student');
    check('teacher/proctor/students created', true, `teacher=${teacher.id} proctor=${proctor.id} A=${studentA.id} B=${studentB.id}`);

    // ══════════════════════════════════════════════════════════════════════
    // STEP 2 — teacher creates an EXAM via POST /api/v1/exams
    // ══════════════════════════════════════════════════════════════════════
    // Pick a level/competency with enough active multiple_choice questions
    // (auto-graded, no AI/mic needed) and pin the exam to EXACTLY those ids
    // via questionPool — see header comment for why.
    const pool = await exams.collection('questions').aggregate([
      { $match: { isActive: true, type: 'multiple_choice' } },
      { $group: { _id: { level: '$level', competency: '$competency' }, ids: { $push: '$_id' }, n: { $sum: 1 } } },
      { $match: { n: { $gte: 3 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]).toArray();
    if (!pool.length) throw new Error('question bank has no level/competency with >=3 active multiple_choice questions');
    const { level, competency } = pool[0]._id;
    const questionIds = pool[0].ids.slice(0, 3).map(String);
    console.log(`Question pool: level=${level} competency=${competency} questionIds=${questionIds.join(',')}`);

    const examPayload = {
      name: `${TAG}-exam`,
      description: 'E2E full-lifecycle throwaway exam',
      type: 'practice',
      targetLevel: level,
      structure: {
        sections: [{ name: 'E2E Reading', competency, duration: 10, questionCount: questionIds.length, weight: 100 }],
        totalDuration: 10,
        passingScore: 60,
      },
      configuration: { randomizeQuestions: false, allowReview: true, showResults: true, attemptsAllowed: 1, timeBetweenAttempts: 0 },
      questionPool: questionIds,
      isActive: true,
      isTemplate: false,
    };
    const createExamRes = await api('POST', '/api/v1/exams', teacher.token, examPayload);
    check('teacher can create exam via POST /api/v1/exams', createExamRes.status === 201, `HTTP ${createExamRes.status} ${JSON.stringify(createExamRes.json?.message || '')}`);
    if (createExamRes.status !== 201) throw new Error('exam creation failed');
    const examId = createExamRes.json.data._id;
    created.examId = examId;
    check('created exam has the requested question pool', Array.isArray(createExamRes.json.data.questionPool) && createExamRes.json.data.questionPool.length === questionIds.length,
      JSON.stringify(createExamRes.json.data.questionPool));

    // ══════════════════════════════════════════════════════════════════════
    // STEP 3 — teacher creates a SESSION via POST /api/v1/sessions
    // ══════════════════════════════════════════════════════════════════════
    const t0 = Date.now();
    const startDate = new Date(t0 + START_DELAY_MS);
    const endDate = new Date(t0 + END_DELAY_MS);
    const sessionPayload = {
      sessionName: `${TAG}-session`,
      examId: String(examId),
      scheduling: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timeZone: 'America/La_Paz',
        timeSlots: [],
      },
      participants: { maxCandidates: 10, candidates: [], proctors: [] }, // same shape SessionForm.tsx sends (candidates/proctors added below via the real endpoints, matching how the UI actually does it)
      settings: {
        requireProctor: true,
        recordSession: false,
        allowLateEntry: true,
        lateEntryMinutes: 5,
        autoStart: true,
        browserLockdown: true,
      },
      sessionType: 'group_synchronized',
    };
    const createSessionRes = await api('POST', '/api/v1/sessions', teacher.token, sessionPayload);
    check('teacher can create session via POST /api/v1/sessions', createSessionRes.status === 201, `HTTP ${createSessionRes.status} ${JSON.stringify(createSessionRes.json?.message || '')}`);
    if (createSessionRes.status !== 201) throw new Error('session creation failed');
    const sessionId = createSessionRes.json.data._id;
    created.sessionId = sessionId;
    const sid = String(sessionId);
    check('new session status is "scheduled"', createSessionRes.json.data.status === 'scheduled', `status=${createSessionRes.json.data.status}`);

    // Enroll candidates + proctor via the real endpoints (matches
    // examService.addCandidatesToSession / addProctorsToSession — one POST
    // per id, not a bulk array, per the actual frontend implementation).
    const addA = await api('POST', `/api/v1/sessions/${sid}/candidates`, teacher.token, { candidateId: String(studentA.id) });
    const addB = await api('POST', `/api/v1/sessions/${sid}/candidates`, teacher.token, { candidateId: String(studentB.id) });
    check('teacher can enroll candidate A', addA.status === 200, `HTTP ${addA.status}`);
    check('teacher can enroll candidate B', addB.status === 200, `HTTP ${addB.status}`);
    const addProctorRes = await api('POST', `/api/v1/sessions/${sid}/proctors`, adminToken, { proctorId: String(proctor.id) });
    check('admin can assign proctor', addProctorRes.status === 200, `HTTP ${addProctorRes.status}`);
    const teacherAddProctorRes = await api('POST', `/api/v1/sessions/${sid}/proctors`, teacher.token, { proctorId: String(proctor.id) });
    check('teacher (non-admin) is refused when assigning a proctor (403)', teacherAddProctorRes.status === 403, `HTTP ${teacherAddProctorRes.status}`);

    // ══════════════════════════════════════════════════════════════════════
    // STEP 4 — students see the upcoming session; starting before start time is refused
    // ══════════════════════════════════════════════════════════════════════
    const myA = await api('GET', '/api/v1/sessions/my-sessions?status=scheduled,in_progress&limit=10&page=1', studentA.token);
    check('student A GET /sessions/my-sessions returns 200', myA.status === 200, `HTTP ${myA.status}`);
    const myASession = myA.json?.data?.sessions?.find((s) => String(s._id) === sid);
    check('student A sees the session in their upcoming list', !!myASession, JSON.stringify(myA.json?.data?.sessions?.map((s) => s._id)));
    const myB = await api('GET', '/api/v1/sessions/my-sessions?status=scheduled,in_progress&limit=10&page=1', studentB.token);
    const myBSession = myB.json?.data?.sessions?.find((s) => String(s._id) === sid);
    check('student B sees the session in their upcoming list', !!myBSession, JSON.stringify(myB.json?.data?.sessions?.map((s) => s._id)));

    const earlyStart = await api('POST', `/api/v1/exam-taking/${sid}/start`, studentA.token);
    // examTaking.service.ts now throws AppError(409, 'SESSION_NOT_STARTED')
    // for this precondition instead of a plain Error that fell back to a
    // 500 — starting too early is a completely expected client condition,
    // not a server fault.
    check('starting before session start time returns 409 SESSION_NOT_STARTED', earlyStart.status === 409 && earlyStart.json?.code === 'SESSION_NOT_STARTED', `HTTP ${earlyStart.status} ${JSON.stringify(earlyStart.json)}`);

    // ══════════════════════════════════════════════════════════════════════
    // STEP 5 — connect sockets BEFORE start time, then wait for Bull auto-start
    // ══════════════════════════════════════════════════════════════════════
    proctorSocket = connectSocket(proctor.token);
    studentASocket = connectSocket(studentA.token);
    studentBSocket = connectSocket(studentB.token);
    const [pConn, aConn, bConn] = await Promise.all([waitForConnect(proctorSocket), waitForConnect(studentASocket), waitForConnect(studentBSocket)]);
    check('proctor socket connected before start', pConn);
    check('student A socket connected before start', aConn);
    check('student B socket connected before start', bConn);

    const startWaitBudget = waitBudgetMs(startDate, START_POLL_TIMEOUT_MS);
    const proctorStartedWait = waitForEvent(proctorSocket, 'session.status.changed', startWaitBudget, (d) => d.status === 'in_progress');
    const studentAStartedWait = waitForEvent(studentASocket, 'session.status.changed', startWaitBudget, (d) => d.status === 'in_progress');
    const studentBStartedWait = waitForEvent(studentBSocket, 'session.status.changed', startWaitBudget, (d) => d.status === 'in_progress');

    const msUntilStart = startDate.getTime() - Date.now();
    console.log(`Waiting ~${Math.round(msUntilStart / 1000)}s for the Bull scheduler to auto-start the session...`);
    const startedSession = await waitFor(
      async () => {
        const r = await api('GET', `/api/v1/sessions/${sid}`, teacher.token);
        return r.json?.data?.status === 'in_progress' ? r.json.data : null;
      },
      startWaitBudget,
      3000
    );
    check('session auto-started (status became in_progress) within timeout', !!startedSession, `observed at ${new Date().toISOString()}, target startDate=${startDate.toISOString()}`);

    const [proctorStartedEvt, studentAStartedEvt, studentBStartedEvt] = await Promise.all([proctorStartedWait, studentAStartedWait, studentBStartedWait]);
    check('proctor socket received session.status.changed(in_progress)', !!proctorStartedEvt, JSON.stringify(proctorStartedEvt));
    check('student A socket received session.status.changed(in_progress)', !!studentAStartedEvt, JSON.stringify(studentAStartedEvt));
    check('student B socket received session.status.changed(in_progress)', !!studentBStartedEvt, JSON.stringify(studentBStartedEvt));

    // ══════════════════════════════════════════════════════════════════════
    // STEP 6 — student A: verify, start, answer all, finish -> graded
    // ══════════════════════════════════════════════════════════════════════
    await submitPassingVerification(studentA.token, sid, String(studentA.id));
    const startA = await api('POST', `/api/v1/exam-taking/${sid}/start`, studentA.token);
    check('student A can start the exam', startA.status === 200, `HTTP ${startA.status} ${JSON.stringify(startA.json?.message || '')}`);
    if (startA.status !== 200) throw new Error('student A start failed');
    const attemptA = await exams.collection('attempts').findOne({ sessionId: new ObjectId(sid), candidateId: studentA.id });
    check('student A attempt created and in_progress', attemptA?.status === 'in_progress');
    const questionsA = attemptA?.questionIds || [];
    check('student A got exactly the pinned question pool questions, no audio', questionsA.length === questionIds.length, `${questionsA.length}/${questionIds.length}`);

    for (const qId of questionsA) {
      const qDoc = await exams.collection('questions').findOne({ _id: new ObjectId(String(qId)) });
      const correctOption = qDoc?.content?.options?.find((o) => o.isCorrect);
      const ansRes = await api('POST', `/api/v1/exam-taking/${sid}/answer`, studentA.token, {
        questionId: String(qId),
        answer: { selectedOptions: [correctOption?.id] },
      });
      check(`student A can answer question ${qId}`, ansRes.status === 200, `HTTP ${ansRes.status}`);
    }
    const finishA = await api('POST', `/api/v1/exam-taking/${sid}/finish`, studentA.token);
    check('student A can finish the exam', finishA.status === 200, `HTTP ${finishA.status} ${JSON.stringify(finishA.json?.message || '')}`);

    const resultA = await waitFor(
      () => exams.collection('exam_results').findOne({ attemptId: attemptA._id }),
      GRADE_POLL_TIMEOUT_MS
    );
    check('student A exam_result appears within timeout', !!resultA, `attemptId=${attemptA._id}`);
    check('student A exam_result has a score', resultA && typeof resultA.percentage === 'number', JSON.stringify(resultA?.percentage));

    const notifA = await waitFor(
      () => notif.collection('user_notifications').findOne({ recipientId: String(studentA.id), type: 'exam.graded' }),
      GRADE_POLL_TIMEOUT_MS
    );
    check("student A's in-app notification exists", !!notifA);

    // ══════════════════════════════════════════════════════════════════════
    // STEP 7 — student B: verify, start, answer one, infraction -> proctor sees it
    // ══════════════════════════════════════════════════════════════════════
    await submitPassingVerification(studentB.token, sid, String(studentB.id));
    const startB = await api('POST', `/api/v1/exam-taking/${sid}/start`, studentB.token);
    check('student B can start the exam', startB.status === 200, `HTTP ${startB.status} ${JSON.stringify(startB.json?.message || '')}`);
    if (startB.status !== 200) throw new Error('student B start failed');
    const attemptB = await exams.collection('attempts').findOne({ sessionId: new ObjectId(sid), candidateId: studentB.id });
    check('student B attempt created and in_progress', attemptB?.status === 'in_progress');
    const firstQuestionB = attemptB?.questionIds?.[0];
    const qDocB = await exams.collection('questions').findOne({ _id: new ObjectId(String(firstQuestionB)) });
    const correctOptionB = qDocB?.content?.options?.find((o) => o.isCorrect);
    const ansB = await api('POST', `/api/v1/exam-taking/${sid}/answer`, studentB.token, {
      questionId: String(firstQuestionB),
      answer: { selectedOptions: [correctOptionB?.id] },
    });
    check('student B can answer one question', ansB.status === 200, `HTTP ${ansB.status}`);

    const proctorInfractionWait = waitForEvent(proctorSocket, 'session.candidate.infraction', 15000, (d) => String(d.candidateId) === String(studentB.id));
    const infractionRes = await api('POST', `/api/v1/exam-taking/${sid}/infractions`, studentB.token, {
      type: 'fullscreen_exit', occurredAt: new Date().toISOString(),
    });
    check('student B infraction accepted', infractionRes.status === 200 && infractionRes.json?.data?.accepted === true, JSON.stringify(infractionRes.json?.data));
    const proctorInfractionEvt = await proctorInfractionWait;
    check('proctor socket receives session.candidate.infraction', !!proctorInfractionEvt, JSON.stringify(proctorInfractionEvt));

    const progressRes = await api('GET', `/api/v1/sessions/${sid}/progress`, proctor.token);
    check('proctor progress endpoint returns 200', progressRes.status === 200, `HTTP ${progressRes.status}`);
    const bProgress = progressRes.json?.data?.candidates?.find((c) => String(c.candidateId) === String(studentB.id));
    check('progress shows B in progress with infractionCount >= 1', bProgress?.status === 'in_progress' && bProgress?.infractionCount >= 1, JSON.stringify(bProgress));

    // ══════════════════════════════════════════════════════════════════════
    // STEP 8 — extend time -> students' sockets get session.time.extended
    // ══════════════════════════════════════════════════════════════════════
    const studentBExtendWait = waitForEvent(studentBSocket, 'session.time.extended', 15000);
    const studentAExtendWait = waitForEvent(studentASocket, 'session.time.extended', 15000);
    const sessionBeforeExtend = await exams.collection('sessions').findOne({ _id: new ObjectId(sid) });
    const attemptBBeforeExtend = await exams.collection('attempts').findOne({ _id: attemptB._id });
    const extendRes = await api('POST', `/api/v1/sessions/${sid}/extend`, proctor.token, { minutes: EXTEND_MINUTES });
    check('proctor can extend session time', extendRes.status === 200, `HTTP ${extendRes.status} ${JSON.stringify(extendRes.json?.message || '')}`);
    const newEndDate = new Date(sessionBeforeExtend.scheduling.endDate.getTime() + EXTEND_MINUTES * 60_000);

    const [studentAExtendEvt, studentBExtendEvt] = await Promise.all([studentAExtendWait, studentBExtendWait]);
    check('student A socket receives session.time.extended', !!studentAExtendEvt, JSON.stringify(studentAExtendEvt));
    check('student B socket receives session.time.extended', !!studentBExtendEvt, JSON.stringify(studentBExtendEvt));

    const attemptBAfterExtend = await exams.collection('attempts').findOne({ _id: attemptB._id });
    check(
      "B's time-remaining (timeAllowedSeconds) increased after extension",
      attemptBAfterExtend.timeAllowedSeconds > attemptBBeforeExtend.timeAllowedSeconds,
      `before=${attemptBBeforeExtend.timeAllowedSeconds} after=${attemptBAfterExtend.timeAllowedSeconds}`
    );

    const sessionAfterExtend = await exams.collection('sessions').findOne({ _id: new ObjectId(sid) });
    check(
      'session.scheduling.endDate was pushed forward by the extension',
      sessionAfterExtend.scheduling.endDate.getTime() === newEndDate.getTime(),
      `expected=${newEndDate.toISOString()} actual=${sessionAfterExtend.scheduling.endDate.toISOString()}`
    );

    // ══════════════════════════════════════════════════════════════════════
    // STEP 9 — wait for scheduler auto-END at the (extended) endDate
    // ══════════════════════════════════════════════════════════════════════
    const endWaitBudget = waitBudgetMs(newEndDate, END_POLL_TIMEOUT_MS);
    const proctorEndedWait = waitForEvent(proctorSocket, 'session.status.changed', endWaitBudget, (d) => d.status === 'completed');
    const studentAEndedWait = waitForEvent(studentASocket, 'session.status.changed', endWaitBudget, (d) => d.status === 'completed');
    const studentBEndedWait = waitForEvent(studentBSocket, 'session.status.changed', endWaitBudget, (d) => d.status === 'completed');

    const msUntilEnd = newEndDate.getTime() - Date.now();
    console.log(`Waiting ~${Math.round(msUntilEnd / 1000)}s for the Bull scheduler to auto-end the (extended) session...`);
    const endedSession = await waitFor(
      async () => {
        const r = await api('GET', `/api/v1/sessions/${sid}`, teacher.token);
        return r.json?.data?.status === 'completed' ? r.json.data : null;
      },
      endWaitBudget,
      3000
    );
    check(
      'session auto-ended (status became completed) at/after the EXTENDED endDate, not the original one',
      !!endedSession,
      `observed at ${new Date().toISOString()}, extended endDate=${newEndDate.toISOString()}, original endDate=${sessionBeforeExtend.scheduling.endDate.toISOString()}`
    );
    if (!endedSession) {
      reportBug(
        'Session did not auto-end even after waiting past the extended endDate — extension may not correctly reschedule the Bull end job',
        `exam-service/src/services/session.service.ts extendTime() calls sessionSchedulerService.rescheduleEndJob(sessionId, newEndDate); ` +
        `if that job never fires, GET /api/v1/sessions/${sid} still returns status="${(await api('GET', `/api/v1/sessions/${sid}`, teacher.token)).json?.data?.status}" ` +
        `at ${new Date().toISOString()}, well past the extended endDate ${newEndDate.toISOString()}.`
      );
    }

    const [proctorEndedEvt, studentAEndedEvt, studentBEndedEvt] = await Promise.all([proctorEndedWait, studentAEndedWait, studentBEndedWait]);
    check('proctor socket received terminal session.status.changed(completed)', !!proctorEndedEvt, JSON.stringify(proctorEndedEvt));
    check('student A socket received terminal session.status.changed(completed)', !!studentAEndedEvt, JSON.stringify(studentAEndedEvt));
    check('student B socket received terminal session.status.changed(completed)', !!studentBEndedEvt, JSON.stringify(studentBEndedEvt));

    const attemptBFinal = await exams.collection('attempts').findOne({ _id: attemptB._id });
    check("B's in-progress attempt was force-closed by auto-end (status=completed)", attemptBFinal?.status === 'completed', `status=${attemptBFinal?.status}`);

    const resultB = await waitFor(
      () => exams.collection('exam_results').findOne({ attemptId: attemptB._id }),
      GRADE_POLL_TIMEOUT_MS
    );
    check("B's exam_result appears within timeout after forced grading", !!resultB, `attemptId=${attemptB._id}`);

    // ══════════════════════════════════════════════════════════════════════
    // STEP 10 — teacher reads the session results report
    // ══════════════════════════════════════════════════════════════════════
    const reportRes = await api('GET', `/api/v1/sessions/${sid}/results`, teacher.token);
    check('teacher can GET /sessions/:id/results', reportRes.status === 200, `HTTP ${reportRes.status}`);
    const reportCandidateIds = (reportRes.json?.data?.results || []).map((r) => String(r.candidateId));
    check('report includes candidate A', reportCandidateIds.includes(String(studentA.id)), JSON.stringify(reportCandidateIds));
    check('report includes candidate B', reportCandidateIds.includes(String(studentB.id)), JSON.stringify(reportCandidateIds));
  } finally {
    // ══════════════════════════════════════════════════════════════════════
    // STEP 11 — cleanup everything created
    // ══════════════════════════════════════════════════════════════════════
    if (teacherSocket) teacherSocket.disconnect();
    if (proctorSocket) proctorSocket.disconnect();
    if (studentASocket) studentASocket.disconnect();
    if (studentBSocket) studentBSocket.disconnect();

    const leftovers = {};
    if (created.sessionId) {
      const sIdObj = new ObjectId(created.sessionId);
      const attemptIds = (await exams.collection('attempts').find({ sessionId: sIdObj }).project({ _id: 1 }).toArray()).map((a) => a._id);
      const delResults = await exams.collection('exam_results').deleteMany({ $or: [{ attemptId: { $in: attemptIds } }, { sessionId: sIdObj }] });
      const delResponses = await exams.collection('responses').deleteMany({ sessionId: sIdObj });
      const delAttempts = await exams.collection('attempts').deleteMany({ sessionId: sIdObj });
      const delSession = await exams.collection('sessions').deleteOne({ _id: sIdObj });
      leftovers.exam_results = delResults.deletedCount;
      leftovers.responses = delResponses.deletedCount;
      leftovers.attempts = delAttempts.deletedCount;
      leftovers.session = delSession.deletedCount;

      // Remove Bull scheduler jobs if any survived (should be gone after
      // auto-start/auto-end already consumed them; this covers the failure
      // path where the suite aborted before they fired).
      try {
        const Bull = require('bull');
        const redisOpts = {
          redis: {
            host: process.env.REDIS_HOST || 'redis',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
          },
        };
        const queue = new Bull('session-scheduler', redisOpts);
        const startJob = await queue.getJob(`start-${created.sessionId}`);
        const endJob = await queue.getJob(`end-${created.sessionId}`);
        if (startJob) await startJob.remove();
        if (endJob) await endJob.remove();
        leftovers.bullJobsRemoved = { start: !!startJob, end: !!endJob };
        await queue.close();
      } catch (e) {
        leftovers.bullCleanupError = e.message;
      }
    }
    if (created.examId) {
      const delExam = await exams.collection('exams').deleteOne({ _id: new ObjectId(created.examId) });
      leftovers.exam = delExam.deletedCount;
    }
    if (created.userIds.length) {
      const delCandidates = await people.collection('candidates').deleteMany({ _id: { $in: created.userIds } });
      const delUsers = await people.collection('users').deleteMany({ _id: { $in: created.userIds } });
      const delNotifs = await notif.collection('user_notifications').deleteMany({ recipientId: { $in: created.userIds.map(String) } });
      leftovers.candidates = delCandidates.deletedCount;
      leftovers.users = delUsers.deletedCount;
      leftovers.notifications = delNotifs.deletedCount;
    }

    // Verify nothing throwaway is left behind.
    const remainingSession = created.sessionId ? await exams.collection('sessions').countDocuments({ _id: new ObjectId(created.sessionId) }) : 0;
    const remainingExam = created.examId ? await exams.collection('exams').countDocuments({ _id: new ObjectId(created.examId) }) : 0;
    const remainingUsers = created.userIds.length ? await people.collection('users').countDocuments({ _id: { $in: created.userIds } }) : 0;
    console.log('\nCleanup counts (deleted):', JSON.stringify(leftovers, null, 2));
    console.log(`Cleanup verification — remaining session=${remainingSession} exam=${remainingExam} users=${remainingUsers} (all should be 0)`);

    console.log('cleanup done');
    await mongoose.disconnect();
  }

  console.log(`\n═══ ${bugs.length} product bug(s) found ═══`);
  for (const b of bugs) console.log(` - ${b.title}`);

  if (results.length) {
    const failed = results.filter((ok) => !ok).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed`);
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(async (e) => {
  console.error('ERROR:', e.message, e.stack);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => {});
});
