import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { dbAll, dbGet, dbRun } from '../db';
import { requireUser } from '../middleware/auth';
import { hashPasswordPBKDF2, randomHex } from '../security';

export const meRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

function kstDateString(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function kstNowUtcDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function startOfKstWeekUtc() {
  // week starts Monday
  const d = kstNowUtcDate();
  const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

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

const UpdateProfileSchema = z.object({
  // 실명 기반이지만 오타 수정 가능성 고려(최소 1자)
  name: z.string().min(1).max(50).optional(),
  phone: z.string().max(30).optional().nullable(),
  homeChurch: z.string().max(80).optional().nullable()
});

// PATCH /api/me  (내정보 수정: 이름/휴대폰/출석교회)
meRoutes.patch('/me', requireUser, async (c) => {
  const userId = c.get('userId');
  const body = UpdateProfileSchema.parse(await c.req.json());

  // 동적 업데이트(넘어온 필드만)
  const sets: string[] = [];
  const params: any[] = [];

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

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

// POST /api/me/password  (비밀번호 변경)
meRoutes.post('/me/password', requireUser, async (c) => {
  const userId = c.get('userId');
  const body = ChangePasswordSchema.parse(await c.req.json());

  const user = await dbGet<{ password_hash: string; password_salt: string }>(
    c.env,
    'SELECT password_hash, password_salt FROM users WHERE id = ?;',
    [userId]
  );
  if (!user) return c.json({ error: 'UNAUTHORIZED' }, 401);

  const curHash = await hashPasswordPBKDF2(body.currentPassword, user.password_salt);
  if (curHash !== user.password_hash) return c.json({ error: 'INVALID_CREDENTIALS' }, 401);

  const newSalt = randomHex(16);
  const newHash = await hashPasswordPBKDF2(body.newPassword, newSalt);

  await dbRun(c.env, 'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?;', [newHash, newSalt, userId]);

  // MVP: 세션 강제 로그아웃(보안)
  await dbRun(c.env, 'DELETE FROM sessions WHERE user_id = ?;', [userId]);

  return c.json({ ok: true });
});

// 마이페이지 최소형 통계
meRoutes.get('/me/stats', requireUser, async (c) => {
  const userId = c.get('userId');

  // 누적 출석일 = DLP 제출(=dlp_entries)한 distinct date 수
  const attendance = await dbGet<{ cnt: number }>(
    c.env,
    'SELECT COUNT(*) AS cnt FROM (SELECT date FROM dlp_entries WHERE user_id = ? GROUP BY date);',
    [userId]
  );

  // 이번 주(월~일) 제출 현황
  const start = startOfKstWeekUtc();
  const days: { date: string; hasDlp: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(start);
    dd.setUTCDate(start.getUTCDate() + i);
    days.push({ date: kstDateString(dd), hasDlp: false });
  }

  const startStr = days[0].date;
  const endStr = days[6].date;

  const rows = await dbAll<{ date: string }>(
    c.env,
    'SELECT date FROM dlp_entries WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY date;',
    [userId, startStr, endStr]
  );

  const set = new Set(rows.map((r) => r.date));
  const filled = days.map((d) => ({ ...d, hasDlp: set.has(d.date) }));
  const submittedCount = filled.filter((d) => d.hasDlp).length;

  return c.json({
    attendanceDays: attendance?.cnt ?? 0,
    week: {
      start: startStr,
      end: endStr,
      submittedCount,
      days: filled
    }
  });
});
