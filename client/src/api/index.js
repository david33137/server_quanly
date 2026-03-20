import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor – attach JWT
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor – handle 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.patch('/auth/me', data),
  register: (data) => api.post('/auth/register', data),
  getUsers: (params) => api.get('/auth/users', { params }),
  updateUser: (id, data) => api.patch(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};

// ─── Gmail ────────────────────────────────────────
export const gmailAPI = {
  getAll: (params) => api.get('/gmail', { params }),
  getById: (id) => api.get(`/gmail/${id}`),
  create: (data) => api.post('/gmail', data),
  bulkCreate: (data) => api.post('/gmail/bulk', data),
  update: (id, data) => api.patch(`/gmail/${id}`, data),
  delete: (id) => api.delete(`/gmail/${id}`),
};

// ─── Channels ─────────────────────────────────────
export const channelAPI = {
  getAll: (params) => api.get('/channels', { params }),
  getById: (id) => api.get(`/channels/${id}`),
  create: (data) => api.post('/channels', data),
  update: (id, data) => api.patch(`/channels/${id}`, data),
  delete: (id) => api.delete(`/channels/${id}`),
};

// ─── Teams ────────────────────────────────────────
export const teamAPI = {
  getAll: () => api.get('/teams'),
  getById: (id) => api.get(`/teams/${id}`),
  create: (data) => api.post('/teams', data),
  update: (id, data) => api.patch(`/teams/${id}`, data),
  delete: (id) => api.delete(`/teams/${id}`),
  addMember: (teamId, userId) => api.post(`/teams/${teamId}/members`, { userId }),
  removeMember: (teamId, userId) => api.delete(`/teams/${teamId}/members/${userId}`),
};

// ─── Sources ──────────────────────────────────────
export const sourceAPI = {
  getAll: (params) => api.get('/sources', { params }),
  create: (data) => api.post('/sources', data),
  bulkCreate: (sources, options = {}) => api.post('/sources/bulk', { sources, ...options }),
  delete: (id) => api.delete(`/sources/${id}`),
};

// ─── Jobs ─────────────────────────────────────────
export const jobAPI = {
  getAll: (params) => api.get('/jobs', { params }),
  getStats: () => api.get('/jobs/stats'),
  getById: (id) => api.get(`/jobs/${id}`),
  create: (data) => api.post('/jobs', data),
  bulkCreate: (jobs) => api.post('/jobs/bulk', { jobs }),
  update: (id, data) => api.patch(`/jobs/${id}`, data),
  assignChannel: (id, targetChannelId) => api.patch(`/jobs/${id}/assign-channel`, { targetChannelId }),
  approve: (id) => api.post(`/jobs/${id}/approve`),
  assign: (id, assignedToId) => api.post(`/jobs/${id}/assign`, { assignedToId }),
  startUpload: (id, data) => api.post(`/jobs/${id}/start-upload`, data),
  markUploaded: (id, data) => api.post(`/jobs/${id}/mark-uploaded`, data),
  moveStep: (id, data) => api.post(`/jobs/${id}/move-step`, data),
  fail: (id, errorMessage) => api.post(`/jobs/${id}/fail`, { errorMessage }),
  requeue: (id) => api.post(`/jobs/${id}/requeue`),
  delete: (id) => api.delete(`/jobs/${id}`),
};

// ─── Logs ─────────────────────────────────────────
export const logAPI = {
  getDashboard: () => api.get('/logs/dashboard'),
  getActivity: (params) => api.get('/logs/activity', { params }),
  getJobLogs: (id) => api.get(`/logs/jobs/${id}`),
  getWorkers: () => api.get('/logs/workers'),
};

// ─── Worker Tokens ────────────────────────────────
export const workerAPI = {
  getTokens: () => api.get('/worker/tokens'),
  createToken: (name) => api.post('/worker/tokens', { name }),
  updateToken: (id, data) => api.patch(`/worker/tokens/${id}`, data),
  deleteToken: (id) => api.delete(`/worker/tokens/${id}`),
};

// ─── System Settings ──────────────────────────────
export const settingsAPI = {
  getAll: () => api.get('/settings'),
  update: (key, value) => api.patch(`/settings/${key}`, { value }),
  bulkUpdate: (settings) => api.patch('/settings/bulk', { settings }),
};

// ─── Target Languages ─────────────────────────────
export const languageAPI = {
  getAll: () => api.get('/languages'),
  create: (data) => api.post('/languages', data),
  update: (id, data) => api.patch(`/languages/${id}`, data),
  delete: (id) => api.delete(`/languages/${id}`),
};

export default api;
