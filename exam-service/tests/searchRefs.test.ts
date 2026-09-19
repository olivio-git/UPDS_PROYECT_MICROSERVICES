/**
 * "One person, one id": the JWT id IS the candidate id — no
 * auth -> profile -> candidate translation is needed to obtain it.
 *
 * searchRefs still acts as a role guard and still enriches req.userInfo with
 * profile data for PDF generation, but that lookup is best-effort: a missing
 * profile must not fail the request, since the id no longer depends on it.
 */

const findById = jest.fn();

jest.mock('../src/models/user.model', () => ({
  User: {
    findById: (...args: unknown[]) => findById(...args),
  },
}));

import type { NextFunction, Request, Response } from 'express';
import { searchRefs } from '../src/middleware/searchRefs';

function run(user: { id: string; role: string; email?: string }) {
  const req = { user } as unknown as Request;
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn() as NextFunction;
  return searchRefs(req, res as unknown as Response, next).then(() => ({ req, res, next }));
}

describe('searchRefs', () => {
  beforeEach(() => {
    findById.mockReset();
  });

  it("uses the JWT id directly as the candidate id, without any profile/candidate lookup", async () => {
    findById.mockResolvedValue({ firstName: 'Alice', lastName: 'Doe', email: 'alice@cba.test' });

    const { req, next } = await run({ id: 'auth-alice', role: 'student' });

    expect(next).toHaveBeenCalled();
    expect(req.userCandidateId).toBe('auth-alice');
    expect(req.userId).toBe('auth-alice');
    expect(req.userInfo?.candidateId).toBe('auth-alice');
    expect(findById).toHaveBeenCalledWith('auth-alice');
  });

  it('still passes when the profile is missing, falling back to the JWT email and empty names', async () => {
    findById.mockResolvedValue(null);

    const { req, res, next } = await run({ id: 'auth-orphan', role: 'student', email: 'orphan@cba.test' });

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.userCandidateId).toBe('auth-orphan');
    expect(req.userInfo).toEqual({
      firstName: '',
      lastName: '',
      email: 'orphan@cba.test',
      candidateId: 'auth-orphan',
    });
  });

  it('still passes when the profile lookup throws, falling back to the JWT claims', async () => {
    findById.mockRejectedValue(new Error('db unavailable'));

    const { req, next } = await run({ id: 'auth-orphan', role: 'student', email: 'orphan@cba.test' });

    expect(next).toHaveBeenCalled();
    expect(req.userCandidateId).toBe('auth-orphan');
    expect(req.userInfo?.email).toBe('orphan@cba.test');
  });

  it('still rejects non-student/candidate roles', async () => {
    const { res, next } = await run({ id: 'auth-teacher', role: 'teacher' });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(findById).not.toHaveBeenCalled();
  });
});
