import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UrgentPrayerTicker, { type UrgentTickerItem } from '../components/UrgentPrayerTicker';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import UrgentPrayerComposer from '../components/urgent/UrgentPrayerComposer';
import TopBar from '../components/layout/TopBar';
import Button from '../ui/Button';
import { Card } from '../ui/Card';

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

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const itemCount = items.length;
  const latestCreatedAt = items[0]?.createdAt ?? null;

  function goLogin() {
    const next = `${location.pathname}${location.search}`;
    navigate(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function openComposer() {
    if (authLoading) return;
    if (!me) {
      goLogin();
      return;
    }
    await refreshMe();
    setSheetOpen(true);
  }

  function scrollToItem(id: string) {
    const el = rowRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate(
      [
        { transform: 'translateY(0)', boxShadow: '0 0 0 0 rgba(243,180,156,0)' },
        { transform: 'translateY(-2px)', boxShadow: '0 0 0 6px rgba(243,180,156,0.18)' },
        { transform: 'translateY(0)', boxShadow: '0 0 0 0 rgba(243,180,156,0)' }
      ],
      { duration: 900, easing: 'ease-out' }
    );
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/urgent-prayers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const nextItems = Array.isArray(data) ? data : [];
      nextItems.sort((a, b) => b.createdAt - a.createdAt);
      setItems(nextItems);
    } catch (e: any) {
      setError(e?.message ?? '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(id: string) {
    const ok = window.confirm('이 긴급기도를 삭제할까요? (운영진 전용)');
    if (!ok) return;

    const reason = window.prompt('삭제 사유를 입력하세요(필수, 최대 120자)');
    if (!reason) return;

    const res = await apiFetch(`/api/admin/urgent-prayers/${id}/delete`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });

    if (res.status === 401) {
      goLogin();
      return;
    }

    if (res.status === 403) {
      window.alert('운영진 권한이 필요합니다.');
      return;
    }

    if (!res.ok) {
      window.alert('삭제 실패: 권한 또는 로그인 상태를 확인하세요.');
      return;
    }

    await reload();
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    const el = rowRefs.current[highlightId];
    if (!el) return;
    scrollToItem(highlightId);
  }, [highlightId, items.length]);

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
              <div style={heroTitle}>지금 함께 기도할 제목</div>
              <div style={heroDesc}>모든 교회가 함께 보는 공통 게시판입니다. 등록된 글은 24시간 동안 노출되고, 공동체가 바로 함께 기도할 수 있어요.</div>
            </div>
            <div style={countStat}>
              <div style={countValue}>{loading ? '…' : itemCount}</div>
              <div style={countLabel}>함께 제목</div>
            </div>
          </div>

          <div style={heroPillRow}>
            <span style={heroPeachPill}>공용 게시판</span>
            <span style={heroMintPill}>노출 24시간</span>
            <span style={heroNeutralPill}>{latestCreatedAt ? `최근 ${formatTime(latestCreatedAt)}` : '방금 확인 가능'}</span>
          </div>

          <div style={tickerShell}>
            <div style={tickerRow}>
              <div style={tickerIconWrap} aria-hidden="true">
                <MegaphoneIcon />
              </div>
              <div style={tickerContentWrap}>
                <UrgentPrayerTicker items={items} intervalMs={4600} heightPx={44} onItemClick={scrollToItem} />
              </div>
            </div>
          </div>

          <div style={heroActions}>
            <Button type="button" variant="primary" size="lg" wide onClick={openComposer}>
              긴급기도 작성하기
            </Button>
            <Button type="button" variant="ghost" size="lg" wide onClick={reload}>
              새로고침
            </Button>
          </div>

          <div style={{ marginTop: 10 }}>
            <Button
              type="button"
              variant="secondary"
              size="md"
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
          </div>
        </Card>

        {error ? <div className="uiErrorBox">{error}</div> : null}

        <Card pad style={sectionCard}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>BOARD</div>
              <div style={sectionTitle}>긴급기도 목록</div>
              <div style={sectionDesc}>최근 등록된 순서대로 확인할 수 있고, 티커를 누르면 해당 항목으로 바로 이동합니다.</div>
            </div>
            <div style={sectionChip}>Board</div>
          </div>

          {loading ? (
            <div style={skeletonStack}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} style={skeletonCard} />
              ))}
            </div>
          ) : itemCount === 0 ? (
            <div style={emptyCard}>
              <div style={emptyTitle}>등록된 긴급기도가 없습니다.</div>
              <div style={emptyDesc}>지금 필요한 기도제목이 있다면 아래 버튼으로 바로 등록해 보세요.</div>
            </div>
          ) : (
            <div style={list}>
              {items.map((item, index) => {
                const isHighlighted = highlightId === item.id;
                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      rowRefs.current[item.id] = el;
                    }}
                    style={{
                      ...itemCard,
                      ...(index === 0 ? itemCardLatest : null),
                      ...(isHighlighted ? itemCardHighlighted : null)
                    }}
                  >
                    <div style={itemTop}>
                      <div style={itemPillRow}>
                        <span style={authorChip}>{item.authorName}</span>
                        <span style={timeMeta}>{formatTime(item.createdAt)}</span>
                      </div>

                      <div style={itemActionRow}>
                        <span style={remainingChip}>{formatRemaining(item.expiresAt)}</span>
                        {isAdmin ? (
                          <Button type="button" variant="danger" size="md" onClick={() => void removeItem(item.id)}>
                            삭제
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div style={itemContent}>{item.content}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card pad style={sectionCard}>
          <div style={guideHeader}>
            <div>
              <div style={guideTitle}>안내</div>
              <div style={guideDesc}>긴급기도는 교회 전체가 함께 보는 게시판이므로 한 번에 한 가지 제목을 짧고 분명하게 작성해 주세요.</div>
            </div>
            <div style={guideChip}>Guide</div>
          </div>

          <div style={guideList}>
            <div style={guideBox}>
              <div style={guideBoxTitle}>작성 팁</div>
              <div style={guideBoxText}>상황과 기도 포인트가 바로 보이도록 한 문장으로 자연스럽게 적으면 참여가 쉬워집니다.</div>
            </div>
            <div style={guideBox}>
              <div style={guideBoxTitle}>노출 규칙</div>
              <div style={guideBoxText}>작성자 표시는 실명으로 보이고, 게시글은 24시간 동안 노출됩니다. 운영 정책상 삭제는 운영진만 가능합니다.</div>
            </div>
          </div>
        </Card>

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

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="uiSheetBackdrop" onClick={onClose}>
      <div className="uiSheet" onClick={(e) => e.stopPropagation()}>
        <div className="uiSheetHandleWrap">
          <div className="uiSheetHandle" />
        </div>
        {children}
        <div style={{ marginTop: 14 }}>
          <Button type="button" variant="secondary" size="md" wide onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatRemaining(expiresAt: number) {
  const ms = Math.max(0, expiresAt - Date.now());
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분 남음`;
  return `${hours}시간 ${minutes}분 남음`;
}

function MegaphoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5v1a2.5 2.5 0 0 0 2.5 2.5H7l3.8 3.2c.65.54 1.6.08 1.6-.77V6.55c0-.85-.95-1.31-1.6-.77L7 9H5.5A2.5 2.5 0 0 0 3 11.5Z" />
      <path d="M16 9.5a4.5 4.5 0 0 1 0 5" />
      <path d="M18.5 7a8 8 0 0 1 0 10" />
    </svg>
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

const heroCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)',
  marginBottom: 12
};

const heroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap'
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
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10
};

const heroTitle: CSSProperties = {
  fontSize: 'clamp(21px, 5.2vw, 24px)',
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em',
  lineHeight: 1.22
};

const heroDesc: CSSProperties = {
  marginTop: 8,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const countStat: CSSProperties = {
  minWidth: 64,
  textAlign: 'right'
};

const countValue: CSSProperties = {
  fontSize: 38,
  lineHeight: 1,
  fontWeight: 800,
  color: '#24313a'
};

const countLabel: CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  fontWeight: 700,
  color: '#7d8991'
};

const heroPillRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 14
};

const heroMintPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800
};

const heroPeachPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800
};

const heroNeutralPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.64)',
  border: '1px solid rgba(221,230,235,0.9)',
  color: '#6d7b84',
  fontSize: 12,
  fontWeight: 800
};

const tickerShell: CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(255,248,245,0.92), rgba(255,242,236,0.84))',
  border: '1px solid rgba(241,195,170,0.32)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)'
};

const tickerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10
};

const tickerIconWrap: CSSProperties = {
  width: 34,
  height: 34,
  flex: '0 0 34px',
  borderRadius: 12,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.62)',
  border: '1px solid rgba(243,180,156,0.22)',
  color: '#a05f48'
};

const tickerContentWrap: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const heroActions: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 14
};

const sectionCard: CSSProperties = {
  marginBottom: 12,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const sectionHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  padding: '2px 2px 12px'
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const sectionTitle: CSSProperties = {
  marginTop: 6,
  fontSize: 19,
  fontWeight: 800,
  lineHeight: 1.24,
  color: '#24313a'
};

const sectionDesc: CSSProperties = {
  marginTop: 6,
  color: '#6b7780',
  fontSize: 14,
  lineHeight: 1.6
};

const sectionChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#9d6550',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const skeletonStack: CSSProperties = {
  display: 'grid',
  gap: 12
};

const skeletonCard: CSSProperties = {
  height: 112,
  borderRadius: 22,
  background: 'linear-gradient(90deg, rgba(255,255,255,0.62) 0%, rgba(243,247,249,0.96) 50%, rgba(255,255,255,0.62) 100%)',
  backgroundSize: '200% 100%',
  animation: 'gratitudeSkeleton 1.2s ease-in-out infinite'
};

const emptyCard: CSSProperties = {
  padding: '18px 16px',
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,251,252,0.74))',
  border: '1px solid rgba(255,255,255,0.58)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const emptyTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 16,
  fontWeight: 800
};

const emptyDesc: CSSProperties = {
  marginTop: 8,
  color: '#6b7780',
  fontSize: 14,
  lineHeight: 1.6
};

const list: CSSProperties = {
  display: 'grid',
  gap: 12
};

const itemCard: CSSProperties = {
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(255,255,255,0.58)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,251,252,0.74))',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const itemCardLatest: CSSProperties = {
  border: '1px solid rgba(243,180,156,0.32)',
  background: 'linear-gradient(180deg, rgba(255,249,246,0.9), rgba(255,244,238,0.82))'
};

const itemCardHighlighted: CSSProperties = {
  boxShadow: '0 0 0 3px rgba(243,180,156,0.18), 0 12px 28px rgba(77,90,110,0.10)'
};

const itemTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap'
};

const itemPillRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};

const itemActionRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};

const authorChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800
};

const timeMeta: CSSProperties = {
  color: '#8d98a0',
  fontSize: 12,
  fontWeight: 700
};

const remainingChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800
};

const itemContent: CSSProperties = {
  marginTop: 12,
  color: '#37464f',
  fontSize: 15,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap'
};

const guideHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap'
};

const guideTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.24
};

const guideDesc: CSSProperties = {
  marginTop: 6,
  color: '#6b7780',
  fontSize: 14,
  lineHeight: 1.6
};

const guideChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2f7f73',
  fontSize: 11,
  fontWeight: 800
};

const guideList: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 14
};

const guideBox: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.62)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,251,252,0.74))'
};

const guideBoxTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 13,
  fontWeight: 800
};

const guideBoxText: CSSProperties = {
  marginTop: 6,
  color: '#6b7780',
  fontSize: 13,
  lineHeight: 1.6
};
