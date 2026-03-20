import { Hono } from 'hono';
import type { Env } from '../env';
import { dbGet, dbRun } from '../db';
import { requireUser } from '../middleware/auth';

export const mcheyneProgressRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

mcheyneProgressRoutes.use('*', requireUser);

function koreaNowDate() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate()
  };
}

function mdKey(month: number, day: number) {
  return month * 100 + day;
}

async function getSummary(env: Env, userId: string, todayKey: number) {
  const totalDays = await dbGet<{ cnt: number }>(
    env,
    'SELECT COUNT(*) AS cnt FROM mcheyne_plan WHERE (month * 100 + day) <= ?;',
    [todayKey]
  );
  const totalReadings = (totalDays?.cnt ?? 0) * 4;

  const done = await dbGet<{ s: number }>(
    env,
    `SELECT COALESCE(SUM(done1 + done2 + done3 + done4), 0) AS s
       FROM mcheyne_progress
      WHERE user_id = ? AND (month * 100 + day) <= ?;`,
    [userId, todayKey]
  );

  const completedReadings = done?.s ?? 0;
  const percent = totalReadings > 0 ? Math.round((completedReadings / totalReadings) * 1000) / 10 : 0;

  return { totalDays: totalDays?.cnt ?? 0, totalReadings, completedReadings, percent };
}

async function getDayProgress(env: Env, userId: string, month: number, day: number) {
  const row = await dbGet<{
    done1: number;
    done2: number;
    done3: number;
    done4: number;
    updated_at: number;
  }>(env, 'SELECT done1, done2, done3, done4, updated_at FROM mcheyne_progress WHERE user_id = ? AND month = ? AND day = ?;', [
    userId,
    month,
    day
  ]);

  return {
    month,
    day,
    done1: row?.done1 ?? 0,
    done2: row?.done2 ?? 0,
    done3: row?.done3 ?? 0,
    done4: row?.done4 ?? 0,
    updatedAt: row?.updated_at ?? null
  };
}

// 특정 날짜 진행(캘린더용)
mcheyneProgressRoutes.get('/progress/day', async (c) => {
  const userId = c.get('userId');
  const month = Number(c.req.query('month') ?? 0);
  const day = Number(c.req.query('day') ?? 0);
  if (!Number.isFinite(month) || month < 1 || month > 12) return c.json({ error: 'BAD_REQUEST', message: 'month must be 1..12' }, 400);
  if (!Number.isFinite(day) || day < 1 || day > 31) return c.json({ error: 'BAD_REQUEST', message: 'day must be 1..31' }, 400);

  const todayKey = mdKey(month, day);
  const today = await getDayProgress(c.env, userId, month, day);
  const summary = await getSummary(c.env, userId, todayKey);
  const todayCompleted = today.done1 + today.done2 + today.done3 + today.done4;

  return c.json({ today, todayCompleted, summary });
});

mcheyneProgressRoutes.get('/progress/today', async (c) => {
  const userId = c.get('userId');
  const { month, day } = koreaNowDate();
  const todayKey = mdKey(month, day);

  const today = await getDayProgress(c.env, userId, month, day);
  const summary = await getSummary(c.env, userId, todayKey);
  const todayCompleted = today.done1 + today.done2 + today.done3 + today.done4;

  return c.json({ today, todayCompleted, summary });
});

