import { useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../api/index.js';
import toast from 'react-hot-toast';
import { Save, RotateCcw, Settings, Zap, Server } from 'lucide-react';

// ─── Group metadata ────────────────────────────────────────────────
const GROUP_META = {
  pipeline: { label: '🔄 Pipeline', icon: Zap,    color: 'var(--accent)'  },
  general:  { label: '⚙️ Chung',    icon: Settings, color: 'var(--purple)' },
  worker:   { label: '🤖 Worker',   icon: Server,   color: 'var(--green)'  },
};

// ─── Toggle Switch ─────────────────────────────────────────────────
function SettingToggle({ id, checked, onChange }) {
  return (
    <label htmlFor={id} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: 10 }}>
      <div style={{ position: 'relative', width: 48, height: 26 }}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
        />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 26,
          background: checked ? 'var(--accent)' : 'var(--bg-card-2)',
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
          transition: 'all 0.2s ease',
        }} />
        <div style={{
          position: 'absolute', top: 3, left: checked ? 25 : 3,
          width: 18, height: 18, borderRadius: '50%',
          background: checked ? '#fff' : 'var(--text-muted)',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }} />
      </div>
    </label>
  );
}

// ─── Number Input ──────────────────────────────────────────────────
function SettingNumber({ id, value, onChange }) {
  return (
    <input
      id={id}
      type="number"
      className="form-control"
      style={{ width: 90, textAlign: 'center' }}
      value={value}
      min={0}
      onChange={e => onChange(e.target.value)}
    />
  );
}

// ─── Setting Row ───────────────────────────────────────────────────
function SettingRow({ setting, onChange }) {
  const cast = (s) => {
    if (s.type === 'boolean') return s.value === 'true';
    if (s.type === 'number')  return parseFloat(s.value) || 0;
    return s.value;
  };

  const val = cast(setting);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, marginRight: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{setting.label}</div>
        {setting.description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
            {setting.description}
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace', opacity: 0.6 }}>
          key: {setting.key}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {setting.type === 'boolean' && (
          <SettingToggle
            id={setting.key}
            checked={val}
            onChange={v => onChange(setting.key, String(v), setting.type)}
          />
        )}
        {setting.type === 'number' && (
          <SettingNumber
            id={setting.key}
            value={val}
            onChange={v => onChange(setting.key, v, setting.type)}
          />
        )}
        {setting.type === 'string' && (
          <input
            id={setting.key}
            className="form-control"
            style={{ width: 200 }}
            value={val}
            onChange={e => onChange(setting.key, e.target.value, setting.type)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const [settings, setSettings] = useState([]);  // raw from API
  const [draft, setDraft]       = useState({});   // { key: value string }
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsAPI.getAll();
      const list = res.data.settings || [];
      setSettings(list);
      const initial = {};
      list.forEach(s => { initial[s.key] = s.value; });
      setDraft(initial);
      setDirty(false);
    } catch (err) { toast.error('Không thể tải cài đặt'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = (key, value) => {
    setDraft(d => ({ ...d, [key]: String(value) }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Find changed settings only
      const changed = {};
      settings.forEach(s => {
        if (draft[s.key] !== s.value) changed[s.key] = draft[s.key];
      });
      if (Object.keys(changed).length === 0) {
        toast('Không có thay đổi nào', { icon: 'ℹ️' });
        setSaving(false);
        return;
      }
      await settingsAPI.bulkUpdate(changed);
      toast.success(`✅ Đã lưu ${Object.keys(changed).length} cài đặt`);
      fetchSettings();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi khi lưu'); }
    setSaving(false);
  };

  const handleReset = () => {
    const initial = {};
    settings.forEach(s => { initial[s.key] = s.value; });
    setDraft(initial);
    setDirty(false);
    toast('Đã hoàn tác thay đổi', { icon: '↩️' });
  };

  // Group settings
  const grouped = {};
  settings.forEach(s => {
    if (!grouped[s.group]) grouped[s.group] = [];
    const withDraft = { ...s, value: draft[s.key] ?? s.value };
    grouped[s.group].push(withDraft);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Cài đặt Hệ thống</div>
          <div className="page-subtitle">Cấu hình tính năng và hành vi của hệ thống</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {dirty && (
            <button className="btn btn-secondary" onClick={handleReset} disabled={saving}>
              <RotateCcw size={15}/> Hoàn tác
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <span className="spinner" /> : <Save size={15}/>}
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            {dirty && !saving && <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 100, padding: '1px 7px', fontSize: 11 }}>
              {settings.filter(s => (draft[s.key] ?? s.value) !== s.value).length} thay đổi
            </span>}
          </button>
        </div>
      </div>

      <div className="page-content">
        {loading
          ? <div style={{ textAlign: 'center', paddingTop: 80 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div>
          : (
            <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Auto-approve banner */}
              {draft['auto_approve_pipeline'] === 'true' && (
                <div style={{
                  background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)',
                  borderRadius: 10, padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 20 }}>⚡</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--yellow)', fontSize: 14 }}>Tự động duyệt đang BẬT</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                      Job mới tạo sẽ <strong>bỏ qua bước Đề xuất</strong> và chuyển thẳng sang <strong>Chờ xử lý</strong>.
                      MANAGER sẽ không cần duyệt thủ công.
                    </div>
                  </div>
                </div>
              )}

              {/* Setting groups */}
              {Object.entries(grouped).map(([group, groupSettings]) => {
                const meta = GROUP_META[group] || { label: group, icon: Settings, color: 'var(--text-secondary)' };
                const Icon = meta.icon;
                const changedCount = groupSettings.filter(s => (draft[s.key] ?? s.value) !== settings.find(x => x.key === s.key)?.value).length;

                return (
                  <div className="card" key={group}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: `${meta.color}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: meta.color, flexShrink: 0,
                      }}>
                        <Icon size={16}/>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{meta.label}</div>
                      {changedCount > 0 && (
                        <span style={{ marginLeft: 'auto', background: 'rgba(245,158,11,0.15)', color: 'var(--yellow)', borderRadius: 100, padding: '2px 10px', fontSize: 11, border: '1px solid rgba(245,158,11,0.3)' }}>
                          {changedCount} thay đổi chưa lưu
                        </span>
                      )}
                    </div>

                    {groupSettings.map((s, i) => (
                      <SettingRow
                        key={s.key}
                        setting={s}
                        onChange={handleChange}
                      />
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
          )
        }
      </div>
    </div>
  );
}
