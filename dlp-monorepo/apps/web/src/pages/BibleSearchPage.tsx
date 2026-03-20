import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';

// Korean Protestant 66-book canonical order (for stable sorting)
const CANON = [
  '창세기','출애굽기','레위기','민수기','신명기','여호수아','사사기','룻기','사무엘상','사무엘하','열왕기상','열왕기하','역대상','역대하','에스라','느헤미야','에스더','욥기','시편','잠언','전도서','아가','이사야','예레미야','예레미야애가','에스겔','다니엘','호세아','요엘','아모스','오바댜','요나','미가','나훔','하박국','스바냐','학개','스가랴','말라기',
  '마태복음','마가복음','누가복음','요한복음','사도행전','로마서','고린도전서','고린도후서','갈라디아서','에베소서','빌립보서','골로새서','데살로니가전서','데살로니가후서','디모데전서','디모데후서','디도서','빌레몬서','히브리서','야고보서','베드로전서','베드로후서','요한일서','요한이서','요한삼서','유다서','요한계시록'
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
  // UI 하이라이트용 간단 토크나이저(백엔드 parsed.terms가 있으면 그걸 우선 사용)
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

  // 긴 토큰부터 적용(중첩 하이라이트 감소)
  const sorted = list.slice().sort((a, b) => b.length - a.length);

  let nodes: any[] = [text];
  let keySeq = 0; // ✅ 렌더마다 결정적인 key 생성 (Math.random 제거)

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
          const k = `m-${needle}-${keySeq++}`;
          next.push(
            <span key={k} style={mark}>
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

  const exceeded = Array.isArray(payload?.exceeded) ? payload.exceeded.map((x: any) => String(x)) : [];
  if (exceeded.length) return exceeded.map(mapCode).join(' · ');

  const reason = String(payload?.reason ?? '');
  if (reason === 'ACCOUNT_LIMIT') return mapCode('ACCOUNT');
  if (reason === 'DEVICE_LIMIT') return mapCode('DEVICE');
  if (reason === 'ACCOUNT_AND_DEVICE_LIMIT') return `${mapCode('ACCOUNT')} · ${mapCode('DEVICE')}`;
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

  const isAuthed = useMemo(() => {
    try {
      return Boolean(localStorage.getItem('dlp_token'));
    } catch {
      return false;
    }
  }, []);

  // context bottom sheet
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxErr, setCtxErr] = useState<string | null>(null);
  const [ctxData, setCtxData] = useState<ContextPayload | null>(null);
  const [ctxFocus, setCtxFocus] = useState<{ book: string; c: number; v: number } | null>(null);

  const limit = 20;

  async function run(searchQ: string, nextOffset: number): Promise<boolean> {
    const query = searchQ.trim();
    if (!query) return false;

    // 레이트리밋 쿨다운 중이면 자동 호출은 막고(수동 Enter/버튼은 허용)
    const cooling = cooldownUntil > Date.now();
    if (cooling && nextOffset === 0 && searchQ === q) {
      // 사용자가 같은 입력으로 버튼을 연타하는 케이스 방지
      setError(`요청이 너무 많습니다. ${Math.ceil((cooldownUntil - Date.now()) / 1000)}초 후 다시 시도해주세요.`);
      return false;
    }

    // cancel any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // 기록(최근 검색어)
    setRecent((prev) => upsertRecent(prev, query));

    setLoading(true);
    setError(null);

    try {
      const url = `/api/bible/search?${new URLSearchParams({ q: query, limit: String(limit), offset: String(nextOffset) }).toString()}`;
      const res = await apiFetch(url);
      const j = await res.json().catch(() => ({}));

      if (res.status === 429) {
        const resetAt = Number(res.headers.get('X-RateLimit-Reset') ?? 0);
        const waitMs = resetAt ? Math.max(1000, resetAt - Date.now()) : 30_000;
        setCooldownUntil(Date.now() + waitMs);
        retryPlanRef.current = { kind: 'search', q: query, offset: nextOffset };

        const label = rateLimitReasonLabel(j);
        const reasonLabel = label ? ` (${label})` : '';
        const loginHint = !isAuthed ? ' 로그인하면 제한이 완화될 수 있어요.' : '';
        const baseMsg = j?.message || `요청이 너무 많습니다.${reasonLabel} ${Math.ceil(waitMs / 1000)}초 후 다시 시도해주세요.`;
        setError(`${baseMsg}${loginHint}`);

        setData(null);
        return false;
      }

      if (!res.ok) throw new Error(j?.message || j?.error || 'SEARCH_FAILED');
      setData(j);
      setOffset(nextOffset);
      // auto-run 중복 방지(디바운스 루프)
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
      const url = `/api/bible/context?${new URLSearchParams({ book: it.book, c: String(it.c), v: String(it.v), radius: '3' }).toString()}`;
      const res = await apiFetch(url);
      const j = await res.json().catch(() => ({}));

      if (res.status === 429) {
        const resetAt = Number(res.headers.get('X-RateLimit-Reset') ?? 0);
        const waitMs = resetAt ? Math.max(1000, resetAt - Date.now()) : 10_000;
        setCooldownUntil(Date.now() + waitMs);
        retryPlanRef.current = { kind: 'context', it };

        const label = rateLimitReasonLabel(j);
        const reasonLabel = label ? ` (${label})` : '';
        const loginHint = !isAuthed ? ' 로그인하면 제한이 완화될 수 있어요.' : '';
        const baseMsg = j?.message || `요청이 너무 많습니다.${reasonLabel} ${Math.ceil(waitMs / 1000)}초 후 다시 시도해주세요.`;
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
    // 최근 검색어 로드
    setRecent(loadRecent());

    // URL에 q가 있으면 즉시 실행(초기 진입)
    if (initialQ) {
      lastAutoRunRef.current = initialQ.trim();
      run(initialQ, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 쿨다운 카운트다운 tick
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
        if (ok) setToast({ msg: '성공했어요', kind: 'ok' });
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

  // ✅ 추천 UX: 디바운스 자동검색(입력 멈춤 350ms)
  useEffect(() => {
    const query = q.trim();
    if (!query) return;

    if (isCooling) return;

    // 초기 로드/직전 실행과 동일하면 스킵
    if (lastAutoRunRef.current === query) return;

    // 너무 짧은 입력은 과도 호출 방지(원하면 1로 낮춰도 됨)
    if (query.length < 2) return;

    debounceRef.current = setTimeout(() => {
      run(query, 0);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const needles = useMemo(() => {
    if (data?.kind === 'text' && data.parsed?.terms?.length) return data.parsed.terms;
    return tokenizeNeedles(q);
  }, [data, q]);

  const sortedItems = useMemo(() => {
    if (data?.kind !== 'text') return [] as SearchItem[];
    return data.items
      .slice()
      // "구절 번호 순"(책(정경순) → 장 → 절)
      .sort((a, b) => {
        const ai = canonIndex.get(a.book) ?? 999;
        const bi = canonIndex.get(b.book) ?? 999;
        if (ai !== bi) return ai - bi;
        if (a.c !== b.c) return a.c - b.c;
        return a.v - b.v;
      });
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(id);
  }, [toast]);

  const showCooldown = isCooling || retrying;

  return (
    <div>
      <TopBar title="성경 검색" backTo="/" />

      {toast ? (
        <div style={toastWrap}>
          <div style={toast.kind === 'ok' ? toastOk : toastWarn}>{toast.msg}</div>
        </div>
      ) : null}

      <section style={card}>
        <div style={{ fontWeight: 950 }}>단어/구절 검색</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run(q, 0);
            }}
            placeholder="예) 믿음 / 태초 / 하나님 은혜 / 믿음 OR 소망"
            style={input}
          />
          <button type="button" style={ghostBtn} onClick={() => run(q, 0)} disabled={loading || isCooling}>
            {isCooling ? `${cooldownSec}s` : loading ? '…' : '검색'}
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
          지원: <b>정규화 검색</b>(공백/구두점 무시 + 단순 조사 제거) · <b>AND</b>(공백) · <b>OR</b>(<code>|</code> / OR / 또는)
          <span style={{ marginLeft: 8 }}>(입력 멈춤 350ms 후 자동검색)</span>
        </div>

        {showCooldown ? (
          <div style={cooldownBox}>
            <div>
              {retrying ? (
                <>재시도 중입니다… 잠시만요.</>
              ) : (
                <>
                  요청이 많아 잠시 대기 중입니다. <b>{cooldownSec}초</b> 후 다시 시도해주세요.
                </>
              )}
            </div>
            {!isAuthed ? (
              <div style={{ marginTop: 6, color: 'var(--muted)' }}>
                로그인하면 제한이 완화될 수 있어요.
              </div>
            ) : null}
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={ghostBtn}
                onClick={() => setAutoRetry((v) => !v)}
                disabled={retrying}
              >
                {retrying ? '재시도 중…' : autoRetry ? `자동 재시도까지 ${cooldownSec}초 (취소)` : `${cooldownSec}초 후 자동 재시도`}
              </button>

              {!isAuthed ? (
                <button
                  type="button"
                  style={ghostBtn}
                  onClick={() => {
                    const next = `${loc.pathname}${loc.search}`;
                    nav(`/login?${new URLSearchParams({ next }).toString()}`);
                  }}
                >
                  로그인
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {recent.length ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>최근 검색</div>
              <button
                type="button"
                style={tinyBtn}
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
              </button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
      </section>

      <div style={{ height: 12 }} />

      {error ? <div style={errorBox}>오류: {error}</div> : null}

      {data?.kind === 'ref' ? (
        <section style={card}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>{data.ref}</div>
          <div style={{ height: 10 }} />
          <pre style={textBox}>{highlightText(data.text, needles)}</pre>
        </section>
      ) : null}

      {data?.kind === 'text' ? (
        <>
          <section style={card}>
            <div style={{ fontWeight: 950 }}>검색 결과</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
              {data.total}개 중 {data.offset + 1}~{Math.min(data.offset + data.items.length, data.total)}
              <span style={{ marginLeft: 8 }}>(정렬: 구절 번호 순)</span>
            </div>

            {data.parsed ? (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                해석: <b>{data.parsed.mode.toUpperCase()}</b> · 토큰 {data.parsed.terms.length}개
                <div style={{ marginTop: 4 }}>
                  {data.parsed.groups.map((g, i) => (
                    <div key={i}>
                      {data.parsed!.mode === 'or' ? `OR-${i + 1}: ` : 'AND: '}
                      {g.join(' + ')}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <div style={{ height: 10 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {sortedItems.map((it) => {
              const snippet = it.snippet || '';
              return (
                <button key={`${it.book}-${it.c}-${it.v}`} type="button" style={rowBtn} onClick={() => openContext(it)}>
                  <div style={{ fontWeight: 950 }}>{it.book} {it.c}:{it.v}</div>

                  {snippet ? (
                    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: 'var(--text)' }}>
                      {highlightText(snippet, needles)}
                    </div>
                  ) : null}

                  <div style={{ marginTop: snippet ? 6 : 4, fontSize: 12, lineHeight: 1.45, color: 'var(--muted)' }}>
                    {highlightText(it.t, needles)}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>탭하면 앞뒤 3절 문맥을 보여줍니다.</div>
                </button>
              );
            })}
          </div>

          <div style={{ height: 12 }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" style={ghostBtnWide} disabled={loading || isCooling || offset <= 0} onClick={() => run(q, Math.max(0, offset - limit))}>
              이전
            </button>
            <button type="button" style={ghostBtnWide} disabled={loading || isCooling || offset + limit >= data.total} onClick={() => run(q, offset + limit)}>
              다음
            </button>
          </div>
        </>
      ) : null}

      <BottomSheet open={ctxOpen} onClose={() => setCtxOpen(false)}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>문맥 보기 (앞뒤 3절)</div>
        {ctxFocus ? (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>
            {ctxFocus.book} {ctxFocus.c}:{ctxFocus.v}
          </div>
        ) : null}

        <div style={{ height: 10 }} />

        {ctxLoading ? <div style={{ color: 'var(--muted)' }}>불러오는 중…</div> : null}
        {ctxErr ? <div style={errorBox}>오류: {ctxErr}</div> : null}

        {ctxData ? (
          <div style={previewBox}>
            {ctxData.verses.map((x) => {
              const focused = x.c === ctxData.focus.c && x.v === ctxData.focus.v;
              return (
                <div key={`${x.c}:${x.v}`} style={{ lineHeight: 1.65 }}>
                  <span style={{ fontWeight: 950, marginRight: 6 }}>{x.v}</span>
                  <span style={focused ? focusLine : undefined}>{highlightText(x.t, needles)}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div style={{ height: 10 }} />

        {ctxFocus ? (
          <button
            type="button"
            style={ghostBtnWide}
            onClick={() => {
              const ref = `${ctxFocus.book} ${ctxFocus.c}:${ctxFocus.v}`;
              nav(`/bible?${new URLSearchParams({ ref }).toString()}`);
              setCtxOpen(false);
            }}
          >
            전체 본문 열기
          </button>
        ) : null}
      </BottomSheet>
    </div>
  );
}

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: any }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 12,
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 18,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          padding: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          color: 'var(--text)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 46, height: 5, borderRadius: 999, background: 'var(--border)' }} />
        </div>
        {children}
        <div style={{ height: 10 }} />
        <button type="button" onClick={onClose} style={{ ...ghostBtnWide, width: '100%' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)'
};

const input: React.CSSProperties = {
  flex: 1,
  height: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 800
};

const ghostBtn: React.CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 900
};

const ghostBtnWide: React.CSSProperties = {
  flex: 1,
  height: 44,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 950
};

const rowBtn: React.CSSProperties = {
  textAlign: 'left',
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)'
};

const textBox: React.CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--text)',
  padding: 12,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--soft)',
  maxHeight: 620,
  overflow: 'auto'
};

const previewBox: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--soft)',
  fontSize: 13,
  color: 'var(--text)'
};

const cooldownBox: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--soft)',
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 900
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--danger-border)',
  background: 'var(--danger-bg)',
  color: 'var(--danger-text)',
  fontWeight: 900
};

const focusLine: React.CSSProperties = {
  background: 'rgba(255, 230, 0, 0.25)',
  padding: '0 3px',
  borderRadius: 6
};

const chip: React.CSSProperties = {
  height: 30,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--soft)',
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 900
};

const tinyBtn: React.CSSProperties = {
  height: 28,
  padding: '0 10px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 900
};

const mark: React.CSSProperties = {
  background: 'rgba(255, 230, 0, 0.35)',
  padding: '0 3px',
  borderRadius: 6,
  fontWeight: 950
};

const toastWrap: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  top: 10,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 50
};

const toastBase: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 950,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  boxShadow: '0 8px 20px rgba(0,0,0,0.18)'
};

const toastOk: React.CSSProperties = {
  ...toastBase,
  border: '1px solid rgba(34, 197, 94, 0.35)',
  background: 'rgba(34, 197, 94, 0.10)'
};

const toastWarn: React.CSSProperties = {
  ...toastBase,
  border: '1px solid rgba(245, 158, 11, 0.45)',
  background: 'rgba(245, 158, 11, 0.10)'
};
