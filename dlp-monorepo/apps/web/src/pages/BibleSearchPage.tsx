import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import Button from '../ui/Button';
import { Card, CardDesc, CardEyebrow, CardTitle } from '../ui/Card';

// Korean Protestant 66-book canonical order
const CANON = [
  '창세기', '출애굽기', '레위기', '민수기', '신명기', '여호수아', '사사기', '룻기',
  '사무엘상', '사무엘하', '열왕기상', '열왕기하', '역대상', '역대하', '에스라', '느헤미야',
  '에스더', '욥기', '시편', '잠언', '전도서', '아가', '이사야', '예레미야', '예레미야애가',
  '에스겔', '다니엘', '호세아', '요엘', '아모스', '오바댜', '요나', '미가', '나훔',
  '하박국', '스바냐', '학개', '스가랴', '말라기', '마태복음', '마가복음', '누가복음',
  '요한복음', '사도행전', '로마서', '고린도전서', '고린도후서', '갈라디아서', '에베소서',
  '빌립보서', '골로새서', '데살로니가전서', '데살로니가후서', '디모데전서', '디모데후서',
  '디도서', '빌레몬서', '히브리서', '야고보서', '베드로전서', '베드로후서', '요한일서',
  '요한이서', '요한삼서', '유다서', '요한계시록'
] as const;

const canonIndex = new Map<string, number>(CANON.map((b, i) => [b, i]));

type SearchItem = { book: string; c: number; v: number; t: string; snippet?: string };

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

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeNeedles(q: string) {
  const s = String(q ?? '').trim();
  if (!s) return [] as string[];
  return s
    .split(/\s*(\||OR|또는)\s*|\s+/i)
    .map((x) => String(x ?? '').trim())
    .filter((x) => x && x !== '|' && x.toUpperCase() !== 'OR' && x !== '또는')
    .filter((x) => x.length >= 1);
}

function highlightText(text: string, needles: string[]) {
  const list = (needles ?? []).map((x) => x.trim()).filter(Boolean);
  if (!list.length) return text;

  const sorted = list.slice().sort((a, b) => b.length - a.length);
  let nodes: any[] = [text];
  let keySeq = 0;

  for (const needle of sorted) {
    const next: any[] = [];
    const re = new RegExp(escapeRegExp(needle), 'gi');

    for (const n of nodes) {
      if (typeof n !== 'string') {
        next.push(n);
        continue;
      }

      const parts = n.split(re);
      if (parts.length <= 1) {
        next.push(n);
        continue;
      }

      const matches = n.match(re) ?? [];
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) next.push(parts[i]);
        if (i < matches.length) {
          next.push(
            <span key={`mark-${needle}-${keySeq++}`} style={mark}>
              {matches[i]}
            </span>
          );
        }
      }
    }

    nodes = next;
  }

  return nodes;
}

function rateLimitReasonLabel(payload: any) {
  const mapCode = (code: string) => {
    if (code === 'ACCOUNT') return '계정 전체 사용량 초과';
    if (code === 'DEVICE') return '이 기기 요청이 너무 빨라요';
    return code;
  };

  const exceeded = Array.isArray(payload?.exceeded)
    ? payload.exceeded.map((x: any) => String(x))
    : [];
  if (exceeded.length) return exceeded.map(mapCode).join(' · ');

  const reason = String(payload?.reason ?? '');
  if (reason === 'ACCOUNT_LIMIT') return mapCode('ACCOUNT');
  if (reason === 'DEVICE_LIMIT') return mapCode('DEVICE');
  if (reason === 'ACCOUNT_AND_DEVICE_LIMIT') {
    return `${mapCode('ACCOUNT')} · ${mapCode('DEVICE')}`;
  }
  if (reason === 'ANON_LIMIT') return '익명 요청이 너무 많아요';

  return '';
}

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

