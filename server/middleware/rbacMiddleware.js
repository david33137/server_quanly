// RBAC role hierarchy
const ROLE_LEVEL = {
  ADMIN: 5,
  MANAGER: 4,
  EDITOR: 3,
  SOURCER: 2,
  VIEWER: 1,
};

/**
 * Require a minimum role level
 * Usage: requireRole('MANAGER')
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    next();
  };
};

/**
 * Require at least a minimum role level
 * e.g. requireMinRole('MANAGER') allows MANAGER, ADMIN
 */
export const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực' });
    }
    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    const requiredLevel = ROLE_LEVEL[minRole] || 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: 'Không đủ quyền hạn' });
    }
    next();
  };
};

export default { requireRole, requireMinRole };
