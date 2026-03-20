export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  APP_SECRET: string;
  // Durable Object (distributed rate limiting)
  RATE_LIMITER: DurableObjectNamespace;
};
