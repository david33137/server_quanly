import { useState, useEffect, useCallback } from 'react';
import { jobAPI, channelAPI, sourceAPI, logAPI, authAPI } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, X, GripVertical, ExternalLink, Clock, Youtube } from 'lucide-react';

// ─── Config ──────────────────────────────────────────────────────
const STEPS = [
  { key: 'SOURCING',       label: 'Đề xuất',     color: '#3b82f6', emoji: '🔍', desc: 'Chờ duyệt' },
  { key: 'APPROVAL',       label: 'Chờ xử lý',   color: '#f59e0b', emoji: '⏳', desc: 'Chờ worker kéo' },
  { key: 'PROCESSING',     label: 'Đang xử lý',  color: '#8b5cf6', emoji: '⚙️', desc: 'Worker xử lý' },
  { key: 'WAITING_UPLOAD', label: 'Chờ upload',  color: '#06b6d4', emoji: '📦', desc: 'Chờ upload' },
  { key: 'UPLOADING',      label: 'Đang upload', color: '#f97316', emoji: '📤', desc: 'Đang upload' },
  { key: 'DONE',           label: 'Hoàn tất',    color: '#10b981', emoji: '✅', desc: 'Xong' },
];
const FAILED_STEP = { key: 'FAILED', label: 'Thất bại', color: '#ef4444', emoji: '❌' };
const ALL_STEPS   = [...STEPS, FAILED_STEP];

const PRIORITY_BADGE = { HIGH: 'badge-red', NORMAL: 'badge-blue', LOW: 'badge-gray' };
const PRIORITY_LABEL = { HIGH: '🔴 Cao', NORMAL: '🔵 Thường', LOW: '⚪ Thấp' };
const SOURCE_BADGE   = { YOUTUBE: 'badge-red', TIKTOK: 'badge-purple', FACEBOOK: 'badge-blue', OTHER: 'badge-gray' };

const VALID_DND = {
  SOURCING:       ['APPROVAL', 'FAILED'],
  APPROVAL:       ['PROCESSING', 'SOURCING', 'FAILED'],
  PROCESSING:     ['WAITING_UPLOAD', 'FAILED'],
  WAITING_UPLOAD: ['UPLOADING', 'FAILED'],
  UPLOADING:      ['DONE', 'WAITING_UPLOAD', 'FAILED'],
  FAILED:         ['APPROVAL', 'SOURCING'],
};

const stepLabel = k => ALL_STEPS.find(s => s.key === k)?.label || k;
const stepColor = k => ALL_STEPS.find(s => s.key === k)?.color || '#fff';

// ─── Action Button ────────────────────────────────────────────────
function ActionButton({ label, color, onClick }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { await onClick(); } catch { toast.error('Lỗi'); }
    finally { setLoading(false); }
  };
  return (
    <button className="btn w-full" onClick={handle} disabled={loading}
      style={{ background: color + '22', color, border: `1px solid ${color}44`, justifyContent: 'center', padding: '12px' }}>
      {loading ? <span className="spinner" /> : label}
    </button>
  );
}

// ─── Upload Done Form ─────────────────────────────────────────────
function UploadDoneForm({ job, channels, onDone }) {
  const [url, setUrl] = useState('');
  const [chId, setChId] = useState(job.targetChannelId || '');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!url || !chId) return toast.error('Cần nhập link và kênh');
    setLoading(true);
    try { await jobAPI.markUploaded(job.id, { uploadedUrl: url, uploadedChannelId: chId }); toast.success('✅ Hoàn tất!'); onDone(); }
    catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
    setLoading(false);
  };
  return (
    <form onSubmit={submit}>
      <div style={{ background: 'var(--bg-card-2)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--green)', fontSize: 13 }}>✅ Xác nhận Upload Xong</div>
        <div className="form-group">
          <label className="form-label">Link YouTube đã upload *</label>
          <input className="form-control" type="url" placeholder="https://youtube.com/watch?v=..." value={url} onChange={e => setUrl(e.target.value)} required />
        </div>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Kênh uploaded *</label>
          <select className="form-control" value={chId} onChange={e => setChId(e.target.value)} required>
            <option value="">-- Chọn kênh --</option>
            {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-success w-full" disabled={loading}>
          {loading ? <span className="spinner" /> : '✅ Xác nhận'}
        </button>
      </div>
    </form>
  );
}

