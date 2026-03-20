import prisma from '../lib/prisma.js';
import { logActivity } from '../services/logService.js';

// Default settings – seeded if not present
const DEFAULTS = [
  {
    key: 'auto_approve_pipeline',
    value: 'false',
    type: 'boolean',
    label: 'Tự động duyệt Pipeline',
    description: 'Khi bật, job mới tạo sẽ tự động chuyển từ Đề xuất → Chờ xử lý mà không cần MANAGER duyệt thủ công.',
    group: 'pipeline',
  },
  {
    key: 'pipeline_max_processing',
    value: '10',
    type: 'number',
    label: 'Giới hạn job đang xử lý',
    description: 'Số lượng job tối đa có thể ở trạng thái Đang xử lý cùng lúc (0 = không giới hạn).',
    group: 'pipeline',
  },
  {
    key: 'allow_worker_auto_fail',
    value: 'true',
    type: 'boolean',
    label: 'Worker tự động đánh dấu thất bại',
    description: 'Khi bật, worker có thể tự chuyển job sang Thất bại khi gặp lỗi. Khi tắt, cần MANAGER xác nhận.',
    group: 'pipeline',
  },
];

// Ensure defaults exist in DB
const seedDefaults = async () => {
  for (const setting of DEFAULTS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},  // don't overwrite existing values
      create: setting,
    });
  }
};

// GET /api/settings
export const getSettings = async (req, res) => {
  try {
    await seedDefaults();
    const settings = await prisma.systemSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
    return res.json({ settings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/settings/:key  – lightweight read for internal use
export const getSetting = async (key) => {
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  if (!s) return null;
  if (s.type === 'boolean') return s.value === 'true';
  if (s.type === 'number')  return parseFloat(s.value);
  return s.value;
};

// PATCH /api/settings/:key
export const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value là bắt buộc' });

    const existing = await prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) return res.status(404).json({ error: `Setting "${key}" không tồn tại` });

    const setting = await prisma.systemSetting.update({
      where: { key },
      data: { value: String(value), updatedById: req.user.id },
    });
    await logActivity({
      userId: req.user.id,
      action: 'SETTING_UPDATED',
      entityType: 'WORKER',
      metadata: { key, oldValue: existing.value, newValue: String(value) },
    });
    return res.json({ setting });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/settings  – bulk update
export const bulkUpdateSettings = async (req, res) => {
  try {
    const { settings } = req.body; // { key: value }
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object là bắt buộc' });

    const results = [];
    for (const [key, value] of Object.entries(settings)) {
      const existing = await prisma.systemSetting.findUnique({ where: { key } });
      if (!existing) continue;
      const updated = await prisma.systemSetting.update({
        where: { key },
        data: { value: String(value), updatedById: req.user.id },
      });
      results.push(updated);
    }
    await logActivity({ userId: req.user.id, action: 'SETTING_UPDATED', metadata: { keys: Object.keys(settings) } });
    return res.json({ settings: results, updated: results.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
