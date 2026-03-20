import { Router } from 'express';
import { getChannels, getChannelById, createChannel, updateChannel, deleteChannel } from '../controllers/channelController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { requireMinRole } from '../middleware/rbacMiddleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/', getChannels);
router.get('/:id', getChannelById);
router.post('/', requireMinRole('MANAGER'), createChannel);
router.patch('/:id', requireMinRole('MANAGER'), updateChannel);
router.delete('/:id', requireMinRole('ADMIN'), deleteChannel);

export default router;