// ─── Fail Form ────────────────────────────────────────────────────
function FailForm({ job, onDone }) {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await jobAPI.fail(job.id, msg || 'Lỗi không xác định'); toast.success('Đã đánh dấu thất bại'); onDone(); }
    catch { toast.error('Lỗi'); }
    setLoading(false);
  };
  return (
    <form onSubmit={submit}>
      <div style={{ background: 'var(--red-bg)', borderRadius: 10, padding: 14, border: '1px solid rgba(239,68,68,0.3)' }}>
        <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--red)', fontSize: 13 }}>❌ Đánh dấu Thất bại</div>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <textarea className="form-control" rows={2} placeholder="Lý do thất bại..." value={msg} onChange={e => setMsg(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-danger w-full" disabled={loading}>
          {loading ? <span className="spinner" /> : '❌ Xác nhận thất bại'}
        </button>
      </div>
    </form>
  );
}

// ─── Job Edit Form ────────────────────────────────────────────────
function JobEditForm({ job, channels, users, onSaved }) {
  const [form, setForm] = useState({
    title:           job.title || '',
    sourceUrl:       job.sourceUrl || '',
    priority:        job.priority || 'NORMAL',
    targetLanguage:  job.targetLanguage || 'vi',
    targetChannelId: job.targetChannel?.id || '',
    assignedToId:    job.assignedTo?.id || '',
    notes:           job.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await jobAPI.update(job.id, {
        title:           form.title || null,
        sourceUrl:       form.sourceUrl || null,
        priority:        form.priority,
        targetLanguage:  form.targetLanguage,
        targetChannelId: form.targetChannelId || null,
        assignedToId:    form.assignedToId || null,
        notes:           form.notes || null,
      });
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi lưu'); }
    finally { setLoading(false); }
  };

  const fs = { marginBottom: 14 };
  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={fs}>
          <label className="form-label">Tiêu đề</label>
          <input className="form-control" placeholder="Tiêu đề của video..." value={form.title} onChange={set('title')} />
        </div>
        <div style={fs}>
          <label className="form-label">URL Nguồn *</label>
          <input className="form-control" type="url" placeholder="https://youtube.com/..." value={form.sourceUrl} onChange={set('sourceUrl')} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label className="form-label">Độ ưu tiên</label>
            <select className="form-control" value={form.priority} onChange={set('priority')}>
              <option value="HIGH">🔴 Cao</option>
              <option value="NORMAL">🔵 Thường</option>
              <option value="LOW">⚪ Thấp</option>
            </select>
          </div>
          <div>
            <label className="form-label">Ngôn ngữ đích</label>
            <select className="form-control" value={form.targetLanguage} onChange={set('targetLanguage')}>
              <option value="vi">🇻🇳 Tiếng Việt</option>
              <option value="en">🇺🇸 English</option>
              <option value="th">🇹🇭 Thai</option>
              <option value="id">🇮🇩 Indonesian</option>
              <option value="zh">🇨🇳 Chinese</option>
              <option value="ko">🇰🇷 Korean</option>
              <option value="ja">🇯🇵 Japanese</option>
            </select>
          </div>
        </div>
        <div style={fs}>
          <label className="form-label">Kênh đích</label>
          <select className="form-control" value={form.targetChannelId} onChange={set('targetChannelId')}>
            <option value="">-- Chưa gán --</option>
            {channels.map(ch => <option key={ch.id} value={ch.id}>📺 {ch.name}</option>)}
          </select>
        </div>
        <div style={fs}>
          <label className="form-label">Giao cho</label>
          <select className="form-control" value={form.assignedToId} onChange={set('assignedToId')}>
            <option value="">-- Chưa gán --</option>
            {users.map(u => <option key={u.id} value={u.id}>👤 {u.name} ({u.role})</option>)}
          </select>
        </div>
        <div style={fs}>
          <label className="form-label">Ghi chú</label>
          <textarea className="form-control" rows={4} placeholder="Ghi chú, yêu cầu đặc biệt..." value={form.notes} onChange={set('notes')} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setForm({
            title: job.title || '', sourceUrl: job.sourceUrl || '', priority: job.priority || 'NORMAL',
            targetLanguage: job.targetLanguage || 'vi', targetChannelId: job.targetChannel?.id || '',
            assignedToId: job.assignedTo?.id || '', notes: job.notes || '',
          })}>Hoàn tác</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
            {loading ? <span className="spinner" /> : null} 💾 Lưu thay đổi
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Job Detail Drawer ────────────────────────────────────────────
function JobDetailDrawer({ job: initialJob, channels, onClose, onUpdated }) {
  const { isAtLeast, user: currentUser } = useAuth();
  const [job, setJob]   = useState(initialJob);
  const [logs, setLogs] = useState([]);
  const [tab,  setTab]  = useState('overview'); // overview | edit | logs
  const [allUsers, setAllUsers] = useState([]);

  const reload = useCallback(() => {
    Promise.all([
      jobAPI.getById(initialJob.id),
      logAPI.getJobLogs(initialJob.id),
    ]).then(([jr, lr]) => {
      setJob(jr.data.job);
      setLogs(lr.data.logs || []);
    }).catch(() => {});
  }, [initialJob.id]);

  useEffect(() => {
    reload();
    authAPI.getUsers().then(r => setAllUsers(r.data.users || [])).catch(() => {});
  }, [reload]);

  // MANAGER chỉ thấy users và channels của team mình
  const isManager = currentUser?.role === 'MANAGER';
  const users = isManager
    ? allUsers.filter(u => u.teamId === currentUser?.teamId)
    : allUsers;
  const availableChannels = isManager
    ? channels.filter(ch => ch.teamId === currentUser?.teamId)
    : channels;


  const step = ALL_STEPS.find(s => s.key === job.currentStep) || FAILED_STEP;
  const LOG_LEVEL_COLOR = { INFO: 'var(--accent)', WARN: 'var(--yellow)', ERROR: 'var(--red)', SUCCESS: 'var(--green)' };

  const TABS = [
    ['overview', '📋 Tổng quan'],
    ['edit',     '✏️ Chỉnh sửa'],
    ['logs',     '📜 Lịch sử'],
  ];

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 500,
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s ease', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span className={`badge ${PRIORITY_BADGE[job.priority]}`}>{PRIORITY_LABEL[job.priority]}</span>
            <button className="btn-icon" onClick={onClose}><X size={16}/></button>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, marginBottom: 8 }}>
            {job.title || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(Chưa có tiêu đề)</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: step.color }}>{step.emoji} {step.label}</span>
            {job.videoSource && <span className={`badge ${SOURCE_BADGE[job.videoSource.sourceType]}`}>{job.videoSource.sourceType}</span>}
            {job.targetLanguage && <span className="badge badge-gray">🌐 {job.targetLanguage.toUpperCase()}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: '9px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: tab === key ? 600 : 400,
              color: tab === key ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* ── TỔNG QUAN: Thông tin + Thao tác ── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Source URL */}
              <div>
                <div className="form-label" style={{ marginBottom: 6 }}>URL Nguồn</div>
                <div style={{ background: 'var(--bg-card-2)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                  <a href={job.sourceUrl} target="_blank" rel="noopener"
                    style={{ color: 'var(--accent)', fontSize: 13, wordBreak: 'break-all', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <ExternalLink size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    {job.sourceUrl}
                  </a>
                </div>
              </div>

              {job.uploadedUrl && (
                <div>
                  <div className="form-label" style={{ marginBottom: 6 }}>Link đã upload</div>
                  <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <a href={job.uploadedUrl} target="_blank" rel="noopener"
                      style={{ color: 'var(--green)', fontSize: 13, wordBreak: 'break-all', display: 'flex', gap: 8 }}>
                      <Youtube size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                      {job.uploadedUrl}
                    </a>
                  </div>
                </div>
              )}

              {job.errorMessage && (
                <div style={{ background: 'var(--red-bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <div className="text-xs" style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 4 }}>⚠ Lỗi</div>
                  <div style={{ fontSize: 13, color: 'var(--red)' }}>{job.errorMessage}</div>
                </div>
              )}

              {job.progress > 0 && job.progress < 100 && (
                <div>
                  <div className="form-label" style={{ marginBottom: 6 }}>Tiến độ xử lý</div>
                  <div className="progress-bar" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${job.progress}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>{job.progress}%</div>
                </div>
              )}

              {/* Meta grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Kênh đích',      value: job.targetChannel?.name },
                  { label: 'Kênh đã upload', value: job.uploadedChannel?.name },
                  { label: 'Giao cho',       value: job.assignedTo?.name },
                  { label: 'Team',           value: job.team?.name },
                  { label: 'Nguồn',          value: job.videoSource?.sourceType },
                  { label: 'Output',         value: job.outputPath },
                  { label: 'Duration',       value: job.duration ? `${job.duration}s` : null },
                  { label: 'Ngày tạo',       value: new Date(job.createdAt).toLocaleString('vi-VN') },
                  { label: 'Bắt đầu xử lý', value: job.startedAt ? new Date(job.startedAt).toLocaleString('vi-VN') : null },
                  { label: 'Hoàn thành',     value: job.completedAt ? new Date(job.completedAt).toLocaleString('vi-VN') : null },
                ].filter(m => m.value).map(m => (
                  <div key={m.label} style={{ background: 'var(--bg-card-2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {job.notes && (
                <div>
                  <div className="form-label" style={{ marginBottom: 6 }}>Ghi chú</div>
                  <div style={{ background: 'var(--bg-card-2)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', fontSize: 13 }}>{job.notes}</div>
                </div>
              )}

              {/* ── Thao tác ── */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>
                  ⚡ Thao tác
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {job.currentStep === 'SOURCING' && isAtLeast('MANAGER') && (
                    <ActionButton label="✅ Duyệt – Chuyển sang Chờ xử lý" color="var(--green)" onClick={async () => {
                      await jobAPI.approve(job.id); onUpdated(); onClose(); toast.success('Đã duyệt!');
                    }} />
                  )}
                  {job.currentStep === 'WAITING_UPLOAD' && (
                    <ActionButton label="📤 Bắt đầu Upload" color="var(--orange)" onClick={async () => {
                      await jobAPI.startUpload(job.id, {}); onUpdated(); onClose(); toast.success('Đang upload...');
                    }} />
                  )}
                  {job.currentStep === 'UPLOADING' && isAtLeast('EDITOR') && (
                    <UploadDoneForm job={job} channels={channels} onDone={() => { onUpdated(); onClose(); }} />
                  )}
                  {['SOURCING','APPROVAL','PROCESSING','WAITING_UPLOAD','UPLOADING'].includes(job.currentStep) && isAtLeast('MANAGER') && (
                    <FailForm job={job} onDone={() => { onUpdated(); onClose(); }} />
                  )}
                  {job.currentStep === 'FAILED' && isAtLeast('MANAGER') && (
                    <ActionButton label="↺ Đặt lại – Về Chờ xử lý" color="var(--accent)" onClick={async () => {
                      await jobAPI.requeue(job.id); onUpdated(); onClose(); toast.success('Đã đặt lại');
                    }} />
                  )}
                  {isAtLeast('ADMIN') && (
                    <ActionButton label="🗑 Xóa job này" color="var(--red)" onClick={async () => {
                      if (!confirm('Xóa job này vĩnh viễn?')) return;
                      await jobAPI.delete(job.id); onUpdated(); onClose(); toast.success('Đã xóa');
                    }} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── CHỈNH SỬA ── */}
          {tab === 'edit' && (
            <JobEditForm job={job} channels={availableChannels} users={users}
              onSaved={() => { reload(); onUpdated(); toast.success('✅ Đã lưu thay đổi'); }} />
          )}

          {/* ── LỊCH SỬ ── */}
          {tab === 'logs' && (
            <div>
              {logs.length === 0 && <div className="empty-state">Chưa có log nào</div>}
              {logs.map((log, i) => (
                <div key={log.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: LOG_LEVEL_COLOR[log.level] || 'var(--text-muted)', marginTop: 4, flexShrink: 0 }} />
                    {i < logs.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    {log.step && <span className="badge badge-gray" style={{ fontSize: 10, marginBottom: 4, display: 'inline-block' }}>{stepLabel(log.step)}</span>}
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{log.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      <Clock size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Transition Modal ─────────────────────────────────────────────
function TransitionModal({ job, fromStep, toStep, channels, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [duration, setDuration] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [uploadedChannelId, setUploadedChannelId] = useState(job.targetChannelId || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (toStep === 'DONE') {
        if (!uploadedUrl || !uploadedChannelId) return toast.error('Cần nhập link YouTube và kênh');
        await jobAPI.markUploaded(job.id, { uploadedUrl, uploadedChannelId });
        toast.success('✅ Upload hoàn tất!');
      } else if (toStep === 'UPLOADING' && fromStep === 'WAITING_UPLOAD') {
        await jobAPI.startUpload(job.id, { note });
        toast.success('📤 Đã bắt đầu upload');
      } else if (toStep === 'FAILED') {
        await jobAPI.fail(job.id, note || 'Thất bại thủ công');
        toast.success('Đã đánh dấu thất bại');
      } else {
        await jobAPI.moveStep(job.id, { targetStep: toStep, note, outputPath, duration });
        toast.success(`Đã chuyển: ${stepLabel(fromStep)} → ${stepLabel(toStep)}`);
      }
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi');
    } finally {
      setLoading(false);
    }
  };

  const isFailed = toStep === 'FAILED';
  const isDone   = toStep === 'DONE';
  const isWaitingUpload = toStep === 'WAITING_UPLOAD';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">↗ Chuyển bước thủ công</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              <span style={{ color: stepColor(fromStep) }}>{stepLabel(fromStep)}</span>
              {' → '}
              <span style={{ color: stepColor(toStep) }}>{stepLabel(toStep)}</span>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background: 'var(--bg-card-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{job.title || '(Chưa có tiêu đề)'}</div>
              <div className="text-xs text-muted truncate">{job.sourceUrl}</div>
            </div>
            {isDone && (
              <>
                <div className="form-group">
                  <label className="form-label">Link YouTube đã upload *</label>
                  <input className="form-control" type="url" placeholder="https://youtube.com/watch?v=..."
                    value={uploadedUrl} onChange={e => setUploadedUrl(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Kênh đã upload *</label>
                  <select className="form-control" value={uploadedChannelId} onChange={e => setUploadedChannelId(e.target.value)} required>
                    <option value="">-- Chọn kênh --</option>
                    {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                  </select>
                </div>
              </>
            )}
            {isWaitingUpload && (
              <>
                <div className="form-group">
                  <label className="form-label">Đường dẫn file output</label>
                  <input className="form-control" placeholder="/output/video.mp4" value={outputPath} onChange={e => setOutputPath(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (giây)</label>
                  <input className="form-control" type="number" placeholder="300" value={duration} onChange={e => setDuration(e.target.value)} />
                </div>
              </>
            )}
            {isFailed && (
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--red)' }}>Lý do thất bại *</label>
                <textarea className="form-control" rows={3} placeholder="Mô tả lỗi..." value={note} onChange={e => setNote(e.target.value)} required autoFocus />
              </div>
            )}
            {!isDone && !isFailed && (
              <div className="form-group">
                <label className="form-label">Ghi chú (tuỳ chọn)</label>
                <textarea className="form-control" rows={2} placeholder="Ghi chú về bước này..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn" disabled={loading} style={{
              background: isFailed ? 'var(--red-bg)' : isDone ? 'var(--green-bg)' : 'var(--accent)',
              color: isFailed ? 'var(--red)' : isDone ? 'var(--green)' : '#fff',
              border: isFailed ? '1px solid rgba(239,68,68,0.3)' : isDone ? '1px solid rgba(16,185,129,0.3)' : 'none',
            }}>
              {loading ? <span className="spinner" /> : null}
              {isFailed ? '❌ Đánh dấu thất bại' : isDone ? '✅ Xác nhận hoàn tất' : '➡ Xác nhận chuyển'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── New Job Modal ────────────────────────────────────────────────
function NewJobModal({ channels, onClose, onCreated }) {
  const [mode, setMode] = useState('url');
  const [urls, setUrls] = useState('');
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [sourceSearch, setSourceSearch] = useState('');
  const [channelId, setChannelId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [lang, setLang] = useState('vi');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === 'source') sourceAPI.getAll().then(r => setSources(r.data.sources)).catch(() => {});
  }, [mode]);

  const filteredSources = sources.filter(s =>
    s.sourceUrl.toLowerCase().includes(sourceSearch.toLowerCase()) ||
    (s.title || '').toLowerCase().includes(sourceSearch.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'url') {
        const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
        if (!urlList.length) return toast.error('Nhập ít nhất 1 URL');
        if (urlList.length === 1) {
          await jobAPI.create({ sourceUrl: urlList[0], targetChannelId: channelId || null, priority, targetLanguage: lang, title: title || null });
        } else {
          await jobAPI.bulkCreate(urlList.map(u => ({ sourceUrl: u, targetChannelId: channelId || null, priority, targetLanguage: lang })));
        }
        toast.success(`✅ Đã tạo ${urls.split('\n').filter(u => u.trim()).length} job`);
      } else {
        if (!selectedSource) return toast.error('Chọn một nguồn');
        await jobAPI.create({ sourceUrl: selectedSource.sourceUrl, videoSourceId: selectedSource.id, title: title || selectedSource.title || null, targetChannelId: channelId || null, priority, targetLanguage: lang });
        toast.success('✅ Đã tạo job từ nguồn');
      }
      onCreated(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi tạo job'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div className="modal-title">➕ Thêm Video vào Pipeline</div>
          <button className="btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {[['url','🔗 Nhập URL'],['source','📋 Chọn Nguồn']].map(([key, label]) => (
            <button key={key} onClick={() => setMode(key)} style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: mode === key ? 600 : 400,
              color: mode === key ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: mode === key ? '2px solid var(--accent)' : '2px solid transparent',
            }}>{label}</button>
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {mode === 'url' ? (
              <>
                <div className="form-group">
                  <label className="form-label">URL nguồn (mỗi dòng 1 URL) *</label>
                  <textarea id="job-urls" className="form-control" rows={4} placeholder="https://youtube.com/watch?v=..."
                    value={urls} onChange={e => setUrls(e.target.value)} required autoFocus />
                  <span className="text-xs text-muted">{urls.split('\n').filter(u => u.trim()).length} URL</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Tiêu đề (nếu chỉ 1 URL)</label>
                  <input className="form-control" placeholder="Tùy chọn..." value={title} onChange={e => setTitle(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label className="form-label">Chọn từ nguồn video</label>
                <input className="form-control" placeholder="Tìm kiếm..." value={sourceSearch}
                  onChange={e => setSourceSearch(e.target.value)} style={{ marginBottom: 8 }} />
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  {filteredSources.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      {sources.length === 0 ? 'Chưa có nguồn nào.' : 'Không tìm thấy'}
                    </div>
                  )}
                  {filteredSources.map(s => (
                    <div key={s.id} onClick={() => { setSelectedSource(s); setTitle(s.title || ''); }}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                        background: selectedSource?.id === s.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                        borderLeft: selectedSource?.id === s.id ? '3px solid var(--accent)' : '3px solid transparent',
                      }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{s.sourceType} · {s._count?.jobs || 0} jobs</div>
                      <div style={{ fontSize: 13, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sourceUrl}</div>
                      {s.title && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.title}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Kênh đích</label>
                <select id="job-channel" className="form-control" value={channelId} onChange={e => setChannelId(e.target.value)}>
                  <option value="">-- Gán sau --</option>
                  {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ngôn ngữ đích</label>
                <select id="job-lang" className="form-control" value={lang} onChange={e => setLang(e.target.value)}>
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="th">Thai</option>
                  <option value="id">Indonesian</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Độ ưu tiên</label>
              <select id="job-priority" className="form-control" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="HIGH">🔴 Cao</option>
                <option value="NORMAL">🔵 Thường</option>
                <option value="LOW">⚪ Thấp</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : <Plus size={16}/>} Thêm vào Pipeline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────
function JobCard({ job, step, onClick }) {
  return (
    <div className="job-card" draggable
      onDragStart={e => { e.dataTransfer.setData('jobId', job.id); e.dataTransfer.setData('fromStep', step.key); }}
      onClick={onClick}
      style={{ cursor: 'pointer' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 7 }}>
        <span className={`badge ${PRIORITY_BADGE[job.priority]}`}>{PRIORITY_LABEL[job.priority]}</span>
        <div className="flex items-center gap-2">
          {job.videoSource && <span className={`badge ${SOURCE_BADGE[job.videoSource.sourceType]}`} style={{ fontSize: 10 }}>{job.videoSource.sourceType}</span>}
          {job.assignedTo && <span className="avatar" style={{ width: 22, height: 22, fontSize: 10 }} title={job.assignedTo.name}>{job.assignedTo.name?.[0]}</span>}
          <GripVertical size={13} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        </div>
      </div>
      <div className="job-card-title">{job.title || '(Chưa có tiêu đề)'}</div>
      <div className="job-card-url">{job.sourceUrl}</div>
      {job.progress > 0 && job.progress < 100 && (
        <div style={{ marginBottom: 7 }}>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${job.progress}%` }} /></div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>{job.progress}%</div>
        </div>
      )}
      {job.targetChannel && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 7 }}>📺 {job.targetChannel.name}</div>}
      <div className="job-card-meta">
        {step.key === 'APPROVAL' && (
          <span style={{ fontSize: 11, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--yellow)', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
            Chờ worker kéo
          </span>
        )}
        {step.key === 'PROCESSING' && (
          <span style={{ fontSize: 11, color: 'var(--purple)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderTopColor: 'var(--purple)' }} />
            Worker đang xử lý
          </span>
        )}
        {step.key === 'WAITING_UPLOAD' && (
          <span style={{ fontSize: 11, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
            Chờ upload
          </span>
        )}
        {step.key === 'UPLOADING' && (
          <span style={{ fontSize: 11, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderTopColor: 'var(--orange)' }} />
            Đang upload...
          </span>
        )}
        {step.key === 'DONE' && job.uploadedUrl && (
          <a href={job.uploadedUrl} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
            style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ExternalLink size={10}/> Xem video
          </a>
        )}
        {step.key === 'FAILED' && job.errorMessage && (
          <span style={{ fontSize: 11, color: 'var(--red)' }}>⚠ {job.errorMessage.slice(0, 36)}...</span>
        )}
        <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>{new Date(job.createdAt).toLocaleDateString('vi-VN')}</span>
      </div>
    </div>
  );
}

// ─── Pipeline Column ──────────────────────────────────────────────
function PipelineColumn({ step, jobs, onDrop, isDragOver, setDragOver, onCardClick }) {
  return (
    <div className="pipeline-column"
      style={{
        borderColor: isDragOver ? step.color : step.key === 'FAILED' ? 'rgba(239,68,68,0.3)' : undefined,
        boxShadow: isDragOver ? `0 0 0 2px ${step.color}40` : undefined,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(step.key); }}
      onDragLeave={() => setDragOver(null)}
      onDrop={e => {
        e.preventDefault(); setDragOver(null);
        const jobId = e.dataTransfer.getData('jobId');
        const from  = e.dataTransfer.getData('fromStep');
        if (from !== step.key) onDrop(jobId, from, step.key);
      }}>
      <div className="pipeline-column-header">
        <div className="pipeline-col-title" style={{ color: step.color }}><span>{step.emoji}</span> {step.label}</div>
        <div className="pipeline-col-count">{jobs.length}</div>
      </div>
      {step.desc && (
        <div style={{ padding: '4px 14px 8px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {step.desc}
        </div>
      )}
      <div className="pipeline-cards">
        {jobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: 12, opacity: 0.5 }}>
            {isDragOver ? '⬇ Thả vào đây' : 'Trống'}
          </div>
        )}
        {jobs.map(job => (
          <JobCard key={job.id} job={job} step={step} onClick={() => onCardClick(job)} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function PipelinePage() {
  const { isAtLeast } = useAuth();
  const [jobs,     setJobs]     = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showNewJob, setShowNewJob] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const [pendingTransition, setPendingTransition] = useState(null);
  const [detailJob, setDetailJob] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [jobRes, chRes] = await Promise.all([jobAPI.getAll({ limit: 200 }), channelAPI.getAll()]);
      setJobs(jobRes.data.jobs);
      setChannels(chRes.data.channels);
    } catch { toast.error('Lỗi tải dữ liệu'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const jobsByStep = {};
  ALL_STEPS.forEach(s => { jobsByStep[s.key] = []; });
  jobs.forEach(j => { if (jobsByStep[j.currentStep]) jobsByStep[j.currentStep].push(j); });

  const handleDrop = (jobId, fromStep, toStep) => {
    const validTargets = VALID_DND[fromStep] || [];
    if (!validTargets.includes(toStep)) {
      toast.error(`Không thể kéo từ "${stepLabel(fromStep)}" sang "${stepLabel(toStep)}"`);
      return;
    }
    const job = jobs.find(j => j.id === jobId);
    if (job) setPendingTransition({ job, fromStep, toStep });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">Pipeline Board</div>
          <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Quản lý luồng xử lý video
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card-2)', padding: '2px 8px', borderRadius: 100, border: '1px solid var(--border)' }}>
              💡 Kéo thẻ để chuyển bước · Click để xem chi tiết
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={fetchAll}><RefreshCw size={14}/> Làm mới</button>
          {isAtLeast('SOURCER') && (
            <button id="new-job-btn" className="btn btn-primary btn-sm" onClick={() => setShowNewJob(true)}>
              <Plus size={14}/> Thêm Video
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : (
          <div className="pipeline-board">
            {ALL_STEPS.map(step => (
              <PipelineColumn key={step.key} step={step} jobs={jobsByStep[step.key] || []}
                onDrop={handleDrop} isDragOver={dragOver === step.key}
                setDragOver={setDragOver} onCardClick={setDetailJob} />
            ))}
          </div>
        )}
      </div>

      {showNewJob && <NewJobModal channels={channels} onClose={() => setShowNewJob(false)} onCreated={fetchAll} />}
      {pendingTransition && (
        <TransitionModal job={pendingTransition.job} fromStep={pendingTransition.fromStep}
          toStep={pendingTransition.toStep} channels={channels}
          onClose={() => setPendingTransition(null)} onDone={fetchAll} />
      )}
      {detailJob && (
        <JobDetailDrawer job={detailJob} channels={channels}
          onClose={() => setDetailJob(null)} onUpdated={fetchAll} />
      )}
    </div>
  );
}
