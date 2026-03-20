import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { dbAll, dbGet, dbRun } from '../db';
import { requireAdmin, requireUser } from '../middleware/auth';

export const urgentPrayerRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

urgentPrayerRoutes.get('/', async (c) => {
  const now = Date.now();
  const rows = await dbAll<{ id: string; author_name_cache: string; content: string; created_at: number; expires_at: number }>(
    c.env,
    `SELECT id, author_name_cache, content, created_at, expires_at
     FROM urgent_prayers
     WHERE deleted_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT 100;`,
    [now]
  );

  return c.json(
    rows.map((r) => ({
      id: r.id,
      authorName: r.author_name_cache,
      content: r.content,
      createdAt: r.created_at,
      expiresAt: r.expires_at
    }))
  );
});

const CreateSchema = z.object({ content: z.string().min(1).max(280) });

urgentPrayerRoutes.post('/', requireUser, async (c) => {
  const { content } = CreateSchema.parse(await c.req.json());
  const userId = c.get('userId');

  const user = await dbGet<{ name: string }>(c.env, 'SELECT name FROM users WHERE id = ?;', [userId]);
  if (!user) return c.json({ error: 'UNAUTHORIZED' }, 401);

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const expiresAt = createdAt + 1000 * 60 * 60 * 24; // 24시간

  await dbRun(
    c.env,
    'INSERT INTO urgent_prayers (id, author_user_id, author_name_cache, content, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?);',
    [id, userId, user.name, content, createdAt, expiresAt]
  );

  return c.json({ ok: true, id });
});

urgentPrayerRoutes.delete('/:id', requireUser, requireAdmin, async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');

  await dbRun(
    c.env,
    'UPDATE urgent_prayers SET deleted_at = ?, deleted_by_admin_id = ? WHERE id = ? AND deleted_at IS NULL;',
    [Date.now(), adminId, id]
  );

  return c.json({ ok: true });
});
