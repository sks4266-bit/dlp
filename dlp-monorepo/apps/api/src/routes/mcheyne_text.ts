import { Hono } from 'hono';
import type { Env } from '../env';
import { dbGet } from '../db';
import { requireUser } from '../middleware/auth';
import { loadBible } from '../bible/store';
import { formatNormalizedRef, parseRef, resolveVerses } from '../bible/ref';

export const mcheyneTextRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

mcheyneTextRoutes.use('*', requireUser);

function koreaNowDate() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate()
  };
}

async function getTextForDay(env: Env, month: number, day: number) {
  const plan = await dbGet<{ month: number; day: number; reading1: string; reading2: string; reading3: string; reading4: string }>(
    env,
    'SELECT month, day, reading1, reading2, reading3, reading4 FROM mcheyne_plan WHERE month = ? AND day = ?;',
    [month, day]
  );

  if (!plan) return null;

  const bible = await loadBible();

  const readingsRaw = [plan.reading1, plan.reading2, plan.reading3, plan.reading4];

  const readings = readingsRaw.map((raw) => {
    const ref = parseRef(raw, bible);
    const verses = resolveVerses(bible, ref);
    return {
      raw,
      ref: formatNormalizedRef(ref),
      verses,
      // 기본은 절번호 포함 텍스트
      text: verses.map((x) => `${x.v}. ${x.t}`).join('\n')
    };
  });

  const preview = readings[0]?.verses?.slice(0, 4).map((x) => ({ c: x.c, v: x.v, t: x.t })) ?? [];

  return { date: { month, day }, plan, preview, readings };
}

// 특정 날짜 본문(캘린더용)
mcheyneTextRoutes.get('/day-text', async (c) => {
  const month = Number(c.req.query('month') ?? 0);
  const day = Number(c.req.query('day') ?? 0);
  if (!Number.isFinite(month) || month < 1 || month > 12) return c.json({ error: 'BAD_REQUEST', message: 'month must be 1..12' }, 400);
  if (!Number.isFinite(day) || day < 1 || day > 31) return c.json({ error: 'BAD_REQUEST', message: 'day must be 1..31' }, 400);

  const data = await getTextForDay(c.env, month, day);
  if (!data) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(data);
});

// 기존 today-text는 유지(내부적으로 day-text 로직 재사용)
mcheyneTextRoutes.get('/today-text', async (c) => {
  const { month, day } = koreaNowDate();
  const data = await getTextForDay(c.env, month, day);
  if (!data) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(data);
});
