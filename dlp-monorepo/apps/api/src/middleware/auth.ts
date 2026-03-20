import { createMiddleware } from 'hono/factory';
import type { Env } from '../env';
import { dbGet } from '../db';

/**
 * MVP 인증 방식
 * - 로그인 성공 시 발급된 session id를 Bearer 토큰으로 사용
 * - 추후 Refresh/Access 분리, HttpOnly 쿠키 등으로 강화 가능
 */
export const requireUser = createMiddleware<{ Bindings: Env; Variables: { userId: string } }>(async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'UNAUTHORIZED' }, 401);

  const token = auth.slice('Bearer '.length);
  const row = await dbGet<{ user_id: string }>(c.env, 'SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?;', [token, Date.now()]);
  if (!row) return c.json({ error: 'UNAUTHORIZED' }, 401);

  c.set('userId', row.user_id);
  await next();
});

export const requireAdmin = createMiddleware<{ Bindings: Env; Variables: { userId: string } }>(async (c, next) => {
  const userId = c.get('userId');
  const role = await dbGet<{ role: string }>(c.env, 'SELECT role FROM user_global_roles WHERE user_id = ? AND role = "ADMIN";', [userId]);
  if (!role) return c.json({ error: 'FORBIDDEN' }, 403);
  await next();
});
