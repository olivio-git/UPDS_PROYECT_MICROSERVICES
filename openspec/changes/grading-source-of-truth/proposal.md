# Proposal: Grading Source of Truth

## Intent

The same result can pass at 60% (frontend, email) and fail at 70% (PDF, LLM text), and the teacher's `structure.passingScore` is ignored. Section weights, rubrics and level thresholds are authored but never used. This change makes grading-service the one place that decides the score and pass/fail. Every consumer reads the stored result.

## Scope

### In Scope
- grading-service computes and stores `passed` and `passingScore`. The 5 consumers read the stored values. Old results fall back to one compute-on-read helper per service.
- Section weights shape the final score when `attempt.sectionsStructure` exists. Weights are validated to sum to 100 on write and normalized by their actual sum at grading time.
- Rubric-driven AI grading (Option A). The AI scores each criterion from 0 to 100, and code applies the weights. Per-criterion scores are stored on the question result.
- `showResults === false`: the student endpoint returns "under review" and the email leaves out the score.
- A non-blocking mastery indicator per competency, based on the Level's minimum scores.

### Out of Scope
- attempts removal, allowReview, randomizeOptions, requireProctor, recordSession/timeSlots, file_upload, questionPool UI, question statistics, dead-code cleanup
- `exam-service/src/integrations/notification.integration.ts` `sendExamResultsEmail`: do NOT touch
- Migration scripts. Adaptive/placement and flat-pool exams keep the raw sum on purpose.

## Capabilities

### New Capabilities
- `grading-pass-fail`: stored `passed`/`passingScore`, the fallback helper and consumer rules
- `grading-section-weights`: weighted final score, sum-to-100 validation and normalization
- `rubric-ai-grading`: prompts built from criteria, deterministic weighting, stored per-criterion scores
- `result-visibility`: `showResults` on the student endpoint and in the email
- `level-mastery-indicator`: per-competency achieved / not achieved (does not change `passed`)

### Modified Capabilities
None (`openspec/specs/` is empty).

## Approach

Grading-service owns the result. grade-exam.ts reads the exam's `passingScore`, the section weights and the question rubrics, then writes the new fields. Consumers only read.

**Event contract change:** `@cba/events` `GradingResultPublishedDataSchemaV1` (`grading.result.published` on `TOPICS.GRADING_EVENTS`) gains optional `passed` and `showResults`. The change is additive, so it stays V1.

**Lockstep checklist (every PR):** keep `IExamResult` in `mcp-grading-server/src/types/index.ts` and in `exam-service/src/models/examResult.model.ts` identical.

## PR Slicing (about 900-1400 lines)

| PR | Content | Est. lines |
|----|---------|------------|
| 1a | Compute and store `passed`/`passingScore` + section weights in grade-exam.ts; both types; weight validation (ExamForm + backend) | ~300 |
| 1b | The 5 consumers + fallback helpers; event fields (`passed`) | ~250 |
| 2 | Rubric grading: groq-evaluator prompt, weighting, `rubricScores`; RubricForm and backend sum validation | ~350 |
| 3 | showResults: student endpoint joins the exam and strips results; `showResults` in the event; email | ~200 |
| 4 | Level mastery indicator | ~200 |

## Affected Areas

| Area | Impact |
|------|--------|
| `mcp-grading-server/src/tools/grade-exam.ts`, `grading/groq-evaluator.ts`, `types/index.ts` | Modified |
| `exam-service/src/models/{examResult,rubric,exam}.model.ts`, `services/exam-result-pdf.service.ts`, `controllers/examResult.controller.ts`, `services/examEvaluation.service.ts` | Modified |
| `notifications-service/src/services/{notification,email}.service.ts` | Modified |
| `shared/events/src/events/grading.ts` | Modified (additive) |
| `frontend/src/services/examResultService.ts`, `ExamForm.tsx`, `RubricForm` | Modified |
| `scripts/e2e/grading-pipeline.e2e.js`, `ai-grading.e2e.js` | Extended |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The two `IExamResult` copies drift apart | Med | Checklist in every PR; e2e checks the new fields |
| One of the 5 thresholds is missed | Med | Grep for `>= 60` / `>= 70` / `passingScore: 70` in verify |
| AI returns bad per-criterion numbers | Med | Clamp to 0-100; fall back to the default criteria if parsing fails |
| An old consumer gets an event without the new fields | Low | Fields are optional; fall back to the helper |

## Rollback Plan

Each PR can be reverted on its own with `git revert`. New fields are optional and additive, so older readers ignore them. The fallback helper covers documents written without them. No data migration needs undoing. Revert order is the reverse of merge order (4→1a).

## Dependencies

- A GROQ API key is needed for the ai-grading e2e run
- `@cba/events` must be rebuilt for mcp-grading-server and notifications-service

## Success Criteria

- [ ] grading-pipeline e2e: an exam with `passingScore` 80 and 70% → stored `passed: false`, the email says "not passed", the frontend and PDF agree
- [ ] e2e: two sections weighted 70/30 → percentage equals the weighted value, not the raw sum
- [ ] ai-grading e2e: a rubric question stores one score per rubric criterion, and the question score matches the weighted formula
- [ ] Saving an exam or rubric whose weights do not sum to 100 is rejected (400)
- [ ] `showResults: false` → the student endpoint has no score/passed/breakdown, while the admin endpoint is still complete
- [ ] The mastery indicator is present, and `passed` does not change
- [ ] No hardcoded pass threshold is left in the 5 consumers
