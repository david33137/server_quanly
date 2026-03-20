import { useState, useEffect, useCallback } from 'react';
import { channelAPI, gmailAPI, teamAPI } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Youtube } from 'lucide-react';

const STATUS_BADGE = { ACTIVE: 'badge-green', LIMITED: 'badge-yellow', SUSPENDED: 'badge-red', INACTIVE: 'badge-gray' };
const STATUS_LABEL = { ACTIVE: 'Hoạt động', LIMITED: 'Hạn chế', SUSPENDED: 'Tạm khóa', INACTIVE: 'Không dùng' };

function ChannelModal({ channel, gmails, teams, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', channelUrl: '', channelId: '', gmailId: '', teamId: '', status: 'ACTIVE', subscribers: '', language: 'vi', niche: '', notes: '', ...channel, subscribers: channel?.subscribers || '' });
  const [loading, setLoading] = useState(false);
  const isEdit = !!channel?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = { ...form, subscribers: form.subscribers ? parseInt(form.subscribers) : null };
      if (isEdit) await channelAPI.update(channel.id, data);
      else await channelAPI.create(data);
      toast.success(isEdit ? 'Đã cập nhật kênh' : 'Đã thêm kênh');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? '✏️ Sửa Kênh' : '➕ Thêm Kênh YouTube'}</div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Tên kênh *</label>
              <input className="form-control" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">URL kênh</label>
                <input className="form-control" placeholder="https://youtube.com/@..." value={form.channelUrl||''} onChange={e => setForm(f => ({...f, channelUrl: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Channel ID (UCxxx)</label>
                <input className="form-control" placeholder="UCxxxxxxxx" value={form.channelId||''} onChange={e => setForm(f => ({...f, channelId: e.target.value}))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Gmail liên kết</label>
                <select className="form-control" value={form.gmailId||''} onChange={e => setForm(f => ({...f, gmailId: e.target.value}))}>
                  <option value="">-- Không gán --</option>
                  {gmails.map(g => <option key={g.id} value={g.id}>{g.email}</option>)}
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
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Trạng thái</label>
                <select className="form-control" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="LIMITED">Hạn chế</option>
                  <option value="SUSPENDED">Tạm khóa</option>
                  <option value="INACTIVE">Không dùng</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subscribers</label>
                <input className="form-control" type="number" value={form.subscribers} onChange={e => setForm(f => ({...f, subscribers: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Ngôn ngữ</label>
                <select className="form-control" value={form.language||'vi'} onChange={e => setForm(f => ({...f, language: e.target.value}))}>
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="th">Thai</option>
                  <option value="id">Indonesian</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Niche / Chủ đề</label>
              <input className="form-control" placeholder="Giải trí, Phim, Hài kịch..." value={form.niche||''} onChange={e => setForm(f => ({...f, niche: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Ghi chú</label>
              <textarea className="form-control" rows={2} value={form.notes||''} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading && <span className="spinner" />}
              {isEdit ? 'Lưu' : 'Thêm kênh'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ChannelsPage() {
  const { isAtLeast } = useAuth();
  const [channels, setChannels] = useState([]);
  const [gmails, setGmails] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = [channelAPI.getAll()];
      if (isAtLeast('MANAGER')) reqs.push(gmailAPI.getAll(), teamAPI.getAll());
      const [cr, gr, tr] = await Promise.all(reqs);
      setChannels(cr.data.channels);
      if (gr) setGmails(gr.data.gmails);
      if (tr) setTeams(tr.data.teams);
    } catch (err) { toast.error('Lỗi tải dữ liệu'); }
    setLoading(false);
  }, [isAtLeast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id) => {
    if (!confirm('Xác nhận xóa kênh?')) return;
    try { await channelAPI.delete(id); toast.success('Đã xóa'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <div className="page-title">📺 Kênh YouTube</div>
          <div className="page-subtitle">Quản lý các kênh upload</div>
        </div>
        {isAtLeast('MANAGER') && <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={16}/> Thêm kênh</button>}
      </div>
      <div className="page-content">
        {loading ? <div style={{ textAlign: 'center', paddingTop: 80 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div> : (
          channels.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><Youtube size={48} /></div><div>Chưa có kênh YouTube nào</div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {channels.map(ch => (
                <div className="card card-hover" key={ch.id}>
                  <div className="flex items-center gap-3 mb-4" style={{ marginBottom: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: 'linear-gradient(135deg, #ff0000, #cc0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🎬</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
                      <div className="text-xs text-muted">{ch.channelId || 'Chưa có Channel ID'}</div>
                    </div>
                    <span className={`badge ${STATUS_BADGE[ch.status]}`}>{STATUS_LABEL[ch.status]}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {ch.gmail && <div className="text-sm text-secondary">📧 {ch.gmail.email}</div>}
                    {ch.team && <div className="text-sm text-secondary">👥 {ch.team.name}</div>}
                    {ch.niche && <div className="text-sm text-secondary">🎯 {ch.niche}</div>}
                    {ch.subscribers != null && <div className="text-sm text-secondary">👁 {ch.subscribers?.toLocaleString()} subscribers</div>}
                    <div className="flex gap-2" style={{ marginTop: 4 }}>
                      <span className="badge badge-blue">{ch._count?.targetJobs || 0} jobs</span>
                      <span className="badge badge-green">{ch._count?.uploadedJobs || 0} đã up</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {ch.channelUrl && <a href={ch.channelUrl} target="_blank" rel="noopener" className="btn btn-secondary btn-sm"><Youtube size={12}/> Xem kênh</a>}
                    {isAtLeast('MANAGER') && <button className="btn btn-secondary btn-sm" onClick={() => setModal(ch)}><Edit2 size={12}/></button>}
                    {isAtLeast('ADMIN') && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ch.id)}><Trash2 size={12}/></button>}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      {modal && <ChannelModal channel={modal === 'new' ? null : modal} gmails={gmails} teams={teams} onClose={() => setModal(null)} onSaved={() => { setModal(null); fetchAll(); }} />}
    </div>
  );
}
