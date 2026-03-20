import prisma from '../lib/prisma.js';

/**
 * Helper to record activity logs
 */
export const logActivity = async ({ userId, action, entityType, entityId, metadata, ipAddress }) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId: userId || null,
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        metadata: metadata || null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (err) {
    // Don't fail the main request if logging fails
    console.error('Activity log error:', err.message);
  }
};

/**
 * Helper to record job-specific logs
 */
export const logJob = async ({ jobId, step, message, level = 'INFO', metadata }) => {
  try {
    await prisma.jobLog.create({
      data: {
        jobId,
        step: step || null,
        message,
        level,
        metadata: metadata || null,
      },
    });
  } catch (err) {
    console.error('Job log error:', err.message);
  }
};

export default { logActivity, logJob };
