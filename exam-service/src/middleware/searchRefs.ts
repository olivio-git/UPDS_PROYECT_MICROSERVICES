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
export const searchRefs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user && (req.user as any).role;
    if (role !== 'candidate' && role !== 'student') {
      throw new Error('Only candidates or students can take exams');
    }
    const authUserId = req.user && (req.user as any).id; 
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
    if (!userCandidate || userCandidate.length === 0) {
      throw new Error('User is not a candidate');
    }

    const userData = userCandidate[0];
    const candidateData = userData.candidate[0];

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
