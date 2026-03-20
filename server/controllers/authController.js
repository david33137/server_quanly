import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { logActivity } from '../services/logService.js';

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    }
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { team: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }
    const token = generateToken(user.id);
    await logActivity({ userId: user.id, action: 'USER_LOGIN', ipAddress: req.ip });
    const { password: _, ...userWithoutPass } = user;
    return res.json({ token, user: userWithoutPass });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/register (Admin only)
export const register = async (req, res) => {
  try {
    const { email, password, name, role, teamId } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }
    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) {
      return res.status(409).json({ error: 'Email đã tồn tại' });
    }
    const salt = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const hashed = await bcrypt.hash(password, salt);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashed,
        name,
        role: role || 'SOURCER',
        teamId: teamId || null,
      },
      include: { team: true },
    });
    await logActivity({ userId: req.user?.id, action: 'USER_CREATED', entityType: 'USER', entityId: user.id });
    const { password: _, ...userWithoutPass } = user;
    return res.status(201).json({ user: userWithoutPass });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  const { password: _, ...userWithoutPass } = req.user;
  return res.json({ user: userWithoutPass });
};

// PATCH /api/auth/me
export const updateMe = async (req, res) => {
  try {
    const { name, avatar, currentPassword, newPassword } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Cần nhập mật khẩu hiện tại để đổi mật khẩu' });
      }
      const isMatch = await bcrypt.compare(currentPassword, req.user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
      }
      const salt = parseInt(process.env.BCRYPT_ROUNDS || '10');
      updateData.password = await bcrypt.hash(newPassword, salt);
    }
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      include: { team: true },
    });
    const { password: _, ...userWithoutPass } = updated;
    return res.json({ user: userWithoutPass });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/users (Admin)
export const getUsers = async (req, res) => {
  try {
    const { teamId, role, search } = req.query;
    const where = {};
    if (teamId) where.teamId = teamId;
    if (role) where.role = role;
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
    const users = await prisma.user.findMany({
      where,
      include: { team: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ users: users.map(u => { const { password, ...r } = u; return r; }) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/users/:id (Admin)
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, teamId, isActive } = req.body;
    const updated = await prisma.user.update({
      where: { id },
      data: { name, role, teamId, isActive },
      include: { team: true },
    });
    await logActivity({ userId: req.user.id, action: 'USER_UPDATED', entityType: 'USER', entityId: id });
    const { password: _, ...userWithoutPass } = updated;
    return res.json({ user: userWithoutPass });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /api/users/:id (Admin)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Không thể xóa chính mình' });
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    await logActivity({ userId: req.user.id, action: 'USER_DELETED', entityType: 'USER', entityId: id });
    return res.json({ message: 'Đã vô hiệu hóa tài khoản' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
