import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { dbGet, dbRun } from '../db';
import { hashPasswordPBKDF2, randomHex } from '../security';

export const authRoutes = new Hono<{ Bindings: Env }>();

const RegisterSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  username: z.string().min(3, '아이디는 3자 이상이어야 합니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  phone: z.string().optional(),
  homeChurch: z.string().optional()
});

authRoutes.post('/register', async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(json);

  if (!parsed.success) {
    return c.json(
      {
        error: 'INVALID_INPUT',
        issues: parsed.error.flatten()
      },
      400
    );
  }

  const body = parsed.data;

  const exists = await dbGet<{ id: string }>(
    c.env,
    'SELECT id FROM users WHERE username = ?;',
    [body.username]
  );

  if (exists) {
    return c.json({ error: 'USERNAME_TAKEN' }, 409);
  }

  const userId = crypto.randomUUID();
  const salt = randomHex(16);
  const passwordHash = await hashPasswordPBKDF2(body.password, salt);

  await dbRun(
    c.env,
    'INSERT INTO users (id, name, username, password_hash, password_salt, phone, home_church, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
    [
      userId,
      body.name,
      body.username,
      passwordHash,
      salt,
      body.phone ?? null,
      body.homeChurch ?? null,
      Date.now()
    ]
  );

  return c.json({ ok: true });
});

const LoginSchema = z.object({
  username: z.string().min(1, '아이디를 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.')
});

authRoutes.post('/login', async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(json);

  if (!parsed.success) {
    return c.json(
      {
        error: 'INVALID_INPUT',
        issues: parsed.error.flatten()
      },
      400
    );
  }

  const body = parsed.data;

  const user = await dbGet<{ id: string; password_hash: string; password_salt: string }>(
    c.env,
    'SELECT id, password_hash, password_salt FROM users WHERE username = ?;',
    [body.username]
  );

  if (!user) {
    return c.json({ error: 'INVALID_CREDENTIALS' }, 401);
  }

  const hash = await hashPasswordPBKDF2(body.password, user.password_salt);

  if (hash !== user.password_hash) {
    return c.json({ error: 'INVALID_CREDENTIALS' }, 401);
  }

  const sessionId = crypto.randomUUID();

  await dbRun(
    c.env,
    'INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?);',
    [sessionId, user.id, 'na', Date.now() + 1000 * 60 * 60 * 24 * 30, Date.now()]
  );

  return c.json({ ok: true, token: sessionId });
});
