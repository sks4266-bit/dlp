import { createMiddleware } from 'hono/factory';
import type { Env } from '../env';
import { dbGet } from '../db';

type Bucket = { count: number; resetAt: number };

type DoResult = { ok: boolean; limit: number; remaining: number; resetAt: number };

type TokenCacheItem = { userId: string; exp: number };
const tokenCache = new Map<string, TokenCacheItem>();
const TOKEN_CACHE_MS = 60_000; // best-effort 60s cache

type UaCacheItem = { h: string; exp: number };
const uaHashCache = new Map<string, UaCacheItem>();
const UA_HASH_CACHE_MS = 5 * 60_000; // best-effort 5m cache

// Fallback memory buckets (used only if Durable Object binding is missing)
const buckets = new Map<string, Bucket>();

function getClientIp(headers: Headers) {
  return (
    headers.get('CF-Connecting-IP') ||
    headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    headers.get('X-Real-IP') ||
    'unknown'
  );
}

function getUserAgent(headers: Headers) {
  return headers.get('User-Agent') || '';
}

async function sha256Hex(s: string) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getUaHashShort(ua: string, now: number) {
  const key = ua || 'NO_UA';
  const cached = uaHashCache.get(key);
  if (cached && cached.exp > now) return cached.h;
  const full = await sha256Hex(key);
  const short = full.slice(0, 12);
  uaHashCache.set(key, { h: short, exp: now + UA_HASH_CACHE_MS });
  return short;
}

function setRateHeaders(c: any, kv: Record<string, string>) {
  for (const [k, v] of Object.entries(kv)) c.header(k, v);
}