async function upsertProgress(env: Env, userId: string, month: number, day: number, body: Partial<{ done1: number; done2: number; done3: number; done4: number }>) {
  // read existing first
  const existing = await dbGet<{ done1: number; done2: number; done3: number; done4: number }>(
    env,
    'SELECT done1, done2, done3, done4 FROM mcheyne_progress WHERE user_id = ? AND month = ? AND day = ?;',
    [userId, month, day]
  );

  const done1 = body.done1 ?? existing?.done1 ?? 0;
  const done2 = body.done2 ?? existing?.done2 ?? 0;
  const done3 = body.done3 ?? existing?.done3 ?? 0;
  const done4 = body.done4 ?? existing?.done4 ?? 0;

  const now = Date.now();

  await dbRun(
    env,
    `INSERT INTO mcheyne_progress (user_id, month, day, done1, done2, done3, done4, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, month, day)
     DO UPDATE SET done1=excluded.done1, done2=excluded.done2, done3=excluded.done3, done4=excluded.done4, updated_at=excluded.updated_at;`,
    [userId, month, day, done1 ? 1 : 0, done2 ? 1 : 0, done3 ? 1 : 0, done4 ? 1 : 0, now]
  );

  return { done1: done1 ? 1 : 0, done2: done2 ? 1 : 0, done3: done3 ? 1 : 0, done4: done4 ? 1 : 0 };
}

// 오늘 진행 업데이트
mcheyneProgressRoutes.put('/progress/today', async (c) => {
  const userId = c.get('userId');
  const { month, day } = koreaNowDate();
  const body = (await c.req.json().catch(() => ({}))) as Partial<{ done1: number; done2: number; done3: number; done4: number }>;

  const next = await upsertProgress(c.env, userId, month, day, body);

  const todayKey = mdKey(month, day);
  const summary = await getSummary(c.env, userId, todayKey);
  const todayCompleted = next.done1 + next.done2 + next.done3 + next.done4;

  return c.json({ ok: true, today: { month, day, ...next }, todayCompleted, summary });
});

// 특정 날짜 진행 업데이트(캘린더/일자 상세용)
mcheyneProgressRoutes.put('/progress/day', async (c) => {
  const userId = c.get('userId');
  const month = Number(c.req.query('month') ?? 0);
  const day = Number(c.req.query('day') ?? 0);
  if (!Number.isFinite(month) || month < 1 || month > 12) return c.json({ error: 'BAD_REQUEST', message: 'month must be 1..12' }, 400);
  if (!Number.isFinite(day) || day < 1 || day > 31) return c.json({ error: 'BAD_REQUEST', message: 'day must be 1..31' }, 400);

  const body = (await c.req.json().catch(() => ({}))) as Partial<{ done1: number; done2: number; done3: number; done4: number }>;
  const next = await upsertProgress(c.env, userId, month, day, body);

  const todayKey = mdKey(month, day);
  const summary = await getSummary(c.env, userId, todayKey);
  const todayCompleted = next.done1 + next.done2 + next.done3 + next.done4;

  return c.json({ ok: true, today: { month, day, ...next }, todayCompleted, summary });
});

mcheyneProgressRoutes.get('/progress/month', async (c) => {
  const userId = c.get('userId');
  const month = Number(c.req.query('month') ?? 0);
  if (!Number.isFinite(month) || month < 1 || month > 12) return c.json({ error: 'BAD_REQUEST', message: 'month must be 1..12' }, 400);

  const rows = await c.env.DB.prepare(
    `SELECT day, done1, done2, done3, done4
       FROM mcheyne_progress
      WHERE user_id = ? AND month = ?
      ORDER BY day ASC;`
  )
    .bind(userId, month)
    .all<{ day: number; done1: number; done2: number; done3: number; done4: number }>();

  const items = (rows.results ?? []).map((r) => ({
    day: r.day,
    done1: r.done1,
    done2: r.done2,
    done3: r.done3,
    done4: r.done4,
    doneCount: (r.done1 ?? 0) + (r.done2 ?? 0) + (r.done3 ?? 0) + (r.done4 ?? 0)
  }));

  return c.json({ month, items });
});

mcheyneProgressRoutes.get('/progress/summary', async (c) => {
  const userId = c.get('userId');
  const { month, day } = koreaNowDate();
  const todayKey = mdKey(month, day);
  const summary = await getSummary(c.env, userId, todayKey);
  return c.json({ asOf: { month, day }, summary });
});
