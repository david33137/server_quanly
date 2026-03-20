import { Router } from 'express';
import { getLanguages, createLanguage, updateLanguage, deleteLanguage } from '../controllers/languageController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { requireMinRole, requireRole } from '../middleware/rbacMiddleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/', getLanguages); // All roles can see languages
router.post('/', requireRole('ADMIN'), createLanguage);
router.patch('/:id', requireRole('ADMIN'), updateLanguage);
router.delete('/:id', requireRole('ADMIN'), deleteLanguage);

export default router;
