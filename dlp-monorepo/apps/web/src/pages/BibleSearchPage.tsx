import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

type SearchItem = {
  book: string;
  c: number;
  v: number;
  t: string;
  snippet?: string;
};

type SearchPayloadText = {
  kind: 'text';
  query: string;
  parsed?: { mode: 'and' | 'or'; groups: string[][]; terms: string[] };
  total: number;
  limit: number;
  offset: number;
  items: SearchItem[];
};

type SearchPayloadRef = {
  kind: 'ref';
  refRaw: string;
  ref: string;
  verses: { c: number; v: number; t: string }[];
  text: string;
};

type SearchPayload = SearchPayloadText | SearchPayloadRef;

type ContextPayload = {
  book: string;
  chapter: number;
  focus: { c: number; v: number };
  radius: number;
  ref: string;
  verses: { c: number; v: number; t: string }[];
  text: string;
};

type PassagePayload = {
  refRaw: string;
  ref: string;
  book: string;
  range: { kind: 'chapter' | 'verse'; c1: number; v1: number | null; c2: number; v2: number | null };
  verses: { c: number; v: number; t: string }[];
  totalVerses: number;
  text: string;
};

type BooksPayload = {
  version: string;
  books: string[];
};

type BookmarkItem = {
  ref: string;
  note: string;
  savedAt: number;
  updatedAt: number;
};

type TabType = 'search' | 'read';

const RECENT_SEARCH_KEY = 'dlp_recent_bible_searches_v1';
const RECENT_READ_KEY = 'dlp_recent_bible_reads_v1';
const BOOKMARK_READ_KEY = 'dlp_bible_read_bookmarks_v1';
const QUICK_READ_REFS = ['창세기 1장', '시편 23편', '요한복음 3장', '로마서 8장'];

const BIBLE_SECTIONS = [
  {
    testament: '구약',
    subtitle: '39권',
    groups: [
      { label: '모세오경', books: ['창세기', '출애굽기', '레위기', '민수기', '신명기'] },
      { label: '역사서', books: ['여호수아', '사사기', '룻기', '사무엘상', '사무엘하', '열왕기상', '열왕기하', '역대상', '역대하', '에스라', '느헤미야', '에스더'] },
      { label: '시가서', books: ['욥기', '시편', '잠언', '전도서', '아가'] },
      { label: '대선지서', books: ['이사야', '예레미야', '예레미야애가', '에스겔', '다니엘'] },
      { label: '소선지서', books: ['호세아', '요엘', '아모스', '오바댜', '요나', '미가', '나훔', '하박국', '스바냐', '학개', '스가랴', '말라기'] }
    ]
  },
  {
    testament: '신약',
    subtitle: '27권',
    groups: [
      { label: '복음서', books: ['마태복음', '마가복음', '누가복음', '요한복음'] },
      { label: '역사서', books: ['사도행전'] },
      { label: '바울서신', books: ['로마서', '고린도전서', '고린도후서', '갈라디아서', '에베소서', '빌립보서', '골로새서', '데살로니가전서', '데살로니가후서', '디모데전서', '디모데후서', '디도서', '빌레몬서'] },
      { label: '일반서신', books: ['히브리서', '야고보서', '베드로전서', '베드로후서', '요한일서', '요한이서', '요한삼서', '유다서'] },
      { label: '예언서', books: ['요한계시록'] }
    ]
  }
] as const;

const CANONICAL_BOOKS = BIBLE_SECTIONS.flatMap((section) => section.groups.flatMap((group) => group.books));

function loadRecent(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveRecent(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(0, 10)));
  } catch {
    // ignore
  }
}

function normalizeBookmarks(input: unknown): BookmarkItem[] {
  const now = Date.now();
  if (!Array.isArray(input)) return [];

  return input
    .map((item, idx) => {
      if (typeof item === 'string') {
        const ref = item.trim();
        if (!ref) return null;
        const ts = now - idx;
        return { ref, note: '', savedAt: ts, updatedAt: ts };
      }
      if (!item || typeof item !== 'object') return null;

      const ref = String((item as any).ref ?? '').trim();
      if (!ref) return null;

      const savedAt = Number((item as any).savedAt ?? now - idx);
      const updatedAt = Number((item as any).updatedAt ?? savedAt);
      return {
        ref,
        note: String((item as any).note ?? ''),
        savedAt: Number.isFinite(savedAt) ? savedAt : now - idx,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : savedAt
      };
    })
    .filter((item): item is BookmarkItem => Boolean(item))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 20);
}

function loadBookmarks(key: string): BookmarkItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return normalizeBookmarks(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveBookmarks(key: string, list: BookmarkItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(normalizeBookmarks(list)));
  } catch {
    // ignore
  }
}

function upsertRecent(key: string, list: string[], value: string) {
  const s = value.trim();
  if (!s) return list;
  const next = [s, ...list.filter((x) => x !== s)].slice(0, 10);
  saveRecent(key, next);
  return next;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeVerseId(book: string, c: number, v: number) {
  return `${book}__${c}__${v}`;
}

function parseSingleVerseRef(ref: string) {
  const match = ref.trim().match(/^(.+?)\s+(\d+):(\d+)$/);
  if (!match) return null;
  return { book: match[1], c: Number(match[2]), v: Number(match[3]) };
}

function formatBookmarkDate(ts: number) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch {
    return '';
  }
}

