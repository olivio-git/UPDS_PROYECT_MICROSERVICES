/*
 * Prepares a ready-to-use demo: two accounts with passwords, an exam built
 * from the question bank and a session that is already running, so someone
 * can log in as the student and sit the exam from the browser.
 *
 * Everything is created through the same REST endpoints the UI uses, except
 * the two user documents (the UI cannot create a password-holding account
 * without an email round trip).
 *
 * The exam uses only multiple-choice questions on purpose: those are graded
 * without GROQ, so the demo shows a score even while the AI key is down.
 *
 * Run inside the exam-service container (it has mongoose and jsonwebtoken):
 *   docker cp scripts/demo/setup-demo.js exam-service:/app/exam-service/
 *   docker exec -w /app/exam-service exam-service node setup-demo.js
 *
 * Pass --clean to delete a previous demo (accounts, exam, session, attempts,
 * results and notifications) before creating a new one.
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
const TAG = 'demo';
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!';
const STUDENT_EMAIL = 'demo.estudiante@cba.test';
const TEACHER_EMAIL = 'demo.docente@cba.test';
const QUESTION_COUNT = Number(process.env.DEMO_QUESTIONS || 5);
const DURATION_MINUTES = Number(process.env.DEMO_DURATION_MIN || 20);
const { ObjectId } = mongoose.Types;

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

async function main() {
  const clean = process.argv.includes('--clean');

  await mongoose.connect(process.env.MONGO_URI);
  const exams = mongoose.connection.db; // cba_platform
  const people = mongoose.connection.client.db(process.env.MONGO_UMS_DB_NAME || 'cba_identity_db');
  const notif = mongoose.connection.client.db(process.env.MONGO_NOTIFICATION_DB_NAME || 'cba_notification_db');

  if (clean) {
    const oldUsers = await people.collection('users').find({ email: { $in: [STUDENT_EMAIL, TEACHER_EMAIL] } }).toArray();
    const oldIds = oldUsers.map((u) => u._id);
    const oldSessions = await exams.collection('sessions').find({ sessionName: /^demo-/ }).project({ _id: 1 }).toArray();
    const sessionIds = oldSessions.map((s) => s._id);
    const attempts = await exams.collection('attempts').find({ sessionId: { $in: sessionIds } }).project({ _id: 1 }).toArray();
    const attemptIds = attempts.map((a) => a._id);
    await exams.collection('exam_results').deleteMany({ attemptId: { $in: attemptIds } });
    await exams.collection('responses').deleteMany({ sessionId: { $in: sessionIds } });
    await exams.collection('attempts').deleteMany({ sessionId: { $in: sessionIds } });
    await exams.collection('sessions').deleteMany({ _id: { $in: sessionIds } });
    await exams.collection('exams').deleteMany({ name: /^demo-/ });
    await notif.collection('user_notifications').deleteMany({ recipientId: { $in: oldIds.map(String) } });
    await people.collection('candidates').deleteMany({ _id: { $in: oldIds } });
    await people.collection('users').deleteMany({ _id: { $in: oldIds } });
    console.log('Limpieza de la demo anterior: listo');
  }

  // ── Accounts ────────────────────────────────────────────────────────────
  // bcrypt lives in identity-service, so the hash is passed in by the caller
  // (see scripts/demo/README or the wrapper command in the session notes).
  const passwordHash = process.env.DEMO_PASSWORD_HASH;
  if (!passwordHash) throw new Error('DEMO_PASSWORD_HASH is required (bcrypt hash of DEMO_PASSWORD)');

  const makePerson = async (email, role, firstName, lastName) => {
    const existing = await people.collection('users').findOne({ email });
    const id = existing?._id || new ObjectId();
    await people.collection('users').updateOne(
      { _id: id },
      {
        $set: {
          email, firstName, lastName, role,
          status: 'active', isActive: true,
          authServiceUserId: String(id),
          passwordHash,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    if (role === 'student') {
      await people.collection('candidates').updateOne(
        { _id: id },
        {
          $set: {
            // Same shape the seed script and UserService.createUser produce:
            // userId equals _id ("one person, one id"), and session lookups
            // ($lookup on candidates.userId) depend on that field existing.
            userId: id,
            personalInfo: { firstName, lastName, email },
            academicInfo: { currentLevel: 'A2', targetLevel: 'A2' },
            status: 'active',
            examHistory: [],
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
    }
    return { id, email, token: signToken({ userId: String(id), email, role }) };
  };

  const student = await makePerson(STUDENT_EMAIL, 'student', 'Estudiante', 'Demo');
  const teacher = await makePerson(TEACHER_EMAIL, 'teacher', 'Docente', 'Demo');
  const adminToken = signToken({ userId: String(new ObjectId()), email: 'demo.admin@cba.test', role: 'admin' });
  console.log(`Cuentas listas: estudiante=${student.id} docente=${teacher.id}`);

  // ── Exam ────────────────────────────────────────────────────────────────
  // Pick the level/competency with the most active multiple-choice questions
  // and pin the exam to exactly those ids, so the demo never draws a question
  // that needs AI grading or a microphone.
  const pool = await exams.collection('questions').aggregate([
    { $match: { isActive: true, type: 'multiple_choice' } },
    { $group: { _id: { level: '$level', competency: '$competency' }, ids: { $push: '$_id' }, n: { $sum: 1 } } },
    { $match: { n: { $gte: QUESTION_COUNT } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]).toArray();
  if (!pool.length) throw new Error(`no level/competency has ${QUESTION_COUNT} active multiple_choice questions`);
  const { level, competency } = pool[0]._id;
  const questionIds = pool[0].ids.slice(0, QUESTION_COUNT).map(String);

  const examRes = await api('POST', '/api/v1/exams', teacher.token, {
    name: `${TAG}-examen-${new Date().toISOString().slice(0, 10)}`,
    description: 'Examen de demostración (preguntas de opción múltiple, calificación automática)',
    type: 'practice',
    targetLevel: level,
    structure: {
      sections: [{ name: 'Sección demo', competency, duration: DURATION_MINUTES, questionCount: questionIds.length, weight: 100 }],
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
  console.log(`Examen creado: ${examId} (${questionIds.length} preguntas, nivel ${level}, ${competency})`);

  // ── Session ─────────────────────────────────────────────────────────────
  const now = Date.now();
  const sessionRes = await api('POST', '/api/v1/sessions', teacher.token, {
    sessionName: `${TAG}-sesion-${new Date().toISOString().slice(11, 16)}`,
    examId: String(examId),
    scheduling: {
      startDate: new Date(now - 2_000).toISOString(),
      endDate: new Date(now + 4 * 3600_000).toISOString(),
      timeZone: 'America/La_Paz',
      timeSlots: [],
    },
    participants: { maxCandidates: 10, candidates: [], proctors: [] },
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

  const enroll = await api('POST', `/api/v1/sessions/${sessionId}/candidates`, teacher.token, { candidateId: String(student.id) });
  if (enroll.status !== 200) throw new Error(`enrolling the student failed: HTTP ${enroll.status}`);
  const proctor = await api('POST', `/api/v1/sessions/${sessionId}/proctors`, adminToken, { proctorId: String(teacher.id) });
  if (proctor.status !== 200) console.warn(`(aviso) no se pudo asignar al docente como supervisor: HTTP ${proctor.status}`);

  // Start it the way a teacher would, so the status transition and its
  // events are the real ones.
  const start = await api('POST', `/api/v1/sessions/${sessionId}/start`, teacher.token);
  if (start.status !== 200) throw new Error(`starting the session failed: HTTP ${start.status} ${JSON.stringify(start.json)}`);
  const session = await exams.collection('sessions').findOne({ _id: new ObjectId(sessionId) });

  // Login now requires OTP-before-password server-side (identity-service
  // enforces it, not just the UI — see auth.service.ts login()), so
  // "log in with the password" alone no longer works. Print the real flow:
  // request the code, read it straight out of Redis (this script's own
  // container has no Redis client handy, but identity-service's does), then
  // verify + log in with the password within its 10-minute window.
  console.log(`
────────────────────────────────────────────────────────────
DEMO LISTA
────────────────────────────────────────────────────────────
  Entrá por:        ${process.env.DEMO_PUBLIC_URL || 'http://localhost:8088'}/

  Estudiante:       ${STUDENT_EMAIL}
  Docente:          ${TEACHER_EMAIL}
  Contraseña:       ${PASSWORD}   (ambas cuentas)

  El login pide el código OTP ANTES que la contraseña (y el backend ahora lo
  exige, no solo la UI). Pasos:
    1. En ${process.env.DEMO_PUBLIC_URL || 'http://localhost:8088'}/ pedí el código con el email de arriba.
    2. Leelo de Redis (nunca se imprime la contraseña de Redis en este comando):
         docker exec -w /app identity-service node -e "const R=require('ioredis'); const r=new R(process.env.REDIS_URI); r.keys('otp:*').then(async ks=>{for(const k of ks)console.log(k, await r.get(k)); r.disconnect();})"
    3. Ingresá el código en /otp-verification y después tu contraseña en /login.
       Tenés 10 minutos entre el paso 2 y completar el login antes de que el
       código (y la verificación) expiren.

  Sesión:           ${session.sessionName}  (estado: ${session.status})\n  Entrada permitida hasta: ${new Date(new Date(session.scheduling.startDate).getTime() + 30 * 60000).toLocaleTimeString("es-BO")}  (ventana de 30 min)
  Examen:           ${questionIds.length} preguntas de opción múltiple, ${DURATION_MINUTES} min
  Bloqueo del navegador: ACTIVADO
  La sesión cierra: ${new Date(session.scheduling.endDate).toLocaleString('es-BO')}
────────────────────────────────────────────────────────────`);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => {});
});
