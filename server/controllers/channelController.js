import prisma from '../lib/prisma.js';
import { logActivity } from '../services/logService.js';

// GET /api/channels
export const getChannels = async (req, res) => {
  try {
    const { teamId, status, gmailId, search } = req.query;
    const where = {};
    if (req.user.role === 'MANAGER' || req.user.role === 'EDITOR' || req.user.role === 'SOURCER') {
      where.teamId = req.user.teamId;
    }
    if (teamId && req.user.role === 'ADMIN') where.teamId = teamId;
    if (status) where.status = status;
    if (gmailId) where.gmailId = gmailId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { channelId: { contains: search, mode: 'insensitive' } },
        { niche: { contains: search, mode: 'insensitive' } },
      ];
    }
    const channels = await prisma.youTubeChannel.findMany({
      where,
      include: {
        gmail: { select: { id: true, email: true, status: true } },
        team: { select: { id: true, name: true } },
        _count: { select: { targetJobs: true, uploadedJobs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ channels });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/channels/:id
export const getChannelById = async (req, res) => {
  try {
    const channel = await prisma.youTubeChannel.findUnique({
      where: { id: req.params.id },
      include: { gmail: true, team: true },
    });
    if (!channel) return res.status(404).json({ error: 'Kênh không tồn tại' });
    return res.json({ channel });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/channels
export const createChannel = async (req, res) => {
  try {
    const { name, channelUrl, channelId, thumbnailUrl, gmailId, teamId: reqTeamId, status, subscribers, language, niche, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Tên kênh là bắt buộc' });

    // MANAGER chỉ được tạo kênh trong team mình
    let resolvedTeamId = reqTeamId || null;
    if (req.user.role === 'MANAGER') {
      resolvedTeamId = req.user.teamId || null;
    }

    // MANAGER chỉ được gắn Gmail thuộc team mình
    if (gmailId && req.user.role === 'MANAGER') {
      const gmail = await prisma.gmailAccount.findUnique({ where: { id: gmailId } });
      if (gmail && gmail.teamId !== req.user.teamId) {
        return res.status(403).json({ error: 'Không có quyền gắn Gmail của team khác' });
      }
    }

    const channel = await prisma.youTubeChannel.create({
      data: { name, channelUrl, channelId, thumbnailUrl, gmailId, teamId: resolvedTeamId, status, subscribers, language, niche, notes },
      include: { gmail: true, team: true },
    });
    await logActivity({ userId: req.user.id, action: 'CHANNEL_CREATED', entityType: 'CHANNEL', entityId: channel.id });
    return res.status(201).json({ channel });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/channels/:id
export const updateChannel = async (req, res) => {
  try {
    const { id } = req.params;

    // MANAGER chỉ được sửa kênh của team mình
    if (req.user.role === 'MANAGER') {
      const existing = await prisma.youTubeChannel.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Kênh không tồn tại' });
      if (existing.teamId !== req.user.teamId) return res.status(403).json({ error: 'Không có quyền sửa kênh của team khác' });
    }

    const { name, channelUrl, channelId, thumbnailUrl, gmailId, teamId: reqTeamId, status, subscribers, language, niche, notes } = req.body;
    const updateData = { name, channelUrl, channelId, thumbnailUrl, gmailId, status, subscribers, language, niche, notes };

    // MANAGER không được thay đổi team
    if (req.user.role !== 'MANAGER') {
      if (reqTeamId !== undefined) updateData.teamId = reqTeamId || null;
    }

    // MANAGER không được gắn Gmail của team khác
    if (gmailId && req.user.role === 'MANAGER') {
      const gmail = await prisma.gmailAccount.findUnique({ where: { id: gmailId } });
      if (gmail && gmail.teamId !== req.user.teamId) {
        return res.status(403).json({ error: 'Không có quyền gắn Gmail của team khác' });
      }
    }

    const channel = await prisma.youTubeChannel.update({
      where: { id },
      data: updateData,
      include: { gmail: true, team: true },
    });
    await logActivity({ userId: req.user.id, action: 'CHANNEL_UPDATED', entityType: 'CHANNEL', entityId: id });
    return res.json({ channel });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


// DELETE /api/channels/:id
export const deleteChannel = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.youTubeChannel.delete({ where: { id } });
    await logActivity({ userId: req.user.id, action: 'CHANNEL_DELETED', entityType: 'CHANNEL', entityId: id });
    return res.json({ message: 'Đã xóa kênh' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
