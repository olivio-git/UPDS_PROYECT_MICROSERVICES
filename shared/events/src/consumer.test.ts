import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyMessage } from './consumer';
import { createEvent } from './envelope';

test('classifyMessage: legacy shape (no id, no version) is ignored, not invalid', () => {
  const legacy = {
    type: 'exam.graded',
    data: { candidateEmail: 'a@b.com' },
    timestamp: new Date().toISOString(),
    service: 'grading-service',
  };

  assert.equal(classifyMessage(legacy), 'legacy');
});

test('classifyMessage: a well-formed envelope is classified as envelope', () => {
  const envelope = createEvent({
    type: 'exam.attempt.finished',
    source: 'exam-service',
    subject: 'attempt-123',
    data: { attemptId: 'attempt-123' },
  });

  assert.equal(classifyMessage(envelope), 'envelope');
});

test('classifyMessage: has id+version but fails schema -> invalid', () => {
  const malformed = {
    id: 'not-a-uuid',
    version: 1,
    type: 'exam.attempt.finished',
    occurredAt: new Date().toISOString(),
    source: 'exam-service',
    subject: 'attempt-123',
    data: {},
  };

  assert.equal(classifyMessage(malformed), 'invalid');
});

test('classifyMessage: has version but no id -> legacy (not invalid)', () => {
  const noId = {
    version: 1,
    type: 'exam.attempt.finished',
    data: {},
  };

  assert.equal(classifyMessage(noId), 'legacy');
});

test('classifyMessage: non-object values are legacy', () => {
  assert.equal(classifyMessage(null), 'legacy');
  assert.equal(classifyMessage('a string'), 'legacy');
  assert.equal(classifyMessage([1, 2, 3]), 'legacy');
});
