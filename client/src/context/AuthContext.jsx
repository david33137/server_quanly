import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/index.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.getMe()
        .then(res => setUser(res.data.user))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const hasRole = (...roles) => user && roles.includes(user.role);
  const isAtLeast = (minRole) => {
    const levels = { ADMIN: 5, MANAGER: 4, EDITOR: 3, SOURCER: 2, VIEWER: 1 };
    return user ? (levels[user.role] || 0) >= (levels[minRole] || 0) : false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, isAtLeast }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

export default AuthContext;
