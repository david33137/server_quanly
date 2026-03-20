import { useState, useEffect } from 'react';
import { logAPI, jobAPI, channelAPI } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { GitBranch, Youtube, Mail, Users, CheckCircle, AlertCircle, Loader, Clock } from 'lucide-react';

const STEP_COLORS = {
  SOURCING: '#3b82f6', APPROVAL: '#f59e0b', PROCESSING: '#8b5cf6',
  WAITING_UPLOAD: '#06b6d4', UPLOADING: '#f97316', DONE: '#10b981', FAILED: '#ef4444',
};
const STEP_LABELS = {
  SOURCING: 'Đề xuất', APPROVAL: 'Chờ duyệt', PROCESSING: 'Xử lý',
  WAITING_UPLOAD: 'Chờ upload', UPLOADING: 'Đang upload', DONE: 'Hoàn tất', FAILED: 'Thất bại',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logAPI.getDashboard()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div><div className="page-title">Dashboard</div><div className="page-subtitle">Tổng quan hệ thống</div></div>
      </div>
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner spinner-lg" />
      </div>
    </div>
  );

  const stats = data?.stats || {};
  const stepStats = data?.stepStats || [];
  const pieData = stepStats.map(s => ({ name: STEP_LABELS[s.currentStep] || s.currentStep, value: s._count, color: STEP_COLORS[s.currentStep] }));

  const statCards = [
    { label: 'Tổng Jobs', value: stats.totalJobs || 0, icon: GitBranch, color: 'var(--accent)', bg: 'rgba(59,130,246,0.12)' },
    { label: 'Hoàn tất', value: stats.doneJobs || 0, icon: CheckCircle, color: 'var(--green)', bg: 'var(--green-bg)' },
    { label: 'Đang xử lý', value: stats.processingJobs || 0, icon: Loader, color: 'var(--purple)', bg: 'var(--purple-bg)' },
    { label: 'Thất bại', value: stats.failedJobs || 0, icon: AlertCircle, color: 'var(--red)', bg: 'var(--red-bg)' },
    { label: 'Kênh YouTube', value: stats.totalChannels || 0, icon: Youtube, color: 'var(--red)', bg: 'var(--red-bg)' },
    { label: 'Gmail', value: stats.totalGmails || 0, icon: Mail, color: 'var(--yellow)', bg: 'var(--yellow-bg)' },
    ...(stats.totalUsers != null ? [{ label: 'Người dùng', value: stats.totalUsers, icon: Users, color: 'var(--cyan)', bg: 'var(--cyan-bg)' }] : []),
  ];

  const ACTION_LABELS = {
    USER_LOGIN: 'Đăng nhập', JOB_CREATED: 'Tạo job', JOB_APPROVED: 'Duyệt job',
    JOB_UPLOADED: 'Upload xong', GMAIL_CREATED: 'Thêm Gmail', CHANNEL_CREATED: 'Thêm kênh',
    TEAM_CREATED: 'Tạo team', WORKER_TOKEN_CREATED: 'Tạo Worker Token',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Xin chào, {user?.name}! 👋</div>
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid">
          {statCards.map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-icon" style={{ background: s.bg }}>
                <s.icon size={22} style={{ color: s.color }} />
              </div>
              <div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Bar chart – pipeline steps */}
          <div className="card">
            <div className="section-title mb-4" style={{ fontSize: 15 }}>Phân bố Pipeline</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stepStats.map(s => ({ name: STEP_LABELS[s.currentStep] || s.currentStep, count: s._count, fill: STEP_COLORS[s.currentStep] }))}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stepStats.map((s, i) => <Cell key={i} fill={STEP_COLORS[s.currentStep] || '#3b82f6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          <div className="card">
            <div className="section-title mb-4" style={{ fontSize: 15 }}>Tỷ lệ Job</div>
            {pieData.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={2} stroke="var(--bg-card)">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  {pieData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="empty-state"><div>Chưa có dữ liệu</div></div>}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="section-title mb-4" style={{ fontSize: 15 }}>Hoạt động gần đây</div>
          {data?.recentActivity?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {data.recentActivity.map(log => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                    {log.user?.name?.[0] || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{log.user?.name || 'System'}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}> - {ACTION_LABELS[log.action] || log.action}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><div>Chưa có hoạt động</div></div>}
        </div>
      </div>
    </div>
  );
}
