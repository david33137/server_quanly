import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { logJob, logActivity } from '../services/logService.js';

// GET /api/worker/jobs/next – Worker pulls next available job
// Worker kéo job từ APPROVAL (chờ xử lý) và tự chuyển sang PROCESSING
export const getNextJob = async (req, res) => {
  try {
    const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const lockExpiry = new Date(Date.now() - LOCK_TIMEOUT_MS);

    // Tìm job ở bước APPROVAL chưa bị lock (hoặc lock đã hết hạn)
    const job = await prisma.videoJob.findFirst({
      where: {
        currentStep: 'APPROVAL',
        OR: [
          { lockedBy: null },
          { lockedAt: { lt: lockExpiry } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (!job) return res.json({ job: null, message: 'Không có job nào chờ xử lý' });

    // Lock job VÀ chuyển sang PROCESSING ngay khi worker nhận
    const locked = await prisma.videoJob.update({
      where: { id: job.id },
      data: {
        currentStep: 'PROCESSING',
        lockedBy: req.worker.id,
        lockedAt: new Date(),
        startedAt: job.startedAt || new Date(),
      },
    });
    await logJob({ jobId: job.id, step: 'PROCESSING', message: `Worker ${req.worker.name} bắt đầu xử lý` });
    return res.json({ job: locked });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/worker/jobs/batch
// Worker kéo nhiều job từ APPROVAL và chuyển sang PROCESSING
export const getBatchJobs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const LOCK_TIMEOUT_MS = 30 * 60 * 1000;
    const lockExpiry = new Date(Date.now() - LOCK_TIMEOUT_MS);
    const jobs = await prisma.videoJob.findMany({
      where: {
        currentStep: 'APPROVAL',
        OR: [{ lockedBy: null }, { lockedAt: { lt: lockExpiry } }],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });
    // Lock all found jobs và chuyển sang PROCESSING
    const updated = [];
    for (const j of jobs) {
      const u = await prisma.videoJob.update({
        where: { id: j.id },
        data: { currentStep: 'PROCESSING', lockedBy: req.worker.id, lockedAt: new Date(), startedAt: j.startedAt || new Date() },
      });
      updated.push(u);
    }
    return res.json({ jobs: updated, count: updated.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PUT /api/worker/jobs/:id/status
export const updateJobStatus = async (req, res) => {
  try {
    const { status, progress, message } = req.body;
    const updateData = {};
    if (progress !== undefined) updateData.progress = parseInt(progress);
    if (message) await logJob({ jobId: req.params.id, step: status, message, level: 'INFO' });
    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: updateData,
    });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/worker/jobs/:id/complete
export const completeJob = async (req, res) => {
  try {
    const { outputPath, subtitlesPath, duration } = req.body;
    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: {
        currentStep: 'WAITING_UPLOAD',
        outputPath: outputPath || null,
        subtitlesPath: subtitlesPath || null,
        lockedBy: null,
        lockedAt: null,
        progress: 100,
      },
    });
    await logJob({ jobId: job.id, step: 'WAITING_UPLOAD', message: `Xử lý hoàn tất. Output: ${outputPath}. Duration: ${duration}`, level: 'INFO' });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/worker/jobs/:id/fail
export const failJobByWorker = async (req, res) => {
  try {
    const { errorMessage } = req.body;
    const job = await prisma.videoJob.update({
      where: { id: req.params.id },
      data: { currentStep: 'FAILED', errorMessage, lockedBy: null, lockedAt: null },
    });
    await logJob({ jobId: job.id, step: 'FAILED', message: `Worker báo lỗi: ${errorMessage}`, level: 'ERROR' });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/worker/heartbeat
export const workerHeartbeat = async (req, res) => {
  try {
    await prisma.workerToken.update({
      where: { id: req.worker.id },
      data: { lastSeen: new Date(), ipAddress: req.ip },
    });
    return res.json({ status: 'ok', timestamp: new Date() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Admin: Worker Token Management ──────────────────────────────

// GET /api/worker/tokens (Admin)
export const getWorkerTokens = async (req, res) => {
  try {
    const tokens = await prisma.workerToken.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ tokens: tokens.map(t => ({ ...t, tokenHash: undefined })) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/worker/tokens (Admin)
export const createWorkerToken = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Tên worker là bắt buộc' });
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(plainToken, 10);
    const token = await prisma.workerToken.create({ data: { name, tokenHash } });
    await logActivity({ userId: req.user.id, action: 'WORKER_TOKEN_CREATED', entityType: 'WORKER', entityId: token.id });
    // Return plain token ONCE (will not be retrievable later)
    return res.status(201).json({ token: { ...token, tokenHash: undefined }, plainToken, message: 'Lưu token này lại, sẽ không hiển thị lại!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/worker/tokens/:id (Admin revoke/activate)
export const updateWorkerToken = async (req, res) => {
  try {
    const { isActive } = req.body;
    const token = await prisma.workerToken.update({
      where: { id: req.params.id },
      data: { isActive },
    });
    return res.json({ token: { ...token, tokenHash: undefined } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /api/worker/tokens/:id
export const deleteWorkerToken = async (req, res) => {
  try {
    await prisma.workerToken.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Đã xóa Worker token' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
