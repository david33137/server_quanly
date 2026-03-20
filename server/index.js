import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();

// Ensure logs directory exists
const __dirname = dirname(fileURLToPath(import.meta.url));
const logsDir = join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

import logger from './lib/logger.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import gmailRoutes from './routes/gmailRoutes.js';
import channelRoutes from './routes/channelRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import sourceRoutes from './routes/sourceRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import workerRoutes from './routes/workerRoutes.js';
import logRoutes from './routes/logRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

const app = express();
const PORT = process.env.PORT || 3031;

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ─── API Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), version: '1.0.0' });
});

// ─── Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  logger.info(`📦 Mode: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
