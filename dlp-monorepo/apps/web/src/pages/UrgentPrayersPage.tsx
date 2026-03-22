import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UrgentPrayerTicker, { type UrgentTickerItem } from '../components/UrgentPrayerTicker';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import UrgentPrayerComposer from '../components/urgent/UrgentPrayerComposer';
import TopBar from '../components/layout/TopBar';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

export default function UrgentPrayersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const highlightId = useMemo(() => new URLSearchParams(location.search).get('highlight'), [location.search]);

  const { me, loading: authLoading, refreshMe } = useAuth();
  const isAdmin = !!me?.isAdmin;

  const [items, setItems] = useState<UrgentTickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function goLogin() {
    const next = `${location.pathname}${location.search}`;
    navigate(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function readErrorMessage(res: Response) {
    const contentType = res.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (typeof data === 'string') return data;
        if (data?.error) return String(data.error);
        if (data?.message) return String(data.message);
        return `HTTP ${res.status}`;
      }

      const text = await res.text();
      return text?.trim() || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  async function reload() {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/urgent-prayers');
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message ?? '긴급기도를 불러오지 못했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    const el = rowRefs.current[highlightId];
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate(
      [
        { backgroundColor: 'rgba(243, 180, 156, 0.22)' },
        { backgroundColor: 'rgba(243, 180, 156, 0.08)' },
        { backgroundColor: 'transparent' }
      ],
      { duration: 1200, easing: 'ease-out' }
    );
  }, [highlightId, items.length]);

  async function openComposer() {
    if (authLoading) return;

    if (!me) {
      goLogin();
      return;
    }

    await refreshMe();
    setSheetOpen(true);
  }

  async function handleDelete(id: string) {
    const ok = confirm('이 긴급기도를 삭제할까요? (운영진 전용)');
    if (!ok) return;

    const reason = prompt('삭제 사유를 입력하세요(필수, 최대 120자)');
    if (!reason?.trim()) return;

    setDeleteLoadingId(id);

    try {
      const res = await apiFetch(`/api/admin/urgent-prayers/${id}/delete`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (res.status === 403) {
        alert('운영진 권한이 필요합니다.');
        return;
      }

      if (!res.ok) {
        alert(await readErrorMessage(res));
        return;
      }

      await reload();
    } catch (e: any) {
      alert(e?.message ?? '삭제에 실패했습니다.');
    } finally {
      setDeleteLoadingId(null);
    }
  }

  function focusItem(id: string) {
    const el = rowRefs.current[id];
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate(
      [
        { transform: 'translateY(0px)', backgroundColor: 'rgba(243,180,156,0.20)' },
        { transform: 'translateY(-1px)', backgroundColor: 'rgba(243,180,156,0.08)' },
        { transform: 'translateY(0px)', backgroundColor: 'transparent' }
      ],
      { duration: 900, easing: 'ease-out' }
    );
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar
          title="긴급기도"
          backTo="/"
          right={
            <Button type="button" variant="secondary" size="md" onClick={openComposer}>
              + 작성
            </Button>
          }
        />

        <Card pad style={heroCard}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={badgePeach}>URGENT PRAYER</div>
              <CardTitle style={heroTitle}>지금 함께 기도할 제목</CardTitle>
              <CardDesc style={heroDesc}>
                모든 교회가 함께 보는 공통 게시판입니다. 등록된 글은 <b>24시간</b> 동안 노출되며,
                운영진만 삭제할 수 있습니다.
              </CardDesc>
            </div>

            <div style={heroMetaBox}>
              <div style={heroMetaMain}>{items.length}</div>
              <div style={heroMetaLabel}>현재 제목</div>
            </div>
          </div>

          <div style={tickerSection}>
            <UrgentPrayerTicker
              items={items}
              intervalMs={3200}
              resumeDelayMs={4500}
              heightPx={44}
              onItemClick={focusItem}
            />
          </div>

          <div style={heroActions}>
            <Button type="button" variant="primary" size="lg" wide onClick={openComposer}>
              긴급기도 작성하기
            </Button>
          </div>

          <div style={heroFoot}>
            <span style={heroFootText}>등록 후 전체 교회에 즉시 공유됩니다.</span>
          </div>
        </Card>

        <div style={{ height: 14 }} />

        {loading ? <Skeleton /> : null}
        {!loading && error ? <ErrorBox message={error} onRetry={reload} /> : null}

        {!loading && !error && items.length === 0 ? (
          <Card pad style={emptyCard}>
            <div style={emptyEmoji}>🙏</div>
            <div style={emptyTitle}>현재 등록된 긴급기도가 없습니다.</div>
            <div style={emptyDesc}>필요한 기도제목이 생기면 바로 작성해서 함께 나눠보세요.</div>
            <div style={{ marginTop: 14 }}>
              <Button type="button" variant="secondary" size="md" wide onClick={openComposer}>
                첫 기도제목 작성하기
              </Button>
            </div>
          </Card>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div style={list}>
            {items.map((it, idx) => (
              <Card
                key={it.id}
                pad
                style={{
                  ...itemCard,
                  ...(idx === 0 ? firstItemCard : null)
                }}
              >
                <div
                  ref={(el) => {
                    rowRefs.current[it.id] = el;
                  }}
                >
                  <div style={itemHead}>
                    <div style={itemHeadLeft}>
                      <div style={authorBadge}>{it.authorName}</div>
                      <div style={timeText}>{formatTime(it.createdAt)}</div>
                    </div>

                    {isAdmin ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={() => handleDelete(it.id)}
                        disabled={deleteLoadingId === it.id}
                      >
                        {deleteLoadingId === it.id ? '삭제 중…' : '삭제'}
                      </Button>
                    ) : null}
                  </div>

                  <div style={contentText}>{it.content}</div>

                  <div style={metaRow}>
                    <div style={metaChip}>24시간 노출</div>
                    {idx === 0 ? <div style={latestChip}>최신</div> : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : null}

        <div style={{ height: 14 }} />

        <Button
          type="button"
          variant="ghost"
          size="lg"
          wide
          onClick={() => {
            if (!me) {
              goLogin();
              return;
            }
            navigate('/urgent-prayers/new');
          }}
        >
          전체화면으로 작성하기
        </Button>

        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <UrgentPrayerComposer
            onUnauthorized={goLogin}
            onDone={async (newId) => {
              setSheetOpen(false);
              await reload();
              navigate(`/urgent-prayers?highlight=${encodeURIComponent(newId)}`);
            }}
          />
        </BottomSheet>
      </div>
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
    <div role="dialog" aria-modal="true" style={sheetBackdrop} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={sheetHandleWrap}>
          <div style={sheetHandle} />
        </div>

        {children}

        <div style={{ marginTop: 14 }}>
          <Button type="button" variant="secondary" size="lg" wide onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={skeletonStack}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={skeletonBlock} />
      ))}

      <style>
        {`
          @keyframes urgentPrayerShimmer {
            0% { background-position: 0% 0; }
            100% { background-position: 200% 0; }
          }
        `}
      </style>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card pad style={errorCard}>
      <div style={errorTitle}>불러오기 오류</div>
      <div style={errorText}>{message}</div>
      <div style={{ marginTop: 12 }}>
        <Button type="button" variant="secondary" size="md" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    </Card>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(
    2,
    '0'
  )} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

const heroCard: CSSProperties = {
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(255,247,242,0.92), rgba(255,243,238,0.80))',
  border: '1px solid rgba(243,180,156,0.28)',
  boxShadow: '0 12px 28px rgba(204,151,126,0.12)',
  backdropFilter: 'blur(16px)'
};

const heroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14
};

const heroCopy: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const badgePeach: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.22)',
  color: '#a05f48',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10
};

