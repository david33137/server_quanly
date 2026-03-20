import { useState, useEffect, useCallback } from 'react';
import { sourceAPI, jobAPI, channelAPI } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Link, GitBranch, ExternalLink, Zap } from 'lucide-react';

// ─── Pipeline step metadata ────────────────────────────────────────
const STEP_META = {
  SOURCING:       { label: 'Đề xuất',      color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  APPROVAL:       { label: 'Chờ xử lý',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  PROCESSING:     { label: 'Đang xử lý',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  WAITING_UPLOAD: { label: 'Chờ upload',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  UPLOADING:      { label: 'Đang upload',  color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'  },
  DONE:           { label: 'Hoàn thành',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  FAILED:         { label: 'Thất bại',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
};

const SOURCE_TYPE_BADGE = { YOUTUBE: 'badge-red', TIKTOK: 'badge-purple', FACEBOOK: 'badge-blue', OTHER: 'badge-gray' };
const SOURCE_TYPE_EMOJI = { YOUTUBE: '▶', TIKTOK: '🎵', FACEBOOK: 'f', OTHER: '🔗' };

// ─── Pipeline Status Cell ──────────────────────────────────────────
function PipelineStatus({ jobs }) {
  if (!jobs || jobs.length === 0) {
    return <span className="badge badge-gray" style={{ fontSize: 11 }}>Chưa vào pipeline</span>;
  }

  // Nhóm theo step
  const stepCounts = {};
  jobs.forEach(j => { stepCounts[j.currentStep] = (stepCounts[j.currentStep] || 0) + 1; });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {Object.entries(stepCounts).map(([step, count]) => {
        const meta = STEP_META[step] || { label: step, color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
        return (
          <span key={step} style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
            background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40`,
            whiteSpace: 'nowrap',
          }}>
            {meta.label}{count > 1 ? ` ×${count}` : ''}
          </span>
        );
      })}
    </div>
  );
}

// ─── Add Source Modal (với tuỳ chọn pipeline) ─────────────────────
function AddSourceModal({ channels, onClose, onSaved }) {
  const [urls, setUrls]                 = useState('');
  const [sourceType, setSourceType]     = useState('YOUTUBE');
  const [addToPipeline, setAddToPipeline] = useState(false);
  const [channelId, setChannelId]       = useState('');
  const [priority, setPriority]         = useState('NORMAL');
  const [targetLang, setTargetLang]     = useState('vi');
  const [loading, setLoading]           = useState(false);

  const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!urlList.length) return toast.error('Nhập ít nhất 1 URL');
    setLoading(true);
    try {
      if (urlList.length === 1) {
        const res = await sourceAPI.create({
          sourceUrl: urlList[0], sourceType,
          addToPipeline, targetChannelId: channelId || null, priority, targetLanguage: targetLang,
        });
        if (addToPipeline && res.data.job) {
          toast.success('✅ Đã thêm nguồn và đưa vào Pipeline!');
        } else {
          toast.success('Đã thêm nguồn');
        }
      } else {
        await sourceAPI.bulkCreate(
          urlList.map(u => ({ sourceUrl: u, sourceType })),
          addToPipeline ? { addToPipeline: true, targetChannelId: channelId || null, priority } : {}
        );
        toast.success(`Đã thêm ${urlList.length} nguồn${addToPipeline ? ' vào Pipeline' : ''}`);
      }
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title">🔍 Thêm Nguồn Video</div>
          <button className="btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* URLs */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>URL nguồn (mỗi dòng 1 URL) *</label>
                <span className="text-xs text-muted">{urlList.length} URL</span>
              </div>
              <textarea className="form-control" rows={5}
                placeholder="https://youtube.com/watch?v=..."
                value={urls} onChange={e => setUrls(e.target.value)} required autoFocus />
            </div>

            <div className="form-group">
              <label className="form-label">Nền tảng</label>
              <select className="form-control" value={sourceType} onChange={e => setSourceType(e.target.value)}>
                <option value="YOUTUBE">▶ YouTube</option>
                <option value="TIKTOK">🎵 TikTok</option>
                <option value="FACEBOOK">f Facebook</option>
                <option value="OTHER">🔗 Khác</option>
              </select>
            </div>

            {/* Toggle: thêm vào pipeline ngay */}
            <div style={{
              borderRadius: 10, border: '1px solid var(--border)',
              overflow: 'hidden', marginBottom: 4,
            }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', cursor: 'pointer',
                  background: addToPipeline ? 'rgba(99,102,241,0.06)' : 'var(--bg-card-2)',
                  borderBottom: addToPipeline ? '1px solid rgba(99,102,241,0.2)' : 'none',
                  transition: 'background 0.2s',
                }}
                onClick={() => setAddToPipeline(v => !v)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Zap size={16} style={{ color: addToPipeline ? 'var(--accent)' : 'var(--text-muted)' }}/>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Thêm vào Pipeline ngay</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Tạo job và đưa vào hàng đợi xử lý
                    </div>
                  </div>
                </div>
                {/* Toggle visual */}
                <div style={{
                  width: 44, height: 24, borderRadius: 24, flexShrink: 0,
                  background: addToPipeline ? 'var(--accent)' : 'var(--bg-card)',
                  border: `1px solid ${addToPipeline ? 'var(--accent)' : 'var(--border)'}`,
                  position: 'relative', transition: 'all 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: 3, left: addToPipeline ? 22 : 3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: addToPipeline ? '#fff' : 'var(--text-muted)',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}/>
                </div>
              </div>

              {/* Pipeline options */}
              {addToPipeline && (
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Kênh đích</label>
                      <select className="form-control" value={channelId} onChange={e => setChannelId(e.target.value)}>
                        <option value="">-- Gán sau --</option>
                        {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Độ ưu tiên</label>
                      <select className="form-control" value={priority} onChange={e => setPriority(e.target.value)}>
                        <option value="HIGH">🔴 Cao</option>
                        <option value="NORMAL">🔵 Thường</option>
                        <option value="LOW">⚪ Thấp</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Ngôn ngữ đích</label>
                    <select className="form-control" value={targetLang} onChange={e => setTargetLang(e.target.value)}>
                      <option value="vi">🇻🇳 Tiếng Việt</option>
                      <option value="en">🇺🇸 English</option>
                      <option value="th">🇹🇭 Thai</option>
                      <option value="id">🇮🇩 Indonesian</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !urlList.length}>
              {loading ? <span className="spinner" /> : (addToPipeline ? <Zap size={15}/> : <Plus size={15}/>)}
              {loading ? 'Đang xử lý...' : addToPipeline ? `Thêm & vào Pipeline (${urlList.length})` : `Thêm ${urlList.length} nguồn`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add To Pipeline Modal (từ row có sẵn) ─────────────────────────
function AddToPipelineModal({ source, channels, onClose, onDone }) {
  const [channelId, setChannelId] = useState('');
  const [priority, setPriority]   = useState('NORMAL');
  const [lang, setLang]           = useState('vi');
  const [title, setTitle]         = useState(source.title || '');
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await jobAPI.create({
        sourceUrl: source.sourceUrl,
        videoSourceId: source.id,
        title: title || null,
        targetChannelId: channelId || null,
        priority,
        targetLanguage: lang,
      });
      toast.success('✅ Đã thêm vào Pipeline!');
      onDone();
      onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi tạo job'); }
    setLoading(false);
  };

  const activeJobs = source.jobs?.filter(j => j.currentStep !== 'DONE' && j.currentStep !== 'FAILED') || [];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">🚀 Đưa vào Pipeline</div>
          <button className="btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Warning nếu đang có job active */}
            {activeJobs.length > 0 && (
              <div style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13,
              }}>
                ⚠️ Nguồn này đang có <strong>{activeJobs.length} job</strong> đang xử lý. Vẫn muốn tạo thêm?
              </div>
            )}
            {/* Source info */}
            <div style={{ background: 'var(--bg-card-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, border: '1px solid var(--border)' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 4 }}>
                {SOURCE_TYPE_EMOJI[source.sourceType]} {source.sourceType}
              </div>
              <a href={source.sourceUrl} target="_blank" rel="noopener"
                style={{ color: 'var(--accent)', fontSize: 13, wordBreak: 'break-all', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                {source.sourceUrl} <ExternalLink size={12} style={{ flexShrink: 0, marginTop: 2 }}/>
              </a>
            </div>
            <div className="form-group">
              <label className="form-label">Tiêu đề (tuỳ chọn)</label>
              <input className="form-control" placeholder="Tiêu đề cho job này..."
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Kênh đích</label>
                <select className="form-control" value={channelId} onChange={e => setChannelId(e.target.value)}>
                  <option value="">-- Gán sau --</option>
                  {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ngôn ngữ đích</label>
                <select className="form-control" value={lang} onChange={e => setLang(e.target.value)}>
                  <option value="vi">🇻🇳 Tiếng Việt</option>
                  <option value="en">🇺🇸 English</option>
                  <option value="th">🇹🇭 Thai</option>
                  <option value="id">🇮🇩 Indonesian</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Độ ưu tiên</label>
              <select className="form-control" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="HIGH">🔴 Cao</option>
                <option value="NORMAL">🔵 Thường</option>
                <option value="LOW">⚪ Thấp</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : <GitBranch size={15}/>}
              Thêm vào Pipeline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function SourcesPage() {
  const { isAtLeast } = useAuth();
  const [sources, setSources]           = useState([]);
  const [channels, setChannels]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [pipelineSource, setPipelineSource] = useState(null);
  const [search, setSearch]             = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterPipeline, setFilterPipeline] = useState(''); // '' | 'in' | 'out'

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, cr] = await Promise.all([
        sourceAPI.getAll({ search: search || undefined, sourceType: filterType || undefined }),
        channelAPI.getAll(),
      ]);
      setSources(sr.data.sources);
      setChannels(cr.data.channels);
    } catch (err) { toast.error('Lỗi tải nguồn'); }
    setLoading(false);
  }, [search, filterType]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleDelete = async (id) => {
    if (!confirm('Xóa nguồn này?')) return;
    try { await sourceAPI.delete(id); toast.success('Đã xóa'); fetchSources(); }
    catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  // Client-side filter for pipeline status
  const displayed = sources.filter(s => {
    if (!filterPipeline) return true;
    const hasActive = s.jobs?.some(j => j.currentStep !== 'DONE' && j.currentStep !== 'FAILED');
    const hasDone   = s.jobs?.some(j => j.currentStep === 'DONE');
    const noneInPipeline = !s.jobs || s.jobs.length === 0;
    if (filterPipeline === 'none')   return noneInPipeline;
    if (filterPipeline === 'active') return hasActive;
    if (filterPipeline === 'done')   return hasDone && !hasActive;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">🔍 Nguồn Video</div>
          <div className="page-subtitle">Quản lý URL nguồn – thêm vào Pipeline để xử lý</div>
        </div>
        {isAtLeast('SOURCER') && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16}/> Thêm nguồn
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ padding: '0 24px 14px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          className="form-control" style={{ width: 240 }}
          placeholder="🔍 Tìm kiếm URL, tiêu đề..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select className="form-control" style={{ width: 150 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Tất cả nền tảng</option>
          <option value="YOUTUBE">▶ YouTube</option>
          <option value="TIKTOK">🎵 TikTok</option>
          <option value="FACEBOOK">f Facebook</option>
          <option value="OTHER">🔗 Khác</option>
        </select>
        <select className="form-control" style={{ width: 180 }} value={filterPipeline} onChange={e => setFilterPipeline(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="none">⚪ Chưa vào Pipeline</option>
          <option value="active">🔄 Đang xử lý</option>
          <option value="done">✅ Đã hoàn thành</option>
        </select>
        <span className="text-xs text-muted" style={{ alignSelf: 'center', marginLeft: 4 }}>
          {displayed.length}/{sources.length} nguồn
        </span>
      </div>

      <div className="page-content" style={{ paddingTop: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>URL Nguồn</th>
                  <th>Nền tảng</th>
                  <th>Tiêu đề</th>
                  <th>Trạng thái Pipeline</th>
                  <th>Người thêm</th>
                  <th>Ngày thêm</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr><td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon"><Link size={40}/></div>
                      <div>Không tìm thấy nguồn nào</div>
                    </div>
                  </td></tr>
                )}
                {displayed.map(s => {
                  const allDone   = s.jobs?.length > 0 && s.jobs.every(j => j.currentStep === 'DONE');
                  const hasActive = s.jobs?.some(j => j.currentStep !== 'DONE' && j.currentStep !== 'FAILED');
                  return (
                    <tr key={s.id} style={{ opacity: allDone ? 0.7 : 1 }}>
                      <td>
                        <a href={s.sourceUrl} target="_blank" rel="noopener"
                          style={{ color: 'var(--accent)', fontSize: 13, maxWidth: 240, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.sourceUrl}
                        </a>
                      </td>
                      <td>
                        <span className={`badge ${SOURCE_TYPE_BADGE[s.sourceType]}`}>
                          {SOURCE_TYPE_EMOJI[s.sourceType]} {s.sourceType}
                        </span>
                      </td>
                      <td className="text-muted text-sm" style={{ maxWidth: 160 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.title || '—'}
                        </span>
                      </td>
                      <td>
                        <PipelineStatus jobs={s.jobs} />
                      </td>
                      <td className="text-sm">{s.addedBy?.name || '—'}</td>
                      <td className="text-muted text-sm">{new Date(s.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <div className="flex gap-2">
                          {isAtLeast('SOURCER') && (
                            <button
                              className={`btn btn-sm ${hasActive ? 'btn-secondary' : 'btn-primary'}`}
                              onClick={() => setPipelineSource(s)}
                              title={hasActive ? 'Đang có job trong pipeline' : 'Đưa vào Pipeline'}
                            >
                              <GitBranch size={12}/>
                              {hasActive ? 'Thêm job' : 'Pipeline'}
                            </button>
                          )}
                          {isAtLeast('MANAGER') && (
                            <button className="btn-icon" onClick={() => handleDelete(s.id)}
                              style={{ color: 'var(--red)' }} title="Xóa">
                              <Trash2 size={14}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AddSourceModal
          channels={channels}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchSources(); }}
        />
      )}
      {pipelineSource && (
        <AddToPipelineModal
          source={pipelineSource}
          channels={channels}
          onClose={() => setPipelineSource(null)}
          onDone={fetchSources}
        />
      )}
    </div>
  );
}
