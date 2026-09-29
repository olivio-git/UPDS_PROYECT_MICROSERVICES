/**
 * A welcome or password-reset email stores the temporary password (and an
 * OTP email its code) so the email can be sent and retried. Once the email is
 * sent, the stored copy must not keep that secret.
 *
 * Run: node -r ts-node/register --test src/repositories/notification.repository.test.ts
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'test-service-token';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-resend-key';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

import assert from 'node:assert/strict';
import test from 'node:test';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildEmailStatusUpdate } = require('./notification.repository');

const NOW = new Date('2026-09-28T12:00:00Z');
const SECRETS = { 'templateData.temporaryPassword': '', 'templateData.otpCode': '' };

test('a sent email loses its secrets and records when it was sent', () => {
  const update = buildEmailStatusUpdate('sent', { messageId: 'm-1' }, NOW);
  assert.deepEqual(update.$unset, SECRETS);
  assert.equal(update.$set.status, 'sent');
  assert.equal(update.$set.sentAt, NOW);
  assert.equal(update.$set.messageId, 'm-1');
});

test('a failed email keeps its secrets: retryFailedEmails may still resend it', () => {
  const update = buildEmailStatusUpdate('failed', { failureReason: 'bounced' }, NOW);
  assert.equal(update.$unset, undefined);
  assert.equal(update.$set.sentAt, undefined);
});

test('a pending email keeps its secrets so a retry can still send it', () => {
  const update = buildEmailStatusUpdate('pending', undefined, NOW);
  assert.equal(update.$unset, undefined);
  assert.equal(update.$set.status, 'pending');
});
