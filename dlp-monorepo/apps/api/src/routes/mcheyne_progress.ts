import { Hono } from 'hono';
import type { Env } from '../env';
import { dbGet, dbRun } from '../db';
import { requireUser } from '../middleware/auth';

export const mcheyneProgressRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

mcheyneProgressRoutes.use('*', requireUser);

type ProgressPatch = Partial<{ done1: number; done2: number; done3: number; done4: number }>;

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

function clampDone(v: unknown) {
  return Number(v) ? 1 : 0;
}

function parseMonthDay(monthRaw: string | undefined, dayRaw: string | undefined) {
  const month = Number(monthRaw ?? 0);
  const day = Number(dayRaw ?? 0);

  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { ok: false as const, error: { error: 'BAD_REQUEST', message: 'month must be 1..12' }, status: 400 };
  }

  if (!Number.isFinite(day) || day < 1 || day > 31) {
    return { ok: false as const, error: { error: 'BAD_REQUEST', message: 'day must be 1..31' }, status: 400 };
  }

  return { ok: true as const, month, day };
}

function normalizePatch(body: any): ProgressPatch {
  const patch: ProgressPatch = {};

  if (body && Object.prototype.hasOwnProperty.call(body, 'done1')) patch.done1 = clampDone(body.done1);
  if (body && Object.prototype.hasOwnProperty.call(body, 'done2')) patch.done2 = clampDone(body.done2);
  if (body && Object.prototype.hasOwnProperty.call(body, 'done3')) patch.done3 = clampDone(body.done3);
  if (body && Object.prototype.hasOwnProperty.call(body, 'done4')) patch.done4 = clampDone(body.done4);

  return patch;
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

  return {
    totalDays: totalDays?.cnt ?? 0,
    totalReadings,
    completedReadings,
    percent
  };
}

