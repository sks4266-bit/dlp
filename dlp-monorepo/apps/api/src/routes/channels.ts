import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { dbAll, dbGet, dbRun } from '../db';
import { requireUser } from '../middleware/auth';

export const channelRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

channelRoutes.use('*', requireUser);

function normalize(s: string) {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/교회/g, '')
    .replace(/[^a-z0-9가-힣]/g, '');
}

function inviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function hasGlobalAdmin(env: Env, userId: string) {
  const row = await dbGet<{ role: string }>(env, 'SELECT role FROM user_global_roles WHERE user_id = ? AND role = "ADMIN";', [userId]);
  return !!row;
}

async function getChannelRole(env: Env, channelId: string, userId: string) {
  const row = await dbGet<{ role: string }>(env, 'SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?;', [channelId, userId]);
  return row?.role ?? null;
}

// GET /api/channels/recommended
channelRoutes.get('/recommended', async (c) => {
  const userId = c.get('userId');
  const me = await dbGet<{ home_church: string | null }>(c.env, 'SELECT home_church FROM users WHERE id = ?;', [userId]);
  const key = normalize(me?.home_church ?? '');

  const rows = await dbAll<{ id: string; name: string; description: string | null; invite_code: string; created_at: number }>(
    c.env,
    'SELECT id, name, description, invite_code, created_at FROM channels ORDER BY created_at DESC LIMIT 50;',
    []
  );

  const scored = rows
    .map((r) => {
      const score = key && normalize(r.name).includes(key) ? 10 : 0;
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score || b.created_at - a.created_at)
    .slice(0, 20);

  return c.json(
    scored.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      inviteCode: r.invite_code,
      createdAt: r.created_at,
      score: r.score
    }))
  );
});

channelRoutes.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim();

  const rows = q
    ? await dbAll<{ id: string; name: string; description: string | null; invite_code: string; created_at: number }>(
        c.env,
        `SELECT id, name, description, invite_code, created_at
           FROM channels
          WHERE LOWER(name) LIKE ?
             OR LOWER(COALESCE(description, '')) LIKE ?
             OR REPLACE(REPLACE(LOWER(name), ' ', ''), '교회', '') LIKE ?
          ORDER BY created_at DESC
          LIMIT 50;`,
        [`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`, `%${normalize(q)}%`]
      )
    : await dbAll<{ id: string; name: string; description: string | null; invite_code: string; created_at: number }>(
        c.env,
        'SELECT id, name, description, invite_code, created_at FROM channels ORDER BY created_at DESC LIMIT 50;',
        []
      );

  return c.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      inviteCode: r.invite_code,
      createdAt: r.created_at
    }))
  );
});

const CreateSchema = z.object({ name: z.string().min(2).max(40), description: z.string().max(140).optional().nullable() });

channelRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const body = CreateSchema.parse(await c.req.json());

  const id = crypto.randomUUID();
  const code = inviteCode();
  const now = Date.now();

  await dbRun(
    c.env,
    'INSERT INTO channels (id, name, description, invite_code, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?);',
    [id, body.name, body.description ?? null, code, userId, now]
  );

  await dbRun(
    c.env,
    'INSERT INTO channel_members (channel_id, user_id, role, joined_at) VALUES (?, ?, ?, ?);',
    [id, userId, 'OWNER', now]
  );

  return c.json({ ok: true, id, inviteCode: code });
});

const OptionalInviteCode = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const next = value.trim().toUpperCase();
    return next ? next : undefined;
  },
  z.string().min(4).max(12).optional()
);

const JoinSchema = z.object({ inviteCode: OptionalInviteCode.optional() });
const DirectJoinSchema = z.object({ inviteCode: z.string().trim().min(4).max(12).transform((value) => value.toUpperCase()) });

channelRoutes.post('/join-by-code', async (c) => {
  const userId = c.get('userId');
  const { inviteCode } = DirectJoinSchema.parse(await c.req.json());

  const ch = await dbGet<{ id: string; name: string }>(c.env, 'SELECT id, name FROM channels WHERE invite_code = ?;', [inviteCode]);
  if (!ch) return c.json({ error: 'INVALID_CODE' }, 400);

  await dbRun(
    c.env,
    'INSERT OR IGNORE INTO channel_members (channel_id, user_id, role, joined_at) VALUES (?, ?, ?, ?);',
    [ch.id, userId, 'MEMBER', Date.now()]
  );

  return c.json({ ok: true, channelId: ch.id, channelName: ch.name });
});

