export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  APP_SECRET: string;
  SUPPORT_TO_EMAIL: string;
  SUPPORT_FROM_EMAIL: string;
  RESEND_API_KEY: string;
  // Durable Object (distributed rate limiting)
  RATE_LIMITER: DurableObjectNamespace;
};