const heroTitle: CSSProperties = {
  fontSize: 27,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  marginTop: 6,
  color: '#726760',
  fontSize: 14,
  lineHeight: 1.58
};

const heroMetaBox: CSSProperties = {
  width: 92,
  minWidth: 92,
  height: 92,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.64)',
  border: '1px solid rgba(255,255,255,0.54)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.52)'
};

const heroMetaMain: CSSProperties = {
  color: '#24313a',
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1
};

const heroMetaLabel: CSSProperties = {
  marginTop: 6,
  color: '#8f7e75',
  fontSize: 11,
  fontWeight: 800
};

const tickerSection: CSSProperties = {
  marginTop: 14
};

const heroActions: CSSProperties = {
  marginTop: 14,
  display: 'grid',
  gap: 10
};

const heroFoot: CSSProperties = {
  marginTop: 10,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10
};

const heroFootText: CSSProperties = {
  color: '#9a7f74',
  fontSize: 12,
  fontWeight: 700
};

const skeletonStack: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10
};

const skeletonBlock: CSSProperties = {
  height: 106,
  borderRadius: 22,
  background:
    'linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.025), rgba(0,0,0,0.06))',
  backgroundSize: '200% 100%',
  animation: 'urgentPrayerShimmer 1.2s infinite linear'
};

const errorCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,245,245,0.70)',
  border: '1px solid rgba(235,138,127,0.28)',
  boxShadow: '0 10px 24px rgba(185,85,85,0.07)'
};

const errorTitle: CSSProperties = {
  color: '#9d4343',
  fontSize: 15,
  fontWeight: 800
};

const errorText: CSSProperties = {
  marginTop: 6,
  color: 'rgba(80, 45, 45, 0.82)',
  fontSize: 13,
  lineHeight: 1.5
};

const emptyCard: CSSProperties = {
  borderRadius: 24,
  textAlign: 'center',
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const emptyEmoji: CSSProperties = {
  fontSize: 34,
  lineHeight: 1
};

const emptyTitle: CSSProperties = {
  marginTop: 10,
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const emptyDesc: CSSProperties = {
  marginTop: 8,
  color: '#69767e',
  fontSize: 14,
  lineHeight: 1.55
};

const list: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10
};

const itemCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 10px 24px rgba(77,90,110,0.075)'
};

const firstItemCard: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,250,247,0.84), rgba(255,255,255,0.78))',
  border: '1px solid rgba(243,180,156,0.20)'
};

const itemHead: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10
};

const itemHeadLeft: CSSProperties = {
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};

const authorBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.13)',
  border: '1px solid rgba(114,215,199,0.20)',
  color: '#2b7f72',
  fontSize: 12,
  fontWeight: 800
};

const timeText: CSSProperties = {
  color: '#8b97a0',
  fontSize: 12,
  fontWeight: 700
};

const contentText: CSSProperties = {
  marginTop: 11,
  color: '#33424b',
  fontSize: 15,
  lineHeight: 1.66,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
};

const metaRow: CSSProperties = {
  marginTop: 13,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10
};

const metaChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 25,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.62)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#7d8a92',
  fontSize: 12,
  fontWeight: 800
};

const latestChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 25,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.14)',
  border: '1px solid rgba(243,180,156,0.22)',
  color: '#a05f48',
  fontSize: 12,
  fontWeight: 800
};

const sheetBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(56,67,76,0.22)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  padding: 12
};

const sheet: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  borderRadius: '24px 24px 18px 18px',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.84))',
  border: '1px solid rgba(255,255,255,0.58)',
  boxShadow: '0 20px 50px rgba(72,84,92,0.18)',
  padding: 14
};

const sheetHandleWrap: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: 12
};

const sheetHandle: CSSProperties = {
  width: 46,
  height: 5,
  borderRadius: 999,
  background: 'rgba(56,67,76,0.14)'
};