channelRoutes.post('/:id/join', async (c) => {
  const userId = c.get('userId');
  const channelId = c.req.param('id');
  const { inviteCode } = JoinSchema.parse(await c.req.json().catch(() => ({})));

  const ch = await dbGet<{ invite_code: string }>(c.env, 'SELECT invite_code FROM channels WHERE id = ?;', [channelId]);
  if (!ch) return c.json({ error: 'NOT_FOUND' }, 404);
  if (inviteCode && ch.invite_code !== inviteCode) return c.json({ error: 'INVALID_CODE' }, 400);

  await dbRun(
    c.env,
    'INSERT OR IGNORE INTO channel_members (channel_id, user_id, role, joined_at) VALUES (?, ?, ?, ?);',
    [channelId, userId, 'MEMBER', Date.now()]
  );

  return c.json({ ok: true });
});

channelRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const channelId = c.req.param('id');

  const ch = await dbGet<{ id: string; name: string; description: string | null; invite_code: string; created_by: string; created_at: number }>(
    c.env,
    'SELECT id, name, description, invite_code, created_by, created_at FROM channels WHERE id = ?;',
    [channelId]
  );
  if (!ch) return c.json({ error: 'NOT_FOUND' }, 404);

  const myRole = await getChannelRole(c.env, channelId, userId);
  const memberCountRow = await dbGet<{ count: number }>(c.env, 'SELECT COUNT(*) AS count FROM channel_members WHERE channel_id = ?;', [channelId]);

  return c.json({
    id: ch.id,
    name: ch.name,
    description: ch.description,
    inviteCode: ch.invite_code,
    createdBy: ch.created_by,
    createdAt: ch.created_at,
    myRole,
    memberCount: memberCountRow?.count ?? 0
  });
});

channelRoutes.get('/:id/members', async (c) => {
  const userId = c.get('userId');
  const channelId = c.req.param('id');

  const myRole = await getChannelRole(c.env, channelId, userId);
  const globalAdmin = await hasGlobalAdmin(c.env, userId);
  if (!myRole && !globalAdmin) return c.json({ error: 'FORBIDDEN' }, 403);

  const rows = await dbAll<{
    user_id: string;
    role: string;
    joined_at: number;
    user_name: string | null;
  }>(
    c.env,
    `SELECT cm.user_id, cm.role, cm.joined_at, u.name AS user_name
       FROM channel_members cm
       LEFT JOIN users u ON u.id = cm.user_id
      WHERE cm.channel_id = ?
      ORDER BY CASE cm.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END, cm.joined_at ASC;`,
    [channelId]
  );

  return c.json(
    rows.map((row) => ({
      userId: row.user_id,
      name: row.user_name ?? '이름없음',
      role: row.role,
      joinedAt: row.joined_at,
      isMe: row.user_id === userId
    }))
  );
});

channelRoutes.post('/:id/members/:memberUserId/kick', async (c) => {
  const actorId = c.get('userId');
  const channelId = c.req.param('id');
  const memberUserId = c.req.param('memberUserId');

  if (actorId === memberUserId) return c.json({ error: 'SELF_KICK_NOT_ALLOWED' }, 400);

  const actorRole = await getChannelRole(c.env, channelId, actorId);
  const globalAdmin = await hasGlobalAdmin(c.env, actorId);
  const canManage = globalAdmin || actorRole === 'OWNER' || actorRole === 'ADMIN';
  if (!canManage) return c.json({ error: 'FORBIDDEN' }, 403);

  const target = await dbGet<{ role: string }>(c.env, 'SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?;', [channelId, memberUserId]);
  if (!target) return c.json({ error: 'NOT_FOUND' }, 404);
  if (target.role === 'OWNER') return c.json({ error: 'OWNER_KICK_NOT_ALLOWED' }, 400);

  await dbRun(c.env, 'DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?;', [channelId, memberUserId]);
  return c.json({ ok: true });
});

