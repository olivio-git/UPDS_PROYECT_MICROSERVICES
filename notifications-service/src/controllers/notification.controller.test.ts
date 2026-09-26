/**
 * Ownership tests for the in-app notification endpoints: a non-admin must
 * never be able to read or modify another user's notifications, even if
 * they pass someone else's recipientId/id. See notification.controller.ts
 * listNotifications / markAsRead / deleteNotification.
 *
 * Run: node -r ts-node/register --test src/controllers/notification.controller.test.ts
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'test-service-token';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-resend-key';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

import assert from 'node:assert/strict';
import test from 'node:test';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NotificationController } = require('./notification.controller');

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

const NOTIF_ID = '507f1f77bcf86cd799439011';

function makeFakeService(notification: any) {
  return {
    getInAppNotificationById: async (id: string) => (id === NOTIF_ID ? notification : null),
    markNotificationAsRead: async () => undefined,
    deleteInAppNotification: async () => true,
    listInAppNotifications: async (recipientId: string) => [{ recipientId }],
  };
}

test('listNotifications: student cannot list another recipient by passing recipientId', async () => {
  const service = makeFakeService(null);
  const controller = new NotificationController(service as any);
  const req: any = {
    user: { userId: 'student-1', role: 'student' },
    query: { recipientId: 'someone-else' },
  };
  const res = makeRes();

  await controller.listNotifications(req, res);

  assert.equal(res.statusCode, 200);
  // The backend must have used the caller's own id, not the requested one.
  assert.equal(res.body.data[0].recipientId, 'student-1');
});

test('listNotifications: admin may pass an explicit recipientId', async () => {
  const service = makeFakeService(null);
  const controller = new NotificationController(service as any);
  const req: any = {
    user: { userId: 'admin-1', role: 'admin' },
    query: { recipientId: 'someone-else' },
  };
  const res = makeRes();

  await controller.listNotifications(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].recipientId, 'someone-else');
});

test('markAsRead: student cannot mark another recipient\'s notification -> 403', async () => {
  const service = makeFakeService({ recipientId: 'owner-1' });
  const controller = new NotificationController(service as any);
  const req: any = { user: { userId: 'someone-else', role: 'student' }, params: { id: NOTIF_ID } };
  const res = makeRes();

  await controller.markAsRead(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('markAsRead: owner can mark their own notification -> 200', async () => {
  const service = makeFakeService({ recipientId: 'owner-1' });
  const controller = new NotificationController(service as any);
  const req: any = { user: { userId: 'owner-1', role: 'student' }, params: { id: NOTIF_ID } };
  const res = makeRes();

  await controller.markAsRead(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test('markAsRead: admin can mark any recipient\'s notification -> 200', async () => {
  const service = makeFakeService({ recipientId: 'owner-1' });
  const controller = new NotificationController(service as any);
  const req: any = { user: { userId: 'admin-1', role: 'admin' }, params: { id: NOTIF_ID } };
  const res = makeRes();

  await controller.markAsRead(req, res);

  assert.equal(res.statusCode, 200);
});

test('markAsRead: unknown id -> 404', async () => {
  const service = makeFakeService({ recipientId: 'owner-1' });
  const controller = new NotificationController(service as any);
  const req: any = { user: { userId: 'owner-1', role: 'student' }, params: { id: 'does-not-exist' } };
  const res = makeRes();

  await controller.markAsRead(req, res);

  assert.equal(res.statusCode, 404);
});

test('deleteNotification: student cannot delete another recipient\'s notification -> 403', async () => {
  const service = makeFakeService({ recipientId: 'owner-1' });
  const controller = new NotificationController(service as any);
  const req: any = { user: { userId: 'someone-else', role: 'student' }, params: { id: NOTIF_ID } };
  const res = makeRes();

  await controller.deleteNotification(req, res);

  assert.equal(res.statusCode, 403);
});

test('deleteNotification: owner can delete their own notification -> 200', async () => {
  const service = makeFakeService({ recipientId: 'owner-1' });
  const controller = new NotificationController(service as any);
  const req: any = { user: { userId: 'owner-1', role: 'student' }, params: { id: NOTIF_ID } };
  const res = makeRes();

  await controller.deleteNotification(req, res);

  assert.equal(res.statusCode, 200);
});

test('listNotifications: admin without recipientId gets their own list (dashboard bell)', async () => {
  const service = makeFakeService(null);
  const controller = new NotificationController(service as any);
  const req: any = { user: { userId: 'admin-1', role: 'admin' }, query: {} };
  const res = makeRes();

  await controller.listNotifications(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].recipientId, 'admin-1');
});

test('listNotifications: service call without recipientId and without a user -> 400', async () => {
  const service = makeFakeService(null);
  const controller = new NotificationController(service as any);
  const req: any = { isServiceCall: true, query: {} };
  const res = makeRes();

  await controller.listNotifications(req, res);

  assert.equal(res.statusCode, 400);
});

test('listNotifications: operator-object recipientId (recipientId[$ne]=x) as admin -> 400', async () => {
  let called = false;
  const service = { ...makeFakeService(null), listInAppNotifications: async () => { called = true; return []; } };
  const controller = new NotificationController(service as any);
  const req: any = { user: { userId: 'admin-1', role: 'admin' }, query: { recipientId: { $ne: 'x' } } };
  const res = makeRes();

  await controller.listNotifications(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
});

test('listNotifications: operator-object recipientId as student -> 400 too', async () => {
  const service = makeFakeService(null);
  const controller = new NotificationController(service as any);
  const req: any = { user: { userId: 'student-1', role: 'student' }, query: { recipientId: { $ne: 'x' } } };
  const res = makeRes();

  await controller.listNotifications(req, res);

  assert.equal(res.statusCode, 400);
});
