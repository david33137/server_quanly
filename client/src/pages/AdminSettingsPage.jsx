import { useState, useEffect, useCallback } from 'react';
import { settingsAPI, languageAPI } from '../api/index.js';
import toast from 'react-hot-toast';
import {
  Save, RotateCcw, Settings, Zap, Server,
  Globe, Plus, Trash2, X, Edit2, Check,
} from 'lucide-react';

// ─── Shared: Tab Bar ────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4,
      padding: '0 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-card)',
      flexShrink: 0,
    }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '11px 16px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: active === t.key ? 600 : 400,
            color: active === t.key ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: active === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          <t.Icon size={14} /> {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────
function Toggle({ id, checked, onChange }) {
  return (
    <label htmlFor={id} style={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}>
      <input
        id={id} type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <div style={{
        width: 48, height: 26, borderRadius: 26, position: 'relative',
        background: checked ? 'var(--accent)' : 'var(--bg-card-2)',
        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        transition: 'all 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: checked ? 25 : 3,
          width: 18, height: 18, borderRadius: '50%',
          background: checked ? '#fff' : 'var(--text-muted)',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }} />
      </div>
    </label>
  );
}

// ─── Setting Row ─────────────────────────────────────────────────────────────
function SettingRow({ setting, onChange, isLast }) {
  const val = setting.type === 'boolean' ? setting.value === 'true'
            : setting.type === 'number'  ? (parseFloat(setting.value) || 0)
            : setting.value;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{setting.label}</div>
        {setting.description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {setting.description}
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--border-light)', marginTop: 4, fontFamily: 'monospace' }}>
          {setting.key}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {setting.type === 'boolean' && (
          <Toggle id={setting.key} checked={val}
            onChange={v => onChange(setting.key, String(v))} />
        )}
        {setting.type === 'number' && (
          <input type="number" className="form-control"
            style={{ width: 90, textAlign: 'center' }}
            value={val} min={0}
            onChange={e => onChange(setting.key, e.target.value)} />
        )}
        {setting.type === 'string' && (
          <input className="form-control"
            style={{ width: 200 }} value={val}
            onChange={e => onChange(setting.key, e.target.value)} />
        )}
      </div>
    </div>
  );
}

// ─── Group metadata ───────────────────────────────────────────────────────────
const GROUP_META = {
  pipeline: { label: 'Pipeline', icon: '🔄', color: 'var(--accent)' },
  general:  { label: 'Chung',    icon: '⚙️',  color: 'var(--purple)' },
  worker:   { label: 'Worker',   icon: '🤖',  color: 'var(--green)'  },
};