async function getDayProgress(env: Env, userId: string, month: number, day: number) {
  const row = await dbGet<{
    done1: number;
    done2: number;
    done3: number;
    done4: number;
    updated_at: number;
  }>(
    env,
    `SELECT done1, done2, done3, done4, updated_at
       FROM mcheyne_progress
      WHERE user_id = ? AND month = ? AND day = ?
      LIMIT 1;`,
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

async function upsertProgress(env: Env, userId: string, month: number, day: number, patch: ProgressPatch) {
  const existing = await dbGet<{
    done1: number;
    done2: number;
    done3: number;
    done4: number;
  }>(
    env,
    `SELECT done1, done2, done3, done4
       FROM mcheyne_progress
      WHERE user_id = ? AND month = ? AND day = ?
      LIMIT 1;`,
    [userId, month, day]
  );

  const next = {
    done1: patch.done1 ?? existing?.done1 ?? 0,
    done2: patch.done2 ?? existing?.done2 ?? 0,
    done3: patch.done3 ?? existing?.done3 ?? 0,
    done4: patch.done4 ?? existing?.done4 ?? 0
  };

  const updatedAt = Date.now();

  if (existing) {
    await dbRun(
      env,
      `UPDATE mcheyne_progress
          SET done1 = ?, done2 = ?, done3 = ?, done4 = ?, updated_at = ?
        WHERE user_id = ? AND month = ? AND day = ?;`,
      [next.done1, next.done2, next.done3, next.done4, updatedAt, userId, month, day]
    );
  } else {
    await dbRun(
      env,
      `INSERT INTO mcheyne_progress
        (user_id, month, day, done1, done2, done3, done4, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [userId, month, day, next.done1, next.done2, next.done3, next.done4, updatedAt]
    );
  }

  return next;
}

// 특정 날짜 진행 조회
mcheyneProgressRoutes.get('/progress/day', async (c) => {
  try {
    const userId = c.get('userId');
    const parsed = parseMonthDay(c.req.query('month'), c.req.query('day'));
    if (!parsed.ok) return c.json(parsed.error, parsed.status);

    const todayKey = mdKey(parsed.month, parsed.day);
    const today = await getDayProgress(c.env, userId, parsed.month, parsed.day);
    const summary = await getSummary(c.env, userId, todayKey);
    const todayCompleted = today.done1 + today.done2 + today.done3 + today.done4;

    return c.json({ today, todayCompleted, summary });
  } catch (e: any) {
    return c.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: e?.message ?? 'Failed to load day progress'
      },
      500
    );
  }
});

// 오늘 진행 조회
mcheyneProgressRoutes.get('/progress/today', async (c) => {
  try {
    const userId = c.get('userId');
    const { month, day } = koreaNowDate();
    const todayKey = mdKey(month, day);

    const today = await getDayProgress(c.env, userId, month, day);
    const summary = await getSummary(c.env, userId, todayKey);
    const todayCompleted = today.done1 + today.done2 + today.done3 + today.done4;

    return c.json({ today, todayCompleted, summary });
  } catch (e: any) {
    return c.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: e?.message ?? 'Failed to load today progress'
      },
      500
    );
  }
});

// 오늘 진행 업데이트
mcheyneProgressRoutes.put('/progress/today', async (c) => {
  try {
    const userId = c.get('userId');
    const { month, day } = koreaNowDate();

    const rawBody = await c.req.json().catch(() => ({}));
    const patch = normalizePatch(rawBody);

    const next = await upsertProgress(c.env, userId, month, day, patch);
    const todayKey = mdKey(month, day);
    const summary = await getSummary(c.env, userId, todayKey);
    const todayCompleted = next.done1 + next.done2 + next.done3 + next.done4;

    return c.json({
      ok: true,
      today: { month, day, ...next },
      todayCompleted,
      summary
    });
  } catch (e: any) {
    return c.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: e?.message ?? 'Failed to save today progress'
      },
      500
    );
  }
});

// 특정 날짜 진행 업데이트
mcheyneProgressRoutes.put('/progress/day', async (c) => {
  try {
    const userId = c.get('userId');
    const parsed = parseMonthDay(c.req.query('month'), c.req.query('day'));
    if (!parsed.ok) return c.json(parsed.error, parsed.status);

    const rawBody = await c.req.json().catch(() => ({}));
    const patch = normalizePatch(rawBody);

    const next = await upsertProgress(c.env, userId, parsed.month, parsed.day, patch);
    const todayKey = mdKey(parsed.month, parsed.day);
    const summary = await getSummary(c.env, userId, todayKey);
    const todayCompleted = next.done1 + next.done2 + next.done3 + next.done4;

    return c.json({
      ok: true,
      today: { month: parsed.month, day: parsed.day, ...next },
      todayCompleted,
      summary
    });
  } catch (e: any) {
    return c.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: e?.message ?? 'Failed to save day progress'
      },
      500
    );
  }
});

// 월 진행 조회
mcheyneProgressRoutes.get('/progress/month', async (c) => {
  try {
    const userId = c.get('userId');
    const month = Number(c.req.query('month') ?? 0);

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return c.json({ error: 'BAD_REQUEST', message: 'month must be 1..12' }, 400);
    }

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
      done1: r.done1 ?? 0,
      done2: r.done2 ?? 0,
      done3: r.done3 ?? 0,
      done4: r.done4 ?? 0,
      doneCount: (r.done1 ?? 0) + (r.done2 ?? 0) + (r.done3 ?? 0) + (r.done4 ?? 0)
    }));

    return c.json({ month, items });
  } catch (e: any) {
    return c.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: e?.message ?? 'Failed to load month progress'
      },
      500
    );
  }
});

mcheyneProgressRoutes.get('/progress/summary', async (c) => {
  try {
    const userId = c.get('userId');
    const { month, day } = koreaNowDate();
    const todayKey = mdKey(month, day);
    const summary = await getSummary(c.env, userId, todayKey);

    return c.json({ asOf: { month, day }, summary });
  } catch (e: any) {
    return c.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: e?.message ?? 'Failed to load progress summary'
      },
      500
    );
  }
});
