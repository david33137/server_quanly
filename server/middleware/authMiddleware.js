import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Không có token xác thực' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { team: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

export default authMiddleware;
