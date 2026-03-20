import { Hono } from 'hono';
import type { Env } from '../env';
import { dbAll, dbGet } from '../db';
import { loadBible } from '../bible/store';
import { parseRef, resolveVerses } from '../bible/ref';

function mdKey(month: number, day: number) {
  return month * 100 + day;
}

export const homeRoutes = new Hono<{ Bindings: Env }>();

function koreaNowDate() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate()
  };
}

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

  const { month, day } = koreaNowDate();

  const plan = await dbGet<{ month: number; day: number; reading1: string; reading2: string; reading3: string; reading4: string }>(
    c.env,
    'SELECT month, day, reading1, reading2, reading3, reading4 FROM mcheyne_plan WHERE month = ? AND day = ?;',
    [month, day]
  );

  // 외부 링크/외부 크롤링 완전 제거:
  // 요구사항: 홈 미리보기는 로그인 없이도 표시
  let mcheynePreview: { c: number; v: number; t: string }[] = [];

  // "내 진행률(오늘까지 %)"은 사용자별 데이터이므로, 토큰이 유효한 경우에만 포함
  let mcheyneProgress: null | {
    percent: number;
    completedReadings: number;
    totalReadings: number;
    todayCompleted: number;
  } = null;

  try {
    const auth = c.req.header('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length);
      const sess = await dbGet<{ user_id: string }>(c.env, 'SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?;', [token, Date.now()]);
      if (sess?.user_id) {
        const todayKey = mdKey(month, day);

        const totalDays = await dbGet<{ cnt: number }>(
          c.env,
          'SELECT COUNT(*) AS cnt FROM mcheyne_plan WHERE (month * 100 + day) <= ?;',
          [todayKey]
        );
        const totalReadings = (totalDays?.cnt ?? 0) * 4;

        const done = await dbGet<{ s: number }>(
          c.env,
          `SELECT COALESCE(SUM(done1 + done2 + done3 + done4), 0) AS s
             FROM mcheyne_progress
            WHERE user_id = ? AND (month * 100 + day) <= ?;`,
          [sess.user_id, todayKey]
        );
        const completedReadings = done?.s ?? 0;
        const percent = totalReadings > 0 ? Math.round((completedReadings / totalReadings) * 1000) / 10 : 0;

        const todayRow = await dbGet<{ done1: number; done2: number; done3: number; done4: number }>(
          c.env,
          'SELECT done1, done2, done3, done4 FROM mcheyne_progress WHERE user_id = ? AND month = ? AND day = ?;',
          [sess.user_id, month, day]
        );
        const todayCompleted = (todayRow?.done1 ?? 0) + (todayRow?.done2 ?? 0) + (todayRow?.done3 ?? 0) + (todayRow?.done4 ?? 0);

        mcheyneProgress = { percent, completedReadings, totalReadings, todayCompleted };
      }
    }
  } catch {
    mcheyneProgress = null;
  }
  try {
    if (plan?.reading1) {
      const bible = await loadBible();
      const ref = parseRef(plan.reading1, bible);
      const verses = resolveVerses(bible, ref).slice(0, 4);
      mcheynePreview = verses.map((x) => ({ c: x.c, v: x.v, t: x.t }));
    }
  } catch {
    mcheynePreview = [];
  }

  return c.json({
    urgentTicker: urgent.map((u) => ({
      id: u.id,
      authorName: u.author_name_cache,
      content: u.content,
      createdAt: u.created_at,
      expiresAt: u.expires_at
    })),
    mcheyneToday: plan,
    mcheynePreview,
    mcheyneProgress
  });
});
