import type { Env } from './env';

/**
 * Cron 정리 작업
 * - 만료된 세션 제거
 * - 오래된 긴급기도 정리(기본 30일 보관)
 */
export async function runCron(env: Env) {
  const now = Date.now();
  const keepUrgentMs = 1000 * 60 * 60 * 24 * 30; // 30 days

  // sessions
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?;').bind(now).run();

  // urgent prayers: purge very old items
  await env.DB.prepare('DELETE FROM urgent_prayers WHERE expires_at <= ?;').bind(now - keepUrgentMs).run();
}
