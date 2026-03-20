import { Router } from 'express';
import { getSources, createSource, bulkCreateSources, deleteSource } from '../controllers/sourceController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { requireMinRole } from '../middleware/rbacMiddleware.js';

const router = Router();
router.use(authMiddleware);
router.use(requireMinRole('SOURCER'));

router.get('/', getSources);
router.post('/', createSource);
router.post('/bulk', bulkCreateSources);
router.delete('/:id', requireMinRole('MANAGER'), deleteSource);

export default router;
