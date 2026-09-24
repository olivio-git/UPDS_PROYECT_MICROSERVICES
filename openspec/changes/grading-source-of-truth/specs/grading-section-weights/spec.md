# Grading Section Weights Specification

## Purpose

Make the teacher-authored section weights actually shape the final score for exams that use sections, while leaving exams without a section structure (adaptive, placement, flat question pools) on their existing raw-sum behavior.

## Requirements

### Requirement: Weighted Final Score

When an attempt has a populated `sectionsStructure`, the system MUST compute the final percentage as the weighted combination of each section's score using that section's configured `weight`, instead of a flat raw sum across all questions.

#### Scenario: Two weighted sections

- GIVEN an exam with two sections weighted 70 and 30
- WHEN a candidate scores 100% on the 70-weight section and 0% on the 30-weight section
- THEN the stored final percentage is 70, not the unweighted average

### Requirement: Weight Sum Validation on Write

The system MUST reject saving an exam whose `sections[].weight` values do not sum to 100.

#### Scenario: Weights do not sum to 100

- GIVEN a teacher submits an exam with sections weighted 50 and 40
- WHEN the exam is saved
- THEN the save is rejected with a 400-level validation error
- AND no exam document is persisted with invalid weights

### Requirement: Normalization Safety Net at Grading Time

The system MUST normalize section weights by their actual sum at grading time, independent of write-time validation, so that any exam document whose weights do not sum to exactly 100 still produces a mathematically valid weighted score.

#### Scenario: Legacy exam with weights not summing to 100

- GIVEN an exam document saved before weight validation existed, with weights summing to 90
- WHEN a candidate's result is graded
- THEN each section's weight is normalized by the actual sum (90) before combining
- AND the resulting percentage stays within 0-100

### Requirement: Unweighted Exams Keep Raw Sum

Exams without a populated `sectionsStructure` (adaptive/placement exams using `adaptiveState.levelHistory`, and fixed exams using a flat `questionPool` without sections) MUST continue to compute the final percentage as the raw sum of points, unaffected by this change.

#### Scenario: Adaptive/placement exam

- GIVEN an adaptive exam that has no `sectionsStructure`
- WHEN the attempt is graded
- THEN the final percentage is the raw sum across all answered questions
- AND no section weighting is applied

#### Scenario: Flat question-pool exam

- GIVEN a fixed exam using `questionPool` with no sections defined
- WHEN the attempt is graded
- THEN the final percentage is the raw sum across all questions, same as before this change
