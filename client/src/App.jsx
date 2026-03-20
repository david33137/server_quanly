import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

// Pages
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PipelinePage from './pages/PipelinePage.jsx';
import GmailPage from './pages/GmailPage.jsx';
import ChannelsPage from './pages/ChannelsPage.jsx';
import TeamsPage from './pages/TeamsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import LogsPage from './pages/LogsPage.jsx';
import WorkersPage from './pages/WorkersPage.jsx';
import SourcesPage from './pages/SourcesPage.jsx';
import AdminSettingsPage from './pages/AdminSettingsPage.jsx';

// Layout
import AppLayout from './components/layout/AppLayout.jsx';

const ProtectedRoute = ({ children, minRole }) => {
  const { user, loading, isAtLeast } = useAuth();
  if (loading) return <div className="login-page"><div className="spinner spinner-lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (minRole && !isAtLeast(minRole)) return <Navigate to="/dashboard" replace />;
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="channels" element={<ChannelsPage />} />
        <Route path="gmail" element={<ProtectedRoute minRole="MANAGER"><GmailPage /></ProtectedRoute>} />
        <Route path="teams" element={<ProtectedRoute minRole="MANAGER"><TeamsPage /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute minRole="ADMIN"><UsersPage /></ProtectedRoute>} />
        <Route path="workers" element={<ProtectedRoute minRole="ADMIN"><WorkersPage /></ProtectedRoute>} />
        <Route path="logs" element={<ProtectedRoute minRole="MANAGER"><LogsPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute minRole="ADMIN"><AdminSettingsPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
