import { NextFunction, Request, Response } from 'express';
import { User } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      userCandidateId?: any;
      userId?: string;
      userInfo?: {
        firstName: string;
        lastName: string;
        email: string;
        candidateId: string;
      };
    }
  }
};
const STUDENT_ROLES = ['candidate', 'student'];

export const isStudentRole = (role: unknown) => STUDENT_ROLES.includes(String(role));

/**
 * "One person, one id": the user-management profile and the exam-domain
 * candidate now share the same _id as the auth-service user carried in the
 * JWT, so the JWT id IS the candidate id and needs no translation.
 *
 * This lookup is best-effort and only used to enrich req.userInfo (used by
 * PDF generation). Callers must not rely on it to resolve the id itself.
 */
async function lookupProfile(personId: string) {
  try {
    return await User.findById(personId);
  } catch (error) {
    console.warn('searchRefs: profile lookup failed, falling back to JWT claims', error);
    return null;
  }
}

export const searchRefs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user && req.user.role;
    if (!isStudentRole(role)) {
      throw new Error('Only candidates or students can take exams');
    }
    const personId = req.user && req.user.id;
    if (!personId) {
      throw new Error('Missing user id in token');
    }

    // The JWT id is the candidate id directly — no auth -> profile -> candidate
    // translation needed.
    req.userCandidateId = personId;
    req.userId = personId;

    // Best-effort profile lookup for PDF metadata. If the profile is missing,
    // fall back to the JWT email and empty names instead of failing the
    // request, since the id above does not depend on this lookup.
    const profile = await lookupProfile(personId);

    req.userInfo = {
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      email: profile?.email || req.user?.email || '',
      candidateId: personId
    };

    console.log('SearchRefs middleware - User info:', req.userInfo); // Debug log
    next();
  } catch (error: any) {
    console.error('Error in searchRefs middleware:', error);
    res.status(403).json({ error: error.message });
  }
};

/**
 * Lets staff through, but restricts students to records of their own candidate
 * id. Use on routes where a student may read a record addressed by a
 * `:candidateParam` path parameter.
 *
 * "One person, one id": for students, the JWT id IS the candidate id, so this
 * is a direct comparison — no lookup required.
 */
export const restrictStudentToOwnCandidate =
  (candidateParam: string) => async (req: Request, res: Response, next: NextFunction) => {
    const role = req.user && req.user.role;
    if (!isStudentRole(role)) {
      next();
      return;
    }
    const personId = req.user && req.user.id;
    if (!personId || String(personId) !== String(req.params[candidateParam])) {
      res.status(403).json({ success: false, message: 'You can only access your own records' });
      return;
    }
    next();
  };
