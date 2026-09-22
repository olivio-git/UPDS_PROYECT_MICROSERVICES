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
 * Maps an auth-service user id to the user-management User and its Candidate.
 * Exam data (attempts, results, history) is keyed by the candidate id, which is
 * a different identifier from the auth user id carried in the JWT.
 */
export async function resolveCandidate(authUserId: string) {
    const userCandidate = await User.aggregate([
      {
        $match:{
          authServiceUserId: authUserId
        }
      },
      {
        $lookup:{
          from: 'candidates',
          localField: '_id',
          foreignField: 'userId',
          as: 'candidate'
        }
      }
    ]);
    const userData = userCandidate?.[0];
    const candidateData = userData?.candidate?.[0];
    if (!userData || !candidateData) {
      throw new Error('User is not a candidate');
    }
    return { userData, candidateData };
}

export const searchRefs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user && (req.user as any).role;
    if (!isStudentRole(role)) {
      throw new Error('Only candidates or students can take exams');
    }
    const authUserId = req.user && (req.user as any).id;
    const { userData, candidateData } = await resolveCandidate(authUserId);

    req.userCandidateId = candidateData._id;
    req.userId = userData._id;

    // Agregar información del usuario para usar en PDFs
    req.userInfo = {
      firstName: userData.firstName || 'Usuario',
      lastName: userData.lastName || '',
      email: userData.email || req.user?.email || '',
      candidateId: candidateData._id
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
 */
export const restrictStudentToOwnCandidate =
  (candidateParam: string) => async (req: Request, res: Response, next: NextFunction) => {
    const role = req.user && (req.user as any).role;
    if (!isStudentRole(role)) {
      next();
      return;
    }
    try {
      const { candidateData } = await resolveCandidate((req.user as any).id);
      if (String(candidateData._id) !== String(req.params[candidateParam])) {
        res.status(403).json({ success: false, message: 'You can only access your own records' });
        return;
      }
      next();
    } catch {
      res.status(403).json({ success: false, message: 'You can only access your own records' });
    }
  };
