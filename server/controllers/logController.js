import prisma from '../lib/prisma.js';

// GET /api/logs/activity
export const getActivityLogs = async (req, res) => {
  try {
    const { userId, entityType, action, startDate, endDate, page = 1, limit = 50 } = req.query;
    const where = {};

    // MANAGER chỉ xem log của thành viên trong team mình
    if (req.user.role === 'MANAGER' && req.user.teamId) {
      where.user = { teamId: req.user.teamId };
    }

    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, role: true, team: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.activityLog.count({ where }),
    ]);
    return res.json({ logs, total, page: parseInt(page), limit: parseInt(limit), scopedToTeam: req.user.role === 'MANAGER' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


// GET /api/logs/jobs/:id
export const getJobLogs = async (req, res) => {
  try {
    const logs = await prisma.jobLog.findMany({
      where: { jobId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ logs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/logs/workers
export const getWorkerStatus = async (req, res) => {
  try {
    const workers = await prisma.workerToken.findMany({
      orderBy: { lastSeen: 'desc' },
    });
    const ONLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes
    const now = Date.now();
    const enriched = workers.map(w => ({
      id: w.id,
      name: w.name,
      isActive: w.isActive,
      isOnline: w.lastSeen ? (now - new Date(w.lastSeen).getTime()) < ONLINE_THRESHOLD : false,
      lastSeen: w.lastSeen,
      ipAddress: w.ipAddress,
      currentJobId: w.currentJobId,
      createdAt: w.createdAt,
    }));
    return res.json({ workers: enriched });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/logs/dashboard-stats
export const getDashboardStats = async (req, res) => {
  try {
    const teamFilter = req.user.role !== 'ADMIN' ? { teamId: req.user.teamId } : {};
    const [
      totalJobs, doneJobs, failedJobs, processingJobs, totalChannels, totalGmails, totalUsers,
      recentActivity, stepStats
    ] = await Promise.all([
      prisma.videoJob.count({ where: teamFilter }),
      prisma.videoJob.count({ where: { ...teamFilter, currentStep: 'DONE' } }),
      prisma.videoJob.count({ where: { ...teamFilter, currentStep: 'FAILED' } }),
      prisma.videoJob.count({ where: { ...teamFilter, currentStep: 'PROCESSING' } }),
      prisma.youTubeChannel.count({ where: teamFilter }),
      prisma.gmailAccount.count({ where: teamFilter }),
      req.user.role === 'ADMIN' ? prisma.user.count({ where: { isActive: true } }) : Promise.resolve(null),
      prisma.activityLog.findMany({
        where: teamFilter.teamId ? { user: { teamId: teamFilter.teamId } } : {},
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.videoJob.groupBy({ by: ['currentStep'], where: teamFilter, _count: true }),
    ]);
    return res.json({
      stats: { totalJobs, doneJobs, failedJobs, processingJobs, totalChannels, totalGmails, totalUsers },
      recentActivity,
      stepStats,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
