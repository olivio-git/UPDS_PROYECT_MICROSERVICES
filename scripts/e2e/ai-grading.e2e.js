/*
 * End-to-end check that AI grading (GROQ) is actually alive against a
 * running stack.
 *
 * Context: GROQ's configured model was retired (404) and, before that, the
 * API key itself was rejected. AI grading for essay/open_text/speaking/
 * listening/audio_response — the centrepiece of this project — was dead for
 * an unknown period, and NONE of the existing e2e suites noticed, because
 * they all exercise auto-gradable question types (multiple_choice, etc.)
 * which never call GROQ. This suite exists to make a dead key or a dead
 * model fail LOUDLY.
 *
 * Checks:
 *   1. A student takes a throwaway exam pinned to a real (or, if the bank
 *      has none, throwaway) essay/open_text question, answers it with a
 *      plausible short text, finishes, and an exam_result appears within a
 *      generous 90s timeout (AI grading takes a few seconds).
 *   2. That question's result carries evaluationMethod: 'ai_grading', a
 *      numeric score in [0, maxScore], and non-empty feedback. THIS is the
 *      check that fails when the key or the model is dead (evaluateWithGroq
 *      falls back to score 0 / an error message on any GROQ failure).
 *   3. The overall exam_result is status 'completed' (not
 *      'pending_ai_review'), exactly one exam_result exists for the
 *      attempt, and gradingDurationMs was recorded.
 *   4. A negative/meaningfulness check, independent of the exam flow: two
 *      direct calls to grading-service's POST /api/v1/grading/question
 *      (the same internal, service-token-authenticated call exam-service's
 *      adaptive-exam path makes) — one with the plausible good answer, one
 *      with an empty answer — and asserts the good answer scores strictly
 *      higher. The empty-answer branch is guaranteed score 0 by
 *      groq-evaluator's own empty-text guard (it never calls GROQ for an
 *      empty response), which keeps this assertion deterministic instead of
 *      comparing two model-scored values against each other: if the good
 *      answer ALSO comes back 0 (GROQ dead -> evaluateWithGroq's catch-all
 *      fallback), the "strictly greater" assertion fails loudly, which is
 *      exactly the point.
 *   5. Prints GROQ_MODEL as seen by this container (docker-compose wires the
 *      same GROQ_MODEL value into both exam-service and grading-service from
 *      the same .env), so a future failure output shows which model was in
 *      play.
 *
 * Creates one throwaway student (@example.com — RFC 2606 reserved, so any
 * attempted email is never delivered), one exam pinned via questionPool to a
 * single AI-graded question, and one session; only creates a throwaway essay
 * question itself if the bank has none active. Deletes everything it
 * created — including the session-manager Redis verification keys — at the
 * end, even on failure.
 *
 * Run inside the exam-service container (it already has mongoose,
 * jsonwebtoken and redis in node_modules):
 *   docker cp scripts/e2e/ai-grading.e2e.js exam-service:/app/exam-service/ai-grading.e2e.js
 *   docker exec -w /app/exam-service exam-service node ai-grading.e2e.js
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
// exam-service's own outbound call to grading-service (same env vars
// examTaking.service.ts and examEventPublisher.ts use).
const GRADING_SERVICE_URL = process.env.GRADING_SERVICE_URL || 'http://grading-service:3007';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN;
const TAG = `e2e-aigrading-${Date.now()}`;
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

// Direct, service-to-service call to grading-service — bypasses the gateway
// and exam-service entirely, same as examTaking.service.ts's adaptive-answer
// path (POST /api/v1/grading/question with X-Service-Token).
async function gradingApi(path, body) {
  const res = await fetch(`${GRADING_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service-Token': SERVICE_TOKEN },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// Same 8 calls a real browser makes from ExamPreparation.tsx (PR10's
// technical-verification gate blocks a brand-new attempt otherwise).
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
  if (!SERVICE_TOKEN) {
    console.log('ABORT: SERVICE_TOKEN not present in this container env — cannot call grading-service directly.');
    process.exitCode = 2;
    return;
  }

  console.log(`GROQ model in use (GROQ_MODEL, same value wired into grading-service): ${process.env.GROQ_MODEL || '(unset, code default) openai/gpt-oss-120b'}`);

  await mongoose.connect(process.env.MONGO_URI);
  const exams = mongoose.connection.db; // exam database (cba_platform)
  const people = mongoose.connection.client.db(process.env.MONGO_UMS_DB_NAME || 'cba_identity_db');

  const redis = createClient({
    socket: { host: process.env.REDIS_HOST || 'redis', port: parseInt(process.env.REDIS_PORT || '6379', 10) },
    password: process.env.REDIS_PASSWORD || undefined,
  });
  redis.on('error', () => {}); // avoid unhandled 'error' events during teardown races
  await redis.connect();

  const created = { personId: null, sessionId: null, examId: null, questionId: null, questionWasCreated: false, verificationId: null };

  try {
    // ---- Pick (or create) an AI-graded question ---------------------------
    const [bankQuestion] = await exams.collection('questions').aggregate([
      { $match: { isActive: true, type: { $in: ['essay', 'open_text'] }, 'content.sampleAnswer': { $exists: true, $ne: '' } } },
      { $sort: { _id: 1 } },
      { $limit: 1 },
    ]).toArray();

    let question = bankQuestion;
    if (!question) {
      // No AI-gradable question with a reference answer in the bank — build
      // one ourselves, mirroring the bank's real schema exactly (content,
      // metadata, statistics) so grading-service reads it the same way.
      const questionId = new ObjectId();
      question = {
        _id: questionId, type: 'essay', competency: 'writing', level: 'A1', difficulty: 3,
        content: {
          question: `${TAG}: Write about your favorite hobby.`,
          instructions: 'Write a short paragraph (50-60 words) about your favorite hobby. Say what it is and why you like it.',
          sampleAnswer: 'My favorite hobby is reading. I like reading because it is relaxing and I learn new things. I read books every evening.',
          keywords: ['hobby', 'like', 'favorite', 'why'],
        },
        metadata: { topic: 'E2E throwaway', subtopic: 'hobbies', tags: ['writing', 'A1', 'e2e'], estimatedTime: 10, points: 10 },
        statistics: { timesUsed: 0, averageScore: 0, averageTime: 0, difficulty: 3 },
        isActive: true, createdBy: new ObjectId(), createdAt: new Date(), updatedAt: new Date(),
      };
      await exams.collection('questions').insertOne(question);
      created.questionId = questionId;
      created.questionWasCreated = true;
    }
    console.log(
      `AI-graded question: ${created.questionWasCreated ? 'created throwaway' : 'from bank'} ` +
      `${question.type}/${question.competency}/${question.level} (id ${question._id})`
    );

    // ---- Throwaway exam pinned to exactly that question --------------------
    const examId = new ObjectId();
    await exams.collection('exams').insertOne({
      _id: examId, name: TAG, description: 'E2E ai-grading throwaway exam', type: 'practice', targetLevel: question.level,
      structure: {
        sections: [{ name: 'E2E-AI', competency: question.competency, duration: 30, questionCount: 1, weight: 100 }],
        totalDuration: 30, passingScore: 60,
      },
      configuration: { randomizeQuestions: false, allowReview: true, showResults: true, attemptsAllowed: 1, timeBetweenAttempts: 0 },
      questionPool: [question._id],
      isActive: true, isTemplate: false, createdBy: new ObjectId(), createdAt: new Date(), updatedAt: new Date(),
    });
    created.examId = examId;
    const exam = await exams.collection('exams').findOne({ _id: examId });

    // Reserved, non-routable domain (RFC 2606) — any attempted send bounces
    // or is dropped locally, never reaches a real inbox.
    const id = new ObjectId();
    const email = `${TAG}@example.com`;
    await people.collection('users').insertOne({
      _id: id, authServiceUserId: String(id), email, firstName: 'E2E', lastName: 'AiGrading',
      role: 'student', isActive: true, status: 'active', createdAt: new Date(),
    });
    await people.collection('candidates').insertOne({
      _id: id, userId: id, personalInfo: { firstName: 'E2E', lastName: 'AiGrading', email },
      academicInfo: { currentLevel: exam.targetLevel, targetLevel: exam.targetLevel }, createdAt: new Date(),
    });
    created.personId = id;
    // issuer/audience required: session-manager-service's technical-gate
    // endpoints verify these strictly, unlike exam-service's own
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

    // ---- Happy path via the real HTTP flow ---------------------------------
    created.verificationId = await submitPassingVerification(token, sid, String(id));
    const startRes = await api('POST', `/api/v1/exam-taking/${sid}/start`, token);
    check('candidate can start', startRes.status === 200, `HTTP ${startRes.status}${startRes.json?.message ? ` ${startRes.json.message}` : ''}`);
    if (startRes.status !== 200) throw new Error('start failed');

    const attempt = await exams.collection('attempts').findOne({ sessionId });
    check('attempt exists', !!attempt);
    const questionId = String(attempt?.questionIds?.[0] ?? '');
    check("attempt's pinned question is the AI-graded question", questionId === String(question._id), `${questionId} vs ${question._id}`);
    if (!questionId) throw new Error('attempt has no questions');

    // Use the bank's own reference answer (or the throwaway one's) as the
    // "good" answer — guaranteed on-topic regardless of which question got
    // picked, and phrased as a plausible student answer, not a copy-paste of
    // the exact sampleAnswer wording risk aside, GROQ grades content/grammar/
    // vocabulary/coherence, so a reference answer is a legitimately strong one.
    const goodAnswerText = question.content?.sampleAnswer
      || `This is a thoughtful, on-topic answer to: ${question.content?.question}`;

    const answerRes = await api('POST', `/api/v1/exam-taking/${sid}/answer`, token, {
      questionId, answer: { text: goodAnswerText },
    });
    check('candidate can answer', answerRes.status === 200, `HTTP ${answerRes.status}`);

    const finishRes = await api('POST', `/api/v1/exam-taking/${sid}/finish`, token);
    check('candidate can finish', finishRes.status === 200, `HTTP ${finishRes.status}`);

    const attemptId = attempt._id;

    // AI grading takes a few seconds (GROQ round-trip); be generous.
    const examResult = await waitFor(
      () => exams.collection('exam_results').findOne({ attemptId }),
      90_000
    );
    check('exam_result appears within 90s (AI-graded via GROQ)', !!examResult);
    if (!examResult) throw new Error('no exam_result appeared — grading pipeline never produced one');

    // ---- Check 2: the AI-graded question's result is real, not a fallback -
    const qResult = examResult.questionResults.find((qr) => String(qr.questionId) === String(question._id));
    check('question result exists for the AI-graded question', !!qResult);
    check(
      "question result evaluationMethod is 'ai_grading'",
      qResult?.evaluationMethod === 'ai_grading',
      `evaluationMethod=${qResult?.evaluationMethod}`
    );
    const qMaxScore = qResult?.maxScore ?? question.metadata?.points ?? 10;
    check(
      'question score is numeric and within [0, maxScore]',
      typeof qResult?.score === 'number' && qResult.score >= 0 && qResult.score <= qMaxScore,
      `score=${qResult?.score} maxScore=${qMaxScore}`
    );
    check(
      'question feedback is non-empty',
      typeof qResult?.feedback === 'string' && qResult.feedback.trim().length > 0,
      JSON.stringify(qResult?.feedback)
    );
    // groq-evaluator.ts answers with fallbackResult(score 0, 'Error en
    // evaluacion IA: …' / 'Error al procesar respuesta del evaluador')
    // whenever the call fails — a dead key, a retired model, a timeout. That
    // still looks like a graded question, so name it here: this is the
    // assertion that says out loud "the AI did not actually grade this".
    check(
      'feedback is real AI output, not the failure fallback',
      typeof qResult?.feedback === 'string' &&
        !/^Error (en evaluacion IA|al procesar respuesta del evaluador)/i.test(qResult.feedback.trim()),
      JSON.stringify(qResult?.feedback).slice(0, 120)
    );

    // ---- Check 3: overall result -------------------------------------------
    check("exam_result status is 'completed'", examResult.status === 'completed', `status=${examResult.status}`);
    const countForAttempt = await exams.collection('exam_results').countDocuments({ attemptId });
    check('exactly one exam_result for the attempt', countForAttempt === 1, `${countForAttempt}`);
    check(
      'gradingDurationMs was recorded',
      typeof examResult.gradingDurationMs === 'number' && examResult.gradingDurationMs >= 0,
      `gradingDurationMs=${examResult.gradingDurationMs}`
    );

    // ---- Check 4: negative/meaningfulness check ----------------------------
    // Direct service-to-service call, same shape examTaking.service.ts uses
    // for adaptive answers. The empty-answer branch never reaches GROQ (see
    // groq-evaluator.ts's empty-text guard), so it is deterministically 0 —
    // this keeps the assertion stable across model variance instead of
    // comparing two model-scored numbers against each other.
    const goodCall = await gradingApi('/api/v1/grading/question', {
      questionId: String(question._id),
      response: { text: goodAnswerText },
    });
    check('direct grading call (good answer) succeeds', goodCall.status === 200, `HTTP ${goodCall.status} ${JSON.stringify(goodCall.json)}`);
    const goodScore = goodCall.json?.data?.score;
    check(
      'direct grading call (good answer) scores > 0',
      typeof goodScore === 'number' && goodScore > 0,
      `score=${goodScore}`
    );

    const emptyCall = await gradingApi('/api/v1/grading/question', {
      questionId: String(question._id),
      response: { text: '' },
    });
    check('direct grading call (empty answer) succeeds', emptyCall.status === 200, `HTTP ${emptyCall.status} ${JSON.stringify(emptyCall.json)}`);
    const emptyScore = emptyCall.json?.data?.score;
    check('direct grading call (empty answer) scores 0', emptyScore === 0, `score=${emptyScore}`);

    check(
      'good answer scores strictly higher than empty answer (AI grading is meaningfully discriminating)',
      typeof goodScore === 'number' && typeof emptyScore === 'number' && goodScore > emptyScore,
      `good=${goodScore} empty=${emptyScore}`
    );
  } finally {
    if (created.sessionId) {
      const ids = (await exams.collection('attempts').find({ sessionId: created.sessionId }).project({ _id: 1 }).toArray()).map((a) => a._id);
      await exams.collection('exam_results').deleteMany({ $or: [{ attemptId: { $in: ids } }, { sessionId: created.sessionId }] });
      await exams.collection('responses').deleteMany({ sessionId: created.sessionId });
      await exams.collection('attempts').deleteMany({ sessionId: created.sessionId });
      await exams.collection('sessions').deleteOne({ _id: created.sessionId });
    }
    if (created.examId) await exams.collection('exams').deleteOne({ _id: created.examId });
    if (created.questionWasCreated && created.questionId) {
      await exams.collection('questions').deleteOne({ _id: created.questionId });
    }
    if (created.personId) {
      await people.collection('candidates').deleteMany({ _id: created.personId });
      await people.collection('users').deleteMany({ _id: created.personId });
    }
    if (created.verificationId) {
      await redis.del(`tech_verify:${created.verificationId}`).catch(() => {});
      await redis.del(`user_tech:${created.personId ? String(created.personId) : ''}`).catch(() => {});
    }
    await redis.quit().catch(() => {});
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
