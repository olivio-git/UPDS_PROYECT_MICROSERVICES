# Rubric-Driven AI Grading Specification

## Purpose

Ground AI essay/open-text/speaking grading in the teacher-authored rubric criteria instead of a hardcoded 4-criteria prompt, while keeping the scoring formula deterministic and auditable (code applies the weights, not the AI).

## Requirements

### Requirement: Per-Criterion AI Scoring

For a question with a resolvable `rubricId`, the system MUST prompt the AI to score each rubric criterion independently on a 0-100 scale, and MUST compute the question's final score by applying the rubric's configured criterion weights in code (not by asking the AI for a single total).

#### Scenario: Rubric question graded

- GIVEN a question whose `metadata.rubricId` resolves to a rubric with criteria "content" (weight 40) and "grammar" (weight 60)
- WHEN the AI grades the answer and returns content=80, grammar=60
- THEN the stored question result includes both per-criterion scores
- AND the computed question score equals `(80*40 + 60*60) / 100` scaled to the question's max score

### Requirement: Default Criteria Without a Rubric

Questions without a resolvable `rubricId` MUST be graded using the existing 4 default criteria (content, grammar, vocabulary, coherence), unchanged from current behavior.

#### Scenario: Question has no rubric assigned

- GIVEN a question with no `metadata.rubricId`
- WHEN it is AI-graded
- THEN the 4 default criteria are used, as before this change

#### Scenario: Rubric assigned but later deleted

- GIVEN a question whose `metadata.rubricId` no longer resolves to an existing rubric document
- WHEN it is AI-graded
- THEN the system falls back to the 4 default criteria
- AND grading completes without failing the pipeline

### Requirement: Invalid AI Score Handling

The system MUST clamp any AI-returned criterion score to the 0-100 range before applying weights, and MUST fall back to the default criteria set if the AI response cannot be parsed into per-criterion scores at all.

#### Scenario: AI returns an out-of-range score

- GIVEN the AI returns a criterion score of 150 (or -10)
- WHEN the question score is computed
- THEN the score is clamped to 100 (or 0) before the weighted formula is applied

#### Scenario: AI omits some rubric criteria

- GIVEN a rubric with criteria A (40), B (30), C (30)
- AND the AI returns valid scores only for A and B
- WHEN the question score is computed
- THEN the weights of the returned criteria are renormalized over their sum (A 40/70, B 30/70)
- AND the stored rubric breakdown is marked as partial
- AND if no criterion is valid, the default-criteria fallback applies

#### Scenario: AI response is unparseable

- GIVEN the AI response cannot be parsed into the expected criteria structure
- WHEN grading attempts to extract per-criterion scores
- THEN the system falls back to grading with the 4 default criteria
- AND does not fail the grading pipeline

### Requirement: Rubric Weight Sum Validation and Normalization

Rubric criterion weights MUST be validated to sum to 100 on write (rejecting the save otherwise), and MUST be normalized by their actual sum at grading time as a safety net for rubrics saved before validation existed.

#### Scenario: Rubric weights do not sum to 100 on save

- GIVEN a teacher submits a rubric with criteria weighted 50 and 40
- WHEN the rubric is saved
- THEN the save is rejected with a 400-level validation error

#### Scenario: Legacy rubric weights normalized at grading time

- GIVEN a rubric document saved before validation existed, with weights summing to 90
- WHEN a question using that rubric is graded
- THEN the weights are normalized by their actual sum before computing the question score
