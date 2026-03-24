import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UrgentPrayerTicker, { type UrgentTickerItem } from '../components/UrgentPrayerTicker';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import UrgentPrayerComposer from '../components/urgent/UrgentPrayerComposer';
import TopBar from '../components/layout/TopBar';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

async function safeReadJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function readErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (typeof json === 'string') return json;

      if (json && typeof json === 'object') {
        const message =
          typeof (json as { message?: unknown }).message === 'string'
            ? (json as { message: string }).message
            : typeof (json as { error?: unknown }).error === 'string'
              ? (json as { error: string }).error
              : null;

        if (message) return message;
      }
    } else {
      const text = await res.text();
      if (text?.trim()) return text.trim();
    }
  } catch {
    // ignore
  }

  return fallback;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(
    2,
    '0'
  )} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatRemainText(expiresAt: number) {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return '노출 종료';

  const minutes = Math.floor(diff / 1000 / 60);
  if (minutes < 60) return `${minutes}분 남음`;

  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  if (remainMinutes === 0) return `${hours}시간 남음`;
  return `${hours}시간 ${remainMinutes}분 남음`;
}

function isExpired(expiresAt: number) {
  return expiresAt <= Date.now();
}

export default function UrgentPrayersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const highlightId = useMemo(
    () => new URLSearchParams(location.search).get('highlight'),
    [location.search]
  );

  const { me, loading: authLoading, refreshMe } = useAuth();
  const isAdmin = !!me?.isAdmin;

  const [items, setItems] = useState<UrgentTickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  function goLogin() {
    const next = `${location.pathname}${location.search}`;
    navigate(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function reload({ preserveNotice = true }: { preserveNotice?: boolean } = {}) {
    setLoading(true);
    setError(null);
    if (!preserveNotice) setNotice(null);

    try {
      const res = await apiFetch('/api/urgent-prayers');
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '긴급기도를 불러오지 못했습니다.'));
      }

      const json = await safeReadJson(res);
      setItems(Array.isArray(json) ? (json as UrgentTickerItem[]) : []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : '긴급기도를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload({ preserveNotice: false });
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    const el = rowRefs.current[highlightId];
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    el.animate(
      [
        {
          transform: 'translateY(0px)',
          backgroundColor: 'rgba(243,180,156,0.18)'
        },
        {
          transform: 'translateY(-1px)',
          backgroundColor: 'rgba(243,180,156,0.08)'
        },
        {
          transform: 'translateY(0px)',
          backgroundColor: 'transparent'
        }
      ],
      { duration: 1100, easing: 'ease-out' }
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
    const ok = window.confirm('이 긴급기도를 삭제할까요? (운영진 전용)');
    if (!ok) return;

    const reasonInput = window.prompt('삭제 사유를 입력하세요(필수, 최대 120자)');
    const reason = reasonInput?.trim();

    if (!reason) {
      setError('삭제 사유를 입력해야 합니다.');
      return;
    }

    setDeleteLoadingId(id);
    setError(null);
    setNotice(null);

    try {
      const res = await apiFetch(`/api/admin/urgent-prayers/${id}/delete`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.slice(0, 120) })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (res.status === 403) {
        setError('운영진 권한이 필요합니다.');
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '삭제에 실패했습니다.'));
      }

      setNotice('긴급기도가 삭제되었습니다.');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
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
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar
          title="긴급기도"
          backTo="/"
          right={
            <Button type="button" variant="secondary" onClick={openComposer}>
              + 작성
            </Button>
          }
        />

        <Card className="glassHeroCard">
          <div style={heroHead}>
            <div style={{ minWidth: 0 }}>
              <div style={badgePeach}>
                <SirenIcon />
                URGENT PRAYER
              </div>

              <CardTitle>지금 함께 기도할 제목</CardTitle>
              <CardDesc>
                모든 교회가 함께 보는 공통 게시판입니다. 등록된 글은 <b>24시간</b> 동안
                노출되며, 운영진만 삭제할 수 있습니다.
              </CardDesc>
            </div>

            <div style={heroSide}>
              <div style={heroCount}>{items.length}</div>
              <div style={heroCountLabel}>현재 제목</div>
            </div>
          </div>

          <div className="stack12" />

          <div style={metaRow}>
            <MetaChip icon={<ClockIcon />} label="유효 24시간" tone="peach" />
            <MetaChip icon={<PeopleIcon />} label="교회 공용 게시판" tone="mint" />
            <MetaChip
              icon={<ShieldIcon />}
              label={isAdmin ? '운영진 삭제 가능' : '운영진 관리'}
              tone="neutral"
            />
          </div>

          <div className="stack12" />

          <div style={tickerWrap}>
            <UrgentPrayerTicker
              items={items}
              intervalMs={3200}
              resumeDelayMs={4500}
              heightPx={44}
              onItemClick={focusItem}
            />
          </div>

          <div className="stack12" />

          <div style={heroActions}>
            <Button type="button" variant="primary" size="lg" wide onClick={openComposer}>
              긴급기도 작성하기
            </Button>

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
          </div>
        </Card>

        <div className="stack12" />

        {error ? <NoticeBox tone="error" text={error} /> : null}
        {notice ? <NoticeBox tone="success" text={notice} /> : null}

        {loading ? (
          <div style={skeletonStack}>
            <SkeletonCard lines={2} />
            <div className="stack12" />
            <SkeletonCard lines={3} />
            <div className="stack12" />
            <SkeletonCard lines={3} />
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <Card>
            <div style={emptyWrap}>
              <div style={emptyEmoji}>🙏</div>
              <div style={emptyTitle}>현재 등록된 긴급기도가 없습니다.</div>
              <div style={emptyDesc}>
                필요한 기도제목이 생기면 바로 작성해서 함께 나눌 수 있어요.
              </div>

              <div className="stack12" />

              <Button
                type="button"
                variant="secondary"
                size="lg"
                wide
                onClick={openComposer}
              >
                첫 기도제목 작성하기
              </Button>
            </div>
          </Card>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <Card>
            <div style={sectionTop}>
              <div>
                <CardTitle>긴급기도 목록</CardTitle>
                <CardDesc>
                  최근 등록된 순서대로 확인할 수 있고, 티커를 눌러 해당 항목으로 바로
                  이동할 수 있습니다.
                </CardDesc>
              </div>
              <div style={sectionBadgePeach}>Board</div>
            </div>

            <div className="stack12" />

            <div style={listWrap}>
              {items.map((item, index) => {
                const expired = isExpired(item.expiresAt);

                return (
                  <article
                    key={item.id}
                    ref={(el) => {
                      rowRefs.current[item.id] = el;
                    }}
                    style={{
                      ...itemCard,
                      ...(index === 0 ? itemCardLatest : null)
                    }}
                  >
                    <div style={itemHead}>
                      <div style={{ minWidth: 0 }}>
                        <div style={itemAuthorRow}>
                          <div style={authorBadge}>{item.authorName}</div>
                          <div style={timeText}>{formatTime(item.createdAt)}</div>
                        </div>

                        <div style={statusRow}>
                          <StatusChip
                            label={expired ? '노출 종료' : formatRemainText(item.expiresAt)}
                            tone={expired ? 'neutral' : 'peach'}
                          />
                          {index === 0 ? <StatusChip label="최신" tone="mint" /> : null}
                        </div>
                      </div>

                      {isAdmin ? (
                        <Button
                          type="button"
                          variant="danger"
                          size="md"
                          disabled={deleteLoadingId === item.id}
                          onClick={() => void handleDelete(item.id)}
                        >
                          {deleteLoadingId === item.id ? '삭제 중…' : '삭제'}
                        </Button>
                      ) : null}
                    </div>

                    <div className="stack10" />

                    <div style={contentBox}>{item.content}</div>
                  </article>
                );
              })}
            </div>
          </Card>
        ) : null}

        <div className="stack12" />

        <Card>
          <div style={sectionTop}>
            <div>
              <CardTitle>안내</CardTitle>
              <CardDesc>
                긴급기도는 교회 전체가 함께 보는 게시판이므로 한 번에 한 가지 제목을 짧고
                분명하게 작성해 주세요.
              </CardDesc>
            </div>
            <div style={sectionBadgeMint}>Guide</div>
          </div>

          <div className="stack10" />

          <div style={helperPanel}>
            <div style={helperTitle}>작성 팁</div>
            <div style={helperDesc}>
              작성자 표시는 <strong>실명</strong>으로 보이고, 게시글은 <strong>24시간</strong>{' '}
              동안 노출됩니다. 운영 정책상 삭제는 운영진만 가능합니다.
            </div>
          </div>
        </Card>

        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <UrgentPrayerComposer
            onUnauthorized={goLogin}
            onDone={async (newId) => {
              setSheetOpen(false);
              setNotice('긴급기도가 등록되었습니다.');
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

        <div className="stack12" />

        <Button type="button" variant="secondary" size="lg" wide onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}

function MetaChip({
  icon,
  label,
  tone = 'neutral'
}: {
  icon: ReactNode;
  label: string;
  tone?: 'mint' | 'peach' | 'neutral';
}) {
  const toneStyle =
    tone === 'mint' ? metaMint : tone === 'peach' ? metaPeach : metaNeutral;

  return (
    <div style={{ ...metaChip, ...toneStyle }}>
      <span style={metaIcon}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function StatusChip({
  label,
  tone
}: {
  label: string;
  tone: 'mint' | 'peach' | 'neutral';
}) {
  const toneStyle =
    tone === 'mint' ? statusMint : tone === 'peach' ? statusPeach : statusNeutral;

  return <div style={{ ...statusChip, ...toneStyle }}>{label}</div>;
}

function NoticeBox({
  tone,
  text
}: {
  tone: 'success' | 'error';
  text: string;
}) {
  return (
    <div
      style={{
        ...noticeBox,
        ...(tone === 'success' ? noticeSuccess : noticeError)
      }}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span style={noticeIconWrap}>
        {tone === 'success' ? <CheckCircleIcon /> : <WarningIcon />}
      </span>
      <span>{text}</span>
    </div>
  );
}

function SkeletonCard({
  lines = 3
}: {
  lines?: number;
}) {
  return (
    <div style={skeletonCard}>
      <div style={skeletonTitle} />
      <div style={skeletonDesc} />
      <div className="stack12" />
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          style={{
            ...skeletonLine,
            width: idx === lines - 1 ? '62%' : idx % 2 === 0 ? '100%' : '84%'
          }}
        />
      ))}
    </div>
  );
}

function SirenIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 1 0-12 0v5h12V8Z" />
      <path d="M5 13h14" />
      <path d="M10 18h4" />
      <path d="M12 2v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m19.1 4.9-1.4 1.4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M20 8v6" />
      <path d="M23 11h-6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v6c0 5-3.4 8.7-7 10-3.6-1.3-7-5-7-10V6l7-3Z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.4 2.4 4.8-5.1" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

const heroHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap'
};

