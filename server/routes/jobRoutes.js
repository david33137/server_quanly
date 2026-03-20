import { Router } from 'express';
import {
  getJobs, getJobStats, getJobById,
  createJob, bulkCreateJobs, updateJob,
  assignChannel, approveJob, assignJob, markUploaded,
  startUpload, moveStep,
  failJob, requeueJob, deleteJob,
} from '../controllers/jobController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { requireMinRole } from '../middleware/rbacMiddleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/', requireMinRole('SOURCER'), getJobs);
router.get('/stats', requireMinRole('SOURCER'), getJobStats);
router.get('/:id', requireMinRole('SOURCER'), getJobById);

router.post('/', requireMinRole('SOURCER'), createJob);
router.post('/bulk', requireMinRole('SOURCER'), bulkCreateJobs);
router.patch('/:id', requireMinRole('EDITOR'), updateJob);

router.patch('/:id/assign-channel', requireMinRole('SOURCER'), assignChannel);
router.post('/:id/approve', requireMinRole('MANAGER'), approveJob);
router.post('/:id/assign', requireMinRole('MANAGER'), assignJob);
router.post('/:id/start-upload', requireMinRole('EDITOR'), startUpload);
router.post('/:id/mark-uploaded', requireMinRole('SOURCER'), markUploaded);
router.post('/:id/move-step', requireMinRole('EDITOR'), moveStep);
router.post('/:id/fail', requireMinRole('MANAGER'), failJob);
router.post('/:id/requeue', requireMinRole('MANAGER'), requeueJob);
router.delete('/:id', requireMinRole('ADMIN'), deleteJob);

export default router;
