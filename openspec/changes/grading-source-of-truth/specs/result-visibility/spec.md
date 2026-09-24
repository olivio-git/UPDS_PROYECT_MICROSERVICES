# Result Visibility Specification

## Purpose

Honor the exam's `configuration.showResults` setting so a student cannot see their score/pass status through the student endpoint or the result email when the teacher configured results as hidden, while teachers/admins always retain full visibility.

## Requirements

### Requirement: Student Endpoint Respects showResults

When an exam's `configuration.showResults` is `false`, the student-facing result endpoint MUST NOT include score, `passed`, or the section/criterion breakdown in its response, and MUST instead indicate the result is under review.

#### Scenario: Results hidden by the teacher

- GIVEN an exam configured with `showResults: false`
- WHEN the owning student requests their result detail
- THEN the response contains no score, no `passed`, and no breakdown
- AND the response indicates the result is pending review

#### Scenario: Results visible by the teacher

- GIVEN an exam configured with `showResults: true` (or unset, defaulting to visible)
- WHEN the owning student requests their result detail and grading is complete
- THEN the response contains the full score, `passed`, and breakdown

### Requirement: Admin/Teacher Endpoint Always Full

The `showResults` setting MUST NOT affect the admin/teacher result endpoint. It MUST always return the complete result regardless of the exam's visibility configuration.

#### Scenario: Teacher views a hidden-from-student result

- GIVEN an exam configured with `showResults: false`
- WHEN a teacher or admin requests the result detail via the admin endpoint
- THEN the response contains the full score, `passed`, and breakdown

### Requirement: Email Respects showResults

The result notification email MUST NOT include the score or pass/fail status when the exam's `configuration.showResults` is `false`.

`showResults` (and `passed`) MUST travel on the `grading.result.published` event as additive optional fields so notifications-service, which cannot join the exam directly, can honor the setting.

#### Scenario: Email for a hidden result

- GIVEN an exam configured with `showResults: false`
- WHEN the grading-complete notification email is sent
- THEN the email omits the score and pass/fail status

#### Scenario: Event predates this change

- GIVEN a `grading.result.published` event without the new `showResults` field (published by an older producer)
- WHEN notifications-service consumes it
- THEN it defaults to showing results (backward-compatible default), matching current behavior

### Requirement: Pending AI Review Is Never Shown As Final

A result with status `pending_ai_review` MUST be presented to the student as pending/under review, never as a final score, regardless of the `showResults` setting.

#### Scenario: Manually-graded question still pending

- GIVEN a result whose status is `pending_ai_review`
- WHEN the owning student requests their result detail
- THEN the response indicates the result is still pending
- AND does not present a final score or `passed` value, even if `showResults` is `true`
