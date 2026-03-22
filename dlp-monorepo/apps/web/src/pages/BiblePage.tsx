import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

type Verse = { c: number; v: number; t: string };

type PassagePayload = {
  refRaw: string;
  ref: string;
  book: string;
  range: { kind: 'chapter' | 'verse'; c1: number; v1: number | null; c2: number; v2: number | null };
  verses: Verse[];
  totalVerses: number;
  text: string;
};

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

export default function BiblePage() {
  const loc = useLocation();
  const nav = useNavigate();
  const { me, loading: authLoading } = useAuth();

  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const initialRef = qs.get('ref') || '';

  const [refInput, setRefInput] = useState(initialRef);
  const [data, setData] = useState<PassagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [autoRetry, setAutoRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState<null | { msg: string; kind: 'ok' | 'warn' }>(null);
  const last429Ref = useRef(false);

  const isAuthed = !!me;

  function goLogin() {
    const next = `${loc.pathname}${loc.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function load(ref: string): Promise<boolean> {
    const q = ref.trim();
    if (!q) return false;

    const cooling = cooldownUntil > Date.now();
    if (cooling) {
      setError(`요청이 너무 많습니다. ${Math.ceil((cooldownUntil - Date.now()) / 1000)}초 후 다시 시도해주세요.`);
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const url = `/api/bible/passage?${new URLSearchParams({ ref: q }).toString()}`;
      const res = await apiFetch(url);
      const j = await res.json().catch(() => ({}));

      if (res.status === 401) {
        goLogin();
        return false;
      }

      if (res.status === 429) {
        last429Ref.current = true;
        const resetAt = Number(res.headers.get('X-RateLimit-Reset') ?? 0);
        const waitMs = resetAt ? Math.max(1000, resetAt - Date.now()) : 30_000;
        setCooldownUntil(Date.now() + waitMs);
        setData(null);

        const label = rateLimitReasonLabel(j);
        const reasonLabel = label ? ` (${label})` : '';
        const loginHint = !authLoading && !isAuthed ? ' 로그인하면 제한이 완화될 수 있어요.' : '';
        const baseMsg = (j as any)?.message || `요청이 너무 많습니다.${reasonLabel} ${Math.ceil(waitMs / 1000)}초 후 다시 시도해주세요.`;
        setError(`${baseMsg}${loginHint}`);
        return false;
      }

      last429Ref.current = false;
      if (!res.ok) throw new Error(j?.message || j?.error || 'LOAD_FAILED');
      setData(j as any);
      return true;
    } catch (e: any) {
      last429Ref.current = false;
      setData(null);
      setError(String(e?.message ?? e));
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialRef) load(initialRef);
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
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(id);
  }, [toast]);

  const showCooldown = isCooling || retrying;

  useEffect(() => {
    if (isCooling) return;
    if (!autoRetry) return;

    setRetrying(true);
    Promise.resolve(load(refInput))
      .then((ok) => {
        if (ok) {
          setToast({ msg: '성공했어요', kind: 'ok' });
        } else {
          setToast({ msg: last429Ref.current ? '다시 제한됨' : '실패했어요', kind: 'warn' });
        }
      })
      .catch(() => {
        setToast({ msg: last429Ref.current ? '다시 제한됨' : '실패했어요', kind: 'warn' });
      })
      .finally(() => {
        setRetrying(false);
        setAutoRetry(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCooling, autoRetry]);

  return (
    <div>
      <TopBar title={data?.ref ?? '성경 본문'} backTo="/" />

      {toast ? (
        <div style={toastWrap}>
          <div style={toast.kind === 'ok' ? toastOk : toastWarn}>{toast.msg}</div>
        </div>
      ) : null}

      <section style={card}>
        <div style={{ fontWeight: 950, marginBottom: 8 }}>본문 찾기</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={refInput}
            onChange={(e) => setRefInput(e.target.value)}
            placeholder="예) 출애굽기 31장 / 창 9~10 / 시편 119:1~24"
            style={input}
          />
          <button type="button" style={ghostBtn} onClick={() => load(refInput)} disabled={loading || isCooling}>
            {isCooling ? `${cooldownSec}s` : loading ? '…' : '열기'}
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
          지원 형식: <b>책 장</b> / <b>책 장~장</b> / <b>책 장:절~절</b> / <b>책 장:절~장:절</b>
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

            {!authLoading && !isAuthed ? (
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

              {!authLoading && !isAuthed ? (
                <button type="button" style={ghostBtn} onClick={goLogin}>
                  로그인
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <div style={{ height: 12 }} />

      {error ? <div style={errorBox}>오류: {error}</div> : null}

      {data ? (
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{data.ref}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{data.totalVerses}절</div>
            </div>
            <button
              type="button"
              style={ghostBtn}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(data.text);
                  alert('본문을 복사했습니다.');
                } catch {
                  alert('복사에 실패했습니다.');
                }
              }}
            >
              복사
            </button>
          </div>

          <div style={{ height: 10 }} />

          <pre style={textBox}>{data.text}</pre>
        </section>
      ) : null}
    </div>
  );
}

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
