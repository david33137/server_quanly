import prisma from '../lib/prisma.js';
import { logActivity } from '../services/logService.js';

// Default languages
const DEFAULT_LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'th', name: 'Thái Lan', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
];

const seedLanguages = async () => {
  const count = await prisma.targetLanguage.count();
  if (count === 0) {
    await prisma.targetLanguage.createMany({
      data: DEFAULT_LANGUAGES
    });
  }
};

// GET /api/languages
export const getLanguages = async (req, res) => {
  try {
    await seedLanguages();
    const languages = await prisma.targetLanguage.findMany({
      orderBy: { name: 'asc' }
    });
    return res.json({ languages });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/languages
export const createLanguage = async (req, res) => {
  try {
    const { code, name, flag } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'Mã và tên ngôn ngữ là bắt buộc' });

    const language = await prisma.targetLanguage.create({
      data: { code, name, flag }
    });

    await logActivity({
      userId: req.user.id,
      action: 'LANGUAGE_CREATED',
      entityType: 'GMAIL', // Reuse GMAIL or add new EntityType if needed
      metadata: { code, name }
    });

    return res.status(201).json({ language });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Mã ngôn ngữ đã tồn tại' });
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/languages/:id
export const updateLanguage = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, flag, isActive } = req.body;

    const language = await prisma.targetLanguage.update({
      where: { id },
      data: { code, name, flag, isActive }
    });

    await logActivity({
      userId: req.user.id,
      action: 'LANGUAGE_UPDATED',
      metadata: { id, code, name }
    });

    return res.json({ language });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /api/languages/:id
export const deleteLanguage = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.targetLanguage.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      action: 'LANGUAGE_DELETED',
      metadata: { id }
    });

    return res.json({ message: 'Đã xóa ngôn ngữ' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
