import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { dbAll, dbGet, dbRun } from '../db';
import { requireAdmin, requireUser } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { sendSupportNotificationEmail } from '../lib/supportMailer';

export const supportRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

type SupportType = 'INQUIRY' | 'BUG' | 'ACCOUNT_DELETE' | 'PRIVACY_DELETE';
type SupportStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

const supportTypes = ['INQUIRY', 'BUG', 'ACCOUNT_DELETE', 'PRIVACY_DELETE'] as const;
const supportStatuses = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

const createSchema = z.object({
  type: z.enum(supportTypes),
  title: z.string().trim().min(2, '제목을 2자 이상 입력해 주세요.').max(120),
  message: z.string().trim().min(10, '내용을 10자 이상 입력해 주세요.').max(5000),
  contactName: z.string().trim().max(40).optional().nullable(),
  contactEmail: z
    .string()
    .trim()
    .max(120)
    .email('이메일 형식이 올바르지 않습니다.')
    .optional()
    .or(z.literal(''))
    .nullable(),
  pageUrl: z.string().trim().max(240).optional().nullable(),
  privacyConsent: z.boolean()
});

const updateStatusSchema = z.object({
  status: z.enum(supportStatuses)
});

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function labelType(type: SupportType) {
  if (type === 'BUG') return '버그 리포트';
  if (type === 'ACCOUNT_DELETE') return '계정 탈퇴 요청';
  if (type === 'PRIVACY_DELETE') return '개인정보 삭제 요청';
  return '일반 문의';
}

function labelStatus(status: SupportStatus) {
  if (status === 'IN_PROGRESS') return '처리 중';
  if (status === 'RESOLVED') return '해결';
  if (status === 'CLOSED') return '종결';
  return '접수됨';
}

async function getOptionalUserId(env: Env, authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length);
  const row = await dbGet<{ user_id: string }>(
    env,
    'SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?;',
    [token, Date.now()]
  );

  return row?.user_id ?? null;
}

supportRoutes.post(
  '/',
  rateLimit({
    keyPrefix: 'support-create',
    windowMs: 1000 * 60 * 60,
    anonLimit: 5,
    userDeviceLimit: 8,
    userAccountLimit: 12
  }),
  async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));

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

    if (!body.privacyConsent) {
      return c.json({ error: 'PRIVACY_CONSENT_REQUIRED', message: '개인정보 수집·이용 동의가 필요합니다.' }, 400);
    }

    const userId = await getOptionalUserId(c.env, c.req.header('Authorization'));
    const user = userId
      ? await dbGet<{ name: string }>(c.env, 'SELECT name FROM users WHERE id = ?;', [userId])
      : null;

    const email = normalizeText(body.contactEmail);
    const contactName = normalizeText(body.contactName);
    const pageUrl = normalizeText(body.pageUrl);
    const type = body.type as SupportType;
    const needsReplyChannel = !userId && (type === 'ACCOUNT_DELETE' || type === 'PRIVACY_DELETE');

    if (needsReplyChannel && !email) {
      return c.json(
        {
          error: 'CONTACT_REQUIRED',
          message: '로그인하지 않은 상태에서 계정/개인정보 삭제 요청을 보내려면 회신 가능한 이메일을 입력해 주세요.'
        },
        400
      );
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await dbRun(
      c.env,
      `INSERT INTO support_messages (
        id,
        type,
        title,
        message,
        contact_name,
        contact_email,
        user_id,
        user_name_cache,
        page_url,
        status,
        privacy_consent,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?);`,
      [
        id,
        type,
        body.title.trim(),
        body.message.trim(),
        contactName,
        email,
        userId,
        user?.name ?? null,
        pageUrl,
        1,
        now,
        now
      ]
    );

    try {
      await sendSupportNotificationEmail(c.env, {
        id,
        type,
        typeLabel: labelType(type),
        title: body.title.trim(),
        message: body.message.trim(),
        contactName,
        contactEmail: email,
        userId,
        userName: user?.name ?? null,
        pageUrl,
        createdAt: now
      });
    } catch (err) {
      console.error('Failed to send support notification email', err);
    }

    return c.json({
      ok: true,
      id,
      type,
      typeLabel: labelType(type),
      status: 'NEW',
      statusLabel: labelStatus('NEW')
    });
  }
);

supportRoutes.get('/admin', requireUser, requireAdmin, async (c) => {
  const status = normalizeText(c.req.query('status'));
  const type = normalizeText(c.req.query('type'));

  const where: string[] = [];
  const params: Array<string> = [];

  if (status && supportStatuses.includes(status as SupportStatus)) {
    where.push('sm.status = ?');
    params.push(status);
  }

  if (type && supportTypes.includes(type as SupportType)) {
    where.push('sm.type = ?');
    params.push(type);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await dbAll<{
    id: string;
    type: SupportType;
    title: string;
    message: string;
    contact_name: string | null;
    contact_email: string | null;
    user_id: string | null;
    user_name_cache: string | null;
    page_url: string | null;
    status: SupportStatus;
    privacy_consent: number;
    created_at: number;
    updated_at: number;
  }>(
    c.env,
    `SELECT sm.id,
            sm.type,
            sm.title,
            sm.message,
            sm.contact_name,
            sm.contact_email,
            sm.user_id,
            sm.user_name_cache,
            sm.page_url,
            sm.status,
            sm.privacy_consent,
            sm.created_at,
            sm.updated_at
       FROM support_messages sm
       ${whereSql}
      ORDER BY sm.created_at DESC
      LIMIT 300;`,
    params
  );

  return c.json(
    rows.map((row) => ({
      id: row.id,
      type: row.type,
      typeLabel: labelType(row.type),
      title: row.title,
      message: row.message,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      userId: row.user_id,
      userName: row.user_name_cache,
      pageUrl: row.page_url,
      status: row.status,
      statusLabel: labelStatus(row.status),
      privacyConsent: !!row.privacy_consent,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  );
});

supportRoutes.post('/admin/:id/status', requireUser, requireAdmin, async (c) => {
  const id = c.req.param('id');
  const parsed = updateStatusSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json(
      {
        error: 'INVALID_INPUT',
        issues: parsed.error.flatten()
      },
      400
    );
  }

  const now = Date.now();

  await dbRun(c.env, 'UPDATE support_messages SET status = ?, updated_at = ? WHERE id = ?;', [
    parsed.data.status,
    now,
    id
  ]);

  return c.json({
    ok: true,
    status: parsed.data.status,
    statusLabel: labelStatus(parsed.data.status)
  });
});
