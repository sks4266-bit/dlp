import type { Env } from './env';

export async function dbGet<T>(env: Env, sql: string, params: any[] = []) {
  const r = await env.DB.prepare(sql).bind(...params).first<T>();
  return r ?? null;
}

export async function dbAll<T>(env: Env, sql: string, params: any[] = []) {
  const r = await env.DB.prepare(sql).bind(...params).all<T>();
  return r.results ?? [];
}

export async function dbRun(env: Env, sql: string, params: any[] = []) {
  return env.DB.prepare(sql).bind(...params).run();
}