const badgePeach: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  marginBottom: 10,
  background: 'rgba(235,168,141,0.16)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448',
  fontSize: 12,
  fontWeight: 800
};

const heroSide: CSSProperties = {
  width: 92,
  minWidth: 92,
  height: 92,
  borderRadius: 999,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.56)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.44)'
};

const heroCount: CSSProperties = {
  color: '#223038',
  fontSize: 28,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.03em'
};

const heroCountLabel: CSSProperties = {
  marginTop: 6,
  color: '#8f7e75',
  fontSize: 11,
  fontWeight: 800
};

const metaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8
};

const metaChip: CSSProperties = {
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '-0.01em'
};

const metaIcon: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const metaMint: CSSProperties = {
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72'
};

const metaPeach: CSSProperties = {
  background: 'rgba(235,168,141,0.16)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448'
};

const metaNeutral: CSSProperties = {
  background: 'rgba(255,255,255,0.48)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#72808a'
};

const tickerWrap: CSSProperties = {
  borderRadius: 18,
  overflow: 'hidden'
};

const heroActions: CSSProperties = {
  display: 'grid',
  gap: 8
};

const noticeBox: CSSProperties = {
  marginBottom: 12,
  minHeight: 48,
  padding: '12px 14px',
  borderRadius: 18,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.5,
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 10px 24px rgba(93,108,122,0.08)'
};

