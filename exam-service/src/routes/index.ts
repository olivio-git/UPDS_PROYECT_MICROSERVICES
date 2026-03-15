import { Router } from 'express';
import examRoute from './exam.route';
import examTakingRoute from './examTaking.routes';
import levelRoute from './level.routes';
import mediaRoute from './media.routes';
import questionRoute from './question.routes';
import rubricRoute from './rubric.routes';
import sessionRoute from './session.routes';
import systemMonitoringRoute from './systemMonitoring.routes';
import evaluationRoute from './evaluation.routes';
import { examResultRoutes } from './examResult.routes';
import reportsRoute from './reports.routes';

const router = Router();

// Mount routes
router.use('/exams', examRoute);
router.use('/questions', questionRoute);
router.use('/levels', levelRoute);
router.use('/rubrics', rubricRoute);
router.use('/sessions', sessionRoute);
router.use('/media', mediaRoute);
router.use('/exam-taking', examTakingRoute);
router.use('/system', systemMonitoringRoute);
router.use('/evaluation', evaluationRoute);
router.use('/exam-results', examResultRoutes);
router.use('/reports', reportsRoute);

export default router;