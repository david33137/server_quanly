import { Router } from 'express';
import {
  getNextJob, getBatchJobs, updateJobStatus, completeJob, failJobByWorker, workerHeartbeat,
  getWorkerTokens, createWorkerToken, updateWorkerToken, deleteWorkerToken
} from '../controllers/workerController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import workerAuthMiddleware from '../middleware/workerAuthMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';

const router = Router();

// Worker endpoints (authenticated via Worker Token)
router.get('/jobs/next', workerAuthMiddleware, getNextJob);
router.get('/jobs/batch', workerAuthMiddleware, getBatchJobs);
router.put('/jobs/:id/status', workerAuthMiddleware, updateJobStatus);
router.post('/jobs/:id/complete', workerAuthMiddleware, completeJob);
router.post('/jobs/:id/fail', workerAuthMiddleware, failJobByWorker);
router.post('/heartbeat', workerAuthMiddleware, workerHeartbeat);

// Admin: manage worker tokens (authenticated via JWT + Admin role)
router.get('/tokens', authMiddleware, requireRole('ADMIN'), getWorkerTokens);
router.post('/tokens', authMiddleware, requireRole('ADMIN'), createWorkerToken);
router.patch('/tokens/:id', authMiddleware, requireRole('ADMIN'), updateWorkerToken);
router.delete('/tokens/:id', authMiddleware, requireRole('ADMIN'), deleteWorkerToken);

export default router;
