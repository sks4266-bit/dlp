import type { BibleData } from './store';
import { formatNormalizedRef, parseRef, resolveVerses } from './ref';
import { CANONICAL_BOOKS_KO } from './canon';

export type FlatVerse = { book: string; c: number; v: number; t: string };

export type SearchItem = FlatVerse & {
  // 결과 스니펫(앞뒤 일부) - UI에서 t 대신 보여줄 수도 있음
  snippet?: string;
  // 어떤 토큰이 매치되었는지(디버그/확장용)
  matched?: string[];
};

let cachedFlat: Promise<FlatVerse[]> | null = null;
let cachedNorm: Promise<Array<FlatVerse & { n: string }>> | null = null;

export async function getFlatVerses(biblePromise: Promise<BibleData>) {
  if (cachedFlat) return cachedFlat;
  cachedFlat = (async () => {
    const bible = await biblePromise;
    const out: FlatVerse[] = [];

    // canonical order first; fallback to whatever remains
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const b of CANONICAL_BOOKS_KO as any) {
      if (bible.data[b]) {
        ordered.push(b);
        seen.add(b);
      }
    }
    for (const b of bible.books) {
      if (!seen.has(b) && bible.data[b]) ordered.push(b);
    }

    for (const book of ordered) {
      const bd = bible.data[book];
      if (!bd) continue;
      for (let c = 1; c < bd.length; c++) {
        const chap = bd[c];
        if (!chap) continue;
        for (let v = 1; v < chap.length; v++) {
          const t = chap[v];
          if (t) out.push({ book, c, v, t });
        }
      }
    }
    return out;
  })();
  return cachedFlat;
}

const JOSA_SUFFIXES = [
  // 1글자 조사
  '은','는','이','가','을','를','에','의','도','만','과','와','께','부터','까지','처럼','보다','으로','로','에서','에게','한테','께서','라도','마저','조차','뿐'
];