// ─── TAB 1: General Settings ─────────────────────────────────────────────────
function GeneralTab() {
  const [settings, setSettings] = useState([]);
  const [draft, setDraft]       = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsAPI.getAll();
      const list = res.data.settings || [];
      setSettings(list);
      const init = {};
      list.forEach(s => { init[s.key] = s.value; });
      setDraft(init);
    } catch { toast.error('Không thể tải cài đặt'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = (key, value) => setDraft(d => ({ ...d, [key]: value }));

  const dirty = settings.some(s => draft[s.key] !== s.value);
  const changedCount = settings.filter(s => draft[s.key] !== s.value).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const changed = {};
      settings.forEach(s => { if (draft[s.key] !== s.value) changed[s.key] = draft[s.key]; });
      if (!Object.keys(changed).length) { toast('Không có thay đổi nào', { icon: 'ℹ️' }); setSaving(false); return; }
      await settingsAPI.bulkUpdate(changed);
      toast.success(`✅ Đã lưu ${Object.keys(changed).length} cài đặt`);
      fetchSettings();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi khi lưu'); }
    setSaving(false);
  };

  const handleReset = () => {
    const init = {};
    settings.forEach(s => { init[s.key] = s.value; });
    setDraft(init);
    toast('Đã hoàn tác', { icon: '↩️' });
  };

  // Group settings
  const grouped = {};
  settings.forEach(s => {
    if (!grouped[s.group]) grouped[s.group] = [];
    grouped[s.group].push({ ...s, value: draft[s.key] ?? s.value });
  });

  if (loading) return (
    <div style={{ textAlign: 'center', paddingTop: 80 }}>
      <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Cấu hình hệ thống</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Thiết lập các thông số hoạt động của hệ thống pipeline
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {dirty && (
            <button className="btn btn-secondary" onClick={handleReset} disabled={saving}>
              <RotateCcw size={14}/> Hoàn tác ({changedCount})
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <span className="spinner" /> : <Save size={14}/>}
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Auto-approve banner */}
      {draft['auto_approve_pipeline'] === 'true' && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
        }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--yellow)', fontSize: 13 }}>Tự động duyệt đang BẬT</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Job mới tạo sẽ bỏ qua bước "Đề xuất" và chuyển thẳng sang "Chờ xử lý".
            </div>
          </div>
        </div>
      )}

      {/* Setting groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(grouped).map(([group, groupSettings]) => {
          const meta = GROUP_META[group] || { label: group, icon: '⚙️', color: 'var(--text-muted)' };
          const groupChanged = groupSettings.filter(s => s.value !== settings.find(x => x.key === s.key)?.value).length;

          return (
            <div key={group} className="card">
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 18 }}>{meta.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</div>
                {groupChanged > 0 && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                    background: 'rgba(245,158,11,0.12)', color: 'var(--yellow)',
                    border: '1px solid rgba(245,158,11,0.25)', borderRadius: 100, padding: '2px 10px',
                  }}>
                    {groupChanged} thay đổi
                  </span>
                )}
              </div>

              {/* Setting rows */}
              {groupSettings.map((s, i) => (
                <SettingRow key={s.key} setting={s} onChange={handleChange}
                  isLast={i === groupSettings.length - 1} />
              ))}
            </div>
          );
        })}

        {settings.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">⚙️</div>
            <div>Chưa có cài đặt nào</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Language Modal ───────────────────────────────────────────────────────────
function LanguageModal({ language, onClose, onSaved }) {
  const [form, setForm] = useState({ code: '', name: '', flag: '', isActive: true, ...language });
  const [loading, setLoading] = useState(false);
  const isEdit = !!language?.id;
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) await languageAPI.update(language.id, form);
      else await languageAPI.create(form);
      toast.success(isEdit ? 'Đã cập nhật ngôn ngữ' : 'Đã thêm ngôn ngữ');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? '✏️ Sửa ngôn ngữ' : '🌐 Thêm ngôn ngữ'}</div>
          <button className="btn-icon" onClick={onClose}><X size={15}/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ paddingTop: 20, paddingBottom: 20 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Mã ngôn ngữ *</label>
                <input className="form-control" value={form.code}
                  placeholder="vi, en, th..." onChange={set('code')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Flag (emoji)</label>
                <input className="form-control" value={form.flag || ''}
                  placeholder="🇻🇳" onChange={set('flag')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Tên hiển thị *</label>
              <input className="form-control" value={form.name}
                placeholder="Tiếng Việt, English..." onChange={set('name')} required autoFocus />
            </div>
            {isEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Toggle id="lang-active" checked={form.isActive}
                  onChange={v => setForm(f => ({ ...f, isActive: v }))} />
                <label htmlFor="lang-active" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  Hiển thị trong danh sách chọn
                </label>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : <Check size={15}/>}
              {isEdit ? 'Lưu thay đổi' : 'Thêm ngôn ngữ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── TAB 2: Languages ─────────────────────────────────────────────────────────
function LanguagesTab() {
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null); // null | 'new' | {language obj}

  const fetchLanguages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await languageAPI.getAll();
      setLanguages(res.data.languages || []);
    } catch { toast.error('Không thể tải ngôn ngữ'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLanguages(); }, [fetchLanguages]);

  const handleDelete = async (lang) => {
    if (!confirm(`Xóa ngôn ngữ "${lang.name}"?`)) return;
    try { await languageAPI.delete(lang.id); toast.success('Đã xóa'); fetchLanguages(); }
    catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  const handleToggleActive = async (lang) => {
    try {
      await languageAPI.update(lang.id, { isActive: !lang.isActive });
      fetchLanguages();
    } catch (err) { toast.error('Lỗi'); }
  };

  if (loading) return (
    <div style={{ textAlign: 'center', paddingTop: 80 }}>
      <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ngôn ngữ đích</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Quản lý danh sách ngôn ngữ dùng trong các form pipeline, nguồn video
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}>
          <Plus size={15}/> Thêm ngôn ngữ
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {languages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌐</div>
            <div>Chưa có ngôn ngữ nào</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Mã', 'Tên hiển thị', 'Flag', 'Hiển thị', 'Thao tác'].map(h => (
                  <th key={h} style={{
                    background: 'var(--bg-card-2)', color: 'var(--text-muted)',
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '12px 16px', textAlign: h === 'Thao tác' ? 'right' : 'left',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {languages.map((lang, i) => (
                <tr key={lang.id} style={{
                  borderBottom: i < languages.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '13px 16px' }}>
                    <code style={{
                      background: 'var(--bg-card-2)', padding: '3px 8px',
                      borderRadius: 6, fontSize: 12, border: '1px solid var(--border)',
                      color: 'var(--accent)', fontWeight: 600,
                    }}>{lang.code}</code>
                  </td>
                  <td style={{ padding: '13px 16px', fontWeight: 500 }}>{lang.name}</td>
                  <td style={{ padding: '13px 16px', fontSize: 22 }}>{lang.flag || '—'}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <Toggle id={`toggle-${lang.id}`} checked={lang.isActive}
                      onChange={() => handleToggleActive(lang)} />
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                    <div className="flex gap-2 justify-end">
                      <button className="btn-icon" title="Sửa" onClick={() => setModal(lang)}>
                        <Edit2 size={13}/>
                      </button>
                      <button className="btn-icon" title="Xóa" onClick={() => handleDelete(lang)}
                        style={{ color: 'var(--red)' }}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
        {languages.filter(l => l.isActive).length}/{languages.length} ngôn ngữ đang hiển thị
      </div>

      {modal && (
        <LanguageModal
          language={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchLanguages(); }}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'general',   label: 'Cấu hình chung',  Icon: Settings },
  { key: 'languages', label: 'Ngôn ngữ đích',   Icon: Globe    },
];

export default function AdminSettingsPage() {
  const [tab, setTab] = useState('general');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Cài đặt Hệ thống</div>
          <div className="page-subtitle">Cấu hình tính năng và hành vi của hệ thống</div>
        </div>
      </div>

      {/* Tab bar */}
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {/* Content */}
      <div className="page-content">
        {tab === 'general'   && <GeneralTab />}
        {tab === 'languages' && <LanguagesTab />}
      </div>
    </div>
  );
}