export default function BibleSearchPage() {
  const lastAutoRunRef = useRef<string>('');
  const debounceRef = useRef<any>(null);

  const loc = useLocation();
  const nav = useNavigate();
  const { me, loading: authLoading } = useAuth();

  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const initialQ = qs.get('q') || '';

  const [q, setQ] = useState(initialQ);
  const [recent, setRecent] = useState<string[]>([]);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [autoRetry, setAutoRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState<null | { msg: string; kind: 'ok' | 'warn' }>(null);

  const retryPlanRef = useRef<
    | null
    | { kind: 'search'; q: string; offset: number }
    | { kind: 'context'; it: SearchItem }
  >(null);

  const isAuthed = !!me;

  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxErr, setCtxErr] = useState<string | null>(null);
  const [ctxData, setCtxData] = useState<ContextPayload | null>(null);
  const [ctxFocus, setCtxFocus] = useState<{ book: string; c: number; v: number } | null>(
    null
  );

  const limit = 20;

  function goLogin() {
    const next = `${loc.pathname}${loc.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function run(searchQ: string, nextOffset: number): Promise<boolean> {
    const query = searchQ.trim();
    if (!query) return false;

    const cooling = cooldownUntil > Date.now();
    if (cooling && nextOffset === 0 && searchQ === q) {
      setError(`요청이 너무 많습니다. ${Math.ceil((cooldownUntil - Date.now()) / 1000)}초 후 다시 시도해주세요.`);
      return false;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    setRecent((prev) => upsertRecent(prev, query));
    setLoading(true);
    setError(null);

    try {
      const url = `/api/bible/search?${new URLSearchParams({
        q: query,
        limit: String(limit),
        offset: String(nextOffset)
      }).toString()}`;

      const res = await apiFetch(url);
      const j = await res.json().catch(() => ({}));

      if (res.status === 401) {
        goLogin();
        return false;
      }

      if (res.status === 429) {
        const resetAt = Number(res.headers.get('X-RateLimit-Reset') ?? 0);
        const waitMs = resetAt ? Math.max(1000, resetAt - Date.now()) : 30_000;

        setCooldownUntil(Date.now() + waitMs);
        retryPlanRef.current = { kind: 'search', q: query, offset: nextOffset };

        const label = rateLimitReasonLabel(j);
        const reasonLabel = label ? ` (${label})` : '';
        const loginHint = !authLoading && !isAuthed ? ' 로그인하면 제한이 완화될 수 있어요.' : '';
        const baseMsg =
          j?.message ||
          `요청이 너무 많습니다.${reasonLabel} ${Math.ceil(waitMs / 1000)}초 후 다시 시도해주세요.`;

        setError(`${baseMsg}${loginHint}`);
        setData(null);
        return false;
      }

      if (!res.ok) throw new Error(j?.message || j?.error || 'SEARCH_FAILED');

      setData(j);
      setOffset(nextOffset);
      lastAutoRunRef.current = query;
      return true;
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setData(null);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function openContext(it: SearchItem): Promise<boolean> {
    setCtxOpen(true);
    setCtxLoading(true);
    setCtxErr(null);
    setCtxData(null);
    setCtxFocus({ book: it.book, c: it.c, v: it.v });

    try {
      const url = `/api/bible/context?${new URLSearchParams({
        book: it.book,
        c: String(it.c),
        v: String(it.v),
        radius: '3'
      }).toString()}`;

      const res = await apiFetch(url);
      const j = await res.json().catch(() => ({}));

      if (res.status === 401) {
        goLogin();
        return false;
      }

      if (res.status === 429) {
        const resetAt = Number(res.headers.get('X-RateLimit-Reset') ?? 0);
        const waitMs = resetAt ? Math.max(1000, resetAt - Date.now()) : 10_000;

        setCooldownUntil(Date.now() + waitMs);
        retryPlanRef.current = { kind: 'context', it };

        const label = rateLimitReasonLabel(j);
        const reasonLabel = label ? ` (${label})` : '';
        const loginHint = !authLoading && !isAuthed ? ' 로그인하면 제한이 완화될 수 있어요.' : '';
        const baseMsg =
          j?.message ||
          `요청이 너무 많습니다.${reasonLabel} ${Math.ceil(waitMs / 1000)}초 후 다시 시도해주세요.`;

        setCtxErr(`${baseMsg}${loginHint}`);
        return false;
      }

      if (!res.ok) throw new Error(j?.message || j?.error || 'CONTEXT_FAILED');

      setCtxData(j);
      return true;
    } catch (e: any) {
      setCtxErr(String(e?.message ?? e));
      return false;
    } finally {
      setCtxLoading(false);
    }
  }

  useEffect(() => {
    setRecent(loadRecent());

    if (initialQ) {
      lastAutoRunRef.current = initialQ.trim();
      run(initialQ, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownSec = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));
  const isCooling = cooldownSec > 0;

  useEffect(() => {
    if (isCooling) return;
    if (!autoRetry) return;

    const plan = retryPlanRef.current;
    if (!plan) {
      setAutoRetry(false);
      return;
    }

    setRetrying(true);

    const p = plan.kind === 'search' ? run(plan.q, plan.offset) : openContext(plan.it);

    Promise.resolve(p)
      .then((ok) => {
        if (ok) setToast({ msg: '재시도 성공', kind: 'ok' });
        else setToast({ msg: '다시 제한됨', kind: 'warn' });
      })
      .catch(() => {
        setToast({ msg: '다시 제한됨', kind: 'warn' });
      })
      .finally(() => {
        setRetrying(false);
        setAutoRetry(false);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCooling, autoRetry]);

  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    if (isCooling) return;
    if (lastAutoRunRef.current === query) return;
    if (query.length < 2) return;

    debounceRef.current = setTimeout(() => {
      run(query, 0);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(id);
  }, [toast]);

  const needles = useMemo(() => {
    if (data?.kind === 'text' && data.parsed?.terms?.length) return data.parsed.terms;
    return tokenizeNeedles(q);
  }, [data, q]);

  const sortedItems = useMemo(() => {
    if (data?.kind !== 'text') return [] as SearchItem[];
    return data.items
      .slice()
      .sort((a, b) => {
        const ai = canonIndex.get(a.book) ?? 999;
        const bi = canonIndex.get(b.book) ?? 999;
        if (ai !== bi) return ai - bi;
        if (a.c !== b.c) return a.c - b.c;
        return a.v - b.v;
      });
  }, [data]);

  const showCooldown = isCooling || retrying;

  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="성경 검색" backTo="/" />

        {toast ? (
          <div style={toastWrap}>
            <div style={toast.kind === 'ok' ? toastOk : toastWarn}>{toast.msg}</div>
          </div>
        ) : null}

        <Card style={heroCard}>
          <div style={badgeMint}>BIBLE SEARCH</div>
          <div style={heroTitle}>단어와 구절로 성경을 빠르게 찾아보세요</div>
          <div style={heroDesc}>
            단어 검색, OR 검색, 구절 직접 입력, 문맥 보기까지 한 흐름으로 정리했습니다.
          </div>

          <div style={{ height: 14 }} />

          <div style={searchRow}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') run(q, 0);
              }}
              placeholder="예) 믿음 / 태초 / 하나님 은혜 / 믿음 OR 소망 / 요한복음 3:16"
              style={searchInput}
            />
            <Button
              variant="primary"
              onClick={() => run(q, 0)}
              disabled={loading || isCooling}
            >
              {isCooling ? `${cooldownSec}s` : loading ? '검색 중…' : '검색'}
            </Button>
          </div>

          <div style={guideText}>
            지원: 정규화 검색 · AND(공백) · OR(<code>|</code> / OR / 또는)
            <span style={{ marginLeft: 8 }}>입력 후 350ms 멈추면 자동 검색</span>
          </div>

          {showCooldown ? (
            <div style={cooldownBox}>
              <div style={cooldownTitle}>
                {retrying
                  ? '재시도 중입니다… 잠시만요.'
                  : `요청이 많아 잠시 대기 중입니다. ${cooldownSec}초 후 다시 시도해주세요.`}
              </div>

              {!authLoading && !isAuthed ? (
                <div style={cooldownDesc}>로그인하면 제한이 완화될 수 있어요.</div>
              ) : null}

              <div style={cooldownActions}>
                <Button
                  variant="ghost"
                  onClick={() => setAutoRetry((v) => !v)}
                  disabled={retrying}
                >
                  {retrying
                    ? '재시도 중…'
                    : autoRetry
                      ? `자동 재시도 ${cooldownSec}초 (취소)`
                      : `${cooldownSec}초 후 자동 재시도`}
                </Button>

                {!authLoading && !isAuthed ? (
                  <Button variant="secondary" onClick={goLogin}>
                    로그인
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {recent.length ? (
            <div style={{ marginTop: 14 }}>
              <div style={recentHead}>
                <div style={recentTitle}>최근 검색</div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRecent([]);
                    try {
                      localStorage.removeItem(RECENT_KEY);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  지우기
                </Button>
              </div>

              <div style={chipWrap}>
                {recent.slice(0, 8).map((x) => (
                  <button
                    key={x}
                    type="button"
                    style={chip}
                    onClick={() => {
                      setQ(x);
                      run(x, 0);
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <div style={{ height: 12 }} />

        {error ? <ErrorBox text={error} /> : null}

        {data?.kind === 'ref' ? (
          <>
            <Card style={resultHeadCard}>
              <CardEyebrow>REFERENCE</CardEyebrow>
              <CardTitle>{data.ref}</CardTitle>
              <CardDesc>직접 입력한 본문 결과입니다.</CardDesc>
            </Card>

            <div style={{ height: 10 }} />

            <Card style={resultCard}>
              <pre style={textBox}>{highlightText(data.text, needles)}</pre>
            </Card>
          </>
        ) : null}

        {data?.kind === 'text' ? (
          <>
            <Card style={resultHeadCard}>
              <div style={resultHeadTop}>
                <div>
                  <CardEyebrow>SEARCH RESULT</CardEyebrow>
                  <CardTitle>검색 결과</CardTitle>
                  <CardDesc>
                    {data.total}개 중 {data.offset + 1}~{Math.min(data.offset + data.items.length, data.total)}개
                  </CardDesc>
                </div>
                <div style={summaryPill}>정렬: 구절 번호 순</div>
              </div>

              {data.parsed ? (
                <div style={parsedBox}>
                  <div style={parsedTitle}>
                    해석: <b>{data.parsed.mode.toUpperCase()}</b> · 토큰 {data.parsed.terms.length}개
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {data.parsed.groups.map((g, i) => (
                      <div key={i} style={parsedLine}>
                        {data.parsed!.mode === 'or' ? `OR-${i + 1}: ` : 'AND: '}
                        {g.join(' + ')}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>

            <div style={{ height: 10 }} />

            <div style={cardsStack}>
              {sortedItems.map((it) => {
                const snippet = it.snippet || '';
                return (
                  <button
                    key={`${it.book}-${it.c}-${it.v}`}
                    type="button"
                    style={readingCard}
                    onClick={() => openContext(it)}
                  >
                    <div style={readingHead}>
                      <div>
                        <div style={readingRef}>
                          {it.book} {it.c}:{it.v}
                        </div>
                      </div>
                      <div style={openHint}>문맥 보기</div>
                    </div>

                    {snippet ? (
                      <div style={snippetBox}>{highlightText(snippet, needles)}</div>
                    ) : null}

                    <div style={verseBox}>{highlightText(it.t, needles)}</div>

                    <div style={cardHint}>탭하면 앞뒤 3절 문맥을 보여줍니다.</div>
                  </button>
                );
              })}
            </div>

            <div style={{ height: 12 }} />

            <div style={pagerRow}>
              <Button
                variant="ghost"
                wide
                disabled={loading || isCooling || offset <= 0}
                onClick={() => run(q, Math.max(0, offset - limit))}
              >
                이전
              </Button>
              <Button
                variant="ghost"
                wide
                disabled={loading || isCooling || offset + limit >= data.total}
                onClick={() => run(q, offset + limit)}
              >
                다음
              </Button>
            </div>
          </>
        ) : null}
      </div>

      <BottomSheet open={ctxOpen} onClose={() => setCtxOpen(false)}>
        <div style={sheetTitleWrap}>
          <div style={sheetEyebrow}>CONTEXT</div>
          <div style={sheetTitle}>문맥 보기 (앞뒤 3절)</div>
          {ctxFocus ? (
            <div style={sheetDesc}>
              {ctxFocus.book} {ctxFocus.c}:{ctxFocus.v}
            </div>
          ) : null}
        </div>

        <div style={{ height: 12 }} />

        {ctxLoading ? <div style={loadingText}>불러오는 중…</div> : null}
        {ctxErr ? <ErrorBox text={ctxErr} /> : null}

        {ctxData ? (
          <div style={previewBox}>
            {ctxData.verses.map((x) => {
              const focused = x.c === ctxData.focus.c && x.v === ctxData.focus.v;
              return (
                <div key={`${x.c}:${x.v}`} style={previewLine}>
                  <span style={verseNum}>{x.v}</span>
                  <span style={focused ? focusLine : undefined}>{highlightText(x.t, needles)}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div style={{ height: 12 }} />

        {ctxFocus ? (
          <Button
            variant="primary"
            wide
            onClick={() => {
              const ref = `${ctxFocus.book} ${ctxFocus.c}:${ctxFocus.v}`;
              nav(`/bible?${new URLSearchParams({ ref }).toString()}`);
              setCtxOpen(false);
            }}
          >
            전체 본문 열기
          </Button>
        ) : null}
      </BottomSheet>
    </div>
  );
}

function BottomSheet({
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
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={sheetBackdrop}
    >
      <div onClick={(e) => e.stopPropagation()} style={sheetPanel}>
        <div style={sheetHandleWrap}>
          <div style={sheetHandle} />
        </div>
        {children}
        <div style={{ height: 10 }} />
        <Button variant="ghost" wide onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <Card style={errorCard}>
      <div style={errorTitle}>오류가 발생했습니다</div>
      <div style={errorText}>{text}</div>
    </Card>
  );
}

const heroCard: CSSProperties = {
  borderRadius: 28,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.68))',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 20px 42px rgba(77,90,110,0.10)'
};

const badgeMint: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2b7f72',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const heroTitle: CSSProperties = {
  marginTop: 12,
  color: '#24313a',
  fontSize: 28,
  lineHeight: 1.18,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  marginTop: 10,
  color: '#66737b',
  fontSize: 14,
  lineHeight: 1.65
};

const searchRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'center'
};

const searchInput: CSSProperties = {
  minWidth: 0,
  minHeight: 48,
  padding: '0 16px',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.58)',
  background: 'rgba(255,255,255,0.68)',
  color: '#33424b',
  fontWeight: 700,
  outline: 'none'
};

const guideText: CSSProperties = {
  marginTop: 10,
  color: '#718089',
  fontSize: 12,
  lineHeight: 1.55
};

const cooldownBox: CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.56)',
  background: 'rgba(255,255,255,0.48)'
};

const cooldownTitle: CSSProperties = {
  color: '#4c5a63',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800
};

const cooldownDesc: CSSProperties = {
  marginTop: 6,
  color: '#718089',
  fontSize: 12,
  lineHeight: 1.5
};

const cooldownActions: CSSProperties = {
  marginTop: 10,
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap'
};

const recentHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10
};

const recentTitle: CSSProperties = {
  color: '#6e7b84',
  fontSize: 12,
  fontWeight: 900
};

const chipWrap: CSSProperties = {
  marginTop: 8,
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap'
};

const chip: CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.62)',
  background: 'rgba(255,255,255,0.58)',
  color: '#44525b',
  fontSize: 12,
  fontWeight: 800
};

const resultHeadCard: CSSProperties = {
  borderRadius: 24
};

const resultCard: CSSProperties = {
  borderRadius: 24
};

const resultHeadTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap'
};

const summaryPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.12)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2b7f72',
  fontSize: 12,
  fontWeight: 800
};

const parsedBox: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 16,
  background: 'rgba(255,255,255,0.48)',
  border: '1px solid rgba(255,255,255,0.50)'
};

const parsedTitle: CSSProperties = {
  color: '#4f5e67',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800
};

const parsedLine: CSSProperties = {
  color: '#718089',
  fontSize: 12,
  lineHeight: 1.45
};

const cardsStack: CSSProperties = {
  display: 'grid',
  gap: 10
};

const readingCard: CSSProperties = {
  textAlign: 'left',
  width: '100%',
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(255,255,255,0.58)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.64))',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const readingHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start'
};

const readingRef: CSSProperties = {
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.2
};

const openHint: CSSProperties = {
  color: '#2b7f72',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const snippetBox: CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 16,
  background: 'rgba(114,215,199,0.08)',
  border: '1px solid rgba(114,215,199,0.18)',
  color: '#33424b',
  fontSize: 13,
  lineHeight: 1.6
};

const verseBox: CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 16,
  background: 'rgba(255,255,255,0.52)',
  border: '1px solid rgba(255,255,255,0.48)',
  color: '#5a6971',
  fontSize: 13,
  lineHeight: 1.6
};

const cardHint: CSSProperties = {
  marginTop: 8,
  color: '#809099',
  fontSize: 11,
  fontWeight: 700
};

const pagerRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10
};

const textBox: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  fontSize: 14,
  lineHeight: 1.75,
  color: '#33424b',
  padding: 14,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.52)',
  border: '1px solid rgba(255,255,255,0.48)',
  maxHeight: 620,
  overflow: 'auto'
};

const errorCard: CSSProperties = {
  borderRadius: 22,
  border: '1px solid rgba(232,162,150,0.38)',
  background: 'rgba(255,244,241,0.84)',
  marginBottom: 12
};

const errorTitle: CSSProperties = {
  color: '#8e4f4f',
  fontSize: 16,
  fontWeight: 800
};

const errorText: CSSProperties = {
  marginTop: 8,
  color: '#7c6666',
  fontSize: 14,
  lineHeight: 1.55
};

const previewBox: CSSProperties = {
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.48)',
  background: 'rgba(255,255,255,0.50)',
  color: '#33424b'
};

const previewLine: CSSProperties = {
  lineHeight: 1.7,
  fontSize: 14
};

const verseNum: CSSProperties = {
  display: 'inline-block',
  minWidth: 20,
  color: '#2b7f72',
  fontWeight: 900,
  marginRight: 6
};

const focusLine: CSSProperties = {
  background: 'rgba(255, 236, 167, 0.72)',
  padding: '0 4px',
  borderRadius: 6
};

const loadingText: CSSProperties = {
  color: '#718089',
  fontSize: 14,
  lineHeight: 1.5
};

const mark: CSSProperties = {
  background: 'rgba(255, 236, 167, 0.76)',
  color: '#2f3a41',
  borderRadius: 6,
  padding: '0 3px'
};

const toastWrap: CSSProperties = {
  position: 'fixed',
  left: '50%',
  top: 16,
  transform: 'translateX(-50%)',
  zIndex: 1200,
  width: 'calc(100% - 28px)',
  maxWidth: 430
};

const toastBase: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  boxShadow: '0 18px 36px rgba(77,90,110,0.14)',
  fontSize: 13,
  fontWeight: 800,
  textAlign: 'center',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)'
};

const toastOk: CSSProperties = {
  ...toastBase,
  color: '#245e55',
  background: 'rgba(232,249,245,0.92)',
  border: '1px solid rgba(114,215,199,0.34)'
};

const toastWarn: CSSProperties = {
  ...toastBase,
  color: '#7a5b33',
  background: 'rgba(255,247,226,0.94)',
  border: '1px solid rgba(240,202,122,0.38)'
};

const sheetBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(25, 32, 39, 0.26)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  padding: 12,
  zIndex: 1100
};

const sheetPanel: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  borderRadius: 28,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.86))',
  border: '1px solid rgba(255,255,255,0.62)',
  padding: 16,
  boxShadow: '0 24px 48px rgba(52, 63, 74, 0.18)'
};

const sheetHandleWrap: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: 10
};

const sheetHandle: CSSProperties = {
  width: 48,
  height: 5,
  borderRadius: 999,
  background: 'rgba(139,153,165,0.35)'
};

const sheetTitleWrap: CSSProperties = {
  display: 'grid',
  gap: 6
};

const sheetEyebrow: CSSProperties = {
  color: '#83a39a',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const sheetTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.2
};

const sheetDesc: CSSProperties = {
  color: '#6d7982',
  fontSize: 13,
  fontWeight: 700
};