function stripPuncToSpace(s: string) {
  return String(s ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    // punctuation → space
    .replace(/[~`!@#$%^&*()_+\-=\[\]{};:'",.<>/?\\|·…“”‘’]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTokens(s: string) {
  const base = stripPuncToSpace(s);
  if (!base) return [] as string[];
  const rawTokens = base.split(' ').filter(Boolean);

  const out: string[] = [];
  for (let tok of rawTokens) {
    // 끝 조사 제거(단순 휴리스틱)
    // 예) 믿음은 -> 믿음, 하나님께서 -> 하나님
    for (const j of JOSA_SUFFIXES) {
      if (tok.length > j.length && tok.endsWith(j)) {
        tok = tok.slice(0, -j.length);
        break;
      }
    }
    // 공백 제거/정규화
    tok = tok.replace(/\s+/g, '');
    if (tok) out.push(tok);
  }
  return out;
}

function normNoSpace(s: string) {
  return normalizeTokens(s).join('');
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

type ParsedQuery = {
  raw: string;
  groups: string[][]; // OR groups, each group is AND terms
  mode: 'and' | 'or';
  termsFlat: string[];
};

function parseQuery(q: string): ParsedQuery {
  const raw = q.trim();
  const normed = stripPuncToSpace(raw);

  // OR separators
  const parts = normed
    .split(/\s*(\||OR|또는)\s*/i)
    .filter((x) => x && x !== '|' && x.toUpperCase() !== 'OR' && x !== '또는');

  const hasOr = /\||\bOR\b|또는/i.test(normed);
  const groups = (hasOr ? parts : [normed]).map((p) => normalizeTokens(p));
  const termsFlat = uniq(groups.flat()).filter(Boolean);

  return {
    raw,
    groups: groups.filter((g) => g.length > 0),
    mode: hasOr ? 'or' : 'and',
    termsFlat
  };
}

function findSnippet(text: string, terms: string[], wordRadius = 6) {
  // ✅ 추천 방식: “단어(공백 기준) 중심 스니펫” + 한글/무공백 케이스는 안전하게 글자 기준으로 폴백
  // - 목표: (1) 읽기 좋은 스니펫, (2) 매칭 지점 주변 단어를 보여주기, (3) 형태소 분석기 같은 무거운 의존성 없이 구현
  const src = String(text ?? '');
  if (!src) return '';

  const cleaned = stripPuncToSpace(src);
  if (!cleaned) return '';

  const tryNeedles = uniq([
    ...terms,
    ...terms.map((t) => t.replace(/\s+/g, '')),
    ...terms.map((t) => stripPuncToSpace(t))
  ]).filter(Boolean);

  let bestIdx = -1;
  let bestNeedle = '';
  for (const needle of tryNeedles) {
    const idx = cleaned.indexOf(needle);
    if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) {
      bestIdx = idx;
      bestNeedle = needle;
    }
  }

  // 매칭 실패 → 앞부분 일부
  if (bestIdx < 0) {
    const maxChars = 40;
    return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars)}…` : cleaned;
  }

  // 공백이 거의 없는 경우(예: 매우 짧은 구절/공백 없는 텍스트) → 글자 기준 폴백
  const hasSpace = cleaned.includes(' ');
  if (!hasSpace) {
    const charRadius = 16;
    const start = Math.max(0, bestIdx - charRadius);
    const end = Math.min(cleaned.length, bestIdx + bestNeedle.length + charRadius);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < cleaned.length ? '…' : '';
    return `${prefix}${cleaned.slice(start, end)}${suffix}`;
  }

  // 단어 스팬(토큰 + 시작/끝 index) 만들기
  const spans: Array<{ w: string; s: number; e: number }> = [];
  let cursor = 0;
  for (const w of cleaned.split(' ').filter(Boolean)) {
    const s = cleaned.indexOf(w, cursor);
    const e = s + w.length;
    spans.push({ w, s, e });
    cursor = e;
  }
  if (!spans.length) return cleaned;

  // 매칭 위치가 포함된 토큰 index 찾기
  let ti = 0;
  for (let i = 0; i < spans.length; i++) {
    if (bestIdx >= spans[i].s && bestIdx < spans[i].e) {
      ti = i;
      break;
    }
    if (bestIdx >= spans[i].e) ti = i; // 가장 가까운 이전 토큰
  }

  const startIdx = Math.max(0, ti - wordRadius);
  const endIdx = Math.min(spans.length, ti + wordRadius + 1);
  const prefix = startIdx > 0 ? '…' : '';
  const suffix = endIdx < spans.length ? '…' : '';
  const snippet = spans.slice(startIdx, endIdx).map((x) => x.w).join(' ');
  return `${prefix}${snippet}${suffix}`;
}

export function looksLikeRef(q: string) {
  const t = q.trim();
  if (!t) return false;
  // has chapter/verse hints
  return /\d/.test(t) && (t.includes(':') || t.includes('장') || t.includes('절') || t.includes('~'));
}

export function tryParseAsRef(q: string, bible: BibleData) {
  try {
    const ref = parseRef(q, bible);
    const verses = resolveVerses(bible, ref);
    if (!verses.length) return null;
    return {
      refRaw: q,
      ref: formatNormalizedRef(ref),
      verses,
      text: verses.map((x) => `${x.c}:${x.v} ${x.t}`).join('\n')
    };
  } catch {
    return null;
  }
}

export async function getNormVerses(biblePromise: Promise<BibleData>) {
  if (cachedNorm) return cachedNorm;
  cachedNorm = (async () => {
    const flat = await getFlatVerses(biblePromise);
    return flat.map((x) => ({ ...x, n: normNoSpace(x.t) }));
  })();
  return cachedNorm;
}

function matchGroups(hay: string, groups: string[][]) {
  // any group matched (OR). within group: all terms matched (AND)
  // parseQuery()/normalizeTokens가 이미 공백/구두점/조사를 정리한 토큰을 만들어주므로,
  // 여기서는 per-verse 루프에서 추가 정규화를 반복하지 않고 그대로 비교(성능 개선).
  for (const g of groups) {
    let ok = true;
    for (const term of g) {
      const nt = term; // already normalized token
      if (!nt) continue;
      if (!hay.includes(nt)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export function searchFlatAdvanced(
  verses: Array<FlatVerse & { n: string }>,
  query: string,
  limit: number,
  offset: number
): { total: number; items: SearchItem[]; parsed: ParsedQuery } {
  const parsed = parseQuery(query);
  const items: SearchItem[] = [];

  if (!parsed.groups.length) return { total: 0, items: [], parsed };

  let total = 0;
  for (const vv of verses) {
    if (matchGroups(vv.n, parsed.groups)) {
      if (total >= offset && items.length < limit) {
        items.push({
          book: vv.book,
          c: vv.c,
          v: vv.v,
          t: vv.t,
          // 단어 기준 스니펫: 매칭 단어 주변 ±6단어
          snippet: findSnippet(vv.t, parsed.termsFlat, 6),
          matched: parsed.termsFlat
        });
      }
      total++;
    }
  }

  return { total, items, parsed };
}

// (구 버전 호환) 단일 토큰 substring 검색
export function searchFlat(verses: FlatVerse[], query: string, limit: number, offset: number) {
  const q = normNoSpace(query);
  const items: FlatVerse[] = [];
  if (!q) return { total: 0, items: [] };

  let total = 0;
  for (const vv of verses) {
    const t = normNoSpace(vv.t);
    if (t.includes(q)) {
      if (total >= offset && items.length < limit) items.push(vv);
      total++;
    }
  }

  return { total, items };
}
