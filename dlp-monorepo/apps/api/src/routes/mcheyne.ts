import { Hono } from 'hono';
import type { Env } from '../env';
import { dbAll, dbGet } from '../db';

export const mcheyneRoutes = new Hono<{ Bindings: Env }>();

function koreaNowDate() {
  // KST = UTC+9
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate()
  };
}

mcheyneRoutes.get('/today', async (c) => {
  const { month, day } = koreaNowDate();

  const plan = await dbGet(c.env, 'SELECT month, day, reading1, reading2, reading3, reading4 FROM mcheyne_plan WHERE month = ? AND day = ?;', [month, day]);

  // 외부 링크/외부 크롤링을 완전 제거하고, plan(읽을 범위)만 제공합니다.
  // 실제 본문은 /api/mcheyne/today-text 또는 /api/bible/* 로 제공합니다.
  return c.json({ plan });
});

// 특정 날짜 읽기 범위(plan): 로그인 없이 제공 (캘린더/딥링크용)
mcheyneRoutes.get('/day', async (c) => {
  const month = Number(c.req.query('month') ?? 0);
  const day = Number(c.req.query('day') ?? 0);
  if (!Number.isFinite(month) || month < 1 || month > 12) return c.json({ error: 'BAD_REQUEST', message: 'month must be 1..12' }, 400);
  if (!Number.isFinite(day) || day < 1 || day > 31) return c.json({ error: 'BAD_REQUEST', message: 'day must be 1..31' }, 400);

  const plan = await dbGet<{ month: number; day: number; reading1: string; reading2: string; reading3: string; reading4: string }>(
    c.env,
    'SELECT month, day, reading1, reading2, reading3, reading4 FROM mcheyne_plan WHERE month = ? AND day = ?;',
    [month, day]
  );

  if (!plan) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json({ plan });
});

// 캘린더/월별 읽기표용: 로그인 없이 읽기 범위(plan)만 제공
mcheyneRoutes.get('/month', async (c) => {
  const month = Number(c.req.query('month') ?? 0);
  if (!Number.isFinite(month) || month < 1 || month > 12) return c.json({ error: 'BAD_REQUEST', message: 'month must be 1..12' }, 400);

  const days = await dbAll<{ month: number; day: number; reading1: string; reading2: string; reading3: string; reading4: string }>(
    c.env,
    'SELECT month, day, reading1, reading2, reading3, reading4 FROM mcheyne_plan WHERE month = ? ORDER BY day ASC;',
    [month]
  );

  return c.json({ month, days });
});
