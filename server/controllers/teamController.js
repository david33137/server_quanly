import prisma from '../lib/prisma.js';
import { logActivity } from '../services/logService.js';

// GET /api/teams
export const getTeams = async (req, res) => {
  try {
    const where = {};
    // MANAGER chỉ được xem team của mình
    if (req.user.role === 'MANAGER' && req.user.teamId) {
      where.id = req.user.teamId;
    }
    const teams = await prisma.team.findMany({
      where,
      include: {
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, channels: true, videoJobs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ teams });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/teams/:id
export const getTeamById = async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        channels: { select: { id: true, name: true, status: true, thumbnailUrl: true } },
        gmailAccounts: { select: { id: true, email: true, status: true } },
      },
    });
    if (!team) return res.status(404).json({ error: 'Team không tồn tại' });
    return res.json({ team });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/teams
export const createTeam = async (req, res) => {
  try {
    const { name, description, managerId } = req.body;
    if (!name) return res.status(400).json({ error: 'Tên team là bắt buộc' });
    const team = await prisma.team.create({
      data: { name, description, managerId },
      include: { manager: { select: { id: true, name: true } } },
    });
    await logActivity({ userId: req.user.id, action: 'TEAM_CREATED', entityType: 'TEAM', entityId: team.id });
    return res.status(201).json({ team });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/teams/:id
export const updateTeam = async (req, res) => {
  try {
    const { name, description, managerId } = req.body;
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: { name, description, managerId },
      include: { manager: { select: { id: true, name: true } } },
    });
    await logActivity({ userId: req.user.id, action: 'TEAM_UPDATED', entityType: 'TEAM', entityId: team.id });
    return res.json({ team });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/teams/:id/members
export const addMember = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId là bắt buộc' });

    // Chỉ ADMIN được thêm/xóa thành viên
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ Admin mới có thể thêm thành viên vào team' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { teamId: req.params.id },
      select: { id: true, name: true, email: true, role: true },
    });
    await logActivity({ userId: req.user.id, action: 'TEAM_MEMBER_ADDED', entityType: 'TEAM', entityId: req.params.id, metadata: { userId } });
    return res.json({ user, message: 'Đã thêm thành viên vào team' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /api/teams/:id/members/:userId
export const removeMember = async (req, res) => {
  try {
    // Chỉ ADMIN được thêm/xóa thành viên
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ Admin mới có thể xóa thành viên khỏi team' });
    }
    const { userId } = req.params;
    await prisma.user.update({ where: { id: userId }, data: { teamId: null } });
    await logActivity({ userId: req.user.id, action: 'TEAM_MEMBER_REMOVED', entityType: 'TEAM', entityId: req.params.id, metadata: { userId } });
    return res.json({ message: 'Đã xóa thành viên khỏi team' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


// DELETE /api/teams/:id
export const deleteTeam = async (req, res) => {
  try {
    await prisma.team.delete({ where: { id: req.params.id } });
    await logActivity({ userId: req.user.id, action: 'TEAM_DELETED', entityType: 'TEAM', entityId: req.params.id });
    return res.json({ message: 'Đã xóa team' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
