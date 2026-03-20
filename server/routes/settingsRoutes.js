import { Router } from 'express';
import { getSettings, updateSetting, bulkUpdateSettings } from '../controllers/settingsController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

router.get('/', getSettings);
router.patch('/bulk', bulkUpdateSettings);
router.patch('/:key', updateSetting);

export default router;
