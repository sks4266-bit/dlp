import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { dbAll, dbGet, dbRun } from '../db';
import { requireUser } from '../middleware/auth';
import { loadBible } from '../bible/store';
import { getFlatVerses } from '../bible/search';

export const bibleGameRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

bibleGameRoutes.use('*', requireUser);

const SCORE_LIMIT = 20;
const ScoreSchema = z.object({
  score: z.number().int().min(0).max(9_999_999),
  survivalMs: z.number().int().min(0).max(9_999_999),
  correctCount: z.number().int().min(0).max(99_999)
});

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function cleanToken(token: string) {
  return token.replace(/^[^0-9A-Za-z가-힣]+|[^0-9A-Za-z가-힣]+$/g, '');
}

function extractCandidates(text: string) {
  return text
    .split(/\s+/)
    .map((raw, index) => ({ raw, clean: cleanToken(raw), index }))
    .filter((item) => item.clean.length >= 2 && item.clean.length <= 10 && /[A-Za-z가-힣]/.test(item.clean));
}

function blankOneWord(text: string) {
  const tokens = text.split(/\s+/);
  const candidates = extractCandidates(text);
  if (!candidates.length) return null;

  const picked = candidates[randomInt(candidates.length)];
  const nextTokens = [...tokens];
  const source = nextTokens[picked.index] ?? picked.raw;
  nextTokens[picked.index] = source.replace(picked.clean, '(     )');

  return {
    answer: picked.clean,
    maskedText: nextTokens.join(' ')
  };
}

function pickDecoys(pool: Array<{ t: string }>, answer: string, count: number) {
  const words = new Set<string>();
  let guard = 0;

  while (words.size < count && guard < 800) {
    guard += 1;
    const verse = pool[randomInt(pool.length)];
    const candidates = extractCandidates(verse.t);
    if (!candidates.length) continue;
    const word = candidates[randomInt(candidates.length)]?.clean ?? '';
    if (!word || word === answer) continue;
    words.add(word);
  }

  return [...words].slice(0, count);
}

function getTierBySurvivalMs(survivalMs: number) {
  const sec = Math.floor(survivalMs / 1000);
  if (sec >= 120) return '사도';
  if (sec >= 80) return '다윗';
  if (sec >= 50) return '파수꾼';
  if (sec >= 30) return '제자';
  if (sec >= 15) return '새싹';
  return '씨앗';
}

async function ensureBibleGameTables(env: Env) {
  await dbRun(
    env,
    `CREATE TABLE IF NOT EXISTS bible_game_scores (
      user_id TEXT PRIMARY KEY,
      best_score INTEGER NOT NULL DEFAULT 0,
      best_survival_ms INTEGER NOT NULL DEFAULT 0,
      best_correct_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );`
  );

  await dbRun(env, 'CREATE INDEX IF NOT EXISTS idx_bible_game_scores_survival ON bible_game_scores(best_survival_ms DESC, best_score DESC);');
}

bibleGameRoutes.get('/question', async (c) => {
  const verses = await getFlatVerses(loadBible());

  for (let tries = 0; tries < 60; tries++) {
    const verse = verses[randomInt(verses.length)];
    const blanked = blankOneWord(verse.t);
    if (!blanked) continue;

    const decoys = pickDecoys(verses, blanked.answer, 3);
    if (decoys.length < 3) continue;

    return c.json({
      reference: `${verse.book} ${verse.c}:${verse.v}`,
      textWithBlank: blanked.maskedText,
      answer: blanked.answer,
      choices: shuffle([blanked.answer, ...decoys])
    });
  }

  return c.json({ error: 'QUESTION_GENERATION_FAILED' }, 500);
});

bibleGameRoutes.get('/leaderboard', async (c) => {
  await ensureBibleGameTables(c.env);

  const rows = await dbAll<{
    user_id: string;
    best_score: number;
    best_survival_ms: number;
    best_correct_count: number;
    updated_at: number;
    name: string | null;
  }>(
    c.env,
    `SELECT s.user_id, s.best_score, s.best_survival_ms, s.best_correct_count, s.updated_at, u.name AS name
       FROM bible_game_scores s
       LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.best_survival_ms DESC, s.best_score DESC, s.best_correct_count DESC, s.updated_at ASC
      LIMIT ?;`,
    [SCORE_LIMIT]
  );

  return c.json(
    rows.map((row, index) => ({
      rank: index + 1,
      userId: row.user_id,
      name: row.name ?? '익명',
      score: row.best_score,
      survivalMs: row.best_survival_ms,
      correctCount: row.best_correct_count,
      tier: getTierBySurvivalMs(row.best_survival_ms),
      updatedAt: row.updated_at
    }))
  );
});

bibleGameRoutes.get('/my-best', async (c) => {
  const userId = c.get('userId');
  await ensureBibleGameTables(c.env);

  const row = await dbGet<{
    best_score: number;
    best_survival_ms: number;
    best_correct_count: number;
    updated_at: number;
  }>(
    c.env,
    'SELECT best_score, best_survival_ms, best_correct_count, updated_at FROM bible_game_scores WHERE user_id = ?;',
    [userId]
  );

  if (!row) {
    return c.json({
      score: 0,
      survivalMs: 0,
      correctCount: 0,
      tier: getTierBySurvivalMs(0),
      updatedAt: null
    });
  }

  return c.json({
    score: row.best_score,
    survivalMs: row.best_survival_ms,
    correctCount: row.best_correct_count,
    tier: getTierBySurvivalMs(row.best_survival_ms),
    updatedAt: row.updated_at
  });
});

bibleGameRoutes.post('/score', async (c) => {
  const userId = c.get('userId');
  const body = ScoreSchema.parse(await c.req.json());
  await ensureBibleGameTables(c.env);

  const existing = await dbGet<{
    best_score: number;
    best_survival_ms: number;
    best_correct_count: number;
  }>(
    c.env,
    'SELECT best_score, best_survival_ms, best_correct_count FROM bible_game_scores WHERE user_id = ?;',
    [userId]
  );

  const improved =
    !existing ||
    body.survivalMs > existing.best_survival_ms ||
    (body.survivalMs === existing.best_survival_ms && body.score > existing.best_score) ||
    (body.survivalMs === existing.best_survival_ms && body.score === existing.best_score && body.correctCount > existing.best_correct_count);

  if (!existing) {
    await dbRun(
      c.env,
      'INSERT INTO bible_game_scores (user_id, best_score, best_survival_ms, best_correct_count, updated_at) VALUES (?, ?, ?, ?, ?);',
      [userId, body.score, body.survivalMs, body.correctCount, Date.now()]
    );
  } else if (improved) {
    await dbRun(
      c.env,
      'UPDATE bible_game_scores SET best_score = ?, best_survival_ms = ?, best_correct_count = ?, updated_at = ? WHERE user_id = ?;',
      [body.score, body.survivalMs, body.correctCount, Date.now(), userId]
    );
  }

  return c.json({
    ok: true,
    improved,
    tier: getTierBySurvivalMs(body.survivalMs)
  });
});
