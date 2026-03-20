type Bucket = { count: number; resetAt: number };

type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

// Durable Object: distributed, per-key counter with fixed window.
// Key strategy (name): e.g. "bible-search:203.0.113.10"
export class RateLimiter {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request) {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(10_000, Number(url.searchParams.get('limit') ?? 60)));
    const windowMs = Math.max(100, Math.min(60 * 60 * 1000, Number(url.searchParams.get('windowMs') ?? 60_000)));

    const now = Date.now();
    const key = 'bucket';

    const cur = (await this.state.storage.get<Bucket>(key)) ?? null;
    let b: Bucket;
    if (!cur || cur.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
    } else {
      b = cur;
    }

    b.count++;
    await this.state.storage.put(key, b);

    const remaining = Math.max(0, limit - b.count);
    const ok = b.count <= limit;

    const payload: RateLimitResult = { ok, limit, remaining, resetAt: b.resetAt };
    return new Response(JSON.stringify(payload), {
      status: ok ? 200 : 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
}
