/*
 * CI-only fixture seed for the e2e job in .github/workflows/ci.yml.
 *
 * Why this exists: scripts/e2e/*.e2e.js were written against a developer's
 * populated local database (177 questions across 6 levels, plus rubrics,
 * users, etc.). The CI Mongo starts completely empty, so the very first
 * script (grading-pipeline.e2e.js) fails immediately with:
 *   "the question bank has no level/competency with an active
 *   multiple-choice question"
 *
 * What every e2e script actually needs (read from each script's own body,
 * not guessed):
 *   - grading-pipeline.e2e.js    needs >=1 active multiple_choice question
 *     for some (level, competency) pair.
 *   - exam-attempt-scope.e2e.js  needs >=2 (one exam with a 2-question
 *     section, one per student).
 *   - identity-privilege.e2e.js  needs no question bank at all (creates its
 *     own throwaway users, exercises identity-service only).
 *   - kick-and-push.e2e.js       needs >=1.
 *   - lockdown-infractions.e2e.js needs >=1.
 *   - technical-gate.e2e.js      needs >=1 (it creates its own throwaway
 *     audio_response question on top, unconditionally).
 *   - exam-lifecycle.e2e.js      needs >=3 (a 3-question pinned pool).
 *   - ai-grading.e2e.js (main/dispatch only, needs GROQ_API_KEY) creates its
 *     own throwaway essay/open_text question if the bank has none — no seed
 *     dependency here either.
 *
 * So the true minimum fixture is: enough ACTIVE multiple_choice questions at
 * ONE (level, competency) pair to satisfy the largest requirement (3), with
 * real options (id + isCorrect) so exam-lifecycle.e2e.js's "answer with the
 * correct option" step exercises real grading instead of an
 * `answer.selectedOptions: [undefined]` edge case.
 *
 * Nothing else in scripts/e2e/*.e2e.js reads pre-existing Level documents,
 * users, rubrics or exams — every script creates its own throwaway
 * users/exams/sessions directly (see their own header comments), so those
 * are deliberately NOT seeded here to keep the fixture minimal. A Level
 * document for CI_SEED_LEVEL is still seeded because the exam-service
 * question bank normally always has a matching Level and it costs nothing —
 * see "Also seed a matching Level" below.
 *
 * Idempotent by design: every seeded document uses a fixed, hardcoded
 * ObjectId and an `updateOne(..., { upsert: true })`, and is tagged
 * `ciSeed: true` (plus `metadata.tags: ['ci-seed']` on questions) so re-runs
 * across CI retries never create duplicates and the fixture is trivially
 * recognizable/removable. No secrets are embedded — createdBy is a fixed,
 * synthetic ObjectId, never a real user.
 *
 * Run inside the exam-service container, same docker cp/exec pattern as the
 * e2e scripts (it already has mongoose in node_modules and the container's
 * own env already points MONGO_URI at cba_platform):
 *   docker cp scripts/ci/seed-e2e.js exam-service:/app/exam-service/seed-e2e.js
 *   docker exec -w /app/exam-service exam-service node seed-e2e.js
 */
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const LEVEL = process.env.CI_SEED_LEVEL || 'A2';
const COMPETENCY = process.env.CI_SEED_COMPETENCY || 'reading';
// exam-lifecycle.e2e.js is the strictest consumer (needs >= 3); a couple of
// spares keep this seed correct even if a future script raises the bar.
const QUESTION_COUNT = Number(process.env.CI_SEED_QUESTION_COUNT || 5);

// Deterministic, recognizable 24-hex-char ids ("ceedca11" = "c(i) e(2e)
// seed ca11(bank)", all valid hex digits) so re-running this script is a
// pure upsert, never a duplicate insert.
const questionId = (n) => new ObjectId(`ceedca11${String(n).padStart(16, '0')}`);
const LEVEL_ID = new ObjectId('ceedca11000000000000fee1');
const CI_ACTOR_ID = new ObjectId('ceedca11000000000000ac70');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const exams = mongoose.connection.db; // cba_platform

  // ---- Reference data: one Level matching the seeded questions ------------
  // Not read by any current e2e script (they only pass the level string
  // through, never look up the Level document), but it costs nothing and
  // keeps the CI question bank shaped like a real one instead of orphaning
  // targetLevel/level strings with no backing Level record.
  const levelReq = { minScore: 60, description: 'CI seed requirement', canDoStatements: ['CI seed statement'] };
  await exams.collection('levels').updateOne(
    { code: LEVEL },
    {
      $set: {
        _id: LEVEL_ID,
        code: LEVEL,
        name: `${LEVEL} (CI seed)`,
        description: 'Level created by scripts/ci/seed-e2e.js for the GitHub Actions e2e job.',
        competencyRequirements: {
          reading: levelReq,
          writing: levelReq,
          listening: levelReq,
          speaking: levelReq,
          grammar: levelReq,
          vocabulary: levelReq,
        },
        overallMinScore: 60,
        isActive: true,
        createdBy: CI_ACTOR_ID,
        ciSeed: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log(`Level ready: ${LEVEL}`);

  // ---- Question bank: N active multiple_choice questions, one level/competency ----
  const ops = [];
  for (let i = 1; i <= QUESTION_COUNT; i++) {
    ops.push({
      updateOne: {
        filter: { _id: questionId(i) },
        update: {
          $set: {
            type: 'multiple_choice',
            competency: COMPETENCY,
            level: LEVEL,
            difficulty: 2,
            content: {
              question: `[CI seed ${i}] Which option is correct?`,
              options: [
                { id: 'a', text: 'Correct option', isCorrect: true },
                { id: 'b', text: 'Distractor 1', isCorrect: false },
                { id: 'c', text: 'Distractor 2', isCorrect: false },
                { id: 'd', text: 'Distractor 3', isCorrect: false },
              ],
            },
            metadata: { topic: 'ci-seed', tags: ['ci-seed'], points: 1 },
            statistics: { timesUsed: 0, averageScore: 0, averageTime: 0, difficulty: 2 },
            isActive: true,
            createdBy: CI_ACTOR_ID,
            ciSeed: true,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    });
  }
  const result = await exams.collection('questions').bulkWrite(ops);
  console.log(
    `Questions ready: ${QUESTION_COUNT} active multiple_choice @ level=${LEVEL} competency=${COMPETENCY} ` +
    `(upserted=${result.upsertedCount}, matched=${result.matchedCount}, modified=${result.modifiedCount})`
  );

  const check = await exams
    .collection('questions')
    .countDocuments({ isActive: true, type: 'multiple_choice', level: LEVEL, competency: COMPETENCY });
  if (check < QUESTION_COUNT) {
    throw new Error(`seed verification failed: expected >= ${QUESTION_COUNT} active multiple_choice questions, found ${check}`);
  }
  console.log(`Verified: ${check} active multiple_choice questions at level=${LEVEL} competency=${COMPETENCY}`);
}

main()
  .then(async () => {
    await mongoose.disconnect();
    console.log('CI e2e fixture seed complete.');
  })
  .catch(async (e) => {
    console.error('SEED ERROR:', e.message);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
