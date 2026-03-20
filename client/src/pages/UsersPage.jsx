import { useState, useEffect, useCallback } from 'react';
import { authAPI, teamAPI } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import { Plus, Edit2, X } from 'lucide-react';

const ROLE_BADGE = { ADMIN: 'badge-red', MANAGER: 'badge-orange', EDITOR: 'badge-purple', SOURCER: 'badge-blue', VIEWER: 'badge-gray' };
const ROLE_LABEL = { ADMIN: 'Admin', MANAGER: 'Manager', EDITOR: 'Editor', SOURCER: 'Sourcer', VIEWER: 'Viewer' };

function UserModal({ user, teams, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SOURCER', teamId: '', isActive: true, ...user });
  const [loading, setLoading] = useState(false);
  const isEdit = !!user?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) await authAPI.updateUser(user.id, form);
      else await authAPI.register(form);
      toast.success(isEdit ? 'Đã cập nhật' : 'Đã tạo người dùng');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? '✏️ Sửa User' : '➕ Tạo User'}</div>
          <button className="btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Họ tên *</label>
              <input className="form-control" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required disabled={isEdit} />
            </div>
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Mật khẩu *</label>
                <input className="form-control" type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required />
              </div>
            )}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-control" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                  <option value="SOURCER">Sourcer</option>
                  <option value="EDITOR">Editor</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Team</label>
                <select className="form-control" value={form.teamId||''} onChange={e => setForm(f => ({...f, teamId: e.target.value}))}>
                  <option value="">-- Không gán --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            {isEdit && (
              <div className="form-group">
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({...f, isActive: e.target.checked}))} />
                  <span className="form-label" style={{ margin: 0 }}>Tài khoản đang hoạt động</span>
                </label>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{isEdit ? 'Lưu' : 'Tạo'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ur, tr] = await Promise.all([authAPI.getUsers(), teamAPI.getAll()]);
      setUsers(ur.data.users);
      setTeams(tr.data.teams);
    } catch (err) { toast.error('Lỗi'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <div className="page-title">👤 Người dùng</div>
          <div className="page-subtitle">Quản lý tài khoản hệ thống</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={16}/> Tạo tài khoản</button>
      </div>
      <div className="page-content">
        {loading ? <div style={{ textAlign: 'center', paddingTop: 80 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Người dùng</th><th>Email</th><th>Role</th><th>Team</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{u.name?.[0]}</div>
                        <strong>{u.name}</strong>
                      </div>
                    </td>
                    <td className="text-muted">{u.email}</td>
                    <td><span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span></td>
                    <td>{u.team?.name || <span className="text-muted">—</span>}</td>
                    <td><span className={`badge ${u.isActive ? 'badge-green' : 'badge-gray'}`}>{u.isActive ? 'Hoạt động' : 'Vô hiệu'}</span></td>
                    <td className="text-muted text-sm">{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td><button className="btn-icon" onClick={() => setModal(u)}><Edit2 size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && <UserModal user={modal === 'new' ? null : modal} teams={teams} onClose={() => setModal(null)} onSaved={() => { setModal(null); fetchAll(); }} />}
    </div>
  );
}
