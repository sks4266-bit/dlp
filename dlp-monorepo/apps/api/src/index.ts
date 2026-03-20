import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env';
import { authRoutes } from './routes/auth';
import { homeRoutes } from './routes/home';
import { urgentPrayerRoutes } from './routes/urgent_prayers';
import { mcheyneRoutes } from './routes/mcheyne';
import { meRoutes } from './routes/me';
import { adminRoutes } from './routes/admin';
import { runCron } from './scheduled';
import { dlpRoutes } from './routes/dlp';
import { gratitudeRoutes } from './routes/gratitude';
import { channelRoutes } from './routes/channels';
import { bibleRoutes } from './routes/bible';
import { mcheyneTextRoutes } from './routes/mcheyne_text';
import { mcheyneProgressRoutes } from './routes/mcheyne_progress';

// Durable Object export (required by Wrangler)
export { RateLimiter } from './durable/RateLimiter';

const app = new Hono<{ Bindings: Env }>();

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);

app.get('/api/health', (c) => c.json({ ok: true }));

app.route('/api/auth', authRoutes);
app.route('/api', homeRoutes);
app.route('/api', meRoutes);
app.route('/api/urgent-prayers', urgentPrayerRoutes);
app.route('/api/mcheyne', mcheyneRoutes);
app.route('/api/mcheyne', mcheyneTextRoutes);
app.route('/api/mcheyne', mcheyneProgressRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/dlp', dlpRoutes);
app.route('/api/gratitude', gratitudeRoutes);
app.route('/api/channels', channelRoutes);
app.route('/api/bible', bibleRoutes);

export default app;


export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(runCron(env));
}
