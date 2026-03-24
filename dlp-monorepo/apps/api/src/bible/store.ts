import { BIBLE_KRV_JSON_GZ_BASE64 } from '../assets/bible_krv_gz_base64';

export type BibleVerse = { c: number; v: number; t: string };

export type BibleData = {
  version: string;
  books: string[];
  // data[book][chapter][verse] => text
  data: Record<string, Array<null | string[]>>;
};

let cachedPromise: Promise<BibleData> | null = null;

function base64ToBytes(b64: string) {
  // TS 환경에서 DOM lib가 없을 수 있어 globalThis로 접근
  const atobFn = (globalThis as any).atob as (s: string) => string;
  const bin = atobFn(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function gunzipToText(bytes: Uint8Array) {
  // Cloudflare Workers runtime supports DecompressionStream
  const DS = (globalThis as any).DecompressionStream as any;
  const ds = new DS('gzip');
  const stream = new Response(bytes).body;
  if (!stream) throw new Error('No stream');
  const decompressed = stream.pipeThrough(ds) as ReadableStream<Uint8Array>;
  return await new Response(decompressed).text();
}

export async function loadBible(): Promise<BibleData> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    const bytes = base64ToBytes(BIBLE_KRV_JSON_GZ_BASE64);
    const jsonText = await gunzipToText(bytes);
    const obj = JSON.parse(jsonText) as BibleData;
    return obj;
  })();

  return cachedPromise;
}
