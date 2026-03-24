import { Hono } from 'hono';
import type { Env } from '../env';
import { dbGet, dbRun } from '../db';
import { requireUser } from '../middleware/auth';

type ProgressFields = {
  done1: number;
  done2: number;
  done3: number;
  done4: number;
};

export const mcheyneProgressRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

mcheyneProgressRoutes.use('*', requireUser);

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

function toDoneFlag(value: unknown) {
  return value ? 1 : 0;
}

function parseMonthDay(monthRaw: string | undefined, dayRaw: string | undefined) {
  const month = Number(monthRaw ?? 0);
  const day = Number(dayRaw ?? 0);

  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { error: { error: 'BAD_REQUEST', message: 'month must be 1..12' }, status: 400 } as const;
  }

  if (!Number.isFinite(day) || day < 1 || day > 31) {
    return { error: { error: 'BAD_REQUEST', message: 'day must be 1..31' }, status: 400 } as const;
  }

  return { month, day } as const;
}

async function getSummary(env: Env, userId: string, todayKey: number) {
  const totalDaysRow = await dbGet<{ cnt: number }>(
    env,
    'SELECT COUNT(*) AS cnt FROM mcheyne_plan WHERE (month * 100 + day) <= ?;',
    [todayKey]
  );

  const completedRow = await dbGet<{ s: number }>(
    env,
    `SELECT COALESCE(SUM(done1 + done2 + done3 + done4), 0) AS s
       FROM mcheyne_progress
      WHERE user_id = ? AND (month * 100 + day) <= ?;`,
    [userId, todayKey]
  );

  const totalReadings = (totalDaysRow?.cnt ?? 0) * 4;
  const completedReadings = completedRow?.s ?? 0;

  return {
    totalDays: totalDaysRow?.cnt ?? 0,
    totalReadings,
    completedReadings,
    percent: totalReadings > 0 ? Math.round((completedReadings / totalReadings) * 1000) / 10 : 0
  };
}

async function getDayProgress(env: Env, userId: string, month: number, day: number) {
  const row = await dbGet<ProgressFields & { updated_at: number }>(
    env,
    'SELECT done1, done2, done3, done4, updated_at FROM mcheyne_progress WHERE user_id = ? AND month = ? AND day = ?;',
    [userId, month, day]
  );

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

async function upsertProgress(env: Env, userId: string, month: number, day: number, body: Partial<ProgressFields>) {
  const existing = await dbGet<ProgressFields>(
    env,
    'SELECT done1, done2, done3, done4 FROM mcheyne_progress WHERE user_id = ? AND month = ? AND day = ?;',
    [userId, month, day]
  );

  const next = {
    done1: body.done1 === undefined ? existing?.done1 ?? 0 : toDoneFlag(body.done1),
    done2: body.done2 === undefined ? existing?.done2 ?? 0 : toDoneFlag(body.done2),
    done3: body.done3 === undefined ? existing?.done3 ?? 0 : toDoneFlag(body.done3),
    done4: body.done4 === undefined ? existing?.done4 ?? 0 : toDoneFlag(body.done4)
  };

  await dbRun(
    env,
    `INSERT INTO mcheyne_progress (user_id, month, day, done1, done2, done3, done4, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, month, day)
     DO UPDATE SET done1 = excluded.done1,
                   done2 = excluded.done2,
                   done3 = excluded.done3,
                   done4 = excluded.done4,
                   updated_at = excluded.updated_at;`,
    [userId, month, day, next.done1, next.done2, next.done3, next.done4, Date.now()]
  );

  return next;
}

async function readProgressBody(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<ProgressFields>;
  return {
    done1: body.done1,
    done2: body.done2,
    done3: body.done3,
    done4: body.done4
  };
}

mcheyneProgressRoutes.get('/progress/day', async (c) => {
  const parsed = parseMonthDay(c.req.query('month'), c.req.query('day'));
  if ('error' in parsed) return c.json(parsed.error, parsed.status);

  const userId = c.get('userId');
  await ensureMcheyneProgressTable(c.env);

  const today = await getDayProgress(c.env, userId, parsed.month, parsed.day);
  const summary = await getSummary(c.env, userId, mdKey(parsed.month, parsed.day));
  const todayCompleted = today.done1 + today.done2 + today.done3 + today.done4;

  return c.json({ today, todayCompleted, summary });
});

mcheyneProgressRoutes.get('/progress/today', async (c) => {
  const userId = c.get('userId');
  const { month, day } = koreaNowDate();

  await ensureMcheyneProgressTable(c.env);

  const today = await getDayProgress(c.env, userId, month, day);
  const summary = await getSummary(c.env, userId, mdKey(month, day));
  const todayCompleted = today.done1 + today.done2 + today.done3 + today.done4;

  return c.json({ today, todayCompleted, summary });
});

mcheyneProgressRoutes.put('/progress/today', async (c) => {
  const userId = c.get('userId');
  const { month, day } = koreaNowDate();
  const body = await readProgressBody(c.req.raw);

  await ensureMcheyneProgressTable(c.env);

  const today = await upsertProgress(c.env, userId, month, day, body);
  const summary = await getSummary(c.env, userId, mdKey(month, day));
  const todayCompleted = today.done1 + today.done2 + today.done3 + today.done4;

  return c.json({ ok: true, today: { month, day, ...today }, todayCompleted, summary });
});

mcheyneProgressRoutes.put('/progress/day', async (c) => {
  const parsed = parseMonthDay(c.req.query('month'), c.req.query('day'));
  if ('error' in parsed) return c.json(parsed.error, parsed.status);

  const userId = c.get('userId');
  const body = await readProgressBody(c.req.raw);

  await ensureMcheyneProgressTable(c.env);

  const today = await upsertProgress(c.env, userId, parsed.month, parsed.day, body);
  const summary = await getSummary(c.env, userId, mdKey(parsed.month, parsed.day));
  const todayCompleted = today.done1 + today.done2 + today.done3 + today.done4;

  return c.json({ ok: true, today: { month: parsed.month, day: parsed.day, ...today }, todayCompleted, summary });
});

mcheyneProgressRoutes.get('/progress/month', async (c) => {
  const month = Number(c.req.query('month') ?? 0);
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return c.json({ error: 'BAD_REQUEST', message: 'month must be 1..12' }, 400);
  }

  const userId = c.get('userId');
  await ensureMcheyneProgressTable(c.env);

  const rows = await c.env.DB.prepare(
    `SELECT day, done1, done2, done3, done4
       FROM mcheyne_progress
      WHERE user_id = ? AND month = ?
      ORDER BY day ASC;`
  )
    .bind(userId, month)
    .all<{ day: number; done1: number; done2: number; done3: number; done4: number }>();

  const items = (rows.results ?? []).map((row) => ({
    day: row.day,
    done1: row.done1,
    done2: row.done2,
    done3: row.done3,
    done4: row.done4,
    doneCount: (row.done1 ?? 0) + (row.done2 ?? 0) + (row.done3 ?? 0) + (row.done4 ?? 0)
  }));

  return c.json({ month, items });
});

mcheyneProgressRoutes.get('/progress/summary', async (c) => {
  const userId = c.get('userId');
  const { month, day } = koreaNowDate();

  await ensureMcheyneProgressTable(c.env);

  const summary = await getSummary(c.env, userId, mdKey(month, day));
  return c.json({ asOf: { month, day }, summary });
});
