# Level Mastery Indicator Specification

## Purpose

Surface the Level's `overallMinScore` / `competencyRequirements[].minScore` — currently authored but never read — as an informational, non-blocking per-competency mastery indicator on the result, without altering the pass/fail decision.

## Requirements

### Requirement: Per-Competency Mastery Indicator

When the exam's level defines `competencyRequirements`, the system MUST compute and store, per competency, whether the candidate's score for that competency met the level's configured minimum score.

#### Scenario: Competency requirements defined

- GIVEN a level with `competencyRequirements` for "grammar" (minScore 70) and "vocabulary" (minScore 60)
- WHEN a candidate scores 80 on grammar and 50 on vocabulary
- THEN the stored result has a mastery indicator showing grammar achieved and vocabulary not achieved

### Requirement: Mastery Indicator Does Not Affect Pass/Fail

The mastery indicator MUST be purely informational. It MUST NOT be used as an input to the `passed` computation defined in the `grading-pass-fail` capability.

#### Scenario: Passed despite unmet mastery

- GIVEN a candidate whose overall score meets the exam's `passingScore` but who does not meet one competency's mastery threshold
- WHEN the result is graded
- THEN `passed` is `true`
- AND the mastery indicator separately shows that competency as not achieved

#### Scenario: Failed despite full mastery

- GIVEN a candidate whose overall score is below the exam's `passingScore` but who meets every competency's mastery threshold
- WHEN the result is graded
- THEN `passed` is `false`
- AND the mastery indicator separately shows every competency as achieved

### Requirement: Graceful Absence of Level Data

Mastery is evaluated from the result's per-competency scores (`competencyScores`, derived from each question's competency), so it applies to sectioned and flat-question-pool exams alike. When the exam is a placement exam, its `targetLevel` does not resolve to an active level, or that level has no `competencyRequirements`, the system MUST omit the mastery indicator rather than error or block grading.

#### Scenario: Level missing competencyRequirements

- GIVEN a level document with no `competencyRequirements`
- WHEN a result for an exam tied to that level is graded
- THEN the mastery indicator is omitted (empty/absent) on the stored result
- AND grading completes normally

#### Scenario: Flat-question-pool exam

- GIVEN a non-placement exam built from a fixed question pool (no teacher-defined sections) whose questions span several competencies
- WHEN the result is graded
- THEN the mastery indicator is computed from the per-competency scores
- AND `passed` is computed as normal

#### Scenario: Placement exam

- GIVEN an adaptive or placement exam
- WHEN the result is graded
- THEN the mastery indicator is omitted
- AND the placement `recommendedLevel` logic is unchanged
