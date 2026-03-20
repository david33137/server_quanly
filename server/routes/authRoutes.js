import { Router } from 'express';
import { login, register, getMe, updateMe, getUsers, updateUser, deleteUser } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { requireRole, requireMinRole } from '../middleware/rbacMiddleware.js';

const router = Router();

// Public
router.post('/login', login);

// Protected
router.use(authMiddleware);
router.get('/me', getMe);
router.patch('/me', updateMe);
router.post('/register', requireRole('ADMIN'), register);
router.get('/users', requireMinRole('MANAGER'), getUsers);
router.patch('/users/:id', requireRole('ADMIN'), updateUser);
router.delete('/users/:id', requireRole('ADMIN'), deleteUser);

export default router;
