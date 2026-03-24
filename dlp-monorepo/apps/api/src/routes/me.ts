import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { dbAll, dbGet, dbRun } from '../db';
import { requireUser } from '../middleware/auth';
import { hashPasswordPBKDF2, randomHex } from '../security';

export const meRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

function kstDateString(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function kstNowUtcDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function startOfKstWeekUtc() {
  const date = kstNowUtcDate();
  const dayOfWeek = date.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function ensureMcheyneProgressTable(env: Env) {
  await dbRun(
    env,
    `CREATE TABLE IF NOT EXISTS mcheyne_progress (
      user_id TEXT NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL,
      done1 INTEGER NOT NULL DEFAULT 0,
      done2 INTEGER NOT NULL DEFAULT 0,
      done3 INTEGER NOT NULL DEFAULT 0,
      done4 INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, month, day)
    );`
  );

  await dbRun(env, 'CREATE INDEX IF NOT EXISTS idx_mcheyne_progress_user ON mcheyne_progress(user_id);');
}

async function verifyPassword(env: Env, userId: string, password: string) {
  const user = await dbGet<{ password_hash: string; password_salt: string }>(
    env,
    'SELECT password_hash, password_salt FROM users WHERE id = ?;',
    [userId]
  );

  if (!user) return null;

  const hash = await hashPasswordPBKDF2(password, user.password_salt);
  if (hash !== user.password_hash) return false;

  return true;
}

async function deleteAccountFootprints(env: Env, userId: string) {
  await ensureMcheyneProgressTable(env);

  await dbRun(env, 'DELETE FROM sessions WHERE user_id = ?;', [userId]);
  await dbRun(env, 'DELETE FROM user_global_roles WHERE user_id = ?;', [userId]);
  await dbRun(env, 'DELETE FROM channel_members WHERE user_id = ?;', [userId]);
  await dbRun(env, 'DELETE FROM dlp_entries WHERE user_id = ?;', [userId]);
  await dbRun(env, 'DELETE FROM gratitude_entries WHERE user_id = ?;', [userId]);
  await dbRun(env, 'DELETE FROM mcheyne_progress WHERE user_id = ?;', [userId]);
  await dbRun(env, 'DELETE FROM mcheyne_reads WHERE user_id = ?;', [userId]);
  await dbRun(env, 'UPDATE posts SET author_id = NULL WHERE author_id = ?;', [userId]);
  await dbRun(env, 'UPDATE comments SET author_id = NULL WHERE author_id = ?;', [userId]);
  await dbRun(env, 'DELETE FROM users WHERE id = ?;', [userId]);
}

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  phone: z.string().max(30).optional().nullable(),
  homeChurch: z.string().max(80).optional().nullable()
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

const DeleteAccountSchema = z.object({
  password: z.string().min(1)
});

meRoutes.get('/me', requireUser, async (c) => {
  const userId = c.get('userId');

  const user = await dbGet<{ id: string; name: string; username: string; phone: string | null; home_church: string | null }>(
    c.env,
    'SELECT id, name, username, phone, home_church FROM users WHERE id = ?;',
    [userId]
  );
  if (!user) return c.json({ error: 'UNAUTHORIZED' }, 401);

  const admin = await dbGet<{ role: string }>(c.env, 'SELECT role FROM user_global_roles WHERE user_id = ? AND role = "ADMIN";', [userId]);

  return c.json({
    id: user.id,
    name: user.name,
    username: user.username,
    phone: user.phone,
    homeChurch: user.home_church,
    isAdmin: !!admin
  });
});

meRoutes.patch('/me', requireUser, async (c) => {
  const userId = c.get('userId');
  const body = UpdateProfileSchema.parse(await c.req.json());

  const sets: string[] = [];
  const params: Array<string | null> = [];

  if (body.name !== undefined) {
    sets.push('name = ?');
    params.push(body.name);
  }
  if (body.phone !== undefined) {
    sets.push('phone = ?');
    params.push(body.phone ?? null);
  }
  if (body.homeChurch !== undefined) {
    sets.push('home_church = ?');
    params.push(body.homeChurch ?? null);
  }

  if (!sets.length) return c.json({ ok: true });

  params.push(userId);
  await dbRun(c.env, `UPDATE users SET ${sets.join(', ')} WHERE id = ?;`, params);

  return c.json({ ok: true });
});

meRoutes.post('/me/password', requireUser, async (c) => {
  const userId = c.get('userId');
  const body = ChangePasswordSchema.parse(await c.req.json());

  const passwordOk = await verifyPassword(c.env, userId, body.currentPassword);
  if (passwordOk === null) return c.json({ error: 'UNAUTHORIZED' }, 401);
  if (!passwordOk) return c.json({ error: 'INVALID_CREDENTIALS' }, 401);

  const newSalt = randomHex(16);
  const newHash = await hashPasswordPBKDF2(body.newPassword, newSalt);

  await dbRun(c.env, 'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?;', [newHash, newSalt, userId]);
  await dbRun(c.env, 'DELETE FROM sessions WHERE user_id = ?;', [userId]);

  return c.json({ ok: true });
});

meRoutes.delete('/me', requireUser, async (c) => {
  const userId = c.get('userId');
  const body = DeleteAccountSchema.parse(await c.req.json().catch(() => ({})));

  const passwordOk = await verifyPassword(c.env, userId, body.password);
  if (passwordOk === null) return c.json({ error: 'UNAUTHORIZED' }, 401);
  if (!passwordOk) return c.json({ error: 'INVALID_CREDENTIALS' }, 401);

  await deleteAccountFootprints(c.env, userId);
  return c.json({ ok: true });
});

meRoutes.get('/me/stats', requireUser, async (c) => {
  const userId = c.get('userId');

  const attendance = await dbGet<{ cnt: number }>(
    c.env,
    'SELECT COUNT(*) AS cnt FROM (SELECT date FROM dlp_entries WHERE user_id = ? GROUP BY date);',
    [userId]
  );

  const start = startOfKstWeekUtc();
  const days: { date: string; hasDlp: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    days.push({ date: kstDateString(date), hasDlp: false });
  }

  const startStr = days[0].date;
  const endStr = days[6].date;
  const rows = await dbAll<{ date: string }>(
    c.env,
    'SELECT date FROM dlp_entries WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY date;',
    [userId, startStr, endStr]
  );

  const submittedDates = new Set(rows.map((row) => row.date));
  const filledDays = days.map((day) => ({ ...day, hasDlp: submittedDates.has(day.date) }));
  const submittedCount = filledDays.filter((day) => day.hasDlp).length;

  return c.json({
    attendanceDays: attendance?.cnt ?? 0,
    week: {
      start: startStr,
      end: endStr,
      submittedCount,
      days: filledDays
    }
  });
});
