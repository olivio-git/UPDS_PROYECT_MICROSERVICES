# Tasks: Grading Source of Truth

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1595 total (1a 395, 1b 245, 2a 340, 2b 70, 3 345, 4 200) |
| 400-line budget risk | Medium (1a at 395 is borderline; estimates are rough — actual diff may cross 400) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1a → PR 1a-bis → PR 1b → PR 2a → PR 2b → PR 3 → PR 4 (PR 2 split from the proposal's single PR 2 to stay under budget; 1a-bis split out of 1a to keep the write-time validation and its ExamForm fix under the 400-line budget) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (resolved during apply) |

Decision needed before apply: No (resolved: stacked-to-main)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium (PR 1a landed at 404 lines; PR 1a-bis ~247 lines; PR 1b ~370 lines — all comfortably under budget except 1a's borderline landing)

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Compute/store `passed`, `passingScore`, weighted section score | PR 1a | Base: main (or tracker if feature-branch-chain). ~395 lines, borderline — watch diff size |
| 2 | 5 consumers read stored fields via fallback helpers; event gains `passed` | PR 1b | Depends on PR 1a's stored fields and lockstep types |
| 3 | Rubric-driven AI grading engine (prompt, parsing, formula, grade-exam wiring, e2e) | PR 2a | Depends on PR 1a (scoring.ts, types); independent of 1b |
| 4 | Rubric weight write-time validation + RubricForm error surfacing | PR 2b | Depends on PR 2a's rubric types only; small, could land in parallel with 2a review |
| 5 | `showResults` visibility across student endpoint, event, email | PR 3 | Depends on PR 1b (event schema, resolvePassFail) |
| 6 | Level mastery indicator (informational, non-blocking) | PR 4 | Depends on PR 1a (passed) and PR 3 (resultVisibility) |

Merge order: 1a → 1a-bis → 1b → 2a → 2b → 3 → 4. Revert order is the reverse. Each PR's fields are additive/optional, so partially-merged states stay backward compatible.

---

## PR 1a — Stored pass/fail + weighted section score (foundation)

**Start**: main / tracker branch. **Finish**: grading-service stores `passed`/`passingScore`/weighted `percentage`; exam save rejects bad weights. **Rollback**: `git revert`; fields optional, no migration.

- [x] 1a.1 Create `mcp-grading-server/src/grading/scoring.ts`: `computeWeightedPercentage(sections)` (Σp·w/Σw over sections with maxScore>0 && w>0; fallback raw if Σw=0), `decidePassed(pct, passingScore, status)`, `DEFAULT_PASSING_SCORE = 70`. *(grading-pass-fail: Stored Pass/Fail Decision; grading-section-weights: Weighted Final Score, Normalization Safety Net)*
- [x] 1a.2 Add `passed?`, `passingScore?`, `scoringMethod?: 'weighted_sections'|'raw_points'`, `sections[].weight/weightedPercentage?` to `mcp-grading-server/src/types/index.ts` (IExamResult).
- [x] 1a.3 Mirror the same fields in `exam-service/src/models/examResult.model.ts` — **lockstep checklist item**.
- [x] 1a.4 Wire `mcp-grading-server/src/tools/grade-exam.ts`: pick `scoringMethod` (`sectionsStructure.length>0 && type!=='placement'` → weighted; else raw), compute percentage, call `decidePassed`, persist `passed`/`passingScore`/`scoringMethod`/`sections`. *(grading-pass-fail scenarios 1–2; grading-section-weights all 4 scenarios)*
- [x] 1a.5 Update `mcp-grading-server/src/schemas/grading.schemas.ts` to accept the new result fields.
- [x] 1a.6 Add Zod `superRefine` to `exam-service/src/schemas/exam.schema.ts` (create + update, when `sections.length>0`): reject when `abs(Σweight-100) >= 0.01`. *(grading-section-weights: Weight Sum Validation on Write)* **PR 1a-bis** — landed together with 1a.7/1a.8. Live-verified against the running stack: `POST /api/v1/exams` with sections 60/40 → 201, sections 60/30 → 400.
- [x] 1a.7 Create `exam-service/tests/examSchema.weights.test.ts`: sum=100 passes, sum=90 → 400, decimals tolerated. Verify: `npm --prefix exam-service test`. **PR 1a-bis** — DONE, 5/5 tests pass (20/20 exam-service suite).
- [x] 1a.8 **PR 1a-bis**, shipped together with 1a.6/1a.7: Update `frontend/src/modules/exams/components/ExamForm.tsx`: section input becomes percentage weight with a running total and "distribute evenly" helper; fix line 343 (now `weight: section.weight`) to save `weight`, not `section.points`. DONE — see PR 1a-bis notes below.
- [x] 1a.9 Extend `scripts/e2e/grading-pipeline.e2e.js`: exam `passingScore=80`, two sections 70/30, attempt scoring 70% → assert `passed:false`, `passingScore:80`, `percentage` equals weighted formula. Verify: docker e2e run. DONE — ran against the live docker stack (rebuilt exam-service + grading-service), 14/14 checks passed including the 4 new weighted-scoring assertions.

**Commits**: `feat(grading): add scoring.ts (weighted %, decidePassed, default passing score)` → `feat(grading): store passed/passingScore/scoringMethod on exam result` → `feat(exam-service): mirror result fields on examResult.model` → `feat(exam-service): validate section weights sum to 100` → `feat(frontend): ExamForm percentage weight + running total` → `test(e2e): weighted pass/fail assertions`.

## PR 1a-bis — Section weight write-time validation + ExamForm UI fix

**Start**: after 1a merged (or stacked on top of 1a's branch). **Finish**: `exam-service` rejects sectioned exams whose weights don't sum to 100 on create/update; `ExamForm.tsx` collects a real percentage weight per section (was silently sending `weight: section.points ?? 1`, a hidden field defaulting to 10 — every existing UI-created sectioned exam has legacy 10/10-style weights that don't sum to 100). **Rollback**: `git revert`; validation-only + UI fix, no data migration (legacy bad-weight exams are left as-is and only get flagged when a teacher re-saves them).

- [x] 1a.6 (see above)
- [x] 1a.7 (see above)
- [x] 1a.8 `frontend/src/modules/exams/components/ExamForm.tsx`:
  - Renamed the local per-section Zod field `points` → `weight` (`0..100`); removed the unused `structure.totalPoints` field (Zod schema, `Exam` type, `ExamSection` type, default values, and the totals-calculation effect) — confirmed via grep it was dead weight: the backend `IExam`/`examSchema` never had a `totalPoints` field (Mongoose strips it silently), and no screen ever reads `exam.structure.totalPoints`. `totalQuestions`/`totalDuration` (which ARE read, in the summary panel) are untouched.
  - Added a "Peso (%)" number input per section, a live running total ("Peso total: X%", green when valid / orange when not) and an inline red error next to "Secciones del Examen", mirroring the existing `RubricForm.tsx` weight-sum UX (`distributeWeightsEvenly`/"Peso (%)"/orange-green total convention) rather than inventing a new pattern.
  - Added a "Distribuir equitativamente" button (same `BarChart3` icon as RubricForm) that redistributes 100% evenly across all current sections, remainder to the first ones so the sum is always exactly 100.
  - `addSection` now redistributes weights evenly across all sections (old + new) instead of leaving the new one at a fixed points-like default; `removeSection` redistributes evenly across the remaining sections. A brand-new exam's first section defaults to `weight: 100`.
  - Editing an existing exam loads `structure.sections[].weight` as-is (no silent normalization) — if legacy weights don't sum to 100, the running total shows the real sum in orange and the teacher must either fix values manually or click "Distribuir equitativamente" before the form will submit.
  - `onSubmit` now blocks (toast, Spanish) when the section weight sum is off by ≥0.01 from 100 — same tolerance as the backend's `superRefine` — so the UI fails fast instead of round-tripping a 400 from the server.
  - Payload fix: `weight: section.points ?? 1` → `weight: section.weight`.
  - Adaptive placement mode clears `structure.sections` to `[]` (existing effect, untouched) — the weight-sum check is skipped whenever `sections.length === 0`, so adaptive/placement exams are unaffected.
  - Verify: `npx tsc -b` (clean) + `npm run build` (clean, only pre-existing unrelated chunk-size warning) + `npx eslint` (0 new issues — diffed against pre-change lint output, identical 19 pre-existing warnings/errors in this file, none touch the new code).
  - Live-verified against the running docker stack (exam-service rebuilt): `POST /api/v1/exams` via the real teacher-auth + validation pipeline, sections `[60,40]` → 201, sections `[60,30]` → 400 "Validation error". Throwaway exam cleaned up after the check.

**Commits**: `feat(exam-service): validate section weights sum to 100` → `test(exam-service): section weight sum validation` → `feat(frontend): ExamForm percentage weight input, running total and distribute-evenly helper`.

## PR 1b — Consumers read stored values + fallback helpers

**Start**: after 1a merged. **Finish**: all 5 consumers read `passed` via one shared helper each; event carries `passed`. **Rollback**: `git revert`; event field optional.

- [x] 1b.1 Add `passed?: z.boolean()`, `passingScore?: z.number()` to `shared/events/src/events/grading.ts` (`GradingResultPublishedDataSchemaV1`, stays V1). Rebuild: `npm --prefix shared/events run pack:local`.
- [x] 1b.2 `npm install` the rebuilt tarball in `mcp-grading-server`, `notifications-service`, `exam-service`. **Note**: a plain `npm install` silently no-ops on a `file:` tarball dep when the lockfile's pinned integrity already "matches" its own stale record — had to run `npm install @cba/events@file:../shared/events/cba-events.tgz` explicitly in each service to force the refresh (verified via `grep passingScore node_modules/@cba/events/dist/events/grading.js`). The resulting local package-lock.json integrity changes were reverted before finishing (not committed) — the `ci/github-actions` branch's `scripts/ci/install-with-local-events.sh` and the three Dockerfiles already handle the non-reproducible-tarball/stale-hash problem by stripping that one entry's integrity before install, so no lockfile churn is needed here.
- [x] 1b.3 Update `mcp-grading-server` grade-exam call sites / `services/notification.service.ts` to publish `passed`/`passingScore` on `grading.result.published`.
- [x] 1b.4 Create `exam-service/src/utils/passFail.ts`: `resolvePassFail(result, exam?)` → stored wins; legacy → `status!=='completed'` gives null, else `pct >= exam?.structure?.passingScore ?? 70`. *(grading-pass-fail: Compute-on-Read Fallback, both scenarios)*
- [x] 1b.5 Create `exam-service/tests/passFail.test.ts`. Verify: `npm --prefix exam-service test` — 6 suites, 39/39 pass (5 new).
- [x] 1b.6 Update `exam-service/src/controllers/examResult.controller.ts` (`my-recent`, `attempt/:id`): batched `Exam.find({_id:{$in}})`, expose `passed`/`passingScore` via the resolver. Also added a shared `attachPassFail()` helper applied to `getResultDetails`, `getDetailedResultWithQuestions` and `getResultDetailsAdmin` (all three return the raw stored document and needed the same legacy fallback filled in before leaving exam-service, per design's "frontend has no threshold" contract).
- [x] 1b.7 Update `exam-service/src/services/exam-result-pdf.service.ts`: `result.passed`, `examSettings.passingScore`, real `examType` via resolver (llm-interpretation inherits). Widened `ExamResultPDFData.result.examType` to include `'mock'` (exam.model's real union) since it's now sourced from the actual `Exam` document instead of a hardcoded `'practice'`.
- [x] 1b.8 Create `notifications-service/src/utils/passFail.ts`: `resolvePassedFromEvent(d)` → `d.passed` → null if not completed → `pct>=70`.
- [x] 1b.9 Update `notifications-service/src/services/{notification,email}.service.ts` and `grading-notification.consumer.ts` to use the resolver. All channels render ONE verdict from the pure `describeGradingVerdict()` (`utils/passFail.ts`, which wraps `resolvePassedFromEvent`): email subject (`buildExamGradedSubject`), HTML body (verdict label now actually rendered in the result box) and text body, and the in-app notification body (`Resultado: …`) with `passed`/`passingScore`/`examType`/`recommendedLevel` in its metadata. Three states (¡Aprobado! / No Aprobado / En Revisión — pending is never "failed") plus placement ("Nivel recomendado: X", no verdict). Retries of stored `exam_graded` emails re-resolve via the same helper, so emails queued before `passed` existed still get the right verdict. The "same format" display decision (weighted % + raw points, e.g. "78% (42/60 puntos)") applies to both email templates. The grading-service HTTP in-app *fallback* (used only when the Kafka publish fails) still has the old verdict-free body.
- [x] 1b.10 Update `frontend/src/services/examResultService.ts`: private `resolvePassed(r)` → `r.passed ?? null`, no threshold. Update `StudentResults.tsx` for neutral badge on null (`getPassBadge()`: Aprobado/No aprobado/Pendiente, used in both the hero badge and the results-list row icon). Also surfaced raw points (`totalScore`/`maxScore`) end-to-end from the controller through `ExamResultSummary`/`StudentExamResult` into the results-list row, matching the format already used in the detail hero.
- [x] 1b.11 Grep-verify: no `>= 60` / `>= 70` / `passingScore: 70` literal remains in the 5 consumers (the 3 documented default-70 constants in scoring.ts and the two passFail.ts helpers are the only allowed occurrences). *(Success criteria: no hardcoded threshold left)* **Residual, out of this PR's explicit scope**: `frontend/examResultService.ts` (`generateFeedback`/`generateRecommendations` narrative copy, `getScoreColor`) and `exam-result-pdf.service.ts` (`getPerformanceLevel`-style 85/70/60 tier labels) still contain score-band literals — these are UI *quality-tier*/copy heuristics (e.g. "Excelente/Bueno/Aceptable", feedback tone), not the `passed` verdict itself, and were not in the prompt's "known hardcoded spots" list. Flagged as a follow-up, not fixed in this PR to stay in scope/budget.
- [x] 1b.12 Judgment-day fixes. **Placement exams (user decision)**: no pass/fail verdict anywhere. grading-service `computeExamScoring` leaves `passed` AND `passingScore` undefined for `exam.type === 'placement'` (shared by the full grading path and `/regrade-session`), and `passingScore` joined `UNSETTABLE_GRADED_FIELDS` so a regrade clears stale values. `grading.result.published` gained optional `examType` + `recommendedLevel` (explicit, not inferred). exam-service `resolvePassFail` returns `{ passed: null, passingScore: null }` for placement. Frontend, email, in-app, PDF and LLM show "Nivel recomendado: X" instead. **LLM** (C1): prompt/fallback builders moved to the pure `llm-exam-result.prompt.ts`, 3-state + placement, covered by `tests/llmExamResultPrompt.test.ts`. **Reports** (W2): level `passRate` uses stored `passed`, with a `$lookup` legacy fallback that mirrors `resolvePassFail`; the denominator excludes non-completed and placement results. **Student history** (W1): `getStudentHistory` exposes the resolved `passed` (cache key bumped to `student_history:v2:`), and `ExamHistoryTable` filters on it with a new "Pendiente" chip. `PASS_THRESHOLD` was removed (the score bands are colour-only). The `passFail.ts` threshold guard in exam-service and notifications-service now mirrors grading-service (`typeof === 'number' && Number.isFinite`). Removed dead `frontend/src/services/pdfService.ts` (zero importers).

**Commits**: `feat(events): add optional passed/passingScore to grading.result.published` → `feat(exam-service): resolvePassFail fallback + tests` → `feat(exam-service): read passed/passingScore in controller and PDF service` → `feat(notifications): resolvePassedFromEvent fallback` → `feat(frontend): read stored passed, drop hardcoded threshold` → `chore: grep-verify no hardcoded thresholds remain`.

**Landed**: 11/11 tasks complete. `git diff --stat` on tracked files: 10 files, 191 insertions(+), 65 deletions(-) = 256 changed lines; plus 3 untracked files (`exam-service/src/utils/passFail.ts` 45, `exam-service/tests/passFail.test.ts` 42, `notifications-service/src/utils/passFail.ts` 27 = 114 lines) = **370 changed lines total**, under the 400-line budget (estimate was ~245; grew mainly from `attachPassFail` covering 3 controller endpoints instead of 2, and the frontend raw-points display decision). Verified: `exam-service` tsc clean + jest 6/6 suites 39/39 tests (5 new); `mcp-grading-server`/`notifications-service` tsc clean; `frontend` tsc -b clean + `npm run build` clean (pre-existing chunk-size warning only) + eslint diffed against pre-change baseline (23 problems both before and after, 0 new). Live: rebuilt `grading-service` and `notifications-service` Docker images (both healthy, confirmed via `docker exec` grep that the compiled `dist/` has the new code) and re-ran `scripts/e2e/grading-pipeline.e2e.js` against the live stack — **30/30 checks passed**, including the in-app-notification-created assertion, proving the new optional event fields don't break consumption. `exam-service`'s own image could not be rebuilt in this sandbox (puppeteer's Chrome download stalled indefinitely — unrelated to this change; the currently-running `exam-service` container is the pre-existing image and was not part of the live check). Package-lock.json changes for the three consumers were reverted before finishing (see 1b.2 note) — no lockfile diff.

## PR 2a — Rubric-driven AI grading engine

**Start**: after 1a merged (needs scoring.ts/types); independent of 1b. **Finish**: essay/open_text questions with a resolvable rubric are scored per-criterion by code, not the AI's total. **Rollback**: `git revert`; questions without `rubricId` unaffected (default-4-criteria path unchanged).

- [x] 2a.1 Add `IRubricEvaluation { rubricId, rubricName, partial?, criteria }`, `IRubricCriterionScore { name, weight, score, feedback? }` to `mcp-grading-server/src/types/index.ts`; mirror on `exam-service/src/models/examResult.model.ts` — **lockstep checklist item**.
- [x] 2a.2 Add `getRubrics()` accessor to `mcp-grading-server/src/db/collections.ts`.
- [x] 2a.3 Implement `evaluateWithRubric(question, answer, points, rubric)` in `groq-evaluator.ts`: prompt lists `n. <name> (peso w%): <description>` + level descriptors; parse `{criteria:[{name,score,feedback}],feedback,suggestions}`; fill `aiAnalysis.criteria` map. *(rubric-ai-grading: Per-Criterion AI Scoring)*
- [x] 2a.4 Add clamp/match/renormalize logic to `scoring.ts`: clamp 0-100, match by exact name then position, drop non-numeric, renormalize over ≥1 valid criteria and mark `partial=true`, fall back to the 4-default-criteria path when 0 valid or unparseable. *(rubric-ai-grading: Invalid AI Score Handling, all 4 scenarios; Default Criteria Without a Rubric)*
- [x] 2a.5 Add rubric-weight normalization at grading time (normalize by actual Σweight, not assumed 100) to the same scoring path. *(rubric-ai-grading: Legacy rubric weights normalized at grading time)*
- [x] 2a.6 Add `computeRubricQuestionScore`: `round2(Σ(c_i·w_i)/Σw_scored/100 · points)`, AI's own total ignored.
- [x] 2a.7 Wire `grade-exam.ts`: collect distinct `metadata.rubricId` across essay/open_text questions in one `getRubrics().find({_id:{$in}})` (ignore `isActive`); evaluate via rubric or fall back to default criteria when absent/not-found; store `IRubricEvaluation`. *(Default Criteria: "rubric assigned but later deleted" scenario)*
- [x] 2a.8 Extend `scripts/e2e/ai-grading.e2e.js`: seed a rubric (3 criteria 50/30/20), assign to a throwaway essay, assert 3 stored criteria matching names/weights and the score formula. Verify: docker e2e run (GROQ key required).

**Commits**: `feat(grading): add rubric types and getRubrics accessor` → `feat(grading): evaluateWithRubric prompt and parsing` → `feat(grading): clamp/renormalize/partial + weight normalization` → `feat(grading): wire rubric grading into grade-exam with fallback` → `test(e2e): per-criterion rubric score assertions`.

**Landed**: 8/8 tasks complete. `git diff --stat` on tracked files: 6 files, ~555 insertions(+), 8 deletions(-) ≈ **563 changed lines** — over the ~340 estimate and over the 400-line review budget (production code alone, excluding the e2e test, is ~371 lines; the e2e test extension is ~192 lines). No further split point exists within this task list without breaking cohesion (the rubric engine's types/prompt/scoring/wiring form one indivisible unit; task 2a.8's e2e assertions were pre-scoped into this same PR by the tasks plan). Flagged per `ask-on-risk`: orchestrator/user should decide whether to accept this size (test code reviews faster than production logic) or split the e2e extension into a separate follow-up commit/PR reviewed independently before merge. Verified: `mcp-grading-server`/`exam-service` tsc clean; pure `scoreRubricCriteria`/`computeRubricQuestionScore` verified with a throwaway `npx tsx` script (7 cases: full match, partial/renormalize, positional match, clamping, empty/unparseable fallback, non-numeric drop, legacy weight-sum≠100 normalization — not committed). Live: rebuilt `grading-service` image (EINTEGRITY workaround on `@cba/events`, lockfile reverted after build, healthy), re-ran extended `scripts/e2e/ai-grading.e2e.js` against the live stack — **38/38 checks passed**, including the new rubric case (3 stored criteria matching rubric names/weights, stored score matches the weighted formula recomputed from stored criteria) and the deleted-rubric fallback case (falls back to default 4 criteria, no pipeline failure). Re-ran `scripts/e2e/grading-pipeline.e2e.js` unmodified — **30/30 checks passed**, no regression. `/regrade-session` confirmed by code inspection (not a new e2e) to preserve any stored `rubric` breakdown: it only recomputes `AUTO_GRADABLE_TYPES` question results and returns AI-graded `questionResults` entries unchanged.

## PR 2b — Rubric weight write-time validation

**Start**: after 2a merged (needs rubric types context, but logic is independent). **Finish**: saving a rubric whose criteria weights don't sum to 100 is rejected; UI surfaces the error. **Rollback**: `git revert`; validation-only, no data change.

- [ ] 2b.1 Add Zod `superRefine` to `exam-service/src/schemas/rubric.schema.ts` (create + update, when `criteria` present): reject when `abs(Σweight-100) >= 0.01`. *(rubric-ai-grading: Rubric Weight Sum Validation and Normalization — save scenario)*
- [ ] 2b.2 Create `exam-service/tests/rubricSchema.weights.test.ts`: sum=100 passes, sum=90 → 400. Verify: `npm --prefix exam-service test`.
- [ ] 2b.3 Update `frontend` `RubricForm.tsx` to surface the 400 validation message (form already enforces 100 client-side; wire the server error display).

**Commits**: `feat(exam-service): validate rubric weights sum to 100` → `feat(frontend): surface rubric weight validation error`.

## PR 3 — Result visibility (`showResults`)

**Start**: after 1b merged (needs event schema + resolvePassFail). **Finish**: hidden results return no score to students/email; admin view unaffected. **Rollback**: `git revert`; field optional, defaults to visible.

- [ ] 3.1 Add `showResults?: z.boolean()` to `shared/events/src/events/grading.ts` (still V1). Rebuild `pack:local`; reinstall in grading/notifications/exam-service.
- [ ] 3.2 Update `mcp-grading-server` grade-exam.ts to read `exam.configuration.showResults`, publish it on the event, and strip score from the in-app HTTP notification fallback when `false`.
- [ ] 3.3 Create `exam-service/src/utils/resultVisibility.ts`: `toStudentView(result, exam)` → when `showResults===false` return `{_id/id, examName, examLevel, evaluatedAt/date, status, examDuration, timeAllowed, totalQuestions, resultsHidden:true}`; `pending_ai_review` always renders as pending regardless of `showResults`. *(result-visibility: Student Endpoint Respects showResults; Pending AI Review Is Never Shown As Final)*
- [ ] 3.4 Create `exam-service/tests/resultVisibility.test.ts`: hidden→stripped, visible→full, pending_ai_review→pending even when visible. Verify: `npm --prefix exam-service test`.
- [ ] 3.5 Apply `toStudentView` in `examResult.controller.ts` for `my-recent`, `:id`, `:id/detailed`, `attempt/:id`; leave `/admin` and `sessions/:id/results` untouched; `my-stats` excludes hidden results; `export-pdf` returns 403 `RESULTS_HIDDEN`. *(Admin/Teacher Endpoint Always Full)*
- [ ] 3.6 Update `exam-service/src/services/examEvaluation.service.ts` to route any independently-composed student payload through `resultVisibility`.
- [ ] 3.7 Update `notifications-service` consumer/notification/email services: `showResults===false` → subject "Examen recibido", no score/verdict, no PDF fetch; default to visible when the field is absent (backward compat). *(Email Respects showResults; Event predates this change)*
- [ ] 3.8 Update `frontend/src/services/examResultService.ts` and `StudentResults.tsx` to render an "under review" card when `resultsHidden`.
- [ ] 3.9 Extend `scripts/e2e/grading-pipeline.e2e.js`: `showResults:false` → student `attempt/:id` has `resultsHidden`, no `percentage`; `/admin` still complete; in-app body has no "Puntaje". Verify: docker e2e run.

**Commits**: `feat(events): add optional showResults` → `feat(grading): publish showResults, strip score from in-app fallback` → `feat(exam-service): resultVisibility.toStudentView + apply across student endpoints` → `feat(exam-service): exclude hidden from my-stats, 403 on export-pdf` → `feat(notifications): honor showResults in templates` → `feat(frontend): under-review card` → `test(e2e): showResults hides score for student, admin stays full`.

## PR 4 — Level mastery indicator

**Start**: after 1a and 3 merged (needs `passed` + `resultVisibility`). **Finish**: per-competency mastery stored and shown, never affects `passed`. **Rollback**: `git revert`; field optional/informational.

- [ ] 4.1 Add `ICompetencyMastery { levelCode, overall: IMasteryCheck, competencies: ICompetencyMasteryItem[] }`, `IMasteryCheck { minScore, percentage, achieved }`, `ICompetencyMasteryItem extends IMasteryCheck { competency }` to both `IExamResult` copies — **lockstep checklist item**.
- [ ] 4.2 Implement `computeMastery(competencyScores, level)` in `scoring.ts`: per-competency and overall achieved/not-achieved vs `level.competencyRequirements[].minScore`/`overallMinScore`; omit for placement, unresolved/inactive `targetLevel`, or no `competencyRequirements`. *(level-mastery-indicator: Per-Competency Mastery Indicator; Graceful Absence of Level Data — all 3 scenarios)*
- [ ] 4.3 Wire `grade-exam.ts`: resolve `exam.targetLevel` → `getLevels().findOne({code, isActive:true})`; derive per-competency scores from question results (works for sectioned and flat-pool exams alike); call `computeMastery`; store `competencyMastery` without reading it back into the already-computed `passed`. *(Mastery Indicator Does Not Affect Pass/Fail — both scenarios; Flat-question-pool scenario)*
- [ ] 4.4 Update `exam-service/src/utils/resultVisibility.ts` so `competencyMastery` appears in the full view and is stripped when `resultsHidden`.
- [ ] 4.5 Update `frontend` `StudentResults.tsx` and the admin review screen to render `competencyMastery` badges when present.
- [ ] 4.6 Extend `scripts/e2e/grading-pipeline.e2e.js`: upsert a level with `competencyRequirements`; assert `competencyMastery` present with correct achieved/not-achieved; assert `passed` unchanged when mastery fails but score passes (and vice versa); assert mastery omitted for a placement exam. Verify: docker e2e run.

**Commits**: `feat(grading): add mastery types and computeMastery` → `feat(grading): resolve target level, wire competencyMastery into grade-exam` → `feat(exam-service): include/strip competencyMastery in resultVisibility` → `feat(frontend): per-competency mastery badges` → `test(e2e): mastery independent of passed`.

---

## Cross-PR Verification (run once all PRs land)

- [ ] Grep the 5 consumers for `>= 60` / `>= 70` / `passingScore: 70` outside the 3 documented default-70 constants.
- [ ] Diff `mcp-grading-server/src/types/index.ts` vs `exam-service/src/models/examResult.model.ts` field-by-field — lockstep confirmed.
- [ ] Run all 6 proposal Success Criteria checks end to end via `scripts/e2e/{grading-pipeline,ai-grading}.e2e.js`.
