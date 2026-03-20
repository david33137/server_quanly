import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

/**
 * Middleware to authenticate Worker API calls
 * Workers use Bearer token in Authorization header (NOT JWT)
 */
export const workerAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Thiếu Worker token' });
    }
    const token = authHeader.split(' ')[1];

    // Find all active worker tokens and check hash
    const workers = await prisma.workerToken.findMany({
      where: { isActive: true },
    });

    let matchedWorker = null;
    for (const worker of workers) {
      const isMatch = await bcrypt.compare(token, worker.tokenHash);
      if (isMatch) {
        matchedWorker = worker;
        break;
      }
    }

    if (!matchedWorker) {
      return res.status(401).json({ error: 'Worker token không hợp lệ' });
    }

    // Update last seen & IP
    await prisma.workerToken.update({
      where: { id: matchedWorker.id },
      data: {
        lastSeen: new Date(),
        ipAddress: req.ip,
      },
    });

    req.worker = matchedWorker;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi xác thực worker' });
  }
};

export default workerAuthMiddleware;
