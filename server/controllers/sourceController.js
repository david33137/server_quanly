import prisma from '../lib/prisma.js';
import { logActivity } from '../services/logService.js';
import { getSetting } from './settingsController.js';

// GET /api/sources
export const getSources = async (req, res) => {
  try {
    const { teamId, sourceType, search } = req.query;
    const where = {};
    if (req.user.role !== 'ADMIN') where.teamId = req.user.teamId;
    if (teamId && req.user.role === 'ADMIN') where.teamId = teamId;
    if (sourceType) where.sourceType = sourceType;
    if (search) {
      where.OR = [
        { sourceUrl: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }
    const sources = await prisma.videoSource.findMany({
      where,
      include: {
        addedBy: { select: { id: true, name: true } },
        team:    { select: { id: true, name: true } },
        // Include jobs với step để hiển thị trạng thái pipeline
        jobs: {
          select: {
            id: true,
            currentStep: true,
            targetChannel: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { jobs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ sources });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/sources
export const createSource = async (req, res) => {
  try {
    const {
      sourceUrl, sourceType, platform, title, duration, thumbnailUrl, description,
      addToPipeline, targetChannelId, priority, targetLanguage,
    } = req.body;
    if (!sourceUrl) return res.status(400).json({ error: 'URL nguồn là bắt buộc' });

    const source = await prisma.videoSource.create({
      data: {
        sourceUrl,
        sourceType: sourceType || 'YOUTUBE',
        platform, title, duration, thumbnailUrl, description,
        addedById: req.user.id,
        teamId: req.user.teamId || null,
      },
      include: { addedBy: { select: { id: true, name: true } } },
    });
    await logActivity({ userId: req.user.id, action: 'SOURCE_CREATED', entityType: 'SOURCE', entityId: source.id });

    // Nếu yêu cầu thêm vào pipeline ngay
    let job = null;
    if (addToPipeline) {
      const autoApprove = await getSetting('auto_approve_pipeline');
      const initialStep = autoApprove ? 'APPROVAL' : 'SOURCING';
      job = await prisma.videoJob.create({
        data: {
          sourceUrl,
          videoSourceId: source.id,
          title: title || null,
          targetChannelId: targetChannelId || null,
          priority: priority || 'NORMAL',
          targetLanguage: targetLanguage || 'vi',
          teamId: req.user.teamId || null,
          assignedToId: req.user.id,
          currentStep: initialStep,
        },
      });
      await logActivity({ userId: req.user.id, action: 'JOB_CREATED', entityType: 'JOB', entityId: job.id });
    }

    return res.status(201).json({ source, job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/sources/bulk
export const bulkCreateSources = async (req, res) => {
  try {
    const { sources, addToPipeline, targetChannelId, priority } = req.body;
    if (!Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({ error: 'Danh sách sources không hợp lệ' });
    }
    const autoApprove = addToPipeline ? await getSetting('auto_approve_pipeline') : false;
    const initialStep = autoApprove ? 'APPROVAL' : 'SOURCING';

    const created = [];
    for (const s of sources) {
      const source = await prisma.videoSource.create({
        data: {
          sourceUrl: s.sourceUrl,
          sourceType: s.sourceType || 'YOUTUBE',
          title: s.title || null,
          addedById: req.user.id,
          teamId: req.user.teamId || null,
        },
      });
      created.push(source);
      if (addToPipeline) {
        await prisma.videoJob.create({
          data: {
            sourceUrl: s.sourceUrl,
            videoSourceId: source.id,
            title: s.title || null,
            targetChannelId: targetChannelId || null,
            priority: priority || 'NORMAL',
            teamId: req.user.teamId || null,
            assignedToId: req.user.id,
            currentStep: initialStep,
          },
        });
      }
    }
    await logActivity({ userId: req.user.id, action: 'SOURCE_BULK_CREATED', metadata: { count: created.length, addToPipeline } });
    return res.status(201).json({ sources: created, count: created.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /api/sources/:id
export const deleteSource = async (req, res) => {
  try {
    await prisma.videoSource.delete({ where: { id: req.params.id } });
    await logActivity({ userId: req.user.id, action: 'SOURCE_DELETED', entityType: 'SOURCE', entityId: req.params.id });
    return res.json({ message: 'Đã xóa nguồn video' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
