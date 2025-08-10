import { Router } from 'express';
import { errorHandler } from '../middleware/errorHandler.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

import examRoute from './exam.route';
