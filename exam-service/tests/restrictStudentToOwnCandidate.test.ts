/**
 * Students may read only their own history; staff may read anyone's.
 *
 * GET /reports/student/:studentId/history allowed the student role and used the
 * path parameter as-is, so any student could read any other student's scores,
 * feedback and personal data by editing the URL.
 *
 * "One person, one id": the JWT id IS the candidate id, so this middleware is
 * now a direct comparison against the path parameter — no profile/candidate
 * lookup involved.
 */

import type { NextFunction, Request, Response } from 'express';
import { restrictStudentToOwnCandidate } from '../src/middleware/searchRefs';

function run(user: { id: string; role: string }, studentId: string) {
  const req = { user, params: { studentId } } as unknown as Request;
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn() as NextFunction;
  return restrictStudentToOwnCandidate('studentId')(req, res as unknown as Response, next)
    .then(() => ({ res, next }));
}

describe('restrictStudentToOwnCandidate', () => {
  it.each(['admin', 'teacher'])('lets %s read any student', async (role) => {
    const { next, res } = await run({ id: 'auth-staff', role }, 'auth-alice');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('lets a student read their own history', async () => {
    const { next } = await run({ id: 'auth-alice', role: 'student' }, 'auth-alice');
    expect(next).toHaveBeenCalled();
  });

  it("rejects a student reading another student's history", async () => {
    const { next, res } = await run({ id: 'auth-alice', role: 'student' }, 'auth-bob');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('applies the same rule to the candidate role', async () => {
    const { next, res } = await run({ id: 'auth-bob', role: 'candidate' }, 'auth-alice');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects when the JWT carries no user id', async () => {
    const { next, res } = await run({ id: '', role: 'student' }, 'auth-alice');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
