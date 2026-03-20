import prisma from '../lib/prisma.js';
import { logActivity, logJob } from '../services/logService.js';
import { getSetting } from './settingsController.js';

const STEP_ORDER = ['SOURCING', 'APPROVAL', 'PROCESSING', 'WAITING_UPLOAD', 'UPLOADING', 'DONE'];

const getNextStep = (currentStep) => {
  const idx = STEP_ORDER.indexOf(currentStep);
  return idx >= 0 && idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : currentStep;
};

// Helper: MANAGER chỉ được thao tác với job thuộc team mình
const assertJobAccess = async (jobId, user) => {
  if (user.role === 'ADMIN') return null; // Admin không bị giới hạn
  const job = await prisma.videoJob.findUnique({ where: { id: jobId }, select: { id: true, teamId: true } });
  if (!job) return { status: 404, error: 'Job không tồn tại' };
  if (user.role === 'MANAGER' && job.teamId !== user.teamId) {
    return { status: 403, error: 'Không có quyền thao tác với job của team khác' };
  }
  return null; // OK
};



// GET /api/jobs
export const getJobs = async (req, res) => {
  try {
    const { step, teamId, assignedToId, channelId, priority, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (req.user.role !== 'ADMIN') where.teamId = req.user.teamId;
    if (teamId && req.user.role === 'ADMIN') where.teamId = teamId;
    if (step) where.currentStep = step;
    if (assignedToId) where.assignedToId = assignedToId;
    if (channelId) where.targetChannelId = channelId;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { sourceUrl: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [jobs, total] = await Promise.all([
      prisma.videoJob.findMany({
        where,
        include: {
          targetChannel: { select: { id: true, name: true, thumbnailUrl: true } },
          uploadedChannel: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, avatar: true } },
          team: { select: { id: true, name: true } },
          videoSource: { select: { id: true, sourceType: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: parseInt(limit),
      }),
      prisma.videoJob.count({ where }),
    ]);
    return res.json({ jobs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/jobs/stats
export const getJobStats = async (req, res) => {
  try {
    const teamFilter = req.user.role !== 'ADMIN' ? { teamId: req.user.teamId } : {};
    const steps = await prisma.videoJob.groupBy({
      by: ['currentStep'],
      where: teamFilter,
      _count: true,
    });
    const total = await prisma.videoJob.count({ where: teamFilter });
    return res.json({ steps, total });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/jobs/:id
export const getJobById = async (req, res) => {
  try {
    const job = await prisma.videoJob.findUnique({
      where: { id: req.params.id },
      include: {
        targetChannel: true,
        uploadedChannel: true,
        assignedTo: { select: { id: true, name: true, avatar: true } },
        team: true,
        videoSource: true,
        jobLogs: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!job) return res.status(404).json({ error: 'Job không tồn tại' });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/jobs
export const createJob = async (req, res) => {
  try {
    const { sourceUrl, videoSourceId, title, targetChannelId, priority, notes, targetLanguage, assignedToId } = req.body;
    if (!sourceUrl) return res.status(400).json({ error: 'URL nguồn là bắt buộc' });

    const autoApprove = await getSetting('auto_approve_pipeline');
    const initialStep = autoApprove ? 'APPROVAL' : 'SOURCING';

    const job = await prisma.videoJob.create({
      data: {
        sourceUrl,
        videoSourceId: videoSourceId || null,
        title: title || null,
        targetChannelId: targetChannelId || null,
        priority: priority || 'NORMAL',
        notes: notes || null,
        targetLanguage: targetLanguage || 'vi',
        teamId: req.user.teamId || null,
        assignedToId: assignedToId || req.user.id,
        currentStep: initialStep,
      },
      include: {
        targetChannel: { select: { id: true, name: true } },
        assignedTo:    { select: { id: true, name: true } },
        team:          { select: { id: true, name: true } },
      },
    });
    await logJob({
      jobId: job.id,
      step: initialStep,
      message: autoApprove
        ? `Job tạo bởi ${req.user.name} (được tự động duyệt) - URL: ${sourceUrl}`
        : `Job tạo bởi ${req.user.name} - URL: ${sourceUrl}`,
    });
    await logActivity({ userId: req.user.id, action: 'JOB_CREATED', entityType: 'JOB', entityId: job.id });
    return res.status(201).json({ job, autoApproved: autoApprove });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/jobs/:id – Cập nhật thông tin job (tổng quát)
export const updateJob = async (req, res) => {
  try {
    const jobId = req.params.id;

    // MANAGER chỉ được sửa job của team mình
    if (req.user.role === 'MANAGER') {
      const existing = await prisma.videoJob.findUnique({ where: { id: jobId } });
      if (!existing) return res.status(404).json({ error: 'Job không tồn tại' });
      if (existing.teamId !== req.user.teamId) return res.status(403).json({ error: 'Không có quyền sửa job của team khác' });
    }

    // MANAGER không được thay đổi teamId
    const allowedBase = ['title', 'sourceUrl', 'videoSourceId', 'targetChannelId', 'priority', 'targetLanguage', 'notes', 'assignedToId'];
    const allowedAdmin = [...allowedBase, 'teamId'];
    const allowed = req.user.role === 'ADMIN' ? allowedAdmin : allowedBase;

    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key] || null;
    }

    // MANAGER: verify targetChannelId thuộc team mình
    if (data.targetChannelId && req.user.role === 'MANAGER') {
      const ch = await prisma.youTubeChannel.findUnique({ where: { id: data.targetChannelId } });
      if (ch && ch.teamId !== req.user.teamId) {
        return res.status(403).json({ error: 'Không được gán kênh của team khác' });
      }
    }

    // MANAGER: verify assignedToId là thành viên team mình
    if (data.assignedToId && req.user.role === 'MANAGER') {
      const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
      if (assignee && assignee.teamId !== req.user.teamId) {
        return res.status(403).json({ error: 'Chỉ được giao việc cho thành viên trong team mình' });
      }
    }

    const job = await prisma.videoJob.update({
      where: { id: jobId },
      data,
      include: {
        targetChannel: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        videoSource: { select: { id: true, sourceType: true } },
      },
    });
    await logJob({ jobId: job.id, message: `Job cập nhật bởi ${req.user.name}: ${Object.keys(data).join(', ')}` });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};



export const bulkCreateJobs = async (req, res) => {
  try {
    const { jobs: jobList } = req.body;
    if (!Array.isArray(jobList) || jobList.length === 0) {
      return res.status(400).json({ error: 'Danh sách jobs không hợp lệ' });
    }
    const autoApprove = await getSetting('auto_approve_pipeline');
    const initialStep = autoApprove ? 'APPROVAL' : 'SOURCING';
    const created = [];
    for (const j of jobList) {
      if (!j.sourceUrl) continue;
      const job = await prisma.videoJob.create({
        data: {
          sourceUrl: j.sourceUrl,
          title: j.title || null,
          targetChannelId: j.targetChannelId || null,
          priority: j.priority || 'NORMAL',
          notes: j.notes || null,
          targetLanguage: j.targetLanguage || 'vi',
          teamId: req.user.teamId || null,
          assignedToId: req.user.id,
          currentStep: initialStep,
        },
      });
      await logJob({ jobId: job.id, step: initialStep, message: `Bulk job tạo bởi ${req.user.name}${autoApprove ? ' (tự dỳng)' : ''}` });
      created.push(job);
    }
    await logActivity({ userId: req.user.id, action: 'JOB_BULK_CREATED', metadata: { count: created.length } });
    return res.status(201).json({ jobs: created, count: created.length, autoApproved: autoApprove });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/jobs/:id/assign-channel
export const assignChannel = async (req, res) => {
  try {
    const err = await assertJobAccess(req.params.id, req.user);
    if (err) return res.status(err.status).json({ error: err.error });
    const { targetChannelId } = req.body;
    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: { targetChannelId },
      include: { targetChannel: { select: { id: true, name: true } } },
    });
    await logJob({ jobId: job.id, message: `Gán kênh: ${job.targetChannel?.name}` });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


// POST /api/jobs/:id/approve (MANAGER+)
// Duyệt job: chuyển từ SOURCING → APPROVAL (Chờ xử lý)
// Worker sẽ tự kéo từ APPROVAL → PROCESSING khi bắt đầu xử lý
export const approveJob = async (req, res) => {
  try {
    const accessErr = await assertJobAccess(req.params.id, req.user);
    if (accessErr) return res.status(accessErr.status).json({ error: accessErr.error });
    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: { currentStep: 'APPROVAL' },
    });
    await logJob({ jobId: job.id, step: 'APPROVAL', message: `Duyệt bởi ${req.user.name} – đang chờ worker xử lý`, level: 'INFO' });
    await logActivity({ userId: req.user.id, action: 'JOB_APPROVED', entityType: 'JOB', entityId: job.id });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/jobs/:id/start-upload
// Bắt đầu upload: WAITING_UPLOAD → UPLOADING (user hoặc worker nhận task upload)
export const startUpload = async (req, res) => {
  try {
    const { note } = req.body;
    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: {
        currentStep: 'UPLOADING',
        assignedToId: req.body.assignedToId || req.user.id,
        lockedBy: req.user.id,
        lockedAt: new Date(),
      },
    });
    await logJob({ jobId: job.id, step: 'UPLOADING', message: `Bắt đầu upload bởi ${req.user.name}${note ? ' – ' + note : ''}` });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/jobs/:id/move-step
// Chuyển thủ công giữa các bước (dùng cho drag & drop manual)
// Body: { targetStep, note, outputPath, duration, assignedToId }
const VALID_FORWARD = {
  SOURCING: ['APPROVAL'],
  APPROVAL: ['PROCESSING'],
  PROCESSING: ['WAITING_UPLOAD'],
  WAITING_UPLOAD: ['UPLOADING'],
  UPLOADING: ['DONE'],
};
export const moveStep = async (req, res) => {
  try {
    const accessErr = await assertJobAccess(req.params.id, req.user);
    if (accessErr) return res.status(accessErr.status).json({ error: accessErr.error });

    const { targetStep, note, outputPath, duration, assignedToId } = req.body;
    if (!targetStep) return res.status(400).json({ error: 'targetStep là bắt buộc' });
    const existing = await prisma.videoJob.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Job không tồn tại' });


    const updateData = { currentStep: targetStep };
    if (assignedToId) updateData.assignedToId = assignedToId;
    if (targetStep === 'PROCESSING') {
      updateData.lockedBy = req.user.id;
      updateData.lockedAt = new Date();
      updateData.startedAt = new Date();
    }
    if (targetStep === 'WAITING_UPLOAD') {
      updateData.lockedBy = null;
      updateData.lockedAt = null;
      if (outputPath) updateData.outputPath = outputPath;
      if (duration) updateData.duration = duration;
    }
    if (targetStep === 'UPLOADING') {
      updateData.lockedBy = req.user.id;
      updateData.lockedAt = new Date();
    }
    if (targetStep === 'DONE') {
      updateData.completedAt = new Date();
      updateData.lockedBy = null;
      updateData.lockedAt = null;
    }

    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: updateData,
    });
    await logJob({
      jobId: job.id,
      step: targetStep,
      message: `[THỦ CÔNG] ${existing.currentStep} → ${targetStep} bởi ${req.user.name}${note ? ' – ' + note : ''}`,
      level: 'INFO',
    });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/jobs/:id/assign (MANAGER, assign to user)
export const assignJob = async (req, res) => {
  try {
    const accessErr = await assertJobAccess(req.params.id, req.user);
    if (accessErr) return res.status(accessErr.status).json({ error: accessErr.error });

    const { assignedToId } = req.body;

    // MANAGER chỉ được giao việc cho thành viên team mình
    if (assignedToId && req.user.role === 'MANAGER') {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { teamId: true } });
      if (assignee && assignee.teamId !== req.user.teamId) {
        return res.status(403).json({ error: 'Chỉ được giao việc cho thành viên trong team mình' });
      }
    }

    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: { assignedToId },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    await logJob({ jobId: job.id, message: `Giao cho: ${job.assignedTo?.name}` });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


// POST /api/jobs/:id/mark-uploaded
export const markUploaded = async (req, res) => {
  try {
    const { uploadedUrl, uploadedChannelId } = req.body;
    if (!uploadedUrl || !uploadedChannelId) {
      return res.status(400).json({ error: 'Link upload và kênh đã upload là bắt buộc' });
    }
    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: {
        uploadedUrl,
        uploadedChannelId,
        currentStep: 'DONE',
        completedAt: new Date(),
      },
    });
    await logJob({ jobId: job.id, step: 'DONE', message: `Upload hoàn tất bởi ${req.user.name} - ${uploadedUrl}` });
    await logActivity({ userId: req.user.id, action: 'JOB_UPLOADED', entityType: 'JOB', entityId: job.id, metadata: { uploadedUrl } });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/jobs/:id/fail
export const failJob = async (req, res) => {
  try {
    const { errorMessage } = req.body;
    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: { currentStep: 'FAILED', errorMessage: errorMessage || 'Lỗi không xác định', lockedBy: null, lockedAt: null },
    });
    await logJob({ jobId: job.id, step: 'FAILED', message: errorMessage || 'Job thất bại', level: 'ERROR' });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/jobs/:id/requeue (retry failed job)
export const requeueJob = async (req, res) => {
  try {
    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: { currentStep: 'APPROVAL', errorMessage: null, lockedBy: null, lockedAt: null, progress: 0 },
    });
    await logJob({ jobId: job.id, message: `Job được đặt lại bởi ${req.user.name}`, level: 'WARN' });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /api/jobs/:id
export const deleteJob = async (req, res) => {
  try {
    await prisma.videoJob.delete({ where: { id: req.params.id } });
    await logActivity({ userId: req.user.id, action: 'JOB_DELETED', entityType: 'JOB', entityId: req.params.id });
    return res.json({ message: 'Đã xóa job' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
