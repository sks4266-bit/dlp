import { Hono } from 'hono';
import type { Env } from '../env';
import { dbAll, dbGet, dbRun } from '../db';
import { loadBible } from '../bible/store';
import { parseRef, resolveVerses } from '../bible/ref';

type McheynePlanRow = {
  month: number;
  day: number;
  reading1: string;
  reading2: string;
  reading3: string;
  reading4: string;
};

type HomeProgress = {
  percent: number;
  completedReadings: number;
  totalReadings: number;
  todayCompleted: number;
};

type HomePerformance = {
  attendanceDays: number;
  weekSubmittedCount: number;
  gratitudeCount: number;
  gratitudeMonth: string;
};

function mdKey(month: number, day: number) {
  return month * 100 + day;
}

function koreaNowDate() {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    nowKst,
    month: nowKst.getUTCMonth() + 1,
    day: nowKst.getUTCDate()
  };
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

async function getAuthorizedUserId(env: Env, authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length);
  const session = await dbGet<{ user_id: string }>(env, 'SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?;', [token, Date.now()]);
  return session?.user_id ?? null;
}

async function getHomeProgress(env: Env, userId: string, month: number, day: number): Promise<HomeProgress> {
  await ensureMcheyneProgressTable(env);

  const todayKey = mdKey(month, day);
  const totalDaysRow = await dbGet<{ cnt: number }>(env, 'SELECT COUNT(*) AS cnt FROM mcheyne_plan WHERE (month * 100 + day) <= ?;', [todayKey]);
  const totalReadings = (totalDaysRow?.cnt ?? 0) * 4;

  const completedRow = await dbGet<{ s: number }>(
    env,
    `SELECT COALESCE(SUM(done1 + done2 + done3 + done4), 0) AS s
       FROM mcheyne_progress
      WHERE user_id = ? AND (month * 100 + day) <= ?;`,
    [userId, todayKey]
  );

  const todayRow = await dbGet<{ done1: number; done2: number; done3: number; done4: number }>(
    env,
    'SELECT done1, done2, done3, done4 FROM mcheyne_progress WHERE user_id = ? AND month = ? AND day = ?;',
    [userId, month, day]
  );

  const completedReadings = completedRow?.s ?? 0;
  const todayCompleted = (todayRow?.done1 ?? 0) + (todayRow?.done2 ?? 0) + (todayRow?.done3 ?? 0) + (todayRow?.done4 ?? 0);

  return {
    percent: totalReadings > 0 ? Math.round((completedReadings / totalReadings) * 1000) / 10 : 0,
    completedReadings,
    totalReadings,
    todayCompleted
  };
}

function getWeekDateRange(nowKst: Date) {
  const start = new Date(nowKst);
  const dow = start.getUTCDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  start.setUTCHours(0, 0, 0, 0);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + i);
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    const day = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}

async function getHomePerformance(env: Env, userId: string, nowKst: Date): Promise<HomePerformance> {
  const attendanceRow = await dbGet<{ cnt: number }>(
    env,
    'SELECT COUNT(*) AS cnt FROM (SELECT date FROM dlp_entries WHERE user_id = ? GROUP BY date);',
    [userId]
  );

  const weekDates = getWeekDateRange(nowKst);
  const weekRows = await dbAll<{ date: string }>(
    env,
    'SELECT date FROM dlp_entries WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY date;',
    [userId, weekDates[0], weekDates[6]]
  );

  const gratitudeMonth = `${nowKst.getUTCFullYear()}-${String(nowKst.getUTCMonth() + 1).padStart(2, '0')}`;
  const gratitudeRow = await dbGet<{ cnt: number }>(
    env,
    'SELECT COUNT(*) AS cnt FROM gratitude_entries WHERE user_id = ? AND date LIKE ?;',
    [userId, `${gratitudeMonth}-%`]
  );

  return {
    attendanceDays: attendanceRow?.cnt ?? 0,
    weekSubmittedCount: weekRows.length,
    gratitudeCount: gratitudeRow?.cnt ?? 0,
    gratitudeMonth
  };
}

export const homeRoutes = new Hono<{ Bindings: Env }>();

homeRoutes.get('/home', async (c) => {
  const now = Date.now();
  const urgent = await dbAll<{ id: string; author_name_cache: string; content: string; created_at: number; expires_at: number }>(
    c.env,
    `SELECT id, author_name_cache, content, created_at, expires_at
       FROM urgent_prayers
      WHERE deleted_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT 10;`,
    [now]
  );

  const { nowKst, month, day } = koreaNowDate();
  const plan = await dbGet<McheynePlanRow>(
    c.env,
    'SELECT month, day, reading1, reading2, reading3, reading4 FROM mcheyne_plan WHERE month = ? AND day = ?;',
    [month, day]
  );

  let mcheynePreview: { c: number; v: number; t: string }[] = [];
  let mcheyneProgress: HomeProgress | null = null;
  let homePerformance: HomePerformance | null = null;

  try {
    const userId = await getAuthorizedUserId(c.env, c.req.header('Authorization'));
    if (userId) {
      const [progress, performance] = await Promise.all([
        getHomeProgress(c.env, userId, month, day),
        getHomePerformance(c.env, userId, nowKst)
      ]);

      mcheyneProgress = progress;
      homePerformance = performance;
    }
  } catch {
    mcheyneProgress = null;
    homePerformance = null;
  }

  try {
    if (plan?.reading1) {
      const bible = await loadBible();
      const ref = parseRef(plan.reading1, bible);
      const verses = resolveVerses(bible, ref).slice(0, 4);
      mcheynePreview = verses.map((verse) => ({ c: verse.c, v: verse.v, t: verse.t }));
    }
  } catch {
    mcheynePreview = [];
  }

  return c.json({
    urgentTicker: urgent.map((item) => ({
      id: item.id,
      authorName: item.author_name_cache,
      content: item.content,
      createdAt: item.created_at,
      expiresAt: item.expires_at
    })),
    mcheyneToday: plan,
    mcheynePreview,
    mcheyneProgress,
    homePerformance
  });
});
