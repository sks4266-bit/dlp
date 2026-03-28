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

type Payload = SearchPayloadText | SearchPayloadRef;

type ContextPayload = {
  book: string;
  chapter: number;
  focus: { c: number; v: number };
  radius: number;
  ref: string;
  verses: { c: number; v: number; t: string }[];
  text: string;
};

const RECENT_KEY = 'dlp_recent_bible_searches_v1';

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    // ignore
  }
}

function upsertRecent(list: string[], q: string) {
  const s = q.trim();
  if (!s) return list;
  const next = [s, ...list.filter((x) => x !== s)].slice(0, 10);
  saveRecent(next);
  return next;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  const [q, setQ] = useState(initialQ);
  const [recent, setRecent] = useState<string[]>([]);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxErr, setCtxErr] = useState<string | null>(null);
  const [ctxData, setCtxData] = useState<ContextPayload | null>(null);

  const limit = 20;
  const needles = useMemo(() => tokenizeNeedles(q), [q]);
  const cooldownSec = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

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

      const payload = (await res.json()) as Payload;
      setData(payload);
      setOffset(nextOffset);
      setRecent((prev) => upsertRecent(prev, query));
      nav(`/bible-search?${new URLSearchParams({ q: query }).toString()}`, { replace: true });
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

  useEffect(() => {
    setRecent(loadRecent());
    if (initialQ.trim()) {
      run(initialQ, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canPrev = data?.kind === 'text' && offset > 0;
  const canNext =
    data?.kind === 'text' ? offset + (data.items?.length ?? 0) < (data.total ?? 0) : false;

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="성경 검색" backTo="/" />

        <Card pad style={heroCard}>
          <div style={badgeMint}>BIBLE SEARCH</div>
          <CardTitle style={heroTitle}>단어와 구절로 바로 찾기</CardTitle>
          <CardDesc style={heroDesc}>

          </CardDesc>

          <form
            style={searchForm}
            onSubmit={(e) => {
              e.preventDefault();
              run(q, 0);
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
                  nav('/bible-search', { replace: true });
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
                      run(item, 0);
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
        </Card>

        {error ? <ErrorBox text={error} onRetry={() => run(q, offset)} /> : null}

        {!data && !loading ? (
          <section style={sectionWrap}>
            <Card pad style={sectionCard}>
              <CardTitle style={sectionCardTitle}>검색 안내</CardTitle>
              <CardDesc style={sectionCardDesc}>
                단어 검색과 성경 구절 검색을 모두 지원합니다.
              </CardDesc>

              <div style={guideList}>
                <div style={guideItem}>• 단어 검색: 믿음 소망 사랑</div>
                <div style={guideItem}>• 구절 검색: 요 3:16</div>
                <div style={guideItem}>• 결과 탭: 주변 문맥 보기</div>
              </div>
            </Card>
          </section>
        ) : null}

        {loading ? (
          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : null}

        {data?.kind === 'ref' ? (
          <section style={sectionWrap}>
            <Card pad style={sectionCard}>
              <div style={resultTop}>
                <div>
                  <div style={miniEyebrow}>REFERENCE</div>
                  <CardTitle style={sectionCardTitle}>{data.ref}</CardTitle>
                </div>
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

        {data?.kind === 'text' ? (
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
                    <button
                      key={`${item.book}-${item.c}-${item.v}`}
                      type="button"
                      style={resultBtn}
                      onClick={() => openContext(item)}
                    >
                      <div style={resultRef}>{`${item.book} ${item.c}:${item.v}`}</div>
                      <div style={resultText}>
                        {highlightText(item.snippet || item.t, needles)}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {data.total > data.limit ? (
                <div style={pager}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => run(q, Math.max(0, offset - limit))}
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
                    onClick={() => run(q, offset + limit)}
                    disabled={!canNext}
                  >
                    다음
                  </Button>
                </div>
              ) : null}
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

              <Button type="button" variant="secondary" size="lg" wide onClick={() => setCtxOpen(false)}>
                닫기
              </Button>
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
    <div role="dialog" aria-modal="true" style={sheetBackdrop} onClick={onClose}>
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

const actionGrid: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 4
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

const resultBtn: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '14px 15px',
  borderRadius: 18,
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(255,255,255,0.9)',
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
