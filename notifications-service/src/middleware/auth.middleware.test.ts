/**
 * Minimal unit tests for the auth middleware guarding every
 * notifications-service route (see auth.middleware.ts).
 *
 * Uses Node's built-in test runner (node:test) via ts-node/register, since
 * this package has jest listed but no ts-jest/babel-jest config wired up for
 * TypeScript, and adding one is a heavier change than this fix needs. Run:
 *   node -r ts-node/register --test src/middleware/auth.middleware.test.ts
 */

// Config throws (process.exit) if these are missing at import time — set
// them before requiring anything that pulls in ../config. Using require()
// here (not import) keeps this from being hoisted above these assignments.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'test-service-token';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-resend-key';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { requireAuth, requireService, requireAdminOrService, isAdmin } = require('./auth.middleware');

function signToken(payload: Record<string, unknown>) {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    issuer: 'cba-auth-service',
    audience: 'cba-platform',
    expiresIn: '1h',
  });
}

function makeRes() {
  const res: any = {
    statusCode: undefined as number | undefined,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function makeReq(headers: Record<string, string> = {}) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    headers: lower,
    header(name: string) {
      return lower[name.toLowerCase()];
    },
  } as any;
}

test('requireAuth: no token -> 401', () => {
  const req = makeReq();
  const res = makeRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('requireAuth: garbage token -> 401', () => {
  const req = makeReq({ authorization: 'Bearer not-a-real-token' });
  const res = makeRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireAuth: valid student token -> next() and req.user populated', () => {
  const token = signToken({ userId: 'student-1', email: 's@x.com', role: 'student' });
  const req = makeReq({ authorization: `Bearer ${token}` });
  const res = makeRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.user.userId, 'student-1');
  assert.equal(req.user.role, 'student');
});

test('requireAuth: valid service token bypasses JWT check', () => {
  const req = makeReq({ 'x-service-token': 'test-service-token' });
  const res = makeRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.isServiceCall, true);
});

test('requireService: no token -> 401', () => {
  const req = makeReq();
  const res = makeRes();
  let nextCalled = false;
  requireService(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireService: wrong token -> 401', () => {
  const req = makeReq({ 'x-service-token': 'wrong-token' });
  const res = makeRes();
  let nextCalled = false;
  requireService(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireService: correct SERVICE_TOKEN -> next()', () => {
  const req = makeReq({ 'x-service-token': 'test-service-token' });
  const res = makeRes();
  let nextCalled = false;
  requireService(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.isServiceCall, true);
});

test('requireAdminOrService: student token -> 403', () => {
  const token = signToken({ userId: 'student-1', role: 'student' });
  const req = makeReq({ authorization: `Bearer ${token}` });
  const res = makeRes();
  let nextCalled = false;
  requireAdminOrService(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('requireAdminOrService: admin token -> next()', () => {
  const token = signToken({ userId: 'admin-1', role: 'admin' });
  const req = makeReq({ authorization: `Bearer ${token}` });
  const res = makeRes();
  let nextCalled = false;
  requireAdminOrService(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, 'admin');
});

test('requireAdminOrService: service token -> next() without a user token', () => {
  const req = makeReq({ 'x-service-token': 'test-service-token' });
  const res = makeRes();
  let nextCalled = false;
  requireAdminOrService(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.isServiceCall, true);
});

test('isAdmin: role checks', () => {
  assert.equal(isAdmin({ userId: '1', role: 'admin' }), true);
  assert.equal(isAdmin({ userId: '1', role: 'student' }), false);
  assert.equal(isAdmin({ userId: '1', role: 'teacher' }), false);
  assert.equal(isAdmin(undefined), false);
});

// --- Token-shape hardening -------------------------------------------------

function runRequireAuth(headers: Record<string, string>) {
  const req = makeReq(headers);
  const res = makeRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

test('requireAuth: token with wrong issuer -> 401', () => {
  const token = jwt.sign({ userId: 'u1', role: 'admin' }, process.env.JWT_SECRET as string, {
    issuer: 'someone-else',
    audience: 'cba-platform',
    expiresIn: '1h',
  });
  const { res, nextCalled } = runRequireAuth({ authorization: `Bearer ${token}` });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireAuth: token with wrong audience -> 401', () => {
  const token = jwt.sign({ userId: 'u1', role: 'admin' }, process.env.JWT_SECRET as string, {
    issuer: 'cba-auth-service',
    audience: 'another-platform',
    expiresIn: '1h',
  });
  const { res, nextCalled } = runRequireAuth({ authorization: `Bearer ${token}` });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireAuth: alg "none" token -> 401', () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    userId: 'u1',
    role: 'admin',
    iss: 'cba-auth-service',
    aud: 'cba-platform',
    iat: now,
    exp: now + 3600,
  })}.`;
  const { res, nextCalled } = runRequireAuth({ authorization: `Bearer ${token}` });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireAuth: token without exp -> 401', () => {
  const token = jwt.sign({ userId: 'u1', role: 'student' }, process.env.JWT_SECRET as string, {
    issuer: 'cba-auth-service',
    audience: 'cba-platform',
  });
  const { res, nextCalled } = runRequireAuth({ authorization: `Bearer ${token}` });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireService: service token of a different length -> 401 (no throw)', () => {
  const req = makeReq({ 'x-service-token': 'test-service-token-but-longer' });
  const res = makeRes();
  let nextCalled = false;
  assert.doesNotThrow(() => requireService(req, res, () => { nextCalled = true; }));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireService: empty configured SERVICE_TOKEN never matches (even an empty header)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { config } = require('../config');
  const original = config.auth.serviceToken;
  config.auth.serviceToken = '';
  try {
    for (const provided of ['', 'test-service-token']) {
      const req = makeReq({ 'x-service-token': provided });
      const res = makeRes();
      let nextCalled = false;
      requireService(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
    }
  } finally {
    config.auth.serviceToken = original;
  }
});
