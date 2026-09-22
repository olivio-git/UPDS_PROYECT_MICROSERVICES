import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEvent, EventEnvelopeSchema } from './envelope';

test('createEvent generates a valid envelope with defaults', () => {
  const envelope = createEvent({
    type: 'exam.attempt.finished',
    source: 'exam-service',
    subject: 'attempt-123',
    data: { attemptId: 'attempt-123' },
  });

  assert.equal(envelope.version, 1);
  assert.equal(envelope.type, 'exam.attempt.finished');
  assert.equal(envelope.source, 'exam-service');
  assert.equal(envelope.subject, 'attempt-123');
  assert.match(envelope.id, /^[0-9a-f-]{36}$/i);
  assert.doesNotThrow(() => new Date(envelope.occurredAt).toISOString());

  const result = EventEnvelopeSchema.safeParse(envelope);
  assert.equal(result.success, true);
});

test('createEvent respects an explicit version', () => {
  const envelope = createEvent({
    type: 'grading.result.published',
    version: 2,
    source: 'grading-service',
    subject: 'attempt-456',
    data: {},
  });

  assert.equal(envelope.version, 2);
});

test('EventEnvelopeSchema rejects a type that is not lowercase.dot', () => {
  const result = EventEnvelopeSchema.safeParse({
    id: '123e4567-e89b-12d3-a456-426614174000',
    type: 'ExamAttemptFinished',
    version: 1,
    occurredAt: new Date().toISOString(),
    source: 'exam-service',
    subject: 'attempt-123',
    data: {},
  });

  assert.equal(result.success, false);
});

test('EventEnvelopeSchema rejects a missing version', () => {
  const result = EventEnvelopeSchema.safeParse({
    id: '123e4567-e89b-12d3-a456-426614174000',
    type: 'exam.attempt.finished',
    occurredAt: new Date().toISOString(),
    source: 'exam-service',
    subject: 'attempt-123',
    data: {},
  });

  assert.equal(result.success, false);
});
