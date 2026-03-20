import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { dbGet, dbRun } from '../db';
import { requireUser } from '../middleware/auth';

export const dlpRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

dlpRoutes.use('*', requireUser);

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const UpsertSchema = z.object({
  bibleChapters: z.number().int().min(0).max(50),
  prayerMinutes: z.number().int().min(0).max(600),
  evangelismCount: z.number().int().min(0).max(50),
  qtApply: z.string().max(2000).optional().nullable()
});

// GET /api/dlp/:date  (없으면 기본값 반환)
dlpRoutes.get('/:date', async (c) => {
  const userId = c.get('userId');
  const date = DateSchema.parse(c.req.param('date'));

  const row = await dbGet<{
    id: string;
    date: string;
    bible_chapters: number;
    prayer_minutes: number;
    evangelism_count: number;
    qt_apply: string | null;
    updated_at: number;
  }>(
    c.env,
    'SELECT id, date, bible_chapters, prayer_minutes, evangelism_count, qt_apply, updated_at FROM dlp_entries WHERE user_id = ? AND date = ?;',
    [userId, date]
  );

  if (!row) {
    return c.json({
      date,
      bibleChapters: 0,
      prayerMinutes: 0,
      evangelismCount: 0,
      qtApply: ''
    });
  }

  return c.json({
    id: row.id,
    date: row.date,
    bibleChapters: row.bible_chapters,
    prayerMinutes: row.prayer_minutes,
    evangelismCount: row.evangelism_count,
    qtApply: row.qt_apply ?? '',
    updatedAt: row.updated_at
  });
});

// PUT /api/dlp/:date  (upsert)
dlpRoutes.put('/:date', async (c) => {
  const userId = c.get('userId');
  const date = DateSchema.parse(c.req.param('date'));
  const body = UpsertSchema.parse(await c.req.json());

  const now = Date.now();
  const id = crypto.randomUUID();

  await dbRun(
    c.env,
    `INSERT INTO dlp_entries (id, user_id, date, bible_chapters, prayer_minutes, evangelism_count, qt_apply, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET
       bible_chapters = excluded.bible_chapters,
       prayer_minutes = excluded.prayer_minutes,
       evangelism_count = excluded.evangelism_count,
       qt_apply = excluded.qt_apply,
       updated_at = excluded.updated_at;`,
    [id, userId, date, body.bibleChapters, body.prayerMinutes, body.evangelismCount, body.qtApply ?? null, now, now]
  );

  return c.json({ ok: true });
});
