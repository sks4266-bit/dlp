import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { dbAll, dbGet, dbRun } from '../db';
import { requireUser } from '../middleware/auth';

export const gratitudeRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

gratitudeRoutes.use('*', requireUser);

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

// GET /api/gratitude?month=YYYY-MM
// returns entries in the month
gratitudeRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const month = MonthSchema.parse(c.req.query('month') ?? '');

  const start = `${month}-01`;
  const end = `${month}-31`;

  const rows = await dbAll<{ id: string; date: string; content: string; created_at: number }>(
    c.env,
    `SELECT id, date, content, created_at
     FROM gratitude_entries
     WHERE user_id = ? AND date >= ? AND date <= ?
     ORDER BY date DESC;`,
    [userId, start, end]
  );

  return c.json(
    rows.map((r) => ({
      id: r.id,
      date: r.date,
      content: r.content,
      createdAt: r.created_at
    }))
  );
});

// GET /api/gratitude/:date
gratitudeRoutes.get('/:date', async (c) => {
  const userId = c.get('userId');
  const date = DateSchema.parse(c.req.param('date'));

  const row = await dbGet<{ id: string; content: string }>(
    c.env,
    'SELECT id, content FROM gratitude_entries WHERE user_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1;',
    [userId, date]
  );

  return c.json({
    date,
    content: row?.content ?? ''
  });
});

const UpsertSchema = z.object({ content: z.string().min(1).max(2000) });

// PUT /api/gratitude/:date  (insert or update)
gratitudeRoutes.put('/:date', async (c) => {
  const userId = c.get('userId');
  const date = DateSchema.parse(c.req.param('date'));
  const { content } = UpsertSchema.parse(await c.req.json());

  const existing = await dbGet<{ id: string }>(
    c.env,
    'SELECT id FROM gratitude_entries WHERE user_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1;',
    [userId, date]
  );

  if (existing) {
    await dbRun(c.env, 'UPDATE gratitude_entries SET content = ? WHERE id = ?;', [content, existing.id]);
    return c.json({ ok: true, id: existing.id });
  }

  const id = crypto.randomUUID();
  await dbRun(
    c.env,
    'INSERT INTO gratitude_entries (id, user_id, date, content, created_at) VALUES (?, ?, ?, ?, ?);',
    [id, userId, date, content, Date.now()]
  );

  return c.json({ ok: true, id });
});