export function rateLimit(opts: {
  keyPrefix: string;
  windowMs: number;
  anonLimit: number;
  userDeviceLimit?: number; // per-device bucket (userId+UA)
  userAccountLimit?: number; // per-account total bucket (userId)
}) {
  const { keyPrefix, windowMs, anonLimit, userDeviceLimit, userAccountLimit } = opts;

  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const ip = getClientIp(c.req.raw.headers);
    const now = Date.now();

    // 1) Identify user (optional)
    let userId: string | null = null;
    const auth = c.req.header('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length);
      try {
        const cached = tokenCache.get(token);
        if (cached && cached.exp > now) {
          userId = cached.userId;
        } else {
          const row = await dbGet<{ user_id: string }>(
            c.env,
            'SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?;',
            [token, now]
          );
          if (row?.user_id) {
            userId = row.user_id;
            tokenCache.set(token, { userId: row.user_id, exp: now + TOKEN_CACHE_MS });
          }
        }
      } catch {
        // ignore
      }
    }

    // 2) Prepare UA hash
    const ua = getUserAgent(c.req.raw.headers);
    const uaHash = await getUaHashShort(ua, now);

    // 3) Limiter backends (DO first, then memory fallback)
    const ns = (c.env as any)?.RATE_LIMITER as DurableObjectNamespace | undefined;

    async function checkOne(key: string, limit: number): Promise<DoResult> {
      if (ns) {
        const id = ns.idFromName(key);
        const stub = ns.get(id);
        const u = new URL('https://rate-limiter.local/');
        u.searchParams.set('limit', String(limit));
        u.searchParams.set('windowMs', String(windowMs));
        const res = await stub.fetch(u.toString(), { method: 'POST' });
        const j = (await res.json().catch(() => null)) as DoResult | null;
        return (
          j ?? {
            ok: res.ok,
            limit,
            remaining: 0,
            resetAt: now + windowMs
          }
        );
      }

      // memory fallback
      const cur = buckets.get(key);
      let b: Bucket;
      if (!cur || cur.resetAt <= now) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
      } else {
        b = cur;
      }

      b.count++;
      const remaining = Math.max(0, limit - b.count);
      const ok = b.count <= limit;
      return { ok, limit, remaining, resetAt: b.resetAt };
    }

    // 4) Decide mode
    // - anon: single bucket (ip+uaHash)
    // - user: dual bucket (account total + device)
    const scope = userId ? 'user' : 'anon';

    if (!userId) {
      const key = `${keyPrefix}:anon:${ip}:${uaHash}`;

      let r: DoResult;
      try {
        r = await checkOne(key, anonLimit);
      } catch {
        r = { ok: false, limit: anonLimit, remaining: 0, resetAt: now + windowMs };
      }

      const retryAfter = Math.max(1, Math.ceil((r.resetAt - now) / 1000));

      setRateHeaders(c, {
        'X-RateLimit-Scope': scope,
        'X-RateLimit-Limit': String(r.limit),
        'X-RateLimit-Remaining': String(r.remaining),
        'X-RateLimit-Reset': String(r.resetAt),
        'Retry-After': String(retryAfter)
      });

      if (!r.ok) {
        // 익명 제한
        c.header('X-RateLimit-Reason', 'anon');
        return c.json(
          {
            error: 'RATE_LIMITED',
            reason: 'ANON_LIMIT',
            message: '요청이 너무 많습니다. (익명 제한) 잠시 후 다시 시도해주세요.'
          },
          429
        );
      }

      await next();
      return;
    }

    // user dual buckets
    const acctLimit = Math.max(anonLimit, userAccountLimit ?? userDeviceLimit ?? anonLimit);
    const devLimit = Math.max(anonLimit, userDeviceLimit ?? userAccountLimit ?? anonLimit);

    const acctKey = `${keyPrefix}:user:acct:${userId}`;
    const devKey = `${keyPrefix}:user:dev:${userId}:${uaHash}`;

    let acct: DoResult;
    let dev: DoResult;
    try {
      // ✅ 지연 감소: 2개 DO 체크를 병렬 처리
      [acct, dev] = await Promise.all([checkOne(acctKey, acctLimit), checkOne(devKey, devLimit)]);
    } catch {
      acct = { ok: false, limit: acctLimit, remaining: 0, resetAt: now + windowMs };
      dev = { ok: false, limit: devLimit, remaining: 0, resetAt: now + windowMs };
    }

    const ok = acct.ok && dev.ok;

    // Effective headers (what UI uses)
    const effectiveLimit = Math.min(acct.limit, dev.limit);
    const effectiveRemaining = Math.min(acct.remaining, dev.remaining);
    const effectiveReset = Math.max(acct.resetAt, dev.resetAt);
    const retryAfter = Math.max(1, Math.ceil((effectiveReset - now) / 1000));

    setRateHeaders(c, {
      'X-RateLimit-Scope': scope,
      'X-RateLimit-Mode': 'dual',

      // overall (compat)
      'X-RateLimit-Limit': String(effectiveLimit),
      'X-RateLimit-Remaining': String(effectiveRemaining),
      'X-RateLimit-Reset': String(effectiveReset),
      'Retry-After': String(retryAfter),

      // detail
      'X-RateLimit-Limit-Account': String(acct.limit),
      'X-RateLimit-Remaining-Account': String(acct.remaining),
      'X-RateLimit-Reset-Account': String(acct.resetAt),

      'X-RateLimit-Limit-Device': String(dev.limit),
      'X-RateLimit-Remaining-Device': String(dev.remaining),
      'X-RateLimit-Reset-Device': String(dev.resetAt)
    });

    if (!ok) {
      const reasons: string[] = [];
      if (!acct.ok) reasons.push('ACCOUNT');
      if (!dev.ok) reasons.push('DEVICE');
      const reasonKey = reasons.length === 2 ? 'both' : reasons[0]?.toLowerCase() || 'unknown';

      // 어떤 버킷에 걸렸는지 명확히 전달
      c.header('X-RateLimit-Reason', reasonKey);

      const label =
        reasons.length === 2
          ? '계정 총량 + 기기별'
          : reasons[0] === 'ACCOUNT'
            ? '계정 총량'
            : '기기별';

      return c.json(
        {
          error: 'RATE_LIMITED',
          reason: reasons.length === 2 ? 'ACCOUNT_AND_DEVICE_LIMIT' : reasons[0] === 'ACCOUNT' ? 'ACCOUNT_LIMIT' : 'DEVICE_LIMIT',
          message: `요청이 너무 많습니다. (${label} 제한) 잠시 후 다시 시도해주세요.`,
          exceeded: reasons,
          retryAfterSec: retryAfter
        },
        429
      );
    }

    await next();
  });
}
