import { useState, useEffect, useCallback } from 'react';
import { workerAPI, logAPI } from '../api/index.js';
import toast from 'react-hot-toast';
import { Plus, Trash2, Copy, X, RefreshCw } from 'lucide-react';

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState(null);
  const [creating, setCreating] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wr, tr] = await Promise.all([logAPI.getWorkers(), workerAPI.getTokens()]);
      setWorkers(wr.data.workers);
      setTokens(tr.data.tokens);
    } catch (err) { toast.error('Lỗi tải dữ liệu'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreateToken = async (e) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    setCreating(true);
    try {
      const res = await workerAPI.createToken(newTokenName);
      setCreatedToken(res.data);
      setNewTokenName('');
      fetchAll();
      toast.success('Đã tạo Worker Token');
    } catch (err) { toast.error('Lỗi'); }
    setCreating(false);
  };

  const handleRevoke = async (id) => {
    try { await workerAPI.updateToken(id, { isActive: false }); fetchAll(); toast.success('Đã revoke'); }
    catch { toast.error('Lỗi'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa token này?')) return;
    try { await workerAPI.deleteToken(id); fetchAll(); toast.success('Đã xóa'); }
    catch { toast.error('Lỗi'); }
  };

  const copyToken = (token) => {
    navigator.clipboard.writeText(token);
    toast.success('Đã copy token!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Workers</div>
          <div className="page-subtitle">Quản lý máy xử lý video</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll}><RefreshCw size={14}/> Làm mới</button>
      </div>
      <div className="page-content">
        {/* Online Workers */}
        <div className="mb-6">
          <div className="section-title mb-4" style={{ fontSize: 15 }}>Trạng thái Workers</div>
          {loading ? <div className="spinner" style={{ margin: '20px auto' }} /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {workers.map(w => (
                <div className="card" key={w.id} style={{ borderColor: w.isOnline ? 'rgba(16,185,129,0.4)' : 'var(--border)' }}>
                  <div className="flex items-center gap-2 mb-4" style={{ marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: w.isOnline ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0, boxShadow: w.isOnline ? '0 0 8px var(--green)' : 'none' }} />
                    <strong style={{ fontSize: 14 }}>{w.name}</strong>
                    <span className={`badge ${w.isOnline ? 'badge-green' : 'badge-gray'}`} style={{ marginLeft: 'auto' }}>{w.isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {w.ipAddress && <div>IP: {w.ipAddress}</div>}
                    <div>Lần cuối: {w.lastSeen ? new Date(w.lastSeen).toLocaleString('vi-VN') : 'Chưa kết nối'}</div>
                    {!w.isActive && <div style={{ color: 'var(--red)', marginTop: 4 }}>⚠ Token bị revoke</div>}
                  </div>
                </div>
              ))}
              {workers.length === 0 && <div className="text-muted text-sm">Chưa có worker nào kết nối</div>}
            </div>
          )}
        </div>

        {/* Token management */}
        <div className="mb-6">
          <div className="section-title mb-4" style={{ fontSize: 15 }}>Tạo Worker Token</div>
          <form onSubmit={handleCreateToken} style={{ display: 'flex', gap: 12, maxWidth: 480 }}>
            <input className="form-control" placeholder="Tên worker (vd: GPU-Server-1)" value={newTokenName} onChange={e => setNewTokenName(e.target.value)} required />
            <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? <span className="spinner" /> : <Plus size={16}/>} Tạo</button>
          </form>
        </div>

        {createdToken && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 20, marginBottom: 24, maxWidth: 640 }}>
            <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>✅ Token được tạo thành công!</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>⚠ Đây là lần duy nhất bạn thấy token này. Hãy lưu lại ngay!</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 8, flex: 1, fontSize: 12, wordBreak: 'break-all' }}>
                {createdToken.plainToken}
              </code>
              <button className="btn btn-secondary btn-sm" onClick={() => copyToken(createdToken.plainToken)}><Copy size={14}/></button>
              <button className="btn-icon" onClick={() => setCreatedToken(null)}><X size={14}/></button>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              Dùng lệnh: <code>node worker.js --token {createdToken.plainToken} --api http://localhost:3031</code>
            </div>
          </div>
        )}

        <div className="section-title mb-4" style={{ fontSize: 15 }}>Danh sách Tokens</div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Tên</th><th>Trạng thái</th><th>Lần cuối thấy</th><th>IP</th><th>Ngày tạo</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {tokens.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td><span className={`badge ${t.isActive ? 'badge-green' : 'badge-gray'}`}>{t.isActive ? 'Hoạt động' : 'Revoked'}</span></td>
                  <td className="text-muted text-sm">{t.lastSeen ? new Date(t.lastSeen).toLocaleString('vi-VN') : '—'}</td>
                  <td className="text-muted text-sm">{t.ipAddress || '—'}</td>
                  <td className="text-muted text-sm">{new Date(t.createdAt).toLocaleDateString('vi-VN')}</td>
                  <td>
                    <div className="flex gap-2">
                      {t.isActive && <button className="btn btn-secondary btn-sm" onClick={() => handleRevoke(t.id)}>Revoke</button>}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {tokens.length === 0 && <tr><td colSpan={6}><div className="empty-state">Chưa có token nào</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
