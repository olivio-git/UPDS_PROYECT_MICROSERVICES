# Grading Pass/Fail Specification

## Purpose

Make grading-service the single source of truth for whether an exam result passed. Every consumer (frontend, PDF, LLM interpretation, email, notifications) reads the stored decision instead of re-deriving it with its own hardcoded threshold.

## Requirements

### Requirement: Stored Pass/Fail Decision

The system MUST compute `passed` (boolean) and `passingScore` (the threshold used) at grading time and store both on the exam result document.

The stored `passingScore` MUST come from the exam's own configured threshold when one exists.

#### Scenario: Result below the configured threshold

- GIVEN an exam with `structure.passingScore` = 80
- WHEN a candidate finishes with a raw/weighted score of 70%
- THEN the stored result has `passed: false` and `passingScore: 80`
- AND every consumer (frontend, PDF, LLM interpretation, email) reports "not passed" for this result

#### Scenario: Result at or above the configured threshold

- GIVEN an exam with `structure.passingScore` = 60
- WHEN a candidate finishes with a score of 60% or higher
- THEN the stored result has `passed: true`

### Requirement: Compute-on-Read Fallback for Legacy Results

The system MUST provide exactly one fallback helper per consuming service that computes `passed` on read when a result document predates this change (missing `passed`).

The fallback MUST use the exam's configured `structure.passingScore` when resolvable, and MUST use one documented default threshold, shared by all consumers, when the exam's threshold is not resolvable.

#### Scenario: Legacy result read after the change ships

- GIVEN an exam result written before `passed` existed on the schema
- WHEN any consumer reads that result
- THEN the consumer computes `passed` via the shared fallback helper instead of a service-local hardcoded threshold
- AND the computed value is not persisted back onto the legacy document

#### Scenario: Legacy result whose exam no longer resolves

- GIVEN a legacy result whose parent exam document cannot be found
- WHEN the fallback helper computes `passed`
- THEN it uses the single documented default threshold
- AND does not throw or block the read

### Requirement: No Consumer-Local Thresholds

Consumers (frontend, PDF service, LLM interpretation, notifications email, in-app notification) MUST NOT contain their own hardcoded pass/fail percentage. They MUST read the stored `passed` field, falling back only through the shared helper from the previous requirement.

#### Scenario: Consumers agree on the same result

- GIVEN one exam result with a stored `passed` value
- WHEN the frontend, the PDF, the LLM interpretation and the email are each generated for that result
- THEN all of them display the same pass/fail outcome
