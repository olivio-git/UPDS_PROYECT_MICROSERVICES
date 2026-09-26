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
 * A third, independent phase seeds a weighted-sections exam/attempt/
 * questions/responses directly in Mongo (bypassing the HTTP exam-taking
 * flow, per design.md's Testing Strategy) and calls grading-service directly
 * to assert the stored `percentage` matches the weighted formula (not the
 * raw sum) and that `passed`/`passingScore` are computed correctly — both in
 * the HTTP response and in the STORED exam_results document. It includes a
 * rounding boundary case (3 equal-weight sections at exactly 70% with
 * passingScore 70 must store 70 / passed) and a `/regrade-session` pass that
 * must keep the weighted percentage and `passed` consistent.
 *
 * Phase 2b checks the time-up contract: an in_progress attempt whose time
 * has run out is auto-submitted by exam-service the moment the candidate's
 * client syncs time (status 'completed', NOT the old 'expired' that was
 * never graded) and exactly one exam_result is produced; a later finish()
 * is an idempotent success. It also checks that grading-service still
 * grades a legacy 'expired' attempt (what the sweeper reconciles).
 *
 * Phase 5 checks the level-mastery indicator (design D13): using the exam's
 * REAL targetLevel document (every level always defines a full
 * `competencyRequirements`/`overallMinScore`, so nothing is upserted), it
 * seeds a case scoring below both thresholds (`passed:true`, mastery not
 * achieved) and one above both (`passed:false`, full mastery achieved) to
 * prove the two verdicts are independent, plus a placement exam and an
 * unresolved `targetLevel`, both of which must omit `competencyMastery`
 * without blocking grading.
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
const Redis = require('ioredis');

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
// exam-service's own outbound call to grading-service (same env var
// examTaking.service.ts uses) — Phase 3 calls grading-service directly,
// service-to-service, instead of driving the HTTP exam-taking flow.
const GRADING_SERVICE_URL = process.env.GRADING_SERVICE_URL || 'http://grading-service:3007';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN;
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

async function gradingApi(path, body) {
  const res = await fetch(`${GRADING_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service-Token': SERVICE_TOKEN },
    body: JSON.stringify(body),
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
  const created = {
    personId: null, sessionId: null, examId: null,
    // Phase 3 seeds (one entry per weighted case).
    weightedExamIds: [], weightedAttemptIds: [], weightedQuestionIds: [],
    weightedCandidateIds: [], weightedSessionIds: [],
    // Phase 4: candidate seeded in the identity DB so grading-service finds an
    // email and the hidden-result notification_emails doc gets written.
    hiddenCandidateId: null, hiddenEmail: null,
    // Phase 2b: extra sessions/attempts seeded for the time-up checks.
    timeUpSessionIds: [], timeUpAttemptIds: [],
  };

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

    // ---- Phase 2b: time running out = automatic submission ---------------
    // Seed a second session for the same candidate with an in_progress
    // attempt whose time already ran out, plus one saved answer. The
    // candidate's time sync (GET /time) must complete it and queue grading.
    const seedTimeUpCase = async (status) => {
      const tuSessionId = new ObjectId();
      const tuAttemptId = new ObjectId();
      created.timeUpSessionIds.push(tuSessionId);
      created.timeUpAttemptIds.push(tuAttemptId);
      await exams.collection('sessions').insertOne({
        _id: tuSessionId, examId: exam._id, sessionName: `${TAG}-timeup-${status}`,
        scheduling: { startDate: new Date(now - 3_600_000), endDate: new Date(now + 3_600_000), timeZone: 'America/La_Paz', timeSlots: [] },
        participants: { maxCandidates: 5, registeredCandidates: [id], proctors: [], currentActive: 0 },
        settings: { requireProctor: false, recordSession: false, browserLockdown: false, allowLateEntry: true, autoStart: false, lateEntryMinutes: 30 },
        status: 'in_progress', createdBy: id, createdAt: new Date(), updatedAt: new Date(),
      });
      const questionObjectId = new ObjectId(questionId);
      await exams.collection('attempts').insertOne({
        _id: tuAttemptId, sessionId: tuSessionId, candidateId: id, examId: exam._id,
        status, startedAt: new Date(now - 30 * 60_000),
        ...(status === 'expired' ? { finishedAt: new Date(now - 25 * 60_000) } : {}),
        timeAllowedSeconds: 60, questionIds: [questionObjectId],
        sectionsStructure: [{ id: 'e2e', name: 'E2E', competency: pick._id.competency, duration: 1, weight: 100, questionCount: 1, questionIds: [questionObjectId] }],
        createdAt: new Date(), updatedAt: new Date(),
      });
      await exams.collection('responses').insertOne({
        sessionId: tuSessionId, candidateId: id, examId: exam._id, questionId: questionObjectId, competency: pick._id.competency,
        answer: { selectedOptions: ['e2e-choice'] }, timeSpent: 10, attempts: 1, createdAt: new Date(), updatedAt: new Date(),
      });
      return { tuSessionId, tuAttemptId };
    };

    const timeUp = await seedTimeUpCase('in_progress');
    const timeRes = await api('GET', `/api/v1/exam-taking/${timeUp.tuSessionId}/time`, token);
    check('time sync on a timed-out attempt answers 200', timeRes.status === 200, `HTTP ${timeRes.status}`);
    check('time sync reports the attempt as submitted (attemptStatus completed)',
      timeRes.json?.data?.timeRemaining === 0 && timeRes.json?.data?.attemptStatus === 'completed', JSON.stringify(timeRes.json?.data));
    const timedOutAttempt = await exams.collection('attempts').findOne({ _id: timeUp.tuAttemptId });
    check('[stored] timed-out attempt is completed, not expired', timedOutAttempt?.status === 'completed', `${timedOutAttempt?.status}`);
    check('[stored] timed-out attempt has finishedAt', timedOutAttempt?.finishedAt instanceof Date);

    const timeUpResult = await waitFor(
      () => exams.collection('exam_results').findOne({ attemptId: timeUp.tuAttemptId }),
      60_000
    );
    check('exam_result appears for the time-up attempt within 60s', !!timeUpResult);

    const lateFinish = await api('POST', `/api/v1/exam-taking/${timeUp.tuSessionId}/finish`, token);
    check('finish after time-up is an idempotent success', lateFinish.status === 200, `HTTP ${lateFinish.status}`);
    await new Promise((r) => setTimeout(r, 5000));
    const timeUpCount = await exams.collection('exam_results').countDocuments({ attemptId: timeUp.tuAttemptId });
    check('exactly one exam_result for the time-up attempt', timeUpCount === 1, `${timeUpCount}`);

    const resumeAfterTimeUp = await api('GET', `/api/v1/exam-taking/${timeUp.tuSessionId}/resume`, token);
    check('resume of the submitted attempt is a structured 409 (completed)',
      resumeAfterTimeUp.status === 409 && resumeAfterTimeUp.json?.code === 'ATTEMPT_NOT_IN_PROGRESS' && resumeAfterTimeUp.json?.attemptStatus === 'completed',
      `HTTP ${resumeAfterTimeUp.status} ${JSON.stringify(resumeAfterTimeUp.json)}`);

    if (SERVICE_TOKEN) {
      // Legacy data: timed-out attempts used to be left 'expired' and never
      // graded. grading-service must accept them (the sweeper reconciles
      // them through the same gradeExam path).
      const legacy = await seedTimeUpCase('expired');
      const legacyRes = await gradingApi('/api/v1/grading/exam', { attemptId: String(legacy.tuAttemptId) });
      check('grading-service grades a legacy expired attempt', legacyRes.status === 200, `HTTP ${legacyRes.status} ${JSON.stringify(legacyRes.json)}`);
      const legacyResult = await exams.collection('exam_results').findOne({ attemptId: legacy.tuAttemptId });
      check('[stored] exam_result exists for the legacy expired attempt', !!legacyResult);
    } else {
      console.log('SKIP legacy expired grading check: SERVICE_TOKEN not present in this container env.');
    }

    // ---- Phase 3: weighted-section scoring + stored pass/fail ------------
    // Deterministic seed, independent of Phase 1/2: a throwaway exam with
    // two sections (weight 70/30), one answered fully correct and the other
    // fully wrong, so the weighted percentage (70) differs from what a naive
    // raw average would give, and the configured passingScore (80) fails it.
    if (!SERVICE_TOKEN) {
      console.log('SKIP Phase 3 (weighted scoring): SERVICE_TOKEN not present in this container env.');
    } else {
      // Seeds one sectioned exam + completed attempt + responses directly in
      // Mongo. Each section lists its questions as { points, correct }.
      // Questions are inserted with isActive: false so they never leak into
      // the real bank (grading looks questions up by _id only).
      const seedWeightedCase = async (label, examType, passingScore, sections) => {
        const examId = new ObjectId();
        const candidateId = new ObjectId();
        const sessionId = new ObjectId();
        const attemptId = new ObjectId();
        created.weightedExamIds.push(examId);
        created.weightedCandidateIds.push(candidateId);
        created.weightedSessionIds.push(sessionId);
        await exams.collection('exams').insertOne({
          _id: examId, name: `${TAG}-${label}`, description: 'E2E weighted-section throwaway exam',
          type: examType, targetLevel: pick._id.level,
          structure: {
            sections: sections.map((sec) => ({ name: sec.name, competency: pick._id.competency, duration: 30, questionCount: sec.questions.length, weight: sec.weight })),
            totalDuration: 30 * sections.length, passingScore,
          },
          configuration: { randomizeQuestions: false, allowReview: true, showResults: true, attemptsAllowed: 1, timeBetweenAttempts: 0 },
          isActive: true, isTemplate: false, createdBy: new ObjectId(), createdAt: new Date(), updatedAt: new Date(),
        });

        const questionDocs = [];
        const responseDocs = [];
        const sectionsStructure = sections.map((sec, i) => {
          const ids = sec.questions.map(({ points, correct }) => {
            const qId = new ObjectId();
            questionDocs.push({
              _id: qId, type: 'multiple_choice', competency: pick._id.competency, level: pick._id.level, difficulty: 1,
              content: { question: 'E2E weighted-scoring throwaway question', options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: false }] },
              metadata: { points }, statistics: { timesUsed: 0, averageScore: 0, averageTime: 0, difficulty: 1 },
              isActive: false, createdBy: new ObjectId(), createdAt: new Date(), updatedAt: new Date(),
            });
            responseDocs.push({
              sessionId, candidateId, examId, questionId: qId, competency: pick._id.competency,
              answer: { selectedOptions: [correct ? 'a' : 'b'] }, timeSpent: 10, attempts: 1, createdAt: new Date(), updatedAt: new Date(),
            });
            return qId;
          });
          return { id: String(i), name: sec.name, competency: pick._id.competency, duration: 30, weight: sec.weight, questionCount: ids.length, questionIds: ids };
        });
        await exams.collection('questions').insertMany(questionDocs);
        created.weightedQuestionIds.push(...questionDocs.map((q) => q._id));

        await exams.collection('attempts').insertOne({
          _id: attemptId, sessionId, candidateId, examId,
          status: 'completed', startedAt: new Date(now - 60_000), finishedAt: new Date(),
          timeAllowedSeconds: 3600, questionIds: questionDocs.map((q) => q._id), sectionsStructure,
          createdAt: new Date(), updatedAt: new Date(),
        });
        created.weightedAttemptIds.push(attemptId);
        await exams.collection('responses').insertMany(responseDocs);
        return { attemptId, sessionId, examId, candidateId };
      };

      // Case 1: two sections (weight 70/30), A fully correct, B fully wrong →
      // weighted 70 (raw average would be 50); passingScore 80 fails it.
      const case1 = await seedWeightedCase('weighted', 'final', 80, [
        { name: 'Sección A', weight: 70, questions: [{ points: 10, correct: true }] },
        { name: 'Sección B', weight: 30, questions: [{ points: 10, correct: false }] },
      ]);
      const gradeRes = await gradingApi('/api/v1/grading/exam', { attemptId: String(case1.attemptId) });
      check('weighted exam grades successfully', gradeRes.status === 200, `HTTP ${gradeRes.status} ${JSON.stringify(gradeRes.json)}`);
      const gradedData = gradeRes.json?.data || {};
      check('scoringMethod is weighted_sections (not raw sum)', gradedData.scoringMethod === 'weighted_sections', `${gradedData.scoringMethod}`);
      check('percentage equals the weighted formula (Σp·w/Σw = 70)', gradedData.percentage === 70, `${gradedData.percentage}`);
      check('passingScore stored from exam.structure.passingScore', gradedData.passingScore === 80, `${gradedData.passingScore}`);
      check('passed is false below the configured threshold', gradedData.passed === false, `${gradedData.passed}`);

      const stored1 = await exams.collection('exam_results').findOne({ attemptId: case1.attemptId });
      check('[stored] weighted exam_result exists', !!stored1);
      check('[stored] percentage = 70 (weighted, not raw 50)', stored1?.percentage === 70, `${stored1?.percentage}`);
      check('[stored] passed = false', stored1?.passed === false, `${stored1?.passed}`);
      check('[stored] passingScore = 80', stored1?.passingScore === 80, `${stored1?.passingScore}`);
      check('[stored] scoringMethod = weighted_sections', stored1?.scoringMethod === 'weighted_sections', `${stored1?.scoringMethod}`);
      const secs1 = (stored1?.sections || []).map((x) => `${x.weight}/${x.weightedPercentage}`).join(',');
      check('[stored] sections carry weight/weightedPercentage (70/70, 30/0)', secs1 === '70/70,30/0', secs1);

      // Case 2 (rounding boundary): 3 equal-weight sections, each at exactly
      // 70% (7 of 10 points), passingScore 70 → must store exactly 70 and pass.
      // Summing per-section rounded contributions would yield 69.9 and fail.
      const seventyPercent = [{ points: 7, correct: true }, { points: 3, correct: false }];
      const case2 = await seedWeightedCase('boundary', 'final', 70, [
        { name: 'Sección 1', weight: 33.33, questions: seventyPercent },
        { name: 'Sección 2', weight: 33.33, questions: seventyPercent },
        { name: 'Sección 3', weight: 33.33, questions: seventyPercent },
      ]);
      const boundaryRes = await gradingApi('/api/v1/grading/exam', { attemptId: String(case2.attemptId) });
      check('boundary exam grades successfully', boundaryRes.status === 200, `HTTP ${boundaryRes.status}`);
      const stored2 = await exams.collection('exam_results').findOne({ attemptId: case2.attemptId });
      check('[stored] boundary percentage = 70 (no double-rounding drift)', stored2?.percentage === 70, `${stored2?.percentage}`);
      check('[stored] boundary passed = true at passingScore 70', stored2?.passed === true, `${stored2?.passed}`);
      check('[stored] boundary passingScore = 70', stored2?.passingScore === 70, `${stored2?.passingScore}`);
      check('[stored] boundary scoringMethod = weighted_sections', stored2?.scoringMethod === 'weighted_sections', `${stored2?.scoringMethod}`);
      const secs2 = (stored2?.sections || []).map((x) => x.weight).join(',');
      check('[stored] boundary sections keep their weights', secs2 === '33.33,33.33,33.33', secs2);

      // /regrade-session (teacher "re-calificar sesión" button): tamper case 1
      // so the auto-grader sees a changed score (a question wrongly stored as
      // 0 with a stale percentage/passed), then regrade. It must rewrite the
      // same facts gradeExam produces — weighted 70 and passed=false — not the
      // raw totalScore/maxScore (50) with a stale `passed`.
      if (stored1) {
        const correctIdx = stored1.questionResults.findIndex((qr) => qr.score > 0);
        await exams.collection('exam_results').updateOne(
          { _id: stored1._id },
          { $set: { [`questionResults.${correctIdx}.score`]: 0, percentage: 0, passed: true } }
        );
        const regradeRes = await gradingApi('/api/v1/grading/regrade-session', { sessionId: String(case1.sessionId) });
        check('regrade-session succeeds and regrades the tampered result',
          regradeRes.status === 200 && regradeRes.json?.data?.regraded === 1 && regradeRes.json?.data?.errors === 0,
          `HTTP ${regradeRes.status} ${JSON.stringify(regradeRes.json?.data ?? regradeRes.json)}`);
        const regraded1 = await exams.collection('exam_results').findOne({ attemptId: case1.attemptId });
        check('[stored] after regrade-session percentage = 70 (weighted, not raw 50)', regraded1?.percentage === 70, `${regraded1?.percentage}`);
        check('[stored] after regrade-session passed = false (recomputed, not stale)', regraded1?.passed === false, `${regraded1?.passed}`);
        check('[stored] after regrade-session scoringMethod/passingScore intact',
          regraded1?.scoringMethod === 'weighted_sections' && regraded1?.passingScore === 80,
          `${regraded1?.scoringMethod}/${regraded1?.passingScore}`);
      }

      // ---- Phase 4: showResults:false hides the score from the student,
      // admin stays complete, and the in-app notification has no "Puntaje" --
      const hidden = await seedWeightedCase('hidden', 'final', 60, [
        { name: 'Sección Única', weight: 100, questions: [{ points: 10, correct: true }] },
      ]);
      await exams.collection('exams').updateOne({ _id: hidden.examId }, { $set: { 'configuration.showResults': false } });
      // Reserved, non-routable domain (RFC 2606), same as Phase 1.
      const hiddenEmail = `${TAG}-hidden@example.com`;
      await people.collection('candidates').insertOne({
        _id: hidden.candidateId, userId: hidden.candidateId,
        personalInfo: { firstName: 'E2E', lastName: 'Hidden', email: hiddenEmail }, createdAt: new Date(),
      });
      created.hiddenCandidateId = hidden.candidateId;
      created.hiddenEmail = hiddenEmail;
      const hiddenGrade = await gradingApi('/api/v1/grading/exam', { attemptId: String(hidden.attemptId) });
      check('hidden-result exam grades successfully', hiddenGrade.status === 200, `HTTP ${hiddenGrade.status}`);

      const hiddenToken = jwt.sign(
        { userId: String(hidden.candidateId), email: `${TAG}-hidden@example.com`, role: 'student' },
        process.env.JWT_SECRET,
        { expiresIn: '10m', issuer: 'cba-auth-service', audience: 'cba-platform' }
      );
      const studentView = await api('GET', `/api/v1/exam-results/attempt/${hidden.attemptId}`, hiddenToken);
      check('student attempt/:id marks the result resultsHidden', studentView.status === 200 && studentView.json?.data?.resultsHidden === true, JSON.stringify(studentView.json));
      check('student attempt/:id has no percentage/score/details', studentView.json?.data?.score === undefined && studentView.json?.data?.details === undefined, JSON.stringify(studentView.json?.data));

      // The full per-student history carries scores — students are not
      // allowed on it at all (not even their own id).
      const historyRes = await api('GET', `/api/v1/reports/student/${hidden.candidateId}/history`, hiddenToken);
      check('student JWT gets 403 on /reports/student/<own id>/history', historyRes.status === 403, `HTTP ${historyRes.status}`);

      const hiddenResultDoc = await exams.collection('exam_results').findOne({ attemptId: hidden.attemptId });
      const adminToken = jwt.sign(
        { userId: String(new ObjectId()), email: 'e2e-admin@example.com', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '10m', issuer: 'cba-auth-service', audience: 'cba-platform' }
      );
      const adminView = await api('GET', `/api/v1/exam-results/${hiddenResultDoc._id}/admin`, adminToken);
      check('admin endpoint stays complete despite showResults:false', adminView.status === 200 && typeof adminView.json?.data?.percentage === 'number', `${adminView.json?.data?.percentage}`);

      // Grading notifications are delivered asynchronously (Kafka →
      // notifications-service). Wait for them before cleanup so they can't
      // land after the delete and be left behind as orphans.
      const weightedRecipients = created.weightedCandidateIds.map(String);
      const notified = await waitFor(async () => {
        const n = await notif.collection('user_notifications').countDocuments({ recipientId: { $in: weightedRecipients } });
        return n >= weightedRecipients.length ? n : null;
      }, 15_000);
      console.log(`Phase 3/4 in-app notifications observed before cleanup: ${notified ?? 'timeout'}`);

      const hiddenNotif = await notif.collection('user_notifications').findOne({ recipientId: String(hidden.candidateId) });
      check('hidden result in-app notification has no "Puntaje"', !!hiddenNotif && !String(hiddenNotif.content?.body).includes('Puntaje'), JSON.stringify(hiddenNotif?.content));
      check('hidden result in-app metadata carries no score/passed', !!hiddenNotif && hiddenNotif.metadata?.score === undefined && hiddenNotif.metadata?.passed === undefined, JSON.stringify(hiddenNotif?.metadata));

      // The stored email doc must not become a side channel for the score
      // (it is persisted before Resend is even called, so a bounce is fine).
      const hiddenEmailDoc = await waitFor(
        () => notif.collection('notification_emails').findOne({ to: hiddenEmail, template: 'exam_graded' }),
        15_000
      );
      const td = hiddenEmailDoc?.templateData || {};
      check('hidden result notification_emails doc was stored', !!hiddenEmailDoc, hiddenEmailDoc ? '' : 'timeout');
      check('hidden result email templateData has no percentage/passed/score', !!hiddenEmailDoc
        && td.showResults === false
        && ['score', 'maxScore', 'percentage', 'passed', 'passingScore', 'recommendedLevel', 'pdfBase64'].every((k) => td[k] === undefined),
        JSON.stringify(td));

      // ---- Phase 5: level mastery indicator — informational, independent
      // of `passed` (design D13, level-mastery-indicator spec). Uses the
      // REAL level document for `pick._id.level` (every level always has a
      // full `competencyRequirements`/`overallMinScore`, so no throwaway
      // level needs to be upserted/cleaned up here). ----------------------
      const targetLevelDoc = await exams.collection('levels').findOne({ code: pick._id.level, isActive: true });
      const compMinScore = targetLevelDoc?.competencyRequirements?.[pick._id.competency]?.minScore;
      const overallMinScore = targetLevelDoc?.overallMinScore;
      if (typeof compMinScore !== 'number' || typeof overallMinScore !== 'number') {
        console.log(`SKIP Phase 5 (level mastery): level ${pick._id.level} has no usable requirements for ${pick._id.competency}.`);
      } else {
        // Below both thresholds, above a low passingScore -> passed true,
        // mastery not achieved ("Passed despite unmet mastery").
        const belowMin = Math.max(1, Math.min(compMinScore, overallMinScore) - 15);
        const caseBelow = await seedWeightedCase('mastery-below', 'final', Math.max(0, belowMin - 10), [
          { name: 'Única', weight: 100, questions: [{ points: belowMin, correct: true }, { points: 100 - belowMin, correct: false }] },
        ]);
        await gradingApi('/api/v1/grading/exam', { attemptId: String(caseBelow.attemptId) });
        const storedBelow = await exams.collection('exam_results').findOne({ attemptId: caseBelow.attemptId });
        check('[stored] mastery-below: passed=true despite unmet mastery', storedBelow?.passed === true, `${storedBelow?.passed}`);
        check('[stored] mastery-below: competencyMastery.levelCode matches targetLevel', storedBelow?.competencyMastery?.levelCode === pick._id.level, JSON.stringify(storedBelow?.competencyMastery));
        check('[stored] mastery-below: overall not achieved', storedBelow?.competencyMastery?.overall?.achieved === false, JSON.stringify(storedBelow?.competencyMastery?.overall));
        const compBelow = storedBelow?.competencyMastery?.competencies?.find((c) => c.competency === pick._id.competency);
        check('[stored] mastery-below: competency not achieved', compBelow?.achieved === false, JSON.stringify(compBelow));

        // Above both thresholds, below a high passingScore -> passed false,
        // full mastery achieved ("Failed despite full mastery").
        const aboveMin = Math.min(99, Math.max(compMinScore, overallMinScore) + 15);
        const caseAbove = await seedWeightedCase('mastery-above', 'final', Math.min(100, aboveMin + 10), [
          { name: 'Única', weight: 100, questions: [{ points: aboveMin, correct: true }, { points: 100 - aboveMin, correct: false }] },
        ]);
        await gradingApi('/api/v1/grading/exam', { attemptId: String(caseAbove.attemptId) });
        const storedAbove = await exams.collection('exam_results').findOne({ attemptId: caseAbove.attemptId });
        check('[stored] mastery-above: passed=false despite full mastery', storedAbove?.passed === false, `${storedAbove?.passed}`);
        check('[stored] mastery-above: overall achieved', storedAbove?.competencyMastery?.overall?.achieved === true, JSON.stringify(storedAbove?.competencyMastery?.overall));
        const compAbove = storedAbove?.competencyMastery?.competencies?.find((c) => c.competency === pick._id.competency);
        check('[stored] mastery-above: competency achieved', compAbove?.achieved === true, JSON.stringify(compAbove));

        // Placement exams get a recommendedLevel, never a mastery indicator.
        const casePlacement = await seedWeightedCase('mastery-placement', 'placement', 60, [
          { name: 'Única', weight: 100, questions: [{ points: 10, correct: true }] },
        ]);
        const placementRes = await gradingApi('/api/v1/grading/exam', { attemptId: String(casePlacement.attemptId) });
        check('placement exam grades successfully', placementRes.status === 200, `HTTP ${placementRes.status}`);
        const storedPlacement = await exams.collection('exam_results').findOne({ attemptId: casePlacement.attemptId });
        check('[stored] placement exam omits competencyMastery', storedPlacement?.competencyMastery == null, JSON.stringify(storedPlacement?.competencyMastery));

        // A targetLevel that never resolves (deleted/renamed) omits mastery
        // too, without blocking grading (Graceful Absence of Level Data).
        const caseUnresolved = await seedWeightedCase('mastery-unresolved', 'final', 50, [
          { name: 'Única', weight: 100, questions: [{ points: 10, correct: true }] },
        ]);
        await exams.collection('exams').updateOne({ _id: caseUnresolved.examId }, { $set: { targetLevel: `${TAG}-no-such-level` } });
        const unresolvedRes = await gradingApi('/api/v1/grading/exam', { attemptId: String(caseUnresolved.attemptId) });
        check('unresolved-level exam grades successfully', unresolvedRes.status === 200, `HTTP ${unresolvedRes.status}`);
        const storedUnresolved = await exams.collection('exam_results').findOne({ attemptId: caseUnresolved.attemptId });
        check('[stored] unresolved targetLevel omits competencyMastery', storedUnresolved?.competencyMastery == null, JSON.stringify(storedUnresolved?.competencyMastery));
        check('[stored] unresolved targetLevel still computes passed normally', storedUnresolved?.passed === true, `${storedUnresolved?.passed}`);
      }
    }
  } finally {
    if (kafkaProducer) await kafkaProducer.disconnect().catch(() => {});
    // Collect every exam_result id this run produced before deleting them, so
    // notifications-service's Redis dedupe keys (notif:grading:<examResultId>:*)
    // can be cleared too.
    const seededAttemptIds = [...created.weightedAttemptIds, ...created.timeUpAttemptIds];
    if (created.sessionId) {
      seededAttemptIds.push(...(await exams.collection('attempts').find({ sessionId: created.sessionId }).project({ _id: 1 }).toArray()).map((a) => a._id));
    }
    const seededResultIds = (await exams.collection('exam_results')
      .find({ $or: [{ attemptId: { $in: seededAttemptIds } }, ...(created.sessionId ? [{ sessionId: created.sessionId }] : [])] })
      .project({ _id: 1 }).toArray()).map((r) => String(r._id));
    if (seededResultIds.length) {
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'redis',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true, maxRetriesPerRequest: 1,
      });
      try {
        await redis.connect();
        for (const resultId of seededResultIds) {
          const keys = await redis.keys(`notif:grading:${resultId}:*`);
          if (keys.length) await redis.del(...keys);
        }
      } catch (e) {
        console.log(`WARN: could not clear notification dedupe keys in Redis (${e.message}); they expire via TTL.`);
      } finally {
        redis.disconnect();
      }
    }
    if (created.sessionId) {
      const ids = (await exams.collection('attempts').find({ sessionId: created.sessionId }).project({ _id: 1 }).toArray()).map((a) => a._id);
      await exams.collection('exam_results').deleteMany({ $or: [{ attemptId: { $in: ids } }, { sessionId: created.sessionId }] });
      await exams.collection('responses').deleteMany({ sessionId: created.sessionId });
      await exams.collection('attempts').deleteMany({ sessionId: created.sessionId });
      await exams.collection('sessions').deleteOne({ _id: created.sessionId });
    }
    if (created.timeUpSessionIds.length) {
      await exams.collection('exam_results').deleteMany({ attemptId: { $in: created.timeUpAttemptIds } });
      await exams.collection('responses').deleteMany({ sessionId: { $in: created.timeUpSessionIds } });
      await exams.collection('attempts').deleteMany({ _id: { $in: created.timeUpAttemptIds } });
      await exams.collection('sessions').deleteMany({ _id: { $in: created.timeUpSessionIds } });
    }
    if (created.examId) await exams.collection('exams').deleteOne({ _id: created.examId });
    if (created.weightedExamIds.length) {
      await exams.collection('exam_results').deleteMany({ $or: [{ examId: { $in: created.weightedExamIds } }, { attemptId: { $in: created.weightedAttemptIds } }] });
      await exams.collection('responses').deleteMany({ examId: { $in: created.weightedExamIds } });
      await exams.collection('attempts').deleteMany({ _id: { $in: created.weightedAttemptIds } });
      await exams.collection('questions').deleteMany({ _id: { $in: created.weightedQuestionIds } });
      await exams.collection('exams').deleteMany({ _id: { $in: created.weightedExamIds } });
      await notif.collection('user_notifications').deleteMany({ recipientId: { $in: created.weightedCandidateIds.map(String) } });
    }
    if (created.hiddenCandidateId) {
      await people.collection('candidates').deleteMany({ _id: created.hiddenCandidateId });
    }
    if (created.hiddenEmail) {
      await notif.collection('notification_emails').deleteMany({ to: created.hiddenEmail });
    }
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
