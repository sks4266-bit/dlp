import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import TopBar from '../components/layout/TopBar';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

type AdminStats = {
  urgentPrayers: {
    total: number;
    active: number;
    deleted: number;
    expired: number;
    createdLast24h: number;
  };
};

type AdminUrgent = {
  id: string;
  authorUserId: string;
  authorName: string;
  content: string;
  createdAt: number;
  expiresAt: number;
  deletedAt: number | null;
  deletedByAdminId: string | null;
  deletedByAdminName: string | null;
  deletedReason: string | null;
};

async function safeReadJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function readErrorMessage(res: Response, fallback: string) {
  const json = await safeReadJson(res);

  if (json && typeof json === 'object') {
    const message =
      typeof (json as { message?: unknown }).message === 'string'
        ? (json as { message: string }).message
        : typeof (json as { error?: unknown }).error === 'string'
          ? (json as { error: string }).error
          : null;

    if (message) return message;
  }

  return fallback;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(
    d.getHours()
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isExpired(ts: number) {
  return ts < Date.now();
}

export default function AdminPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { me } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [rows, setRows] = useState<AdminUrgent[]>([]);
  const [includeExpired, setIncludeExpired] = useState(true);
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const title = useMemo(() => 'ADMIN 대시보드', []);
  const activeCount = stats?.urgentPrayers.active ?? 0;
  const deletedCount = stats?.urgentPrayers.deleted ?? 0;
  const expiredCount = stats?.urgentPrayers.expired ?? 0;

  function goLogin() {
    const next = `${loc.pathname}${loc.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function loadAll() {
    setLoading(true);
    setErr(null);
    setNotice(null);

    try {
      const statsRes = await apiFetch('/api/admin/stats');

      if (statsRes.status === 401) {
        goLogin();
        return;
      }
      if (statsRes.status === 403) {
        nav('/');
        return;
      }
      if (!statsRes.ok) {
        throw new Error(await readErrorMessage(statsRes, '관리자 통계를 불러오지 못했습니다.'));
      }

      const statsJson = await safeReadJson(statsRes);
      setStats((statsJson as AdminStats | null) ?? null);

      const query = new URLSearchParams({
        includeExpired: includeExpired ? '1' : '0',
        includeDeleted: includeDeleted ? '1' : '0'
      }).toString();

      const rowsRes = await apiFetch(`/api/admin/urgent-prayers?${query}`);

      if (rowsRes.status === 401) {
        goLogin();
        return;
      }
      if (rowsRes.status === 403) {
        nav('/');
        return;
      }
      if (!rowsRes.ok) {
        throw new Error(await readErrorMessage(rowsRes, '긴급기도 목록을 불러오지 못했습니다.'));
      }

      const rowsJson = await safeReadJson(rowsRes);
      setRows(Array.isArray(rowsJson) ? (rowsJson as AdminUrgent[]) : []);
    } catch (e) {
      setStats(null);
      setRows([]);
      setErr(e instanceof Error ? e.message : '관리자 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!me) return;
    if (!me.isAdmin) {
      nav('/');
      return;
    }

    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.isAdmin, includeExpired, includeDeleted]);

  async function handleDelete(row: AdminUrgent) {
    const ok = window.confirm('이 긴급기도를 삭제할까요? (운영진 전용)');
    if (!ok) return;

    const input = window.prompt('삭제 사유를 입력하세요. (필수, 최대 120자)');
    const reason = input?.trim();

    if (!reason) {
      setErr('삭제 사유를 입력해야 합니다.');
      return;
    }

    setDeletingId(row.id);
    setErr(null);
    setNotice(null);

    try {
      const res = await apiFetch(`/api/admin/urgent-prayers/${row.id}/delete`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.slice(0, 120) })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }
      if (res.status === 403) {
        nav('/');
        return;
      }
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '긴급기도 삭제에 실패했습니다.'));
      }

      setNotice('긴급기도가 삭제되었습니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '긴급기도 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  if (!me) return null;
  if (!me.isAdmin) return null;

  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar
          title={title}
          backTo="/"
          right={
            <Button
              type="button"
              variant="ghost"
              onClick={() => void loadAll()}
              disabled={loading}
            >
              {loading ? '불러오는 중…' : '새로고침'}
            </Button>
          }
        />

        <Card className="glassHeroCard">
          <div style={heroHead}>
            <div style={{ minWidth: 0 }}>
              <div style={badgePeach}>
                <ShieldIcon />
                ADMIN ONLY
              </div>

              <CardTitle>긴급기도 운영 대시보드</CardTitle>
              <CardDesc>
                통계 확인, 노출 필터링, 삭제 이력 점검까지 한 화면에서 차분하게 관리합니다.
              </CardDesc>
            </div>

            <div style={heroActionRow}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => nav('/urgent-prayers')}
              >
                사용자 화면 보기
              </Button>
            </div>
          </div>

          <div className="stack12" />

          <div style={metaRow}>
            <MetaChip icon={<PulseIcon />} label={`활성 ${activeCount}`} tone="mint" />
            <MetaChip icon={<TrashIcon />} label={`삭제 ${deletedCount}`} tone="peach" />
            <MetaChip icon={<ClockIcon />} label={`만료 ${expiredCount}`} tone="sky" />
            <MetaChip
              icon={<ListIcon />}
              label={`목록 ${rows.length}건`}
              tone="neutral"
            />
          </div>
        </Card>

        <div className="stack12" />

        {err ? <NoticeBox tone="error" text={err} /> : null}
        {notice ? <NoticeBox tone="success" text={notice} /> : null}

        {loading ? (
          <>
            <SkeletonCard lines={4} />
            <div className="stack12" />
            <SkeletonCard lines={3} />
            <div className="stack12" />
            <SkeletonCard lines={5} tall />
          </>
        ) : (
          <>
            <Card>
              <div style={sectionTop}>
                <div>
                  <CardTitle>긴급기도 통계</CardTitle>
                  <CardDesc>
                    현재 집계 기준으로 전체/활성/삭제/만료/최근 생성 건수를 확인합니다.
                  </CardDesc>
                </div>
                <div style={sectionBadgeMint}>Stats</div>
              </div>

              <div className="stack12" />

              <div style={statGrid}>
                <StatCard label="전체" value={stats?.urgentPrayers.total ?? '-'} tone="neutral" />
                <StatCard label="활성 (24h)" value={stats?.urgentPrayers.active ?? '-'} tone="mint" />
                <StatCard label="삭제" value={stats?.urgentPrayers.deleted ?? '-'} tone="peach" />
                <StatCard label="만료" value={stats?.urgentPrayers.expired ?? '-'} tone="sky" />
                <StatCard
                  label="최근 24h 생성"
                  value={stats?.urgentPrayers.createdLast24h ?? '-'}
                  tone="mint"
                  wide
                />
              </div>
            </Card>

            <div className="stack12" />

            <Card>
              <div style={sectionTop}>
                <div>
                  <CardTitle>긴급기도 전체 관리</CardTitle>
                  <CardDesc>
                    만료/삭제 포함 여부를 조정해서 운영 시점에 필요한 목록만 확인하세요.
                  </CardDesc>
                </div>
                <div style={sectionBadgeSky}>Filters</div>
              </div>

              <div className="stack12" />

              <div style={filterWrap}>
                <label style={togglePill}>
                  <input
                    type="checkbox"
                    checked={includeExpired}
                    onChange={(e) => setIncludeExpired(e.target.checked)}
                    style={checkbox}
                  />
                  만료 포함
                </label>

                <label style={togglePill}>
                  <input
                    type="checkbox"
                    checked={includeDeleted}
                    onChange={(e) => setIncludeDeleted(e.target.checked)}
                    style={checkbox}
                  />
                  삭제 포함
                </label>
              </div>

              <div className="stack10" />

              <div style={helperPanel}>
                <div style={helperTitle}>운영 메모</div>
                <div style={helperDesc}>
                  삭제는 즉시 반영되므로, 실제 운영에서는 사유를 분명하게 남기는 편이 좋습니다.
                </div>
              </div>
            </Card>

            <div className="stack12" />

            <Card>
              <div style={sectionTop}>
                <div>
                  <CardTitle>긴급기도 목록</CardTitle>
                  <CardDesc>
                    작성자, 생성/만료 시각, 상태, 삭제 이력을 한 번에 확인할 수 있습니다.
                  </CardDesc>
                </div>
                <div style={sectionBadgePeach}>Moderation</div>
              </div>

              <div className="stack12" />

              {rows.length === 0 ? (
                <div style={emptyState}>
                  <div style={emptyTitle}>표시할 긴급기도가 없습니다.</div>
                  <div style={emptyDesc}>
                    현재 필터 조건에서 조회되는 항목이 없어요.
                  </div>
                </div>
              ) : (
                <div style={listWrap}>
                  {rows.map((row) => {
                    const expired = isExpired(row.expiresAt);
                    const deleted = Boolean(row.deletedAt);

                    const statusLabel = deleted
                      ? '삭제됨'
                      : expired
                        ? '만료됨'
                        : '활성';

                    const statusTone = deleted
                      ? rowStatusDeleted
                      : expired
                        ? rowStatusExpired
                        : rowStatusActive;

                    return (
                      <article key={row.id} style={rowCard}>
                        <div style={rowHead}>
                          <div style={{ minWidth: 0 }}>
                            <div style={rowAuthor}>{row.authorName}</div>
                            <div style={rowMeta}>
                              작성 {formatTime(row.createdAt)} · 만료 {formatTime(row.expiresAt)}
                            </div>
                          </div>

                          <div style={rowActionArea}>
                            <div style={{ ...rowStatus, ...statusTone }}>{statusLabel}</div>

                            {!deleted ? (
                              <Button
                                type="button"
                                variant="danger"
                                size="md"
                                disabled={deletingId === row.id}
                                onClick={() => void handleDelete(row)}
                              >
                                {deletingId === row.id ? '삭제 중…' : '삭제'}
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <div className="stack10" />

                        <div style={contentBox}>{row.content}</div>

                        {deleted ? (
                          <>
                            <div className="stack10" />
                            <div style={logBox}>
                              삭제 로그: {row.deletedByAdminName ?? row.deletedByAdminId ?? '-'} ·{' '}
                              {row.deletedAt ? formatTime(row.deletedAt) : '-'}
                              {row.deletedReason ? ` · 사유: ${row.deletedReason}` : ''}
                            </div>
                          </>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  wide = false
}: {
  label: string;
  value: string | number;
  tone: 'mint' | 'sky' | 'peach' | 'neutral';
  wide?: boolean;
}) {
  const toneStyle =
    tone === 'mint'
      ? statMint
      : tone === 'sky'
        ? statSky
        : tone === 'peach'
          ? statPeach
          : statNeutral;

  return (
    <div style={{ ...statCard, ...toneStyle, ...(wide ? statCardWide : null) }}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
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
  tone?: 'mint' | 'sky' | 'peach' | 'neutral';
}) {
  const toneStyle =
    tone === 'mint'
      ? metaMint
      : tone === 'sky'
        ? metaSky
        : tone === 'peach'
          ? metaPeach
          : metaNeutral;

  return (
    <div style={{ ...metaChip, ...toneStyle }}>
      <span style={metaIcon}>{icon}</span>
      <span>{label}</span>
    </div>
  );
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
  lines = 3,
  tall = false
}: {
  lines?: number;
  tall?: boolean;
}) {
  return (
    <div style={{ ...skeletonCard, minHeight: tall ? 210 : 132 }}>
      <div style={skeletonTitle} />
      <div style={skeletonDesc} />
      <div className="stack12" />
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          style={{
            ...skeletonLine,
            width:
              idx === lines - 1
                ? '62%'
                : idx % 2 === 0
                  ? '100%'
                  : '84%'
          }}
        />
      ))}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v6c0 5-3.4 8.7-7 10-3.6-1.3-7-5-7-10V6l7-3Z" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 6-4-12-3 6H2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
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

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
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

const heroActionRow: CSSProperties = {
  display: 'flex',
  gap: 8,
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

const metaSky: CSSProperties = {
  background: 'rgba(144,193,255,0.14)',
  border: '1px solid rgba(144,193,255,0.22)',
  color: '#5276a7'
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

const sectionBadgeMint: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2b7f72'
};

const sectionBadgeSky: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(144,193,255,0.14)',
  border: '1px solid rgba(144,193,255,0.24)',
  color: '#5276a7'
};

const sectionBadgePeach: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(235,168,141,0.15)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448'
};

const statGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10
};

const statCard: CSSProperties = {
  minHeight: 96,
  borderRadius: 18,
  padding: '14px 14px 13px',
  border: '1px solid rgba(255,255,255,0.54)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.40)'
};

const statCardWide: CSSProperties = {
  gridColumn: '1 / -1'
};

const statMint: CSSProperties = {
  background: 'rgba(114,215,199,0.12)'
};

const statSky: CSSProperties = {
  background: 'rgba(144,193,255,0.12)'
};

const statPeach: CSSProperties = {
  background: 'rgba(235,168,141,0.12)'
};

const statNeutral: CSSProperties = {
  background: 'rgba(255,255,255,0.46)'
};

const statLabel: CSSProperties = {
  color: '#72808a',
  fontSize: 12,
  fontWeight: 800
};

const statValue: CSSProperties = {
  marginTop: 8,
  color: '#223038',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.03em'
};

const filterWrap: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap'
};

const togglePill: CSSProperties = {
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  background: 'rgba(255,255,255,0.48)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#42515b',
  fontSize: 13,
  fontWeight: 800,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)'
};

const checkbox: CSSProperties = {
  width: 16,
  height: 16
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

const listWrap: CSSProperties = {
  display: 'grid',
  gap: 10
};

const rowCard: CSSProperties = {
  borderRadius: 20,
  padding: 14,
  background: 'rgba(255,255,255,0.46)',
  border: '1px solid rgba(255,255,255,0.54)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.40)'
};

const rowHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const rowAuthor: CSSProperties = {
  color: '#223038',
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: '-0.02em'
};

const rowMeta: CSSProperties = {
  marginTop: 4,
  color: '#72808a',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.45
};

const rowActionArea: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end'
};

const rowStatus: CSSProperties = {
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: 'nowrap'
};

const rowStatusActive: CSSProperties = {
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2b7f72'
};

const rowStatusExpired: CSSProperties = {
  background: 'rgba(144,193,255,0.14)',
  border: '1px solid rgba(144,193,255,0.24)',
  color: '#5276a7'
};

const rowStatusDeleted: CSSProperties = {
  background: 'rgba(235,125,125,0.12)',
  border: '1px solid rgba(235,125,125,0.24)',
  color: '#a14d4d'
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

const logBox: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  background: 'rgba(255,243,240,0.82)',
  border: '1px solid rgba(235,138,127,0.20)',
  color: '#8f5d5d',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5
};

const emptyState: CSSProperties = {
  borderRadius: 18,
  padding: '20px 16px',
  background: 'rgba(255,255,255,0.42)',
  border: '1px solid rgba(255,255,255,0.52)',
  textAlign: 'center'
};

const emptyTitle: CSSProperties = {
  color: '#31414a',
  fontSize: 14,
  fontWeight: 900
};

const emptyDesc: CSSProperties = {
  marginTop: 6,
  color: '#72808a',
  fontSize: 12,
  lineHeight: 1.5
};

const icon16: CSSProperties = {
  width: 16,
  height: 16,
  display: 'block'
};
