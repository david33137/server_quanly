import { Router } from 'express';
import { getTeams, getTeamById, createTeam, updateTeam, deleteTeam, addMember, removeMember } from '../controllers/teamController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { requireMinRole, requireRole } from '../middleware/rbacMiddleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/', requireMinRole('MANAGER'), getTeams);
router.get('/:id', requireMinRole('MANAGER'), getTeamById);
router.post('/', requireRole('ADMIN'), createTeam);
router.patch('/:id', requireRole('ADMIN'), updateTeam);
router.delete('/:id', requireRole('ADMIN'), deleteTeam);
router.post('/:id/members', requireMinRole('MANAGER'), addMember);
router.delete('/:id/members/:userId', requireMinRole('MANAGER'), removeMember);

export default router;
