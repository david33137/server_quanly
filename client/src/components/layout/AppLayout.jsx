import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  LayoutDashboard, GitBranch, Search, Youtube, Mail, Users, UserCog,
  Server, FileText, LogOut, Settings
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'Tổng quan' },
  { to: '/pipeline', icon: GitBranch, label: 'Pipeline', section: 'Công việc' },
  { to: '/sources', icon: Search, label: 'Nguồn Video', section: 'Công việc' },
  { to: '/channels', icon: Youtube, label: 'Kênh YouTube', section: 'Tài nguyên' },
  { to: '/gmail', icon: Mail, label: 'Gmail', section: 'Tài nguyên', minRole: 'MANAGER' },
  { to: '/teams', icon: Users, label: 'Teams', section: 'Hệ thống', minRole: 'MANAGER' },
  { to: '/users', icon: UserCog, label: 'Người dùng', section: 'Hệ thống', minRole: 'ADMIN' },
  { to: '/workers', icon: Server, label: 'Workers', section: 'Hệ thống', minRole: 'ADMIN' },
  { to: '/logs', icon: FileText, label: 'Activity Log', section: 'Hệ thống', minRole: 'MANAGER' },
  { to: '/settings', icon: Settings, label: 'Cài đặt', section: 'Hệ thống', minRole: 'ADMIN' },
];

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên', MANAGER: 'Trưởng nhóm',
  EDITOR: 'Biên tập viên', SOURCER: 'Tìm nguồn', VIEWER: 'Xem'
};

export default function AppLayout() {
  const { user, logout, isAtLeast } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  // Group nav items by section
  const sections = {};
  navItems.forEach(item => {
    if (item.minRole && !isAtLeast(item.minRole)) return;
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  const initials = user?.name?.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase() || 'U';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🎬</div>
          <div>
            <div className="logo-text">YT Reup</div>
            <div className="logo-sub">Management System</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <div className="nav-section-label">{section}</div>
              {items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card" onClick={handleLogout} title="Đăng xuất">
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{ROLE_LABELS[user?.role]}</div>
            </div>
            <LogOut size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
