// @ts-nocheck
import jwt from 'jsonwebtoken';
import { SessionController } from '../src/controllers/SessionController';

// Minimal mock for SessionService (not used by the tested methods)
class MockSessionService {}

describe('SessionController - generateSessionAccessToken', () => {
  const controller = new SessionController(new MockSessionService() as any);

  afterEach(() => {
    delete process.env.SESSION_JWT_SECRET;
    delete process.env.JWT_SECRET;
    delete process.env.SESSION_JWT_EXP_MIN;
  });

  test('signs a JWT when SESSION_JWT_SECRET is set', () => {
    process.env.SESSION_JWT_SECRET = 'test-secret';
    process.env.SESSION_JWT_EXP_MIN = '1';

    const token = (controller as any).generateSessionAccessToken('user1', 'u@example.com', 'sess1', 'student');
    const decoded = jwt.verify(token, 'test-secret') as any;

    expect(decoded.id).toBe('user1');
    expect(decoded.email).toBe('u@example.com');
    expect(decoded.role).toBe('student');
    expect(decoded.sessionId).toBe('sess1');
  });

  test('throws if no secret is configured', () => {
    delete process.env.SESSION_JWT_SECRET;
    delete process.env.JWT_SECRET;

    expect(() => (controller as any).generateSessionAccessToken('u', 'e', 's', 'student')).toThrow('SESSION_JWT_SECRET or JWT_SECRET is not configured');
  });
});
