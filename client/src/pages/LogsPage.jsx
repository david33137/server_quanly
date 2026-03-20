import { useState, useEffect, useCallback } from 'react';
import { logAPI } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const ACTION_LABELS = {
  USER_LOGIN: 'Đăng nhập', JOB_CREATED: 'Tạo job', JOB_APPROVED: 'Duyệt job',
  JOB_UPDATED: 'Sửa job', JOB_UPLOADED: 'Upload xong', JOB_DELETED: 'Xóa job',
  JOB_BULK_CREATED: 'Tạo bulk jobs', JOB_FAILED: 'Job thất bại', JOB_REQUEUED: 'Requeue job',
  GMAIL_CREATED: 'Thêm Gmail', GMAIL_UPDATED: 'Sửa Gmail', GMAIL_DELETED: 'Xóa Gmail',
  GMAIL_PASSWORD_REVEALED: '🔑 Xem mật khẩu Gmail', GMAIL_BULK_CREATED: 'Bulk import Gmail',
  CHANNEL_CREATED: 'Thêm kênh', CHANNEL_UPDATED: 'Sửa kênh', CHANNEL_DELETED: 'Xóa kênh',
  TEAM_CREATED: 'Tạo team', TEAM_UPDATED: 'Sửa team', TEAM_DELETED: 'Xóa team',
  TEAM_MEMBER_ADDED: 'Thêm thành viên', TEAM_MEMBER_REMOVED: 'Xóa thành viên',
  USER_CREATED: 'Tạo user', USER_UPDATED: 'Sửa user', USER_DELETED: 'Xóa user',
  WORKER_TOKEN_CREATED: 'Tạo Worker Token',
};

const ACTION_COLORS = {
  USER_LOGIN: 'badge-blue', JOB_CREATED: 'badge-green', JOB_APPROVED: 'badge-purple',
  JOB_UPDATED: 'badge-blue', JOB_UPLOADED: 'badge-green', JOB_DELETED: 'badge-red',
  JOB_BULK_CREATED: 'badge-green', GMAIL_PASSWORD_REVEALED: 'badge-red',
  GMAIL_BULK_CREATED: 'badge-green',
  USER_DELETED: 'badge-red', TEAM_DELETED: 'badge-red', CHANNEL_DELETED: 'badge-red',
  GMAIL_DELETED: 'badge-red', WORKER_TOKEN_CREATED: 'badge-orange',
  JOB_FAILED: 'badge-red', JOB_REQUEUED: 'badge-yellow',
};

export default function LogsPage() {
  const { isAtLeast, user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [scopedToTeam, setScopedToTeam] = useState(false);
  const [filter, setFilter] = useState({ entityType: '', action: '' });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await logAPI.getActivity({ page, limit: 50, ...filter });
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setScopedToTeam(res.data.scopedToTeam || false);
    } catch (err) { toast.error('Lỗi tải log'); }
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <div className="page-title">📋 Activity Log</div>
          <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Lịch sử hoạt động {scopedToTeam ? 'của team' : 'hệ thống'} ({total} bản ghi)
            {scopedToTeam && (
              <span style={{
                fontSize: 11, background: 'rgba(245,158,11,0.15)', color: 'var(--yellow)',
                border: '1px solid rgba(245,158,11,0.3)', borderRadius: 100, padding: '2px 10px',
              }}>
                🔒 Chỉ hiển thị log team của bạn
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchLogs}><RefreshCw size={14}/> Làm mới</button>
      </div>
      <div className="page-content">
        <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 200 }} value={filter.entityType} onChange={e => setFilter(f => ({...f, entityType: e.target.value}))}>
            <option value="">Tất cả loại</option>
            <option value="JOB">Job</option>
            <option value="CHANNEL">Channel</option>
            <option value="GMAIL">Gmail</option>
            {isAtLeast('ADMIN') && <option value="USER">User</option>}
            <option value="TEAM">Team</option>
            {isAtLeast('ADMIN') && <option value="WORKER">Worker</option>}
          </select>
          <input className="form-control" style={{ width: 240 }} placeholder="Tìm theo action..." value={filter.action} onChange={e => setFilter(f => ({...f, action: e.target.value}))} />
        </div>
        {loading ? <div style={{ textAlign: 'center', paddingTop: 60 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người dùng</th>
                  {isAtLeast('ADMIN') && <th>Team</th>}
                  <th>Hành động</th>
                  <th>Loại</th>
                  {isAtLeast('ADMIN') && <th>IP</th>}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{log.user?.name?.[0] || '?'}</div>
                        <div>
                          <div style={{ fontSize: 13 }}>{log.user?.name || 'System'}</div>
                          {isAtLeast('ADMIN') && log.user?.role && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{log.user.role}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {isAtLeast('ADMIN') && (
                      <td className="text-muted text-sm">{log.user?.team?.name || '—'}</td>
                    )}
                    <td><span className={`badge ${ACTION_COLORS[log.action] || 'badge-gray'}`}>{ACTION_LABELS[log.action] || log.action}</span></td>
                    <td className="text-muted text-sm">{log.entityType || '—'}</td>
                    {isAtLeast('ADMIN') && <td className="text-muted text-sm">{log.ipAddress || '—'}</td>}
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={isAtLeast('ADMIN') ? 6 : 4}><div className="empty-state">Chưa có log nào</div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {total > 50 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Trước</button>
            <span className="text-muted text-sm" style={{ lineHeight: '32px', padding: '0 12px' }}>Trang {page}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={logs.length < 50}>Sau →</button>
          </div>
        )}
      </div>
    </div>
  );
}
