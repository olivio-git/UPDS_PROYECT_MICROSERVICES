/*
 * Seeds a ready-to-use browser E2E fixture: one student account with a real
 * password, an exam pinned to multiple-choice questions (auto-graded, no
 * GROQ/microphone needed) and a session already in_progress with
 * browserLockdown on, so a real browser can log in and sit the exam
 * end-to-end.
 *
 * Modeled on scripts/demo/setup-demo.js (account/exam/session shapes,
 * questionPool pinning to avoid AI-graded question types) and
 * scripts/e2e/exam-lifecycle.e2e.js (throwaway-account + cleanup pattern,
 * NODE_ENV=production guard for dev-mode JWTs).
 *
 * Run inside the exam-service container (it has mongoose + jsonwebtoken):
 *   docker cp scripts/e2e-browser/docker/seed.js \
 *     exam-service:/app/exam-service/e2e-browser-seed.js
 *   docker exec -e DEMO_PASSWORD_HASH=<bcrypt hash> \
 *     -w /app/exam-service exam-service node e2e-browser-seed.js
 *
 * Pass --clean to delete everything a previous run created (matches
 * setup-demo.js's --clean flag) instead of seeding.
 *
 * IMPORTANT: on success this prints exactly ONE line of JSON — the LAST
 * line of stdout — with everything the Playwright global-setup needs. Every
 * other progress message goes to stderr (console.error) so a naive
 * `stdout.trim().split('\n').pop()` always yields valid JSON.
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const TAG = 'e2ebrowser';
// Unique per run (not a fixed address): identity-service rate-limits OTP
// generation to 3 requests per 5 minutes PER EMAIL (otp.service.ts), so a
// fixed email would make back-to-back suite runs (or a debugging session)
// flake with "Demasiados intentos" — a real production safeguard, not a bug.
const STUDENT_EMAIL = `${TAG}.student.${Date.now()}@cba.test`;
const PASSWORD = process.env.E2E_BROWSER_PASSWORD || 'E2eBrowser2026!';
const QUESTION_COUNT = Number(process.env.E2E_BROWSER_QUESTIONS || 3);
const DURATION_MINUTES = Number(process.env.E2E_BROWSER_DURATION_MIN || 15);
const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
const { ObjectId } = mongoose.Types;

const log = (...args) => console.error(...args); // keep stdout clean for the JSON payload

function signToken({ userId, email, role }) {
  return jwt.sign({ userId, email, role }, process.env.JWT_SECRET, {
    expiresIn: '2h',
    issuer: 'cba-auth-service',
    audience: 'cba-platform',
  });
}

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

async function clean(exams, people) {
  // Matches ANY previous run's timestamped email/name (not just the current
  // STUDENT_EMAIL) so leftovers from an interrupted earlier run are always
  // swept up too, regardless of which run created them.
  const oldUsers = await people
    .collection('users')
    .find({ email: new RegExp(`^${TAG}\\.(student|teacher)\\.`) })
    .project({ _id: 1 })
    .toArray();
  const oldUserIds = oldUsers.map((u) => u._id);
  const oldSessions = await exams
    .collection('sessions')
    .find({ sessionName: new RegExp(`^${TAG}-`) })
    .project({ _id: 1 })
    .toArray();
  const sessionIds = oldSessions.map((s) => s._id);
  const attempts = await exams
    .collection('attempts')
    .find({ sessionId: { $in: sessionIds } })
    .project({ _id: 1 })
    .toArray();
  const attemptIds = attempts.map((a) => a._id);

  const delResults = await exams.collection('exam_results').deleteMany({
    $or: [{ attemptId: { $in: attemptIds } }, { sessionId: { $in: sessionIds } }],
  });
  const delResponses = await exams.collection('responses').deleteMany({ sessionId: { $in: sessionIds } });
  const delAttempts = await exams.collection('attempts').deleteMany({ sessionId: { $in: sessionIds } });
  const delSessions = await exams.collection('sessions').deleteMany({ _id: { $in: sessionIds } });
  const delExams = await exams.collection('exams').deleteMany({ name: new RegExp(`^${TAG}-`) });
  const delCandidates = await people.collection('candidates').deleteMany({ _id: { $in: oldUserIds } });
  const delUsers = await people.collection('users').deleteMany({ _id: { $in: oldUserIds } });

  log(
    'Cleanup counts:',
    JSON.stringify({
      exam_results: delResults.deletedCount,
      responses: delResponses.deletedCount,
      attempts: delAttempts.deletedCount,
      sessions: delSessions.deletedCount,
      exams: delExams.deletedCount,
      candidates: delCandidates.deletedCount,
      users: delUsers.deletedCount,
    })
  );
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ABORT: NODE_ENV=production re-validates tokens against identity-service; dev-mode JWTs would be rejected.');
    process.exitCode = 2;
    return;
  }

  const isClean = process.argv.includes('--clean');

  await mongoose.connect(process.env.MONGO_URI);
  const exams = mongoose.connection.db; // cba_platform
  const people = mongoose.connection.client.db(process.env.MONGO_UMS_DB_NAME || 'cba_identity_db');

  try {
    if (isClean) {
      await clean(exams, people);
      return;
    }

    // Idempotency: wipe any leftovers from a previous failed/interrupted run
    // before seeding fresh data (same defensive pattern setup-demo.js uses
    // for --clean, applied unconditionally here since this fixture is
    // meant to be single-tenant and disposable).
    await clean(exams, people);

    const passwordHash = process.env.DEMO_PASSWORD_HASH;
    if (!passwordHash) throw new Error('DEMO_PASSWORD_HASH is required (bcrypt hash of the student password)');

    // ── Student account (real password, logs in through the browser) ──────
    const studentId = new ObjectId();
    await people.collection('users').insertOne({
      _id: studentId,
      authServiceUserId: String(studentId),
      email: STUDENT_EMAIL,
      firstName: 'E2E',
      lastName: 'Browser',
      role: 'student',
      status: 'active',
      isActive: true,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // userId MUST equal _id — /sessions/my-sessions does a $lookup on
    // candidates.userId and returns 500 if it's missing/mismatched (learned
    // from scripts/demo/setup-demo.js's header comment).
    await people.collection('candidates').insertOne({
      _id: studentId,
      userId: studentId,
      personalInfo: { firstName: 'E2E', lastName: 'Browser', email: STUDENT_EMAIL },
      academicInfo: { currentLevel: 'A2', targetLevel: 'A2' },
      status: 'active',
      examHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    log(`Student ready: ${studentId} <${STUDENT_EMAIL}>`);

    // ── Throwaway teacher/admin (dev-mode JWTs, only used server-side) ────
    const teacherId = new ObjectId();
    const teacherEmail = `${TAG}.teacher.${Date.now()}@cba.test`;
    await people.collection('users').insertOne({
      _id: teacherId,
      authServiceUserId: String(teacherId),
      email: teacherEmail,
      firstName: 'E2E',
      lastName: 'Teacher',
      role: 'teacher',
      status: 'active',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const teacherToken = signToken({ userId: String(teacherId), email: teacherEmail, role: 'teacher' });

    // ── Exam pinned to exactly QUESTION_COUNT multiple_choice questions ────
    // (auto-graded — GROQ's API key is currently rejected, so anything
    // needing AI grading would never finish).
    const pool = await exams
      .collection('questions')
      .aggregate([
        { $match: { isActive: true, type: 'multiple_choice' } },
        { $group: { _id: { level: '$level', competency: '$competency' }, ids: { $push: '$_id' }, n: { $sum: 1 } } },
        { $match: { n: { $gte: QUESTION_COUNT } } },
        { $sort: { n: -1 } },
        { $limit: 1 },
      ])
      .toArray();
    if (!pool.length) throw new Error(`no level/competency has ${QUESTION_COUNT} active multiple_choice questions`);
    const { level, competency } = pool[0]._id;
    const questionIds = pool[0].ids.slice(0, QUESTION_COUNT).map(String);

    const examName = `${TAG}-exam-${Date.now()}`;
    const examRes = await api('POST', '/api/v1/exams', teacherToken, {
      name: examName,
      description: 'Browser E2E fixture exam (multiple-choice only, auto-graded)',
      type: 'practice',
      targetLevel: level,
      structure: {
        sections: [
          {
            name: 'E2E Browser Section',
            competency,
            duration: DURATION_MINUTES,
            questionCount: questionIds.length,
            weight: 100,
          },
        ],
        totalDuration: DURATION_MINUTES,
        passingScore: 60,
      },
      configuration: { randomizeQuestions: false, allowReview: true, showResults: true, attemptsAllowed: 1, timeBetweenAttempts: 0 },
      questionPool: questionIds,
      isActive: true,
      isTemplate: false,
    });
    if (examRes.status !== 201) throw new Error(`exam creation failed: HTTP ${examRes.status} ${JSON.stringify(examRes.json)}`);
    const examId = examRes.json.data._id;
    log(`Exam created: ${examId} (${questionIds.length} multiple_choice questions, level ${level}/${competency})`);

    // ── Session, already in_progress, browser lockdown ON ──────────────────
    const now = Date.now();
    const sessionRes = await api('POST', '/api/v1/sessions', teacherToken, {
      sessionName: `${TAG}-session-${now}`,
      examId: String(examId),
      scheduling: {
        startDate: new Date(now - 2_000).toISOString(),
        endDate: new Date(now + 3 * 3600_000).toISOString(),
        timeZone: 'America/La_Paz',
        timeSlots: [],
      },
      participants: { maxCandidates: 5, candidates: [], proctors: [] },
      settings: {
        requireProctor: false,
        recordSession: false,
        allowLateEntry: true,
        lateEntryMinutes: 30,
        autoStart: true,
        browserLockdown: true,
      },
      sessionType: 'group_synchronized',
    });
    if (sessionRes.status !== 201) throw new Error(`session creation failed: HTTP ${sessionRes.status} ${JSON.stringify(sessionRes.json)}`);
    const sessionId = String(sessionRes.json.data._id);

    const enroll = await api('POST', `/api/v1/sessions/${sessionId}/candidates`, teacherToken, {
      candidateId: String(studentId),
    });
    if (enroll.status !== 200) throw new Error(`enrolling the student failed: HTTP ${enroll.status}`);

    // Start it the way a teacher would (same as setup-demo.js) so the status
    // transition is the real one instead of writing status:'in_progress'
    // directly into Mongo.
    const start = await api('POST', `/api/v1/sessions/${sessionId}/start`, teacherToken);
    if (start.status !== 200) throw new Error(`starting the session failed: HTTP ${start.status} ${JSON.stringify(start.json)}`);
    log(`Session started: ${sessionId}`);

    // ── Single JSON line for the Playwright harness ────────────────────────
    console.log(
      JSON.stringify({
        studentEmail: STUDENT_EMAIL,
        studentPassword: PASSWORD,
        studentId: String(studentId),
        sessionId,
        examId: String(examId),
        examName,
        questionCount: questionIds.length,
      })
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error('SEED ERROR:', e.message);
  process.exitCode = 1;
});
