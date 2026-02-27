// @ts-nocheck
import jwt from 'jsonwebtoken';
import { authenticateSocket } from '../src/middleware/auth';

describe('authenticateSocket middleware', () => {
  afterEach(() => {
    delete process.env.SESSION_JWT_SECRET;
    delete process.env.JWT_SECRET;
  });

  test('authenticates socket with valid session token', async () => {
    process.env.SESSION_JWT_SECRET = 'sess-secret';
    const payload = { id: 'user1', email: 'u@example.com', role: 'student' };
    const token = jwt.sign(payload, process.env.SESSION_JWT_SECRET, { expiresIn: '1m' });

    const socket = {
      handshake: { auth: { token } }
    };

    let called = false;
    const next = (err?: Error) => {
      if (err) throw err;
      called = true;
    };

    await authenticateSocket(socket as any, next as any);
    expect(called).toBe(true);
  });

  test('rejects when no token provided', async () => {
    const socket = { handshake: {} };
    let errReceived = null;
    const next = (err?: Error) => { errReceived = err; };

    await authenticateSocket(socket as any, next as any);
    expect(errReceived).toBeInstanceOf(Error);
    expect(errReceived.message).toMatch(/No token provided|Invalid token/);
  });
});
