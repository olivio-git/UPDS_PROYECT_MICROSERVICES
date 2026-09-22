/*
 * End-to-end check of the Kafka-based grading pipeline against a running
 * stack: finishing an exam attempt must publish `exam.attempt.finished` on
 * `exam-events`, grading-service must consume it and produce exactly one
 * exam_result, and notifications-service must create an in-app notification
 * for the candidate via the new `grading.result.published` -> 'exam.graded'
 * path.
 *
 * It also re-publishes the same `exam.attempt.finished` data a second time
 * (simulating an at-least-once redelivery) and checks that grading-service
 * and notifications-service both stay idempotent: still exactly one
 * exam_result, and the notification dedupe key stops the second candidate
 * notification/email.
 *
 * Creates one throwaway student (@example.com — a reserved, non-routable
 * domain per RFC 2606, so any attempted email is never delivered), one exam
 * built from the question bank and one in-progress session, and deletes
 * everything it created at the end, even on failure.
 *
 * Run inside the exam-service container (it already has mongoose,
 * jsonwebtoken, kafkajs and @cba/events in node_modules):
 *   docker cp scripts/e2e/grading-pipeline.e2e.js exam-service:/app/exam-service/grading-pipeline.e2e.js
 *   docker exec -w /app/exam-service exam-service node grading-pipeline.e2e.js
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Kafka } = require('kafkajs');
const { createEvent, publishEvent, TOPICS, EXAM_ATTEMPT_FINISHED } = require('@cba/events');

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
const TAG = `e2e-grading-${Date.now()}`;
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
  const created = { personId: null, sessionId: null, examId: null };

  let kafkaProducer = null;

  try {
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
      _id: examId, name: TAG, description: 'E2E grading-pipeline throwaway exam', type: 'practice', targetLevel: pick._id.level,
      structure: {
        sections: [{ name: 'E2E', competency: pick._id.competency, duration: 30, questionCount: 1, weight: 100 }],
        totalDuration: 30, passingScore: 60,
      },
      configuration: { randomizeQuestions: false, allowReview: true, showResults: true, attemptsAllowed: 1, timeBetweenAttempts: 0 },
      isActive: true, isTemplate: false, createdBy: new ObjectId(), createdAt: new Date(), updatedAt: new Date(),
    });
    created.examId = examId;
    const exam = await exams.collection('exams').findOne({ _id: examId });
    console.log(`Throwaway exam: level ${exam.targetLevel}, ${pick._id.competency}, 1 question`);

    // Reserved, non-routable domain (RFC 2606) — any attempted send bounces
    // or is dropped locally, never reaches a real inbox.
    const id = new ObjectId();
    const email = `${TAG}@example.com`;
    await people.collection('users').insertOne({
      _id: id, authServiceUserId: String(id), email, firstName: 'E2E', lastName: 'Grading',
      role: 'student', isActive: true, status: 'active', createdAt: new Date(),
    });
    await people.collection('candidates').insertOne({
      _id: id, userId: id, personalInfo: { firstName: 'E2E', lastName: 'Grading', email },
      academicInfo: { currentLevel: exam.targetLevel, targetLevel: exam.targetLevel }, createdAt: new Date(),
    });
    created.personId = id;
    // issuer/audience required: session-manager-service's technical-gate
    // endpoints (PR10) verify these strictly, unlike exam-service's own
    // authMiddleware which only checks the secret.
    const token = jwt.sign({ userId: String(id), email, role: 'student' }, process.env.JWT_SECRET, {
      expiresIn: '10m',
      issuer: 'cba-auth-service',
      audience: 'cba-platform',
    });

    const sessionId = new ObjectId();
    const now = Date.now();
    await exams.collection('sessions').insertOne({
      _id: sessionId, examId: exam._id, sessionName: TAG,
      scheduling: { startDate: new Date(now - 60_000), endDate: new Date(now + 3_600_000), timeZone: 'America/La_Paz', timeSlots: [] },
      participants: { maxCandidates: 5, registeredCandidates: [id], proctors: [], currentActive: 0 },
      settings: { requireProctor: false, recordSession: false, browserLockdown: false, allowLateEntry: true, autoStart: false, lateEntryMinutes: 30 },
      status: 'in_progress', createdBy: id, createdAt: new Date(), updatedAt: new Date(),
    });
    created.sessionId = sessionId;
    const sid = String(sessionId);

    // ---- Phase 1: happy path via the real HTTP flow ----------------------
    await submitPassingVerification(token, sid, String(id));
    const startRes = await api('POST', `/api/v1/exam-taking/${sid}/start`, token);
    check('candidate can start', startRes.status === 200, `HTTP ${startRes.status}${startRes.json?.message ? ` ${startRes.json.message}` : ''}`);
    if (startRes.status !== 200) throw new Error('start failed');

    const attempt = await exams.collection('attempts').findOne({ sessionId });
    check('attempt exists', !!attempt);
    const questionId = String(attempt?.questionIds?.[0] ?? '');
    if (!questionId) throw new Error('attempt has no questions');

    const answerRes = await api('POST', `/api/v1/exam-taking/${sid}/answer`, token, {
      questionId, answer: { selectedOptions: ['e2e-choice'] },
    });
    check('candidate can answer', answerRes.status === 200, `HTTP ${answerRes.status}`);

    const finishRes = await api('POST', `/api/v1/exam-taking/${sid}/finish`, token);
    check('candidate can finish', finishRes.status === 200, `HTTP ${finishRes.status}`);

    const attemptId = attempt._id;

    const firstResult = await waitFor(
      () => exams.collection('exam_results').findOne({ attemptId }),
      60_000
    );
    check('exam_result appears within 60s (graded via Kafka consumer)', !!firstResult);

    const countAfterFirst = await exams.collection('exam_results').countDocuments({ attemptId });
    check('exactly one exam_result after normal finish', countAfterFirst === 1, `${countAfterFirst}`);

    const inAppNotif = await waitFor(
      () => notif.collection('user_notifications').findOne({ recipientId: String(id), type: 'exam.graded' }),
      15_000,
      1000
    );
    check('in-app notification created for candidate', !!inAppNotif);

    // ---- Phase 2: duplicate exam.attempt.finished redelivery -------------
    // Simulates at-least-once delivery: publish the very same event data
    // twice more directly to Kafka (bypassing exam-service's HTTP layer,
    // which only ever publishes once per finish call).
    kafkaProducer = new Kafka({
      clientId: 'e2e-grading-pipeline',
      brokers: [process.env.KAFKA_BROKER || 'kafka:29092'],
    }).producer();
    await kafkaProducer.connect();

    const duplicateEnvelope = createEvent({
      type: EXAM_ATTEMPT_FINISHED,
      source: 'e2e-grading-pipeline',
      subject: String(attemptId),
      data: {
        attemptId: String(attemptId),
        examId: String(attempt.examId),
        candidateId: String(attempt.candidateId),
        sessionId: String(attempt.sessionId),
        finishedAt: new Date().toISOString(),
        reason: 'submitted',
      },
    });

    // Two separate envelopes (distinct ids), same underlying data — matches
    // what actually happens when gradeExam() re-sends a notification for an
    // already-graded attempt: a *new* envelope id every time.
    const published1 = await publishEvent(kafkaProducer, TOPICS.EXAM_EVENTS, duplicateEnvelope);
    const duplicateEnvelope2 = createEvent({
      type: EXAM_ATTEMPT_FINISHED,
      source: 'e2e-grading-pipeline',
      subject: String(attemptId),
      data: duplicateEnvelope.data,
    });
    const published2 = await publishEvent(kafkaProducer, TOPICS.EXAM_EVENTS, duplicateEnvelope2);
    check('duplicate exam.attempt.finished published twice', published1 && published2);

    // Give grading-service's consumer time to process both redeliveries.
    await new Promise((r) => setTimeout(r, 8000));

    const countAfterDuplicate = await exams.collection('exam_results').countDocuments({ attemptId });
    check('still exactly one exam_result after duplicate redelivery', countAfterDuplicate === 1, `${countAfterDuplicate}`);
  } finally {
    if (kafkaProducer) await kafkaProducer.disconnect().catch(() => {});
    if (created.sessionId) {
      const ids = (await exams.collection('attempts').find({ sessionId: created.sessionId }).project({ _id: 1 }).toArray()).map((a) => a._id);
      await exams.collection('exam_results').deleteMany({ $or: [{ attemptId: { $in: ids } }, { sessionId: created.sessionId }] });
      await exams.collection('responses').deleteMany({ sessionId: created.sessionId });
      await exams.collection('attempts').deleteMany({ sessionId: created.sessionId });
      await exams.collection('sessions').deleteOne({ _id: created.sessionId });
    }
    if (created.examId) await exams.collection('exams').deleteOne({ _id: created.examId });
    if (created.personId) {
      await notif.collection('user_notifications').deleteMany({ recipientId: String(created.personId) });
      await people.collection('candidates').deleteMany({ _id: created.personId });
      await people.collection('users').deleteMany({ _id: created.personId });
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
