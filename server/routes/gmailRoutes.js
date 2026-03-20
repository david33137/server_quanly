import { Router } from 'express';
import { getGmailAccounts, getGmailById, createGmail, bulkCreateGmail, updateGmail, deleteGmail, revealPassword } from '../controllers/gmailController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { requireMinRole } from '../middleware/rbacMiddleware.js';

const router = Router();
router.use(authMiddleware);
router.use(requireMinRole('MANAGER'));

router.get('/', getGmailAccounts);
router.get('/:id', getGmailById);
router.post('/', createGmail);
router.post('/bulk', bulkCreateGmail);
router.patch('/:id', updateGmail);
router.delete('/:id', deleteGmail);
router.post('/:id/reveal-password', requireMinRole('ADMIN'), revealPassword);

export default router;