// posts list/create
channelRoutes.get('/:id/posts', async (c) => {
  const channelId = c.req.param('id');
  const board = (c.req.query('board') ?? 'notice').slice(0, 20);

  const rows = await dbAll<{
    id: string;
    board_type: string;
    title: string | null;
    content: string;
    author_id: string | null;
    is_anonymous: number;
    created_at: number;
    author_name: string | null;
  }>(
    c.env,
    `SELECT p.id, p.board_type, p.title, p.content, p.author_id, p.is_anonymous, p.created_at,
            u.name AS author_name
       FROM posts p
       LEFT JOIN users u ON u.id = p.author_id
      WHERE p.channel_id = ? AND p.board_type = ?
      ORDER BY p.created_at DESC
      LIMIT 100;`,
    [channelId, board]
  );

  return c.json(
    rows.map((r) => ({
      id: r.id,
      boardType: r.board_type,
      title: r.title,
      content: r.content,
      authorName: r.is_anonymous ? '익명' : r.author_name ?? '알수없음',
      isAnonymous: !!r.is_anonymous,
      createdAt: r.created_at
    }))
  );
});

const CreatePostSchema = z.object({
  boardType: z.string().min(2).max(20),
  title: z.string().max(80).optional().nullable(),
  content: z.string().min(1).max(3000),
  isAnonymous: z.boolean().optional()
});

channelRoutes.post('/:id/posts', async (c) => {
  const userId = c.get('userId');
  const channelId = c.req.param('id');
  const body = CreatePostSchema.parse(await c.req.json());

  const mem = await dbGet<{ role: string }>(c.env, 'SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?;', [channelId, userId]);
  if (!mem) return c.json({ error: 'FORBIDDEN' }, 403);

  const id = crypto.randomUUID();
  await dbRun(
    c.env,
    'INSERT INTO posts (id, channel_id, board_type, title, content, author_id, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
    [id, channelId, body.boardType, body.title ?? null, body.content, userId, body.isAnonymous ? 1 : 0, Date.now()]
  );

  return c.json({ ok: true, id });
});

// comments list/create
channelRoutes.get('/posts/:postId/comments', async (c) => {
  const postId = c.req.param('postId');
  const rows = await dbAll<{
    id: string;
    content: string;
    author_id: string | null;
    is_anonymous: number;
    created_at: number;
    author_name: string | null;
  }>(
    c.env,
    `SELECT cm.id, cm.content, cm.author_id, cm.is_anonymous, cm.created_at, u.name AS author_name
       FROM comments cm
       LEFT JOIN users u ON u.id = cm.author_id
      WHERE cm.post_id = ?
      ORDER BY cm.created_at ASC
      LIMIT 200;`,
    [postId]
  );

  return c.json(
    rows.map((r) => ({
      id: r.id,
      content: r.content,
      authorName: r.is_anonymous ? '익명' : r.author_name ?? '알수없음',
      isAnonymous: !!r.is_anonymous,
      createdAt: r.created_at
    }))
  );
});

const CreateCommentSchema = z.object({ content: z.string().min(1).max(1000), isAnonymous: z.boolean().optional() });

channelRoutes.post('/posts/:postId/comments', async (c) => {
  const userId = c.get('userId');
  const postId = c.req.param('postId');
  const body = CreateCommentSchema.parse(await c.req.json());

  const post = await dbGet<{ channel_id: string | null }>(c.env, 'SELECT channel_id FROM posts WHERE id = ?;', [postId]);
  if (!post?.channel_id) return c.json({ error: 'NOT_FOUND' }, 404);

  const mem = await dbGet<{ role: string }>(c.env, 'SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?;', [post.channel_id, userId]);
  if (!mem) return c.json({ error: 'FORBIDDEN' }, 403);

  const id = crypto.randomUUID();
  await dbRun(
    c.env,
    'INSERT INTO comments (id, post_id, content, author_id, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?, ?);',
    [id, postId, body.content, userId, body.isAnonymous ? 1 : 0, Date.now()]
  );

  return c.json({ ok: true, id });
});
