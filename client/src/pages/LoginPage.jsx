import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Đăng nhập thành công!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🎬</div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: 6 }}>YT Reup Manager</h1>
          <p className="text-muted text-sm">Hệ thống quản lý YouTube Re-upload</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              id="login-email"
              type="email"
              className="form-control"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <input
              id="login-password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button id="login-submit" type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
            {loading ? <><span className="spinner" /> Đang đăng nhập...</> : 'Đăng nhập'}
          </button>
        </form>
        <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-card-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <p className="text-xs text-muted mb-4" style={{ fontWeight: 600, marginBottom: 8 }}>Tài khoản mẫu:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { role: 'Admin', email: 'admin@ytreup.com', pass: 'Admin@123' },
              { role: 'Manager', email: 'manager.alpha@ytreup.com', pass: 'Manager@123' },
              { role: 'Sourcer', email: 'sourcer1@ytreup.com', pass: 'Sourcer@123' },
            ].map(acc => (
              <button key={acc.role} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', fontFamily: 'monospace', fontSize: 11 }}
                onClick={() => { setEmail(acc.email); setPassword(acc.pass); }}>
                [{acc.role}] {acc.email}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
