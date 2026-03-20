import type { BibleData, BibleVerse } from './store';

export type ParsedRef = {
  raw: string;
  book: string;
  // one of:
  // - chapter range (no verses)
  // - verse range (may span multiple chapters)
  kind: 'chapter' | 'verse';
  c1: number;
  v1: number | null;
  c2: number;
  v2: number | null;
};

const ABBR_BOOK: Record<string, string> = {
  // OT abbreviations used in McCheyne xlsx
  창: '창세기',
  출: '출애굽기',
  욥: '욥기'
};

function normalizeRaw(s: string) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[–—−]/g, '~')
    .replace(/：/g, ':')
    .replace(/～/g, '~')
    .trim();
}

function stripSuffix(s: string) {
  // remove trailing 장/절 words if present
  return s.replace(/(장|절)\s*$/g, '').trim();
}

export function findBookPrefix(raw: string, bible: BibleData) {
  // Try exact book names first (longest match wins)
  const candidates = [...bible.books].sort((a, b) => b.length - a.length);
  for (const b of candidates) {
    if (raw.startsWith(b)) {
      const rest = raw.slice(b.length).trim();
      return { book: b, rest };
    }
  }

  // Abbreviations like "창 9~10"
  // token before first digit
  const m = raw.match(/^([가-힣]{1,3})(?=\s*\d)/);
  if (m) {
    const ab = m[1];
    const full = ABBR_BOOK[ab];
    if (full) {
      const rest = raw.slice(ab.length).trim();
      return { book: full, rest };
    }
  }

  // Special: "누가복음1:1~38" (no space) already covered by startsWith.
  return null;
}

function parseChapterPart(part: string) {
  const t = stripSuffix(part);
  if (!t) return null;
  const mRange = t.match(/^(\d+)\s*~\s*(\d+)$/);
  if (mRange) return { c1: Number(mRange[1]), c2: Number(mRange[2]) };
  const mSingle = t.match(/^(\d+)$/);
  if (mSingle) return { c1: Number(mSingle[1]), c2: Number(mSingle[1]) };
  return null;
}

function parseVersePart(part: string) {
  const t = stripSuffix(part);
  if (!t) return null;

  // c:v~c:v
  let m = t.match(/^(\d+)\s*:\s*(\d+)\s*~\s*(\d+)\s*:\s*(\d+)$/);
  if (m) {
    return { c1: Number(m[1]), v1: Number(m[2]), c2: Number(m[3]), v2: Number(m[4]) };
  }

  // c:v~v
  m = t.match(/^(\d+)\s*:\s*(\d+)\s*~\s*(\d+)$/);
  if (m) {
    const c = Number(m[1]);
    return { c1: c, v1: Number(m[2]), c2: c, v2: Number(m[3]) };
  }

  // c:v
  m = t.match(/^(\d+)\s*:\s*(\d+)$/);
  if (m) {
    const c = Number(m[1]);
    const v = Number(m[2]);
    return { c1: c, v1: v, c2: c, v2: v };
  }

  return null;
}

export function parseRef(input: string, bible: BibleData): ParsedRef {
  const raw0 = normalizeRaw(input);
  const raw = stripSuffix(raw0);

  const found = findBookPrefix(raw, bible);
  if (!found) throw new Error(`UNKNOWN_BOOK: ${input}`);

  const { book } = found;
  let rest = stripSuffix(found.rest);
  if (!rest) throw new Error(`MISSING_CHAPTER: ${input}`);

  // Some plan entries contain "시편 10" (no '편') - but book already matched.

  // Determine kind by presence of ':'
  if (rest.includes(':')) {
    const vp = parseVersePart(rest);
    if (!vp) throw new Error(`BAD_REF: ${input}`);
    return { raw: input, book, kind: 'verse', ...vp };
  }

  // Chapter-only
  const cp = parseChapterPart(rest);
  if (!cp) {
    // try to recover formats like "11:1~12:28" where book+rest had no space and got split ok.
    throw new Error(`BAD_REF: ${input}`);
  }

  return { raw: input, book, kind: 'chapter', c1: cp.c1, v1: null, c2: cp.c2, v2: null };
}

export function resolveVerses(bible: BibleData, ref: ParsedRef): BibleVerse[] {
  const bookData = bible.data[ref.book];
  if (!bookData) throw new Error(`BOOK_NOT_FOUND: ${ref.book}`);

  const out: BibleVerse[] = [];

  // helper to push verse range in chapter
  function pushChapterVerses(c: number, vStart: number, vEnd: number) {
    const chap = bookData[c];
    if (!chap) return;
    const end = Math.min(vEnd, chap.length - 1);
    for (let v = vStart; v <= end; v++) {
      const t = chap[v];
      if (t) out.push({ c, v, t });
    }
  }

  if (ref.kind === 'chapter') {
    for (let c = ref.c1; c <= ref.c2; c++) {
      const chap = bookData[c];
      if (!chap) continue;
      pushChapterVerses(c, 1, chap.length - 1);
    }
    return out;
  }

  // verse kind (may span multiple chapters)
  const c1 = ref.c1;
  const c2 = ref.c2;
  const v1 = ref.v1 ?? 1;
  const v2 = ref.v2 ?? 9999;

  if (c1 === c2) {
    pushChapterVerses(c1, v1, v2);
    return out;
  }

  // first chapter: from v1 to end
  {
    const chap = bookData[c1];
    if (chap) pushChapterVerses(c1, v1, chap.length - 1);
  }
  // middle chapters: whole
  for (let c = c1 + 1; c <= c2 - 1; c++) {
    const chap = bookData[c];
    if (!chap) continue;
    pushChapterVerses(c, 1, chap.length - 1);
  }
  // last chapter: from 1 to v2
  pushChapterVerses(c2, 1, v2);

  return out;
}

export function formatNormalizedRef(ref: ParsedRef) {
  if (ref.kind === 'chapter') {
    if (ref.c1 === ref.c2) return `${ref.book} ${ref.c1}장`;
    return `${ref.book} ${ref.c1}~${ref.c2}장`;
  }

  if (ref.c1 === ref.c2) {
    if (ref.v1 === ref.v2) return `${ref.book} ${ref.c1}:${ref.v1}`;
    return `${ref.book} ${ref.c1}:${ref.v1}~${ref.v2}`;
  }

  return `${ref.book} ${ref.c1}:${ref.v1}~${ref.c2}:${ref.v2}`;
}
