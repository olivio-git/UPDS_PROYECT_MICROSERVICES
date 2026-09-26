## Exploration: grading-source-of-truth

> Mirror of engram `sdd/grading-source-of-truth/explore` (#1687), plus a live-DB verification added by the orchestrator (see "Backward compatibility").

### Current State

**exam_results shape.** Two independently maintained copies of the same shape:
- Writer: `mcp-grading-server/src/types/index.ts` `IExamResult` (plain interface, native Mongo driver, no schema enforcement).
- Reader: `exam-service/src/models/examResult.model.ts` `IExamResult` / `examResultSchema`, collection `exam_results`.

Both lack `passed` and `passingScore`. Both have `questionResults[].aiAnalysis.criteria: Record<string, number>` (free-form, not tied to rubric criteria) and no `rubricId`/`rubricScores` on the result. `sections?: Array<{name, competency, score, maxScore, percentage}>` exists on both (computed in grade-exam.ts step 9) but has no `weight`/`weightedScore`.

**Every pass/fail and score consumer:**
1. `mcp-grading-server/src/tools/grade-exam.ts:326-329`: `totalScore`/`maxScoreTotal`/`percentage` are raw point sums; no `passingScore`/`weight` read. Placement only (`:352-397`) uses `placementConfig.levelPassingThreshold` to produce `recommendedLevel`, not a boolean `passed`.
2. `grade-exam.ts:401-402`: `status` (`completed`/`pending_ai_review`) is evaluation completeness, not pass/fail.
3. `frontend/src/services/examResultService.ts:376` (list) and `:397` (detail): hardcoded `>= 60`.
4. `exam-service/src/services/exam-result-pdf.service.ts:246`: `passed: examResult.percentage >= 70`; feeds the PDF and `llmData.result.passed`.
5. `exam-result-pdf.service.ts:304`: separate hardcoded `passingScore: 70` default for `examSettings`.
6. `exam-service/src/services/llm-interpretation.service.ts:72,75,400,407`: consumes `data.result.passed` / `data.result.passingScore ?? 70` from the PDF service; perpetuates its value.
7. `notifications-service/src/services/email.service.ts:153`: `status === 'completed' && percentage >= 60` (queued-email path).
8. `notifications-service/src/services/notification.service.ts:240`: `data.status === 'completed' && data.percentage >= 60`. **This is the live production email path** (`grading-notification.consumer.ts:120` → `sendEmailIfEnabled` → this method).
9. `exam-service/src/integrations/notification.integration.ts:75` `sendExamResultsEmail`: dead code, zero callers. Out of scope, do not touch.
10. `frontend/src/modules/exams/components/ExamForm.tsx`: authors `structure.sections[].weight` from UI `points`; never consumed downstream.

Net effect: for the same result, the frontend and email say pass at 60%, the PDF and LLM interpretation at 70%, and the teacher's configured `passingScore` is ignored.

**Rubrics.** `exam-service/src/models/rubric.model.ts`: `criteria: [{name, description, weight, levels: [{score, description, examples}]}]`, `scoringType: 'holistic' | 'analytic'`, `maxScore`. `weight` is not validated to sum to 100. `rubric.service.ts:190-210 calculateScore()` is a correct weighted average but is an orphan (only `rubric.routes.ts:85`). `question.metadata.rubricId` exists on both `IQuestion` copies but `grade-exam.ts` never reads it. `groq-evaluator.ts:201-247 buildEvaluationPrompt()` hardcodes `content`, `grammar`, `vocabulary`, `coherence` (0-100). `responses.evaluation.rubricScores` (`response.model.ts:28`) is declared, never populated; grade-exam never writes to `responses`.

**Section weights.** `attempt.sectionsStructure[]` (`exam-service/src/models/attempt.model.ts:13-21`, mirrored in `IAttempt`) stores `{id, name, competency, duration, weight, questionCount, questionIds}`, so the section→question mapping is available at grading time. `grade-exam.ts:128-136` uses it when present, else flat `attempt.questionIds`. Section scores are already computed (`:332-344`); `weight` is available but never applied.
- Adaptive/placement exams do not populate `sectionsStructure` (they use `adaptiveState.levelHistory`).
- Fixed `questionPool` exams without sections use flat `questionIds`, so `sections` is `undefined`.
- No validation that `sections[].weight` sums to 100.

**Level thresholds.** `level.model.ts:39` `overallMinScore` and `competencyRequirements.*.minScore` are required fields that nothing reads outside CRUD. mcp-grading-server never queries `levels` during grading. Kept as an open question.

**Backward compatibility.** Mongoose does not backfill; existing docs will lack new fields.
Live DB check (orchestrator, 2026-09-24, `cba_platform`): `exam_results` = 1, `exams` = 1 (type `practice`, `structure.passingScore` = 60, one section with `weight` = 100), questions with `metadata.rubricId` set = 0.

**showResults enforcement.**
- Student: `exam-service/src/controllers/examResult.controller.ts:58-95` (`getResultDetails`, ownership check) → `examEvaluation.service.ts:25-27` (`getExamResult`, bare `findById`, no `Exam` join). Needs an exam join and field stripping when `configuration.showResults === false`.
- Teacher/admin: `examResult.controller.ts:204-225` (`getResultDetailsAdmin`, `requireRole('admin','teacher')`) must stay unfiltered.
- Email: `grading-notification.consumer.ts` → `NotificationService.sendExamGradedEmail` (`notification.service.ts:227-270`). notifications-service cannot look up the exam, so `showResults` (and `passed`) must travel in `GradingResultPublishedDataSchemaV1` (`shared/events/src/events/grading.ts`, Zod, shared `@cba/events`).

**Shared-schema coupling.** The two `IExamResult`/`IQuestionResult` copies are hand-synchronised ("match exam-service schemas exactly") with no compiler or CI check. Every new field must be added to both. `@cba/events` is a real shared package, so extending it is low risk.

**Testability.** mcp-grading-server and the frontend have no unit runner; exam-service has jest. Existing verification for this pipeline is container e2e: `scripts/e2e/grading-pipeline.e2e.js` (finish→grade→notify, idempotency) and `scripts/e2e/ai-grading.e2e.js` (GROQ liveness, good vs empty answer). Recommendation: extend both rather than add a runner.

### Affected Areas
- `mcp-grading-server/src/tools/grade-exam.ts`: totals, sections, pass/fail, rubric fetch/application.
- `mcp-grading-server/src/grading/groq-evaluator.ts`: rubric-driven criteria in the prompt.
- `mcp-grading-server/src/types/index.ts` and `exam-service/src/models/examResult.model.ts`: new fields, edited in lockstep.
- `exam-service/src/models/rubric.model.ts`, `rubric.service.ts` (orphan `calculateScore`), `rubric.routes.ts`.
- `exam-service/src/models/response.model.ts`: `evaluation.rubricScores` never populated; decide keep or drop.
- `frontend/src/services/examResultService.ts:376,397`.
- `exam-service/src/services/exam-result-pdf.service.ts:246,304`; `llm-interpretation.service.ts` (callers only).
- `notifications-service/src/services/email.service.ts:153`, `notification.service.ts:240`, `grading-notification.consumer.ts`.
- `shared/events/src/events/grading.ts`.
- `exam-service/src/controllers/examResult.controller.ts:58-95`, `examEvaluation.service.ts:25-27`.
- `scripts/e2e/grading-pipeline.e2e.js`, `scripts/e2e/ai-grading.e2e.js`.

### Approaches

**Rubric + AI**
1. **Option A: code applies weights.** The AI scores each rubric criterion 0-100; code computes `Σ(criterionScore/100 × weight/Σweights) × maxScore`.
   - Pros: deterministic, auditable, matches orphan `calculateScore()`, per-criterion breakdown for student and teacher, testable.
   - Cons: variable-length criteria in the prompt; clamping is the only guard against bad AI numbers.
   - Effort: medium.
2. **Option B: weights in the prompt, AI returns the total.**
   - Pros: less code.
   - Cons: opaque, untestable, no breakdown.
   - Effort: low.

Recommendation: **A**. Questions without `rubricId` keep the current 4 default criteria.

**Backward compatibility**
1. **Migration script.** Backfill `passed`/`passingScore` by joining `exams`.
   - Pros: every document is consistent immediately.
   - Cons: introduces a migration mechanism this repo does not have.
2. **Compute-on-read fallback.** `result.passed ?? percentage >= (exam.structure.passingScore ?? default)`, centralized in one helper per service.
   - Pros: no migration step, self-heals.
   - Cons: must be centralized carefully to stay a single source of truth.

Recommendation: **fallback**, because live volume is 1 document.

### Recommendation
Slice into reviewable PRs (estimated 900-1400 changed lines total):
1. **Pass/fail source of truth + section weights.** Compute and store in grade-exam, then update all 5 consumers. May need a further split (compute/store vs consume).
2. **Rubric-driven AI grading** (Option A).
3. **showResults enforcement** (student endpoint + email via `@cba/events`).
4. **Level thresholds.** Only if the user brings them into scope.

### Risks
- Hand-copied `IExamResult` drift between grading-service and exam-service.
- Five duplicated pass/fail thresholds; missing one leaves a user-visible contradiction.
- Dead `sendExamResultsEmail` could be edited by mistake.
- Section weighting only applies when `sectionsStructure` exists; adaptive/placement and flat-pool exams stay raw-sum and must be documented as intentional.
- No sum-to-100 validation for section or rubric weights.

### Open questions for the user
1. Should `Level.overallMinScore` / `competencyRequirements.*.minScore` join pass/fail or certification logic? Options:
   - (a) stay dormant
   - (b) separate non-blocking "competency mastery" indicator
   - (c) extra AND condition on `passed`
2. Weight sums: validate on write (forms + backend schemas reject) or normalize on read (divide by the actual sum)?

### Ready for Proposal
Yes, after the open questions are answered.