const noticeSuccess: CSSProperties = {
  background: 'rgba(114,215,199,0.12)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2b7f72'
};

const noticeError: CSSProperties = {
  background: 'rgba(235,125,125,0.10)',
  border: '1px solid rgba(235,125,125,0.22)',
  color: '#a14d4d'
};

const noticeIconWrap: CSSProperties = {
  width: 18,
  height: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  marginTop: 1
};

const skeletonStack: CSSProperties = {
  display: 'block'
};

const skeletonCard: CSSProperties = {
  borderRadius: 24,
  padding: 20,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.62))',
  border: '1px solid rgba(255,255,255,0.54)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)'
};

const skeletonTitle: CSSProperties = {
  width: '36%',
  height: 18,
  borderRadius: 999,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.78), rgba(255,255,255,0.28))',
  backgroundSize: '200% 100%',
  animation: 'qtShimmer 1.3s ease-in-out infinite'
};

const skeletonDesc: CSSProperties = {
  width: '72%',
  height: 12,
  marginTop: 10,
  borderRadius: 999,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0.68), rgba(255,255,255,0.22))',
  backgroundSize: '200% 100%',
  animation: 'qtShimmer 1.3s ease-in-out infinite'
};

const skeletonLine: CSSProperties = {
  height: 14,
  marginTop: 10,
  borderRadius: 999,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0.24), rgba(255,255,255,0.72), rgba(255,255,255,0.24))',
  backgroundSize: '200% 100%',
  animation: 'qtShimmer 1.3s ease-in-out infinite'
};

