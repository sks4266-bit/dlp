import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { dbAll, dbGet, dbRun } from '../db';
import { requireAdmin, requireUser } from '../middleware/auth';

export const adminRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

adminRoutes.use('*', requireUser, requireAdmin);

// 긴급기도 전체 조회(관리자)
adminRoutes.get('/urgent-prayers', async (c) => {
  const includeExpired = c.req.query('includeExpired') === '1';
  const includeDeleted = c.req.query('includeDeleted') === '1';

  const where: string[] = [];
  const params: any[] = [];

  if (!includeExpired) {
    where.push('up.expires_at > ?');
    params.push(Date.now());
  }
  if (!includeDeleted) {
    where.push('up.deleted_at IS NULL');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await dbAll<{
    id: string;
    author_user_id: string;
    author_name_cache: string;
    content: string;
    created_at: number;
    expires_at: number;
    deleted_at: number | null;
    deleted_by_admin_id: string | null;
    deleted_reason: string | null;
    deleted_by_admin_name: string | null;
  }>(
    c.env,
    `SELECT up.id,
            up.author_user_id,
            up.author_name_cache,
            up.content,
            up.created_at,
            up.expires_at,
            up.deleted_at,
            up.deleted_by_admin_id,
            up.deleted_reason,
            u.name AS deleted_by_admin_name
     FROM urgent_prayers up
     LEFT JOIN users u ON u.id = up.deleted_by_admin_id
     ${whereSql}
     ORDER BY up.created_at DESC
     LIMIT 500;`,
    params
  );

  return c.json(
    rows.map((r) => ({
      id: r.id,
      authorUserId: r.author_user_id,
      authorName: r.author_name_cache,
      content: r.content,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      deletedAt: r.deleted_at,
      deletedByAdminId: r.deleted_by_admin_id,
      deletedByAdminName: r.deleted_by_admin_name,
      deletedReason: r.deleted_reason
    }))
  );
});

const DeleteWithReasonSchema = z.object({ reason: z.string().min(1).max(120) });

// 관리자 삭제(사유 포함)
adminRoutes.post('/urgent-prayers/:id/delete', async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const { reason } = DeleteWithReasonSchema.parse(await c.req.json());

  await dbRun(
    c.env,
    `UPDATE urgent_prayers
       SET deleted_at = ?,
           deleted_by_admin_id = ?,
           deleted_reason = ?
     WHERE id = ? AND deleted_at IS NULL;`,
    [Date.now(), adminId, reason, id]
  );

  return c.json({ ok: true });
});

// 간단 통계(관리자)
adminRoutes.get('/stats', async (c) => {
  const now = Date.now();
  const since24h = now - 1000 * 60 * 60 * 24;

  const total = await dbGet<{ cnt: number }>(c.env, 'SELECT COUNT(*) AS cnt FROM urgent_prayers;', []);
  const active = await dbGet<{ cnt: number }>(
    c.env,
    'SELECT COUNT(*) AS cnt FROM urgent_prayers WHERE deleted_at IS NULL AND expires_at > ?;',
    [now]
  );
  const deleted = await dbGet<{ cnt: number }>(c.env, 'SELECT COUNT(*) AS cnt FROM urgent_prayers WHERE deleted_at IS NOT NULL;', []);
  const expired = await dbGet<{ cnt: number }>(c.env, 'SELECT COUNT(*) AS cnt FROM urgent_prayers WHERE expires_at <= ?;', [now]);
  const created24h = await dbGet<{ cnt: number }>(c.env, 'SELECT COUNT(*) AS cnt FROM urgent_prayers WHERE created_at >= ?;', [since24h]);

  return c.json({
    urgentPrayers: {
      total: total?.cnt ?? 0,
      active: active?.cnt ?? 0,
      deleted: deleted?.cnt ?? 0,
      expired: expired?.cnt ?? 0,
      createdLast24h: created24h?.cnt ?? 0
    }
  });
});
