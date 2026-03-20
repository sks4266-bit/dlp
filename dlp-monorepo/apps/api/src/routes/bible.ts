import { Hono } from 'hono';
import type { Env } from '../env';
import { rateLimit } from '../middleware/rateLimit';
import { loadBible } from '../bible/store';
import { formatNormalizedRef, parseRef, resolveVerses } from '../bible/ref';
import { getNormVerses, looksLikeRef, searchFlatAdvanced, tryParseAsRef } from '../bible/search';

export const bibleRoutes = new Hono<{ Bindings: Env }>();

// 요구사항 변경: 성경 검색/문맥 포함 “로그인 없이 허용”
// → /api/bible/* 전체를 공개 API로 제공합니다.
// (apiFetch는 토큰이 있으면 자동 첨부하므로, 로그인/비로그인 모두 동일하게 동작)

bibleRoutes.get('/books', async (c) => {
  const bible = await loadBible();
  return c.json({ version: bible.version, books: bible.books });
});

bibleRoutes.get('/chapter', async (c) => {
  const book = (c.req.query('book') ?? '').trim();
  const chapter = Number(c.req.query('chapter') ?? 0);
  if (!book) return c.json({ error: 'BAD_REQUEST', message: 'book is required' }, 400);
  if (!Number.isFinite(chapter) || chapter <= 0) return c.json({ error: 'BAD_REQUEST', message: 'chapter must be number' }, 400);

  const bible = await loadBible();
  const ref = parseRef(`${book} ${chapter}장`, bible);
  const verses = resolveVerses(bible, ref);

  return c.json({
    refRaw: `${book} ${chapter}장`,
    ref: formatNormalizedRef(ref),
    book: ref.book,
    chapter,
    verses,
    text: verses.map((x) => `${x.v}. ${x.t}`).join('\n')
  });
});

bibleRoutes.get(
  '/search',
  // ✅ 공개 API 보호(가벼운 best-effort): IP 기준 60회/분
  // anon: 60/min
  // authed: 기기별 240/min + 계정총량 600/min (2중 체크)
  rateLimit({ keyPrefix: 'bible-search', anonLimit: 60, userDeviceLimit: 240, userAccountLimit: 600, windowMs: 60_000 }),
  async (c) => {
  const q = (c.req.query('q') ?? c.req.query('query') ?? '').trim();
  const limit = Math.max(1, Math.min(50, Number(c.req.query('limit') ?? 20)));
  const offset = Math.max(0, Number(c.req.query('offset') ?? 0));

  if (!q) return c.json({ error: 'BAD_REQUEST', message: 'q is required' }, 400);

  const bible = await loadBible();

  // "구절 입력"(예: 창세기 1:1)인 경우: 바로 본문 반환
  if (looksLikeRef(q)) {
    const asRef = tryParseAsRef(q, bible);
    if (asRef) {
      return c.json({ kind: 'ref', ...asRef });
    }
  }

  // 일반 단어/문장 검색 (고도화: 정규화 + AND/OR + 스니펫)
  // - 공백/구두점 제거
  // - 단순 조사(은/는/이/가/을/를/… ) 접미 제거(휴리스틱)
  // - '|' / OR / 또는 로 OR 그룹
  // - 그 외 공백 구분은 AND
  const verses = await getNormVerses(Promise.resolve(bible));
  const r = searchFlatAdvanced(verses, q, limit, offset);

  return c.json({
    kind: 'text',
    query: q,
    parsed: { mode: r.parsed.mode, groups: r.parsed.groups, terms: r.parsed.termsFlat },
    total: r.total,
    limit,
    offset,
    items: r.items
  });
});

bibleRoutes.get(
  '/context',
  // 클릭 기반 호출이 많을 수 있어 search보다 넉넉히
  // anon: 120/min
  // authed: 기기별 480/min + 계정총량 1200/min (2중 체크)
  rateLimit({ keyPrefix: 'bible-context', anonLimit: 120, userDeviceLimit: 480, userAccountLimit: 1200, windowMs: 60_000 }),
  async (c) => {
  const book = (c.req.query('book') ?? '').trim();
  const cNum = Number(c.req.query('c') ?? 0);
  const vNum = Number(c.req.query('v') ?? 0);
  const radius = Math.max(0, Math.min(20, Number(c.req.query('radius') ?? 3)));

  if (!book || !cNum || !vNum) return c.json({ error: 'BAD_REQUEST', message: 'book,c,v are required' }, 400);

  const bible = await loadBible();
  // same-chapter context only
  const chap = bible.data?.[book]?.[cNum];
  const maxV = chap ? Math.max(1, chap.length - 1) : vNum + radius;

  const v1 = Math.max(1, vNum - radius);
  const v2 = Math.min(maxV, vNum + radius);

  const refStr = `${book} ${cNum}:${v1}~${v2}`;
  const ref = parseRef(refStr, bible);
  const verses = resolveVerses(bible, ref);

  return c.json({
    book,
    chapter: cNum,
    focus: { c: cNum, v: vNum },
    radius,
    ref: formatNormalizedRef(ref),
    verses,
    text: verses.map((x) => `${x.c}:${x.v} ${x.t}`).join('\n')
  });
});

bibleRoutes.get(
  '/passage',
  // anon: 120/min
  // authed: 기기별 480/min + 계정총량 1200/min (2중 체크)
  rateLimit({ keyPrefix: 'bible-passage', anonLimit: 120, userDeviceLimit: 480, userAccountLimit: 1200, windowMs: 60_000 }),
  async (c) => {
  const q = (c.req.query('ref') ?? '').trim();
  if (!q) return c.json({ error: 'BAD_REQUEST', message: 'ref is required' }, 400);

  const bible = await loadBible();
  const ref = parseRef(q, bible);
  const verses = resolveVerses(bible, ref);

  // 홈용/미리보기용 limit
  const limit = Number(c.req.query('limit') ?? 0);
  const limited = Number.isFinite(limit) && limit > 0 ? verses.slice(0, Math.min(limit, 200)) : verses;

  return c.json({
    refRaw: q,
    ref: formatNormalizedRef(ref),
    book: ref.book,
    range: { kind: ref.kind, c1: ref.c1, v1: ref.v1, c2: ref.c2, v2: ref.v2 },
    verses: limited,
    totalVerses: verses.length,
    text: limited.map((x) => `${x.c}:${x.v} ${x.t}`).join('\n')
  });
});
