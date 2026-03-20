import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { logActivity } from '../services/logService.js';

// GET /api/gmail
export const getGmailAccounts = async (req, res) => {
  try {
    const { teamId, status, search } = req.query;
    const where = {};
    // Manager chỉ xem gmail của team mình
    if (req.user.role === 'MANAGER') where.teamId = req.user.teamId;
    if (teamId && req.user.role === 'ADMIN') where.teamId = teamId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }
    const gmails = await prisma.gmailAccount.findMany({
      where,
      include: { team: { select: { id: true, name: true } }, channels: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    // Ẩn mật khẩu
    const safe = gmails.map(g => ({ ...g, passwordEnc: '••••••••', backupCodes: g.backupCodes ? '••••••••' : null }));
    return res.json({ gmails: safe });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/gmail/:id
export const getGmailById = async (req, res) => {
  try {
    const gmail = await prisma.gmailAccount.findUnique({
      where: { id: req.params.id },
      include: { team: true, channels: true },
    });
    if (!gmail) return res.status(404).json({ error: 'Gmail không tồn tại' });
    return res.json({ gmail: { ...gmail, passwordEnc: '••••••••', backupCodes: gmail.backupCodes ? '••••••••' : null } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/gmail
export const createGmail = async (req, res) => {
  try {
    const { email, password, recoveryEmail, phone, backupCodes, notes, teamId: reqTeamId, status } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    const exists = await prisma.gmailAccount.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ error: 'Gmail đã tồn tại trong hệ thống' });

    // MANAGER chỉ được tạo Gmail trong team mình
    let resolvedTeamId = reqTeamId || null;
    if (req.user.role === 'MANAGER') {
      resolvedTeamId = req.user.teamId || null;
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const passwordEnc = await bcrypt.hash(password, rounds);
    const gmail = await prisma.gmailAccount.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordEnc,
        recoveryEmail,
        phone,
        backupCodes,
        notes,
        teamId: resolvedTeamId,
        status: status || 'ACTIVE',
      },
      include: { team: true },
    });
    await logActivity({ userId: req.user.id, action: 'GMAIL_CREATED', entityType: 'GMAIL', entityId: gmail.id, ipAddress: req.ip });
    return res.status(201).json({ gmail: { ...gmail, passwordEnc: '••••••••' } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/gmail/bulk – Full format: email|password|recovery|phone|status|teamName|notes
export const bulkCreateGmail = async (req, res) => {
  try {
    const { lines, teamId: defaultTeamId, status: defaultStatus = 'ACTIVE' } = req.body;
    if (!lines || !Array.isArray(lines) || lines.length === 0)
      return res.status(400).json({ error: 'Cần cung cấp danh sách' });

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const results = { created: 0, skipped: 0, errors: [] };

    // Cache teams by name for lookup
    const allTeams = await prisma.team.findMany({ select: { id: true, name: true } });
    const teamByName = {};
    allTeams.forEach(t => { teamByName[t.name.toLowerCase()] = t.id; });

    // Detect if first line is header row
    const firstLine = lines[0]?.trim().toLowerCase() || '';
    const isHeader = firstLine.startsWith('email') || firstLine === 'email|password|recovery|phone|status|team|notes';
    const dataLines = isHeader ? lines.slice(1) : lines;

    const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'];

    for (const line of dataLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue; // skip comments

      // Detect separator: pipe has priority, then tab, then colon
      const sep = trimmed.includes('|') ? '|' : trimmed.includes('\t') ? '\t' : ':';
      const parts = trimmed.split(sep).map(p => p.trim());

      if (parts.length < 2) { results.errors.push(`"${trimmed}" – sai định dạng (cần ít nhất email|password)`); continue; }

      const [
        email,
        password,
        recoveryEmail = '',
        phone = '',
        statusRaw = '',
        teamNameRaw = '',
        ...notesParts
      ] = parts;

      const notes = notesParts.join('|').trim(); // join in case notes had pipe chars

      if (!email || !email.includes('@')) { results.errors.push(`"${email || trimmed}" – email không hợp lệ`); continue; }
      if (!password) { results.errors.push(`"${email}" – thiếu mật khẩu`); continue; }

      // Resolve status
      const statusUpper = statusRaw.trim().toUpperCase();
      const status = VALID_STATUSES.includes(statusUpper) ? statusUpper : defaultStatus;

      // Resolve team: by name from line, or fallback to default teamId
      let resolvedTeamId = defaultTeamId || null;
      if (teamNameRaw.trim()) {
        const found = teamByName[teamNameRaw.trim().toLowerCase()];
        if (found) resolvedTeamId = found;
        else results.errors.push(`⚠ Team "${teamNameRaw}" không tồn tại – Gmail "${email}" vẫn được tạo không có team`);
      }

      try {
        const exists = await prisma.gmailAccount.findUnique({ where: { email: email.toLowerCase() } });
        if (exists) { results.skipped++; continue; }

        const passwordEnc = await bcrypt.hash(password, rounds);
        const gmail = await prisma.gmailAccount.create({
          data: {
            email: email.toLowerCase(),
            passwordEnc,
            recoveryEmail: recoveryEmail || null,
            phone: phone || null,
            notes: notes || null,
            teamId: resolvedTeamId,
            status,
          },
        });
        await logActivity({ userId: req.user.id, action: 'GMAIL_CREATED', entityType: 'GMAIL', entityId: gmail.id, ipAddress: req.ip });
        results.created++;
      } catch (e) {
        results.errors.push(`"${email}" – ${e.message}`);
      }
    }

    return res.status(201).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};




// PATCH /api/gmail/:id
export const updateGmail = async (req, res) => {
  try {
    const { id } = req.params;
    // MANAGER chỉ được sửa Gmail của team mình
    if (req.user.role === 'MANAGER') {
      const existing = await prisma.gmailAccount.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Không tìm thấy Gmail' });
      if (existing.teamId !== req.user.teamId) return res.status(403).json({ error: 'Không có quyền sửa Gmail của team khác' });
    }

    const { email, password, recoveryEmail, phone, backupCodes, notes, teamId: reqTeamId, status } = req.body;
    const updateData = { recoveryEmail, phone, notes, status };

    // MANAGER không thể thay đổi team assignment
    if (req.user.role !== 'MANAGER' && reqTeamId !== undefined) {
      updateData.teamId = reqTeamId || null;
    }

    if (email) updateData.email = email.toLowerCase().trim();
    if (password) {
      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
      updateData.passwordEnc = await bcrypt.hash(password, rounds);
    }
    if (backupCodes) updateData.backupCodes = backupCodes;
    const gmail = await prisma.gmailAccount.update({
      where: { id },
      data: updateData,
      include: { team: true },
    });
    await logActivity({ userId: req.user.id, action: 'GMAIL_UPDATED', entityType: 'GMAIL', entityId: id });
    return res.json({ gmail: { ...gmail, passwordEnc: '••••••••' } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


// DELETE /api/gmail/:id
export const deleteGmail = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.gmailAccount.delete({ where: { id } });
    await logActivity({ userId: req.user.id, action: 'GMAIL_DELETED', entityType: 'GMAIL', entityId: id });
    return res.json({ message: 'Đã xóa Gmail' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/gmail/:id/reveal-password (Admin only, logs access)
export const revealPassword = async (req, res) => {
  try {
    const gmail = await prisma.gmailAccount.findUnique({ where: { id: req.params.id } });
    if (!gmail) return res.status(404).json({ error: 'Không tìm thấy' });
    await logActivity({
      userId: req.user.id,
      action: 'GMAIL_PASSWORD_REVEALED',
      entityType: 'GMAIL',
      entityId: gmail.id,
      metadata: { email: gmail.email },
      ipAddress: req.ip,
    });
    // Note: password is bcrypt hashed, cannot be revealed. We return a note.
    return res.json({ message: 'Mật khẩu được mã hóa một chiều. Để xem mật khẩu gốc, cần cập nhật lại.', passwordEnc: gmail.passwordEnc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
