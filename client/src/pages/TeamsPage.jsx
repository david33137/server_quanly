import { useState, useEffect, useCallback } from 'react';
import { teamAPI, authAPI } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import { Plus, Trash2, UserPlus, UserMinus, X, Edit2 } from 'lucide-react';

// ADMIN-only: create/edit team modal
function TeamModal({ team, users, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', managerId: '', ...team });
  const [loading, setLoading] = useState(false);
  const isEdit = !!team?.id;
  const managers = users.filter(u => ['ADMIN', 'MANAGER'].includes(u.role));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) await teamAPI.update(team.id, form);
      else await teamAPI.create(form);
      toast.success(isEdit ? 'Đã cập nhật team' : 'Đã tạo team');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? '✏️ Sửa Team' : '➕ Tạo Team'}</div>
          <button className="btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Tên team *</label>
              <input className="form-control" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Mô tả</label>
              <textarea className="form-control" rows={2} value={form.description||''} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Trưởng nhóm</label>
              <select className="form-control" value={form.managerId||''} onChange={e => setForm(f => ({...f, managerId: e.target.value}))}>
                <option value="">-- Chọn sau --</option>
                {managers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{isEdit ? 'Lưu' : 'Tạo team'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Team card – renders differently for ADMIN vs MANAGER
function TeamCard({ team, currentUser, users, isAdmin, isManager, onEdit, onDelete, onAddMember, onRemoveMember }) {
  const [selectedUserId, setSelectedUserId] = useState('');

  const teamMembers = users.filter(u => u.teamId === team.id);

  const canEditThisTeam   = isAdmin;
  const canManageMembers  = isAdmin; // chỉ ADMIN mới được thêm/xóa thành viên

  const unassignedUsers = users.filter(u => !u.teamId && u.role !== 'ADMIN');

  const handleAdd = () => {
    if (!selectedUserId) return toast.error('Chọn thành viên cần thêm');
    onAddMember(team.id, selectedUserId);
    setSelectedUserId('');
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{team.name}</div>
          {team.description && <div className="text-sm text-muted" style={{ marginTop: 2 }}>{team.description}</div>}
        </div>
        <div className="flex gap-2 items-center">
          <span className="badge badge-blue">{team._count?.members || 0} thành viên</span>
          <span className="badge badge-purple">{team._count?.channels || 0} kênh</span>
          {canEditThisTeam && <>
            <button className="btn-icon" onClick={() => onEdit(team)} title="Sửa team"><Edit2 size={14}/></button>
            <button className="btn-icon" onClick={() => onDelete(team.id)} style={{ color: 'var(--red)' }} title="Xóa team"><Trash2 size={14}/></button>
          </>}
        </div>
      </div>

      {/* Manager badge */}
      {team.manager && (
        <div className="text-sm" style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
          👑 Trưởng nhóm: <strong>{team.manager.name}</strong>
        </div>
      )}

      {/* Members list */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: canManageMembers && unassignedUsers.length ? 12 : 0 }}>
        {teamMembers.map(m => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-card-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 10px',
          }}>
            <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{m.name?.[0]}</div>
            <span style={{ fontSize: 13 }}>{m.name}</span>
            <span className="badge badge-gray" style={{ fontSize: 10 }}>{m.role}</span>
            {canManageMembers && (
              <button
                onClick={() => onRemoveMember(team.id, m.id)}
                title="Xóa khỏi team"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                <UserMinus size={12}/>
              </button>
            )}
          </div>
        ))}
        {teamMembers.length === 0 && <span className="text-sm text-muted">Chưa có thành viên</span>}
      </div>

      {/* Add member – chỉ ADMIN */}
      {canManageMembers && unassignedUsers.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <select
            className="form-control"
            style={{ flex: 1, maxWidth: 280 }}
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}>
            <option value="">+ Thêm thành viên...</option>
            {unassignedUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={handleAdd}>
            <UserPlus size={14}/>
          </button>
        </div>
      )}

      {/* Read-only notice – chỉ MANAGER */}
      {isManager && (
        <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(59,130,246,0.07)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', border: '1px solid rgba(59,130,246,0.15)' }}>
          🔒 Chỉ xem – liên hệ Admin để thay đổi thành viên
        </div>
      )}
    </div>
  );
}

export default function TeamsPage() {
  const { user, isAtLeast } = useAuth();
  const isAdmin   = isAtLeast('ADMIN');
  const isManager = user?.role === 'MANAGER';

  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, ur] = await Promise.all([teamAPI.getAll(), authAPI.getUsers()]);
      setTeams(tr.data.teams);
      setUsers(ur.data.users || []);
    } catch (err) { toast.error('Lỗi tải dữ liệu'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id) => {
    if (!confirm('Xóa team này? Các thành viên sẽ không còn thuộc team nào.')) return;
    try { await teamAPI.delete(id); toast.success('Đã xóa'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  const handleAddMember = async (teamId, userId) => {
    try { await teamAPI.addMember(teamId, userId); toast.success('Đã thêm thành viên'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  const handleRemoveMember = async (teamId, userId) => {
    if (!confirm('Xóa thành viên này khỏi team?')) return;
    try { await teamAPI.removeMember(teamId, userId); toast.success('Đã xóa thành viên'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <div className="page-title">👥 Quản lý Teams</div>
          <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Phân chia và quản lý nhóm làm việc
            {isManager && (
              <span style={{
                fontSize: 11, background: 'rgba(245,158,11,0.12)', color: 'var(--yellow)',
                border: '1px solid rgba(245,158,11,0.25)', borderRadius: 100, padding: '2px 10px',
              }}>
                🔒 Chỉ hiển thị team của bạn
              </span>
            )}
          </div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModal('new')}>
            <Plus size={16}/> Tạo Team
          </button>
        )}
      </div>

      <div className="page-content">
        {loading
          ? <div style={{ textAlign: 'center', paddingTop: 80 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {teams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  currentUser={user}
                  users={users}
                  isAdmin={isAdmin}
                  isManager={isManager}
                  onEdit={setModal}
                  onDelete={handleDelete}
                  onAddMember={handleAddMember}
                  onRemoveMember={handleRemoveMember}
                />
              ))}
              {teams.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <div>{isManager ? 'Bạn chưa được gán vào team nào' : 'Chưa có team nào'}</div>
                </div>
              )}
            </div>
          )
        }
      </div>

      {modal && (
        <TeamModal
          team={modal === 'new' ? null : modal}
          users={users}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
