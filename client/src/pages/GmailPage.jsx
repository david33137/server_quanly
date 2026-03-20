import { useState, useEffect, useCallback } from 'react';
import { gmailAPI, teamAPI } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Eye, EyeOff, Upload } from 'lucide-react';

const STATUS_BADGE = { ACTIVE: 'badge-green', SUSPENDED: 'badge-yellow', BANNED: 'badge-red' };
const STATUS_LABEL = { ACTIVE: 'Hoạt động', SUSPENDED: 'Tạm khóa', BANNED: 'Bị cấm' };

// ─── Single Gmail Modal ───────────────────────────────────────────
function GmailModal({ gmail, teams, onClose, onSaved }) {
  const [form, setForm] = useState({ email: '', password: '', recoveryEmail: '', phone: '', notes: '', teamId: '', status: 'ACTIVE', ...gmail });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!gmail?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) await gmailAPI.update(gmail.id, form);
      else await gmailAPI.create(form);
      toast.success(isEdit ? 'Đã cập nhật Gmail' : 'Đã thêm Gmail');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? '✏️ Sửa Gmail' : '➕ Thêm Gmail'}</div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Email Gmail *</label>
              <input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required disabled={isEdit} />
            </div>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">{isEdit ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu *'}</label>
              <input className="form-control" type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required={!isEdit} style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, bottom: 10, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Email khôi phục</label>
                <input className="form-control" type="email" value={form.recoveryEmail||''} onChange={e => setForm(f => ({...f, recoveryEmail: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Số điện thoại</label>
                <input className="form-control" value={form.phone||''} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Team</label>
                <select className="form-control" value={form.teamId||''} onChange={e => setForm(f => ({...f, teamId: e.target.value}))}>
                  <option value="">-- Không gán --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Trạng thái</label>
                <select className="form-control" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="SUSPENDED">Tạm khóa</option>
                  <option value="BANNED">Bị cấm</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Ghi chú</label>
              <textarea className="form-control" rows={2} value={form.notes||''} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {isEdit ? 'Lưu thay đổi' : 'Thêm Gmail'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Bulk Import Modal ────────────────────────────────────────────
const TEMPLATE = `# Dòng bắt đầu bằng # là comment, sẽ bị bỏ qua
# Format: email|password|recovery_email|phone|status|team_name|notes
# Các cột từ cột 3 trở đi là tuỳ chọn (có thể để trống)
# status: ACTIVE | SUSPENDED | BANNED (mặc định ACTIVE)
# team_name: tên team như trong hệ thống (để trống nếu không gán)
email|password|recovery_email|phone|status|team_name|notes
test1@gmail.com|matkhau123|backup@gmail.com|0901234567|ACTIVE|Team Alpha|Account chính
test2@gmail.com|matkhau456|||ACTIVE||Account phụ
test3@gmail.com|matkhau789||||Team Beta|`;

function BulkImportModal({ teams, onClose, onSaved }) {
  const [text, setText] = useState(TEMPLATE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  const lineCount = text.split('\n').filter(l => {
    const t = l.trim();
    return t && !t.startsWith('#') && !t.toLowerCase().startsWith('email|');
  }).length;

  const copyTemplate = () => {
    navigator.clipboard.writeText(TEMPLATE);
    toast.success('Đã copy template');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lines = text.split('\n').filter(l => l.trim());
    if (!lines.length) return toast.error('Nhập ít nhất 1 dòng');
    setLoading(true);
    setResult(null);
    try {
      const res = await gmailAPI.bulkCreate({ lines });
      setResult(res.data.results);
      if (res.data.results.created > 0) {
        toast.success(`✅ Đã tạo ${res.data.results.created} Gmail`);
        onSaved();
      } else if (res.data.results.skipped > 0 && res.data.results.created === 0) {
        toast('⚠️ Tất cả đã tồn tại, không tạo thêm', { icon: '⚠️' });
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <div className="modal-title">📥 Bulk Import Gmail</div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Format guide */}
            <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)', marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>📌 Format: 7 cột phân cách bằng <code style={{ background: 'rgba(59,130,246,0.1)', padding: '1px 6px', borderRadius: 4 }}>|</code></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowGuide(v => !v)}>
                    {showGuide ? 'Ẩn' : 'Chi tiết'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copyTemplate}>
                    📋 Copy template
                  </button>
                </div>
              </div>
              {/* Column reference */}
              <div style={{ padding: '8px 14px 10px', overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: 0, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {[
                    { col: 1, name: 'email', req: true, note: 'Địa chỉ Gmail' },
                    { col: 2, name: 'password', req: true, note: 'Mật khẩu' },
                    { col: 3, name: 'recovery_email', req: false, note: 'Email khôi phục' },
                    { col: 4, name: 'phone', req: false, note: 'Số điện thoại' },
                    { col: 5, name: 'status', req: false, note: 'ACTIVE | SUSPENDED | BANNED' },
                    { col: 6, name: 'team_name', req: false, note: 'Tên team chính xác' },
                    { col: 7, name: 'notes', req: false, note: 'Ghi chú tự do' },
                  ].map(c => (
                    <div key={c.col} style={{
                      padding: '4px 10px', borderRight: '1px solid rgba(59,130,246,0.15)',
                      background: c.req ? 'rgba(59,130,246,0.1)' : 'transparent',
                      minWidth: 80,
                    }}>
                      <div style={{ fontWeight: 700, color: c.req ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        [{c.col}] {c.name}{c.req ? ' *' : ''}
                      </div>
                      {showGuide && <div style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: 11, whiteSpace: 'normal', lineHeight: 1.4 }}>{c.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
              {showGuide && (
                <div style={{ padding: '6px 14px 10px', borderTop: '1px solid rgba(59,130,246,0.15)', fontSize: 12, color: 'var(--text-muted)' }}>
                  💡 <strong>Lưu ý:</strong> Dòng đầu có thể là header (bắt đầu bằng "email") sẽ tự bỏ qua • Dòng bắt đầu <code>#</code> là comment • Cột trống: để trống nhưng giữ dấu <code>|</code> • Cũng hỗ trợ Tab và <code>:</code> (cũ, chỉ email+pass)
                </div>
              )}
            </div>

            {/* Team list helper */}
            {teams.length > 0 && (
              <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                <strong>Tên team hợp lệ:</strong>{' '}
                {teams.map((t, i) => (
                  <code key={t.id} onClick={() => navigator.clipboard.writeText(t.name).then(() => toast.success(`Đã copy "${t.name}"`))}
                    style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 4, cursor: 'pointer', marginRight: 4 }}
                    title="Click để copy">
                    {t.name}
                  </code>
                ))}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Dữ liệu nhập</label>
                <span className="text-xs text-muted">{lineCount} Gmail sẽ được thêm</span>
              </div>
              <textarea className="form-control" rows={12} style={{ fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.6 }}
                value={text} onChange={e => setText(e.target.value)} spellCheck={false} />
            </div>

            {/* Result summary */}
            {result && (
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 12 }}>
                <div style={{ background: 'var(--bg-card-2)', padding: '12px 16px', display: 'flex', gap: 24, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>{result.created}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>✅ Đã tạo</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--yellow)' }}>{result.skipped}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>⏭ Bỏ qua (trùng)</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>{result.errors.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>⚠ Lỗi/Cảnh báo</div>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <div style={{ padding: '8px 14px', maxHeight: 130, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
                    {result.errors.map((e, i) => (
                      <div key={i} style={{ fontSize: 12, color: e.startsWith('⚠') ? 'var(--yellow)' : 'var(--red)', marginBottom: 3, display: 'flex', gap: 6 }}>
                        <span>{e}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Đóng</button>
            <button type="submit" className="btn btn-primary" disabled={loading || lineCount === 0}>
              {loading ? <span className="spinner" /> : <Upload size={15}/>}
              {loading ? 'Đang import...' : `Import ${lineCount} Gmail`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────
export default function GmailPage() {
  const { isAtLeast } = useAuth();
  const [gmails, setGmails] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);       // null | 'new' | gmail object
  const [bulkOpen, setBulkOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [gr, tr] = await Promise.all([gmailAPI.getAll(), teamAPI.getAll()]);
      setGmails(gr.data.gmails);
      setTeams(tr.data.teams);
    } catch (err) { toast.error('Lỗi tải dữ liệu'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id) => {
    if (!confirm('Xác nhận xóa Gmail này?')) return;
    try {
      await gmailAPI.delete(id);
      toast.success('Đã xóa');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi xóa'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <div className="page-title">📧 Quản lý Gmail</div>
          <div className="page-subtitle">Tài khoản Gmail cho các kênh YouTube ({gmails.length})</div>
        </div>
        {isAtLeast('MANAGER') && (
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setBulkOpen(true)}>
              <Upload size={15}/> Bulk Import
            </button>
            <button className="btn btn-primary" onClick={() => setModal('new')}>
              <Plus size={16}/> Thêm Gmail
            </button>
          </div>
        )}
      </div>
      <div className="page-content">
        {loading ? <div style={{ textAlign: 'center', paddingTop: 80 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Email</th><th>Trạng thái</th><th>Team</th><th>Kênh liên kết</th><th>Recovery</th><th>Ghi chú</th><th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {gmails.length === 0 && <tr><td colSpan={7}><div className="empty-state">Chưa có Gmail nào</div></td></tr>}
                {gmails.map(g => (
                  <tr key={g.id}>
                    <td><strong>{g.email}</strong></td>
                    <td><span className={`badge ${STATUS_BADGE[g.status]}`}>{STATUS_LABEL[g.status]}</span></td>
                    <td>{g.team?.name || <span className="text-muted">—</span>}</td>
                    <td><span className="badge badge-blue">{g.channels?.length || 0} kênh</span></td>
                    <td className="text-muted text-sm">{g.recoveryEmail || '—'}</td>
                    <td className="text-muted text-sm truncate" style={{ maxWidth: 150 }}>{g.notes || '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        {isAtLeast('MANAGER') && <button className="btn-icon" onClick={() => setModal(g)} title="Sửa"><Edit2 size={14}/></button>}
                        {isAtLeast('ADMIN') && <button className="btn-icon" onClick={() => handleDelete(g.id)} title="Xóa" style={{ color: 'var(--red)' }}><Trash2 size={14}/></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && <GmailModal gmail={modal === 'new' ? null : modal} teams={teams} onClose={() => setModal(null)} onSaved={() => { setModal(null); fetchAll(); }} />}
      {bulkOpen && <BulkImportModal teams={teams} onClose={() => setBulkOpen(false)} onSaved={fetchAll} />}
    </div>
  );
}