function tokenizeNeedles(q: string) {
  return String(q ?? '')
    .trim()
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function highlightText(text: string, needles: string[]): ReactNode {
  const list = needles.filter(Boolean);
  if (!list.length) return text;

  const re = new RegExp(`(${list.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(re);

  return parts.map((part, idx) => {
    const matched = list.some((needle) => needle.toLowerCase() === part.toLowerCase());
    if (!matched) return <span key={idx}>{part}</span>;
    return (
      <span key={idx} style={mark}>
        {part}
      </span>
    );
  });
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const j = await res.clone().json();
    if (typeof j?.message === 'string' && j.message.trim()) return j.message.trim();
    if (typeof j?.error === 'string' && j.error.trim()) return j.error.trim();
  } catch {
    // ignore
  }

  try {
    const t = await res.text();
    if (t.trim()) return t.trim();
  } catch {
    // ignore
  }

  return fallback;
}

export default function BibleSearchPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { me } = useAuth();

  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const initialQ = qs.get('q') || '';
  const initialRef = qs.get('ref') || '';
  const initialTab = qs.get('tab') === 'read' || initialRef.trim() ? 'read' : 'search';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const [q, setQ] = useState(initialQ);
  const [recent, setRecent] = useState<string[]>([]);
  const [data, setData] = useState<SearchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxErr, setCtxErr] = useState<string | null>(null);
  const [ctxData, setCtxData] = useState<ContextPayload | null>(null);

  const [refInput, setRefInput] = useState(initialRef);
  const [recentReads, setRecentReads] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [currentBookmarkNote, setCurrentBookmarkNote] = useState('');
  const [highlightVerseIds, setHighlightVerseIds] = useState<string[]>([]);
  const [readData, setReadData] = useState<PassagePayload | null>(null);
  const [readLoading, setReadLoading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [readCooldownUntil, setReadCooldownUntil] = useState(0);
  const [books, setBooks] = useState<string[]>([]);
  const [selectedBook, setSelectedBook] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<number>(1);

  const limit = 20;
  const needles = useMemo(() => tokenizeNeedles(q), [q]);
  const cooldownSec = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  const readCooldownSec = Math.max(0, Math.ceil((readCooldownUntil - Date.now()) / 1000));
  const orderedBooks = useMemo(() => CANONICAL_BOOKS.filter((book) => books.includes(book)), [books]);
  const groupedBooks = useMemo(
    () =>
      BIBLE_SECTIONS.map((section) => ({
        ...section,
        groups: section.groups
          .map((group) => ({ ...group, books: group.books.filter((book) => books.includes(book)) }))
          .filter((group) => group.books.length > 0)
      })).filter((section) => section.groups.length > 0),
    [books]
  );

  function syncUrl(tab: TabType, nextQ?: string, nextRef?: string) {
    const params = new URLSearchParams();
    params.set('tab', tab);

    const qValue = (nextQ ?? q).trim();
    const refValue = (nextRef ?? refInput).trim();

    if (tab === 'search' && qValue) params.set('q', qValue);
    if (tab === 'read' && refValue) params.set('ref', refValue);

    nav(`/bible-search${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
  }

  function switchTab(tab: TabType) {
    setActiveTab(tab);
    syncUrl(tab);
  }

  function goLogin() {
    const next = `${loc.pathname}${loc.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function run(searchQ: string, nextOffset: number) {
    const query = searchQ.trim();
    if (!query) {
      setError('검색어를 입력해 주세요.');
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(
        `/api/bible/search?${new URLSearchParams({
          q: query,
          limit: String(limit),
          offset: String(nextOffset)
        }).toString()}`
      );

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (res.status === 429) {
        const waitMs = Number(res.headers.get('X-RateLimit-Reset') ?? 0) - Date.now();
        const safeWait = waitMs > 1000 ? waitMs : 30000;
        setCooldownUntil(Date.now() + safeWait);
        throw new Error(`요청이 많습니다. ${Math.ceil(safeWait / 1000)}초 후 다시 시도해 주세요.`);
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '검색에 실패했습니다.'));
      }

      const payload = (await res.json()) as SearchPayload;
      setData(payload);
      setOffset(nextOffset);
      setRecent((prev) => upsertRecent(RECENT_SEARCH_KEY, prev, query));
      setActiveTab('search');
      syncUrl('search', query, refInput);
    } catch (e: any) {
      setData(null);
      setError(String(e?.message ?? '검색에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  }

  async function openContext(it: SearchItem) {
    setCtxOpen(true);
    setCtxLoading(true);
    setCtxErr(null);
    setCtxData(null);

    try {
      const res = await apiFetch(
        `/api/bible/context?${new URLSearchParams({
          book: it.book,
          c: String(it.c),
          v: String(it.v),
          radius: '3'
        }).toString()}`
      );

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (res.status === 429) {
        throw new Error('문맥 조회가 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.');
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '문맥을 불러오지 못했습니다.'));
      }

      const payload = (await res.json()) as ContextPayload;
      setCtxData(payload);
    } catch (e: any) {
      setCtxErr(String(e?.message ?? '문맥을 불러오지 못했습니다.'));
    } finally {
      setCtxLoading(false);
    }
  }

  async function loadPassage(targetRef: string, options?: { highlightVerseIds?: string[]; skipRecent?: boolean }) {
    const query = targetRef.trim();
    if (!query) {
      setReadError('읽을 본문을 입력해 주세요.');
      setReadData(null);
      setHighlightVerseIds([]);
      return false;
    }

    setReadLoading(true);
    setReadError(null);

    try {
      const res = await apiFetch(`/api/bible/passage?${new URLSearchParams({ ref: query }).toString()}`);

      if (res.status === 401) {
        goLogin();
        return false;
      }

      if (res.status === 429) {
        const waitMs = Number(res.headers.get('X-RateLimit-Reset') ?? 0) - Date.now();
        const safeWait = waitMs > 1000 ? waitMs : 30000;
        setReadCooldownUntil(Date.now() + safeWait);
        throw new Error(`본문 조회 요청이 많습니다. ${Math.ceil(safeWait / 1000)}초 후 다시 시도해 주세요.`);
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '본문을 불러오지 못했습니다.'));
      }

      const payload = (await res.json()) as PassagePayload;
      const explicitHighlights = options?.highlightVerseIds ?? [];
      const inferredSingle = explicitHighlights.length ? null : parseSingleVerseRef(query);

      setReadData(payload);
      setRefInput(query);
      setSelectedBook(payload.book);
      setSelectedChapter(payload.range.c1);
      if (!options?.skipRecent) {
        setRecentReads((prev) => upsertRecent(RECENT_READ_KEY, prev, query));
      }
      setHighlightVerseIds(
        explicitHighlights.length
          ? explicitHighlights
          : inferredSingle
            ? [makeVerseId(inferredSingle.book, inferredSingle.c, inferredSingle.v)]
            : []
      );
      setActiveTab('read');
      syncUrl('read', q, query);
      return true;
    } catch (e: any) {
      setReadError(String(e?.message ?? '본문을 불러오지 못했습니다.'));
      return false;
    } finally {
      setReadLoading(false);
    }
  }

  async function loadBooks() {
    try {
      const res = await apiFetch('/api/bible/books');
      if (!res.ok) return;
      const payload = (await res.json()) as BooksPayload;
      const nextBooks = Array.isArray(payload?.books) ? payload.books : [];
      setBooks(nextBooks);
      setSelectedBook((prev) => prev || CANONICAL_BOOKS.find((book) => nextBooks.includes(book)) || nextBooks[0] || '');
    } catch {
      // ignore
    }
  }

  function openChapterSelection() {
    if (!selectedBook || !Number.isFinite(selectedChapter) || selectedChapter <= 0) {
      setReadError('책과 장을 확인해 주세요.');
      return;
    }
    void loadPassage(`${selectedBook} ${selectedChapter}장`);
  }

  function stepChapter(delta: number) {
    setSelectedChapter((prev) => Math.max(1, prev + delta));
  }

  async function openAdjacentChapter(delta: number) {
    const baseBook = selectedBook || readData?.book;
    const baseChapter = readData?.range.c1 ?? selectedChapter;
    const nextChapter = baseChapter + delta;
    if (!baseBook || nextChapter <= 0) return;

    setSelectedBook(baseBook);
    setSelectedChapter(nextChapter);
    setRefInput(`${baseBook} ${nextChapter}장`);
    const ok = await loadPassage(`${baseBook} ${nextChapter}장`);
    if (!ok) {
      setSelectedChapter(baseChapter);
      setRefInput(`${baseBook} ${baseChapter}장`);
    }
  }

  function openReadTabWithRef(targetRef: string, highlight?: { book: string; c: number; v: number }) {
    setCtxOpen(false);
    setActiveTab('read');
    setRefInput(targetRef);
    void loadPassage(targetRef, {
      highlightVerseIds: highlight ? [makeVerseId(highlight.book, highlight.c, highlight.v)] : undefined
    });
  }

  function openSearchResultInReader(item: SearchItem) {
    const targetRef = `${item.book} ${item.c}장`;
    setActiveTab('read');
    setSelectedBook(item.book);
    setSelectedChapter(item.c);
    setRefInput(targetRef);
    void loadPassage(targetRef, { highlightVerseIds: [makeVerseId(item.book, item.c, item.v)] });
  }

  function saveOrUpdateBookmark(ref: string, note: string) {
    setBookmarks((prev) => {
      const now = Date.now();
      const existing = prev.find((item) => item.ref === ref);
      const next = existing
        ? prev.map((item) =>
            item.ref === ref
              ? { ...item, note: note.trim(), updatedAt: now }
              : item
          )
        : [{ ref, note: note.trim(), savedAt: now, updatedAt: now }, ...prev];
      const normalized = normalizeBookmarks(next);
      saveBookmarks(BOOKMARK_READ_KEY, normalized);
      return normalized;
    });
  }

  function deleteBookmark(ref: string) {
    setBookmarks((prev) => {
      const next = prev.filter((item) => item.ref !== ref);
      saveBookmarks(BOOKMARK_READ_KEY, next);
      return next;
    });
  }

  function updateBookmarkDraft(ref: string, note: string) {
    setBookmarks((prev) => prev.map((item) => (item.ref === ref ? { ...item, note } : item)));
  }

  function persistBookmarkNote(ref: string) {
    setBookmarks((prev) => {
      const next = prev.map((item) =>
        item.ref === ref
          ? { ...item, note: item.note.trim(), updatedAt: Date.now() }
          : item
      );
      const normalized = normalizeBookmarks(next);
      saveBookmarks(BOOKMARK_READ_KEY, normalized);
      return normalized;
    });
  }

  useEffect(() => {
    setRecent(loadRecent(RECENT_SEARCH_KEY));
    setRecentReads(loadRecent(RECENT_READ_KEY));
    setBookmarks(loadBookmarks(BOOKMARK_READ_KEY));
    void loadBooks();

    if (initialRef.trim()) {
      void loadPassage(initialRef);
    } else if (initialQ.trim()) {
      void run(initialQ, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!readData || highlightVerseIds.length === 0) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`bible-verse-${highlightVerseIds[0]}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [readData, highlightVerseIds]);

  const currentBookmark = readData ? bookmarks.find((item) => item.ref === readData.ref) ?? null : null;

  useEffect(() => {
    setCurrentBookmarkNote(currentBookmark?.note ?? '');
  }, [currentBookmark?.ref, currentBookmark?.note]);

  const canPrev = data?.kind === 'text' && offset > 0;
  const canNext = data?.kind === 'text' ? offset + (data.items?.length ?? 0) < (data.total ?? 0) : false;
  const isBookmarked = !!currentBookmark;
  const sortedBookmarks = useMemo(() => [...bookmarks].sort((a, b) => b.updatedAt - a.updatedAt), [bookmarks]);
  const currentChapterRef = `${selectedBook || readData?.book || ''} ${readData?.range.c1 ?? selectedChapter}장`.trim();

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="성경 검색" backTo="/" />

        <Card pad style={heroCard}>
          <div style={badgeMint}>BIBLE SEARCH</div>
          <CardTitle style={heroTitle}>찾기와 읽기를 한곳에서</CardTitle>
          <CardDesc style={heroDesc}>검색 탭에서는 단어와 구절을 찾고, 본문 읽기 탭에서는 개역개정 본문을 바로 열어 읽을 수 있어요.</CardDesc>

          <div style={tabRow}>
            <button
              type="button"
              style={{ ...tabButton, ...(activeTab === 'search' ? tabButtonActive : null) }}
              onClick={() => switchTab('search')}
            >
              검색
            </button>
            <button
              type="button"
              style={{ ...tabButton, ...(activeTab === 'read' ? tabButtonActive : null) }}
              onClick={() => switchTab('read')}
            >
              본문 읽기
            </button>
          </div>

          {activeTab === 'search' ? (
            <>
              <form
                style={searchForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(q, 0);
                }}
              >
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={input}
                  placeholder="예) 사랑 / 요 3:16 / 믿음 소망 사랑"
                />

                <div style={actionGrid}>
                  <Button type="submit" variant="primary" size="lg" wide disabled={loading}>
                    {loading ? '검색 중…' : '검색'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    wide
                    onClick={() => {
                      setQ('');
                      setData(null);
                      setError(null);
                      syncUrl('search', '', refInput);
                    }}
                  >
                    초기화
                  </Button>
                </div>
              </form>

              {recent.length > 0 ? (
                <div style={recentWrap}>
                  <div style={miniLabel}>최근 검색</div>
                  <div style={chipRow}>
                    {recent.slice(0, 8).map((item) => (
                      <button
                        key={item}
                        type="button"
                        style={chipBtn}
                        onClick={() => {
                          setQ(item);
                          void run(item, 0);
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {cooldownSec > 0 ? (
                <div style={cooldownBox}>
                  요청이 많습니다. {cooldownSec}초 후 다시 시도해 주세요.
                  {!me ? ' 로그인하면 제한이 완화될 수 있어요.' : ''}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div style={readerStack}>
                <div style={readerPanel}>
                  <div style={readerPanelHeader}>
                    <div>
                      <div style={miniLabel}>66권 정경 순서</div>
                      <div style={readerPanelTitle}>책 선택 후 장을 바로 읽어보세요</div>
                      <div style={readerPanelDesc}>구약 39권과 신약 27권을 분류 순서대로 재배치했습니다.</div>
                    </div>
                    <div style={selectedBookPill}>{selectedBook || '책 선택'}</div>
                  </div>

                  <div style={chapterControlSection}>
                    <div style={chapterControlRow}>
                      <button type="button" style={chapterStepBtn} onClick={() => stepChapter(-1)} disabled={selectedChapter <= 1}>
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={selectedChapter}
                        onChange={(e) => setSelectedChapter(Math.max(1, Number(e.target.value || 1)))}
                        style={chapterInput}
                        placeholder="장"
                      />
                      <button type="button" style={chapterStepBtn} onClick={() => stepChapter(1)}>
                        +
                      </button>
                    </div>
                    <Button type="button" variant="primary" size="md" wide onClick={openChapterSelection} disabled={readLoading || !selectedBook}>
                      {selectedBook ? `${selectedBook} ${selectedChapter}장 열기` : '책을 먼저 선택하세요'}
                    </Button>
                    <div style={chapterNavRow}>
                      <button type="button" style={chapterNavBtn} onClick={() => void openAdjacentChapter(-1)} disabled={readLoading || !(selectedBook || readData?.book) || selectedChapter <= 1}>
                        이전 장
                      </button>
                      <div style={chapterNavLabel}>{currentChapterRef || '장 네비게이션'}</div>
                      <button type="button" style={chapterNavBtn} onClick={() => void openAdjacentChapter(1)} disabled={readLoading || !(selectedBook || readData?.book)}>
                        다음 장
                      </button>
                    </div>
                  </div>

                  {groupedBooks.length === 0 ? (
                    <div style={emptyBookNote}>성경 권 목록을 불러오는 중입니다.</div>
                  ) : (
                    <div style={testamentStack}>
                      {groupedBooks.map((section) => {
                        const totalCount = section.groups.reduce((sum, group) => sum + group.books.length, 0);
                        const isOldTestament = section.testament === '구약';
                        return (
                          <div key={section.testament} style={{ ...testamentCard, ...(isOldTestament ? testamentCardOld : testamentCardNew) }}>
                            <div style={testamentHeader}>
                              <div>
                                <div style={isOldTestament ? testamentEyebrowOld : testamentEyebrowNew}>{isOldTestament ? 'OLD TESTAMENT' : 'NEW TESTAMENT'}</div>
                                <div style={testamentTitle}>{section.testament}</div>
                              </div>
                              <div style={testamentMeta}>{section.subtitle} · {totalCount}권</div>
                            </div>

                            <div style={categoryStack}>
                              {section.groups.map((group) => (
                                <div key={`${section.testament}-${group.label}`} style={categoryBlock}>
                                  <div style={categoryLabel}>{group.label}</div>
                                  <div style={bookGrid}>
                                    {group.books.map((book) => {
                                      const active = selectedBook === book;
                                      return (
                                        <button
                                          key={book}
                                          type="button"
                                          style={active ? bookCardActive : bookCard}
                                          onClick={() => setSelectedBook(book)}
                                        >
                                          <span style={bookCardText}>{book}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={readerSummary}>전체 {orderedBooks.length}권 기준으로 표시됩니다.</div>
                </div>

                <form
                  style={searchForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void loadPassage(refInput);
                  }}
                >
                  <div style={miniLabel}>구간 직접 열기</div>
                  <input
                    value={refInput}
                    onChange={(e) => setRefInput(e.target.value)}
                    style={input}
                    placeholder="예) 창세기 1장 / 요한복음 3:16~18 / 시편 119:1~24"
                  />

                  <div style={actionGrid}>
                    <Button type="submit" variant="primary" size="lg" wide disabled={readLoading}>
                      {readLoading ? '불러오는 중…' : '본문 열기'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      wide
                      onClick={() => {
                        setRefInput('');
                        setReadData(null);
                        setReadError(null);
                        syncUrl('read', q, '');
                      }}
                    >
                      초기화
                    </Button>
                  </div>
                </form>

                <div style={readerHintBox}>
                  지원 형식: <b>책 장</b> / <b>책 장~장</b> / <b>책 장:절~절</b> / <b>책 장:절~장:절</b>
                </div>

                <div style={miniLabel}>바로 열기</div>
                <div style={chipRow}>
                  {QUICK_READ_REFS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      style={chipBtn}
                      onClick={() => {
                        setRefInput(item);
                        void loadPassage(item);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {sortedBookmarks.length > 0 ? (
                  <div style={bookmarkManageSection}>
                    <div style={bookmarkManageHead}>
                      <div style={miniLabel}>북마크 관리</div>
                      <div style={bookmarkMetaText}>최신 수정 순으로 정렬됩니다.</div>
                    </div>
                    <div style={bookmarkList}>
                      {sortedBookmarks.map((item) => (
                        <div key={item.ref} style={bookmarkCard}>
                          <div style={bookmarkCardTop}>
                            <div>
                              <div style={bookmarkRef}>★ {item.ref}</div>
                              <div style={bookmarkDate}>저장 {formatBookmarkDate(item.savedAt)} · 수정 {formatBookmarkDate(item.updatedAt)}</div>
                            </div>
                            <div style={bookmarkActionInline}>
                              <button
                                type="button"
                                style={bookmarkGhostBtn}
                                onClick={() => {
                                  setRefInput(item.ref);
                                  setCurrentBookmarkNote(item.note);
                                  void loadPassage(item.ref, { skipRecent: true });
                                }}
                              >
                                열기
                              </button>
                              <button type="button" style={bookmarkDeleteBtn} onClick={() => deleteBookmark(item.ref)}>
                                삭제
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={item.note}
                            onChange={(e) => updateBookmarkDraft(item.ref, e.target.value)}
                            placeholder="이 본문에 대한 메모를 남겨보세요."
                            style={bookmarkNoteInput}
                          />
                          <div style={bookmarkCardFooter}>
                            <button type="button" style={bookmarkSaveBtn} onClick={() => persistBookmarkNote(item.ref)}>
                              메모 저장
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {recentReads.length > 0 ? (
                  <div style={recentWrap}>
                    <div style={miniLabel}>최근 읽은 본문</div>
                    <div style={chipRow}>
                      {recentReads.slice(0, 8).map((item) => (
                        <button
                          key={item}
                          type="button"
                          style={chipBtn}
                          onClick={() => {
                            setRefInput(item);
                            void loadPassage(item);
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {readCooldownSec > 0 ? (
                  <div style={cooldownBox}>
                    본문 조회 요청이 많습니다. {readCooldownSec}초 후 다시 시도해 주세요.
                    {!me ? ' 로그인하면 제한이 완화될 수 있어요.' : ''}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </Card>

        {activeTab === 'search' ? error ? <ErrorBox text={error} onRetry={() => void run(q, offset)} /> : null : null}
        {activeTab === 'read' ? readError ? <ErrorBox text={readError} onRetry={() => void loadPassage(refInput)} /> : null : null}

        {activeTab === 'search' && !data && !loading ? (
          <section style={sectionWrap}>
            <Card pad style={sectionCard}>
              <CardTitle style={sectionCardTitle}>검색 안내</CardTitle>
              <CardDesc style={sectionCardDesc}>단어 검색과 성경 구절 검색을 모두 지원합니다.</CardDesc>

              <div style={guideList}>
                <div style={guideItem}>• 단어 검색: 믿음 소망 사랑</div>
                <div style={guideItem}>• 구절 검색: 요 3:16</div>
                <div style={guideItem}>• 결과 탭: 주변 문맥 보기</div>
              </div>
            </Card>
          </section>
        ) : null}

        {activeTab === 'read' && !readData && !readLoading ? (
          <section style={sectionWrap}>
            <Card pad style={sectionCard}>
              <CardTitle style={sectionCardTitle}>본문 읽기 안내</CardTitle>
              <CardDesc style={sectionCardDesc}>개역개정 본문을 정경 순서 66권 기준으로 탐색하고, 장 단위 또는 원하는 구간으로 바로 열 수 있어요.</CardDesc>

              <div style={guideList}>
                <div style={guideItem}>• 카드형 책 선택: 구약 / 신약을 분리한 카드 버튼으로 원하는 책을 바로 선택</div>
                <div style={guideItem}>• 장 네비게이션: 이전 장 / 다음 장 버튼으로 연속 읽기</div>
                <div style={guideItem}>• 북마크와 강조: 자주 읽는 본문을 저장하고, 검색 결과에서 넘어온 절은 자동 강조</div>
              </div>
            </Card>
          </section>
        ) : null}

        {activeTab === 'search' && loading ? (
          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : null}

        {activeTab === 'read' && readLoading ? (
          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : null}

        {activeTab === 'search' && data?.kind === 'ref' ? (
          <section style={sectionWrap}>
            <Card pad style={sectionCard}>
              <div style={resultTop}>
                <div>
                  <div style={miniEyebrow}>REFERENCE</div>
                  <CardTitle style={sectionCardTitle}>{data.ref}</CardTitle>
                </div>
                <Button type="button" variant="secondary" size="md" onClick={() => openReadTabWithRef(data.ref)}>
                  본문 읽기
                </Button>
              </div>

              <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                {data.verses.map((verse) => (
                  <div key={`${verse.c}:${verse.v}`} style={verseCard}>
                    <div style={verseRef}>{`${data.ref.split(' ')[0]} ${verse.c}:${verse.v}`}</div>
                    <div style={verseText}>{verse.t}</div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeTab === 'search' && data?.kind === 'text' ? (
          <section style={sectionWrap}>
            <Card pad style={sectionCard}>
              <div style={resultTop}>
                <div>
                  <div style={miniEyebrow}>RESULT</div>
                  <CardTitle style={sectionCardTitle}>검색 결과 {data.total}건</CardTitle>
                  <CardDesc style={sectionCardDesc}>
                    {offset + 1}–{Math.min(offset + data.items.length, data.total)}번째 결과를 표시합니다.
                  </CardDesc>
                </div>
              </div>

              <div style={resultList}>
                {data.items.length === 0 ? (
                  <div style={emptyNote}>일치하는 구절을 찾지 못했습니다.</div>
                ) : (
                  data.items.map((item) => (
                    <div key={`${item.book}-${item.c}-${item.v}`} style={resultCardWrap}>
                      <button type="button" style={resultBtn} onClick={() => openSearchResultInReader(item)}>
                        <div style={resultRef}>{`${item.book} ${item.c}:${item.v}`}</div>
                        <div style={resultText}>{highlightText(item.snippet || item.t, needles)}</div>
                        <div style={resultHint}>본문 읽기 탭으로 이동해 해당 절을 강조해서 보여줍니다.</div>
                      </button>
                      <div style={resultActionRow}>
                        <button type="button" style={resultTextActionBtn} onClick={() => void openContext(item)}>
                          문맥 보기
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {data.total > data.limit ? (
                <div style={pager}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => void run(q, Math.max(0, offset - limit))}
                    disabled={!canPrev}
                  >
                    이전
                  </Button>
                  <div style={pagerText}>
                    {Math.floor(offset / limit) + 1} / {Math.max(1, Math.ceil(data.total / limit))}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => void run(q, offset + limit)}
                    disabled={!canNext}
                  >
                    다음
                  </Button>
                </div>
              ) : null}
            </Card>
          </section>
        ) : null}

        {activeTab === 'read' && readData ? (
          <section style={sectionWrap}>
            <Card pad style={sectionCard}>
              <div style={resultTop}>
                <div>
                  <div style={miniEyebrow}>READING</div>
                  <CardTitle style={sectionCardTitle}>{readData.ref}</CardTitle>
                  <CardDesc style={sectionCardDesc}>{readData.totalVerses}절 · 검색 결과에서 이동한 절은 강조 표시됩니다.</CardDesc>
                </div>
                <div style={readHeaderActions}>
                  <Button
                    type="button"
                    variant={isBookmarked ? 'primary' : 'secondary'}
                    size="md"
                    onClick={() => saveOrUpdateBookmark(readData.ref, currentBookmarkNote)}
                  >
                    {isBookmarked ? '북마크 업데이트' : '북마크 저장'}
                  </Button>
                  {isBookmarked ? (
                    <Button type="button" variant="ghost" size="md" onClick={() => deleteBookmark(readData.ref)}>
                      북마크 삭제
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(readData.text);
                        alert('본문을 복사했습니다.');
                      } catch {
                        alert('복사에 실패했습니다.');
                      }
                    }}
                  >
                    복사
                  </Button>
                </div>
              </div>

              <div style={bookmarkEditorBox}>
                <div style={bookmarkEditorLabel}>북마크 메모</div>
                <textarea
                  value={currentBookmarkNote}
                  onChange={(e) => setCurrentBookmarkNote(e.target.value)}
                  placeholder="이 본문에 남기고 싶은 묵상, 기도제목, 핵심 문장을 적어보세요."
                  style={bookmarkEditorInput}
                />
                <div style={bookmarkEditorHint}>{isBookmarked ? '메모를 수정한 뒤 북마크 업데이트를 누르면 최신 날짜로 정렬됩니다.' : '메모를 입력한 뒤 북마크 저장을 누르면 함께 저장됩니다.'}</div>
              </div>

              <div style={chapterNavRowRead}>
                <button type="button" style={chapterNavBtn} onClick={() => void openAdjacentChapter(-1)} disabled={readLoading || readData.range.c1 <= 1}>
                  이전 장
                </button>
                <div style={chapterNavLabelStrong}>{`${readData.book} ${readData.range.c1}장`}</div>
                <button type="button" style={chapterNavBtn} onClick={() => void openAdjacentChapter(1)} disabled={readLoading}>
                  다음 장
                </button>
              </div>

              <div style={readerVerseList}>
                {readData.verses.map((verse) => {
                  const verseId = makeVerseId(readData.book, verse.c, verse.v);
                  const focused = highlightVerseIds.includes(verseId);
                  return (
                    <div id={`bible-verse-${verseId}`} key={`${verse.c}:${verse.v}`} style={focused ? readerVerseCardFocus : readerVerseCard}>
                      <div style={readerVerseNo}>{verse.v}</div>
                      <div style={readerVerseBody}>
                        <div style={readerVerseRef}>{`${readData.book} ${verse.c}:${verse.v}`}</div>
                        <div style={readerVerseText}>{verse.t}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        ) : null}

        <Sheet open={ctxOpen} onClose={() => setCtxOpen(false)}>
          <div style={sheetHeader}>
            <div style={sheetEyebrow}>CONTEXT</div>
            <div style={sheetTitle}>주변 문맥 보기</div>
          </div>

          {ctxLoading ? (
            <div style={sheetBody}>
              <SkeletonCard />
            </div>
          ) : ctxErr ? (
            <div style={sheetBody}>
              <ErrorBox text={ctxErr} onRetry={() => setCtxOpen(false)} />
            </div>
          ) : ctxData ? (
            <div style={sheetBody}>
              <div style={contextRef}>{ctxData.ref}</div>
              <div style={contextList}>
                {ctxData.verses.map((verse) => {
                  const focused = verse.c === ctxData.focus.c && verse.v === ctxData.focus.v;
                  return (
                    <div key={`${verse.c}:${verse.v}`} style={focused ? focusLine : contextLine}>
                      <div style={contextVerseNo}>{verse.v}</div>
                      <div style={contextVerseText}>{verse.t}</div>
                    </div>
                  );
                })}
              </div>

              <div style={sheetActionRow}>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  wide
                  onClick={() => openReadTabWithRef(`${ctxData.book} ${ctxData.focus.c}장`, { book: ctxData.book, c: ctxData.focus.c, v: ctxData.focus.v })}
                >
                  이 본문 읽기
                </Button>
                <Button type="button" variant="ghost" size="lg" wide onClick={() => setCtxOpen(false)}>
                  닫기
                </Button>
              </div>
            </div>
          ) : null}
        </Sheet>
      </div>
    </div>
  );
}

function ErrorBox({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div style={errorBox}>
      <div style={{ fontSize: 14, lineHeight: 1.55 }}>{text}</div>
      <div style={{ marginTop: 10 }}>
        <Button type="button" variant="secondary" size="md" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={skeletonCard}>
      <div style={skeletonLineLg} />
      <div style={skeletonLineMd} />
      <div style={skeletonLineSm} />
    </div>
  );
}

function Sheet({
  open,
  onClose,
  children
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div style={sheetBackdrop} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={sheetHandleWrap}>
          <div style={sheetHandle} />
        </div>
        {children}
      </div>
    </div>
  );
}

const page: CSSProperties = {
  minHeight: '100dvh',
  padding: '12px 14px 30px',
  background: 'transparent'
};

const pageInner: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  margin: '0 auto'
};

const badgeMint: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10
};

const heroCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)'
};

const heroTitle: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  marginTop: 6,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const tabRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginTop: 16,
  marginBottom: 4
};

const tabButton: CSSProperties = {
  minHeight: 44,
  borderRadius: 16,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.84)',
  color: '#61707a',
  fontSize: 14,
  fontWeight: 900,
  cursor: 'pointer',
  boxShadow: '0 8px 18px rgba(77,90,110,0.05)'
};

const tabButtonActive: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(236,253,248,0.96), rgba(222,247,241,0.92))',
  border: '1px solid rgba(114,215,199,0.3)',
  color: '#257567'
};

const searchForm: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 16
};

const input: CSSProperties = {
  width: '100%',
  height: 52,
  borderRadius: 18,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.92)',
  padding: '0 16px',
  fontSize: 15,
  color: '#24313a',
  outline: 'none',
  boxSizing: 'border-box'
};

const chapterInput: CSSProperties = {
  width: '100%',
  height: 48,
  borderRadius: 16,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.92)',
  padding: '0 14px',
  fontSize: 16,
  fontWeight: 800,
  color: '#24313a',
  outline: 'none',
  boxSizing: 'border-box',
  textAlign: 'center'
};

const chapterControlSection: CSSProperties = {
  marginTop: 12,
  display: 'grid',
  gap: 10
};

const chapterControlRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '52px 1fr 52px',
  gap: 8,
  alignItems: 'center'
};

const chapterStepBtn: CSSProperties = {
  height: 48,
  borderRadius: 16,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.92)',
  color: '#4f6472',
  fontSize: 22,
  fontWeight: 800,
  cursor: 'pointer'
};

const chapterNavRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '96px 1fr 96px',
  gap: 8,
  alignItems: 'center'
};

const chapterNavBtn: CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: '1px solid rgba(210,220,228,0.95)',
  background: 'rgba(255,255,255,0.92)',
  color: '#4f6472',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer'
};

const chapterNavLabel: CSSProperties = {
  minHeight: 42,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 14,
  background: 'rgba(247,250,251,0.9)',
  border: '1px solid rgba(224,231,236,0.92)',
  color: '#5f6d75',
  fontSize: 12,
  fontWeight: 800,
  textAlign: 'center',
  padding: '0 10px'
};

const chapterNavRowRead: CSSProperties = {
  ...chapterNavRow,
  marginTop: 16
};

const chapterNavLabelStrong: CSSProperties = {
  ...chapterNavLabel,
  color: '#257567',
  background: 'rgba(236,253,248,0.92)',
  border: '1px solid rgba(114,215,199,0.3)'
};

const actionGrid: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 4
};

const actionGridCompact: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 10
};

const readerStack: CSSProperties = {
  display: 'grid',
  gap: 14,
  marginTop: 16
};

const readerPanel: CSSProperties = {
  padding: '16px 14px 14px',
  borderRadius: 18,
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(255,255,255,0.74)'
};

const readerPanelHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const readerPanelTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.3
};

const readerPanelDesc: CSSProperties = {
  marginTop: 4,
  color: '#6b7982',
  fontSize: 13,
  lineHeight: 1.5
};

const selectedBookPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#257567',
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: 'nowrap'
};

const testamentStack: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 14
};

const testamentCard: CSSProperties = {
  padding: '14px 12px 12px',
  borderRadius: 20,
  background: 'rgba(250,252,255,0.82)',
  border: '1px solid rgba(224,231,236,0.92)'
};

const testamentCardOld: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,249,240,0.96), rgba(255,255,255,0.9))',
  border: '1px solid rgba(236,208,150,0.42)'
};

const testamentCardNew: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(240,251,255,0.96), rgba(255,255,255,0.9))',
  border: '1px solid rgba(170,218,232,0.42)'
};

const testamentHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 10
};

const testamentTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 18,
  fontWeight: 900,
  marginTop: 4
};

const testamentEyebrowOld: CSSProperties = {
  color: '#9a6a23',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.12em'
};

const testamentEyebrowNew: CSSProperties = {
  color: '#2f7f73',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.12em'
};

const testamentMeta: CSSProperties = {
  color: '#6f7d86',
  fontSize: 12,
  fontWeight: 700
};

const categoryStack: CSSProperties = {
  display: 'grid',
  gap: 10
};

const categoryBlock: CSSProperties = {
  display: 'grid',
  gap: 6
};

const categoryLabel: CSSProperties = {
  color: '#5f6d75',
  fontSize: 12,
  fontWeight: 800
};

const bookGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8
};

const bookCard: CSSProperties = {
  minHeight: 54,
  width: '100%',
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(255,255,255,0.96)',
  color: '#4f6472',
  borderRadius: 16,
  padding: '10px 8px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  boxShadow: '0 8px 18px rgba(77,90,110,0.04)'
};

const bookCardActive: CSSProperties = {
  ...bookCard,
  border: '1px solid rgba(114,215,199,0.34)',
  background: 'linear-gradient(180deg, rgba(236,253,248,0.96), rgba(222,247,241,0.92))',
  color: '#257567',
  boxShadow: '0 10px 20px rgba(114,215,199,0.16)'
};

const bookCardText: CSSProperties = {
  lineHeight: 1.35
};

const emptyBookNote: CSSProperties = {
  marginTop: 14,
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(247,250,251,0.88)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#6d7a83',
  fontSize: 13
};

const readerSummary: CSSProperties = {
  marginTop: 12,
  color: '#6f7d86',
  fontSize: 12,
  fontWeight: 700
};

const readerHintBox: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(247,250,251,0.88)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#5f6d75',
  fontSize: 13,
  lineHeight: 1.55
};

const recentWrap: CSSProperties = {
  marginTop: 14
};

const miniLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#738089',
  marginBottom: 8
};

const chipRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8
};

const chipBtn: CSSProperties = {
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(247,250,251,0.9)',
  color: '#5f6d75',
  borderRadius: 999,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer'
};

const cooldownBox: CSSProperties = {
  marginTop: 14,
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(255,247,235,0.95)',
  border: '1px solid rgba(236,208,150,0.5)',
  color: '#8a6a24',
  fontSize: 13,
  lineHeight: 1.55
};

const sectionWrap: CSSProperties = {
  marginTop: 14
};

const sectionCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const sectionCardTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const sectionCardDesc: CSSProperties = {
  marginTop: 4,
  color: '#6d7a83',
  fontSize: 13,
  lineHeight: 1.55
};

const guideList: CSSProperties = {
  marginTop: 14,
  display: 'grid',
  gap: 8
};

const guideItem: CSSProperties = {
  color: '#55636c',
  fontSize: 14,
  lineHeight: 1.55
};

const resultTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const miniEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const resultList: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 14
};

const resultCardWrap: CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(255,255,255,0.9)',
  overflow: 'hidden'
};

const resultBtn: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '14px 15px 10px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer'
};

const resultRef: CSSProperties = {
  color: '#2f7f73',
  fontSize: 13,
  fontWeight: 800
};

const resultText: CSSProperties = {
  marginTop: 6,
  color: '#33424b',
  fontSize: 15,
  lineHeight: 1.65
};

const resultHint: CSSProperties = {
  marginTop: 8,
  color: '#70808a',
  fontSize: 12,
  lineHeight: 1.45
};

const resultActionRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  padding: '0 15px 12px'
};

const resultTextActionBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  padding: 0
};

const emptyNote: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(247,250,251,0.72)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#6d7a83',
  fontSize: 14,
  lineHeight: 1.55
};

const pager: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  marginTop: 14
};

const pagerText: CSSProperties = {
  color: '#68757e',
  fontSize: 13,
  fontWeight: 700
};

const verseCard: CSSProperties = {
  padding: '14px 15px',
  borderRadius: 18,
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(255,255,255,0.9)'
};

const verseRef: CSSProperties = {
  color: '#2f7f73',
  fontSize: 13,
  fontWeight: 800
};

const verseText: CSSProperties = {
  marginTop: 6,
  color: '#33424b',
  fontSize: 15,
  lineHeight: 1.65
};

const readHeaderActions: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 8
};

const readerVerseList: CSSProperties = {
  marginTop: 14,
  display: 'grid',
  gap: 10,
  maxHeight: 620,
  overflow: 'auto',
  paddingRight: 2
};

const readerVerseCard: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '44px 1fr',
  gap: 12,
  padding: '14px 15px',
  borderRadius: 18,
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(250,252,255,0.88)',
  scrollMarginTop: 100
};

const readerVerseCardFocus: CSSProperties = {
  ...readerVerseCard,
  border: '1px solid rgba(245,188,72,0.65)',
  background: 'linear-gradient(180deg, rgba(255,248,220,0.96), rgba(255,255,255,0.92))',
  boxShadow: '0 12px 26px rgba(245,188,72,0.18)'
};

const readerVerseNo: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: 'rgba(236,253,248,0.95)',
  color: '#257567',
  fontSize: 15,
  fontWeight: 900,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const readerVerseBody: CSSProperties = {
  minWidth: 0
};

const readerVerseRef: CSSProperties = {
  color: '#6d7a83',
  fontSize: 12,
  fontWeight: 800
};

const readerVerseText: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 15,
  lineHeight: 1.72
};

const bookmarkManageSection: CSSProperties = {
  marginTop: 16,
  display: 'grid',
  gap: 10
};

const bookmarkManageHead: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
};

const bookmarkMetaText: CSSProperties = {
  color: '#7b8790',
  fontSize: 12,
  fontWeight: 700
};

const bookmarkList: CSSProperties = {
  display: 'grid',
  gap: 10
};

const bookmarkCard: CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(255,255,255,0.9)',
  padding: '14px 14px 12px'
};

const bookmarkCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const bookmarkRef: CSSProperties = {
  color: '#257567',
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.4
};

const bookmarkDate: CSSProperties = {
  marginTop: 4,
  color: '#7b8790',
  fontSize: 12,
  lineHeight: 1.45
};

const bookmarkActionInline: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end'
};

const bookmarkGhostBtn: CSSProperties = {
  minHeight: 34,
  borderRadius: 12,
  border: '1px solid rgba(214,223,229,0.92)',
  background: 'rgba(247,250,251,0.9)',
  color: '#4f6472',
  fontSize: 12,
  fontWeight: 800,
  padding: '0 12px',
  cursor: 'pointer'
};

const bookmarkDeleteBtn: CSSProperties = {
  ...bookmarkGhostBtn,
  color: '#a14c43',
  border: '1px solid rgba(234,178,161,0.6)',
  background: 'rgba(255,243,240,0.95)'
};

const bookmarkNoteInput: CSSProperties = {
  width: '100%',
  minHeight: 76,
  marginTop: 12,
  borderRadius: 14,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(250,252,255,0.96)',
  padding: '12px 14px',
  fontSize: 14,
  lineHeight: 1.6,
  color: '#24313a',
  boxSizing: 'border-box',
  resize: 'vertical'
};

const bookmarkCardFooter: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 10
};

const bookmarkSaveBtn: CSSProperties = {
  minHeight: 36,
  borderRadius: 12,
  border: '1px solid rgba(114,215,199,0.3)',
  background: 'rgba(236,253,248,0.92)',
  color: '#257567',
  fontSize: 12,
  fontWeight: 900,
  padding: '0 12px',
  cursor: 'pointer'
};

const bookmarkEditorBox: CSSProperties = {
  marginTop: 14,
  padding: '14px',
  borderRadius: 18,
  background: 'rgba(247,250,251,0.9)',
  border: '1px solid rgba(224,231,236,0.9)'
};

const bookmarkEditorLabel: CSSProperties = {
  color: '#5f6d75',
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 8
};

const bookmarkEditorInput: CSSProperties = {
  width: '100%',
  minHeight: 88,
  borderRadius: 14,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.96)',
  padding: '12px 14px',
  fontSize: 14,
  lineHeight: 1.6,
  color: '#24313a',
  boxSizing: 'border-box',
  resize: 'vertical'
};

const bookmarkEditorHint: CSSProperties = {
  marginTop: 8,
  color: '#738089',
  fontSize: 12,
  lineHeight: 1.5
};

const mark: CSSProperties = {
  background: 'rgba(255,235,153,0.88)',
  color: '#4e4320',
  borderRadius: 6,
  padding: '0 2px'
};

const errorBox: CSSProperties = {
  marginTop: 12,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(255,243,240,0.96)',
  border: '1px solid rgba(234,178,161,0.44)',
  color: '#8b4f44'
};

const skeletonCard: CSSProperties = {
  borderRadius: 22,
  padding: 16,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const skeletonLineLg: CSSProperties = {
  height: 18,
  width: '56%',
  borderRadius: 999,
  background: 'rgba(223,230,235,0.95)'
};

const skeletonLineMd: CSSProperties = {
  height: 14,
  width: '82%',
  borderRadius: 999,
  background: 'rgba(232,237,241,0.95)',
  marginTop: 12
};

const skeletonLineSm: CSSProperties = {
  height: 12,
  width: '42%',
  borderRadius: 999,
  background: 'rgba(238,242,245,0.95)',
  marginTop: 12
};

const sheetBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(18,24,29,0.34)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 50,
  padding: '0 12px 12px'
};

const sheet: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  borderRadius: '24px 24px 0 0',
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(255,255,255,0.72)',
  boxShadow: '0 -8px 30px rgba(31,41,55,0.18)',
  backdropFilter: 'blur(18px)',
  padding: '10px 16px 18px'
};

const sheetHandleWrap: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '4px 0 8px'
};

const sheetHandle: CSSProperties = {
  width: 54,
  height: 6,
  borderRadius: 999,
  background: 'rgba(184,195,202,0.9)'
};

const sheetHeader: CSSProperties = {
  padding: '4px 4px 10px'
};

const sheetEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const sheetTitle: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const sheetBody: CSSProperties = {
  display: 'grid',
  gap: 14
};

const sheetActionRow: CSSProperties = {
  display: 'grid',
  gap: 8
};

const contextRef: CSSProperties = {
  color: '#2f7f73',
  fontSize: 14,
  fontWeight: 800
};

const contextList: CSSProperties = {
  display: 'grid',
  gap: 8
};

const contextLine: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 1fr',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 14,
  background: 'rgba(248,250,252,0.9)',
  border: '1px solid rgba(226,232,240,0.9)'
};

const focusLine: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 1fr',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 14,
  background: 'rgba(114,215,199,0.12)',
  border: '1px solid rgba(114,215,199,0.22)'
};

const contextVerseNo: CSSProperties = {
  color: '#6f7b83',
  fontSize: 13,
  fontWeight: 800,
  textAlign: 'center'
};

const contextVerseText: CSSProperties = {
  color: '#33424b',
  fontSize: 15,
  lineHeight: 1.65
};