const emptyWrap: CSSProperties = {
  textAlign: 'center',
  padding: '4px 2px'
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

const sectionTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const sectionBadgeBase: CSSProperties = {
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
  flex: '0 0 auto'
};

const sectionBadgePeach: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(235,168,141,0.15)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448'
};

const sectionBadgeMint: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2b7f72'
};

const listWrap: CSSProperties = {
  display: 'grid',
  gap: 10
};

const itemCard: CSSProperties = {
  borderRadius: 20,
  padding: 14,
  background: 'rgba(255,255,255,0.46)',
  border: '1px solid rgba(255,255,255,0.54)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.40)'
};

const itemCardLatest: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,250,247,0.84), rgba(255,255,255,0.74))',
  border: '1px solid rgba(243,180,156,0.22)'
};

const itemHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const itemAuthorRow: CSSProperties = {
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

const statusRow: CSSProperties = {
  marginTop: 8,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6
};

const statusChip: CSSProperties = {
  minHeight: 26,
  padding: '0 10px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const statusMint: CSSProperties = {
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72'
};

const statusPeach: CSSProperties = {
  background: 'rgba(235,168,141,0.14)',
  border: '1px solid rgba(235,168,141,0.22)',
  color: '#a56448'
};

const statusNeutral: CSSProperties = {
  background: 'rgba(255,255,255,0.48)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#72808a'
};

const contentBox: CSSProperties = {
  padding: '12px 13px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.56)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#31414a',
  fontSize: 14,
  lineHeight: 1.65,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
};

const helperPanel: CSSProperties = {
  borderRadius: 16,
  padding: '12px 13px',
  background: 'rgba(255,255,255,0.42)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)'
};

const helperTitle: CSSProperties = {
  color: '#42515b',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 4
};

const helperDesc: CSSProperties = {
  color: '#6f7d87',
  fontSize: 12,
  lineHeight: 1.55
};

const sheetBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(56,67,76,0.22)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
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

const icon16: CSSProperties = {
  width: 16,
  height: 16,
  display: 'block'
};
