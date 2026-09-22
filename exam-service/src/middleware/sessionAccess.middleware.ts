import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { Session } from '../models/session.model';
import { User } from '../models/user.model';
import { logger } from '../utils/logger';

// Gate for session-mutating actions (kick, extend, end, regrade, ...).
// requireRole() already keeps out roles that can never touch these routes
// (e.g. students); this middleware narrows 'teacher'/'proctor' down to
// "assigned to THIS specific session" — closing the gap where any teacher
// or any proctor could act on a session they have nothing to do with.
// Allowed: admin, the session's creator, or a proctor assigned to the
// session. Everyone else gets 403.
export const requireSessionAssignment = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      if (req.user.role === 'admin') {
        next();
        return;
      }

      const sessionId = req.params.id;
      if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
        res.status(400).json({ success: false, message: 'Invalid session id' });
        return;
      }

      const session = await Session.findById(sessionId).select('createdBy participants.proctors');
      if (!session) {
        res.status(404).json({ success: false, message: 'Session not found' });
        return;
      }

      // req.user.id is the auth-service user id from the JWT; createdBy and
      // participants.proctors store the local exam-service User _id (see
      // SessionService.create()/addProctor()). Resolve one to the other.
      const localUser = await User.findOne({ authServiceUserId: req.user.id }).select('_id');
      const localUserId = localUser?._id ? String(localUser._id) : String(req.user.id);

      const isCreator = String(session.createdBy) === localUserId;
      const isAssignedProctor = (session.participants.proctors || []).some(
        (id: any) => String(id) === localUserId
      );

      if (!isCreator && !isAssignedProctor) {
        res.status(403).json({
          success: false,
          message: 'No estás asignado a esta sesión'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Error checking session assignment:', error);
      res.status(500).json({ success: false, message: 'Authorization check failed' });
    }
  };
};
