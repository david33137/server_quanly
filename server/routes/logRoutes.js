import { Router } from 'express';
import { getActivityLogs, getJobLogs, getWorkerStatus, getDashboardStats } from '../controllers/logController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { requireMinRole } from '../middleware/rbacMiddleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/dashboard', getDashboardStats);
router.get('/activity', requireMinRole('MANAGER'), getActivityLogs);
router.get('/jobs/:id', requireMinRole('SOURCER'), getJobLogs);
router.get('/workers', requireMinRole('ADMIN'), getWorkerStatus);

export default router;
