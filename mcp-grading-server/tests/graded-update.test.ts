import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGradedUpdate, UNSETTABLE_GRADED_FIELDS } from '../src/grading/scoring.js';

// MongoDB rejects an update that names the same path in $set and $unset
// ("would create a conflict at 'failedCompetencies'"), which made every
// regrade of an exam without a per-competency minimum fail.
test('an undefined graded field goes to $unset only, never to $set too', () => {
  const update = buildGradedUpdate(
    { percentage: 70, passed: false, failedCompetencies: undefined, competencyMastery: undefined },
    UNSETTABLE_GRADED_FIELDS
  );
  assert.deepEqual(update.$set, { percentage: 70, passed: false });
  assert.deepEqual(update.$unset, { failedCompetencies: '', competencyMastery: '', passingScore: '', sections: '' });
  for (const key of Object.keys(update.$unset ?? {})) {
    assert.equal(key in update.$set, false, `${key} is in both $set and $unset`);
  }
});

test('with every graded field defined there is no $unset', () => {
  const update = buildGradedUpdate(
    { passed: true, passingScore: 60, sections: [], competencyMastery: {}, failedCompetencies: [] },
    UNSETTABLE_GRADED_FIELDS
  );
  assert.equal(update.$unset, undefined);
  assert.deepEqual(update.$set.failedCompetencies, []);
});
