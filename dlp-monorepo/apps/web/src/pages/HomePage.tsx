import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import UrgentPrayerTicker, { type UrgentTickerItem } from '../components/UrgentPrayerTicker';
import { useAuth } from '../auth/AuthContext';
import UrgentPrayerComposer from '../components/urgent/UrgentPrayerComposer';
import TopBar from '../components/layout/TopBar';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

type HomePayload = {
  urgentTicker: UrgentTickerItem[];
  mcheyneToday: null | {
    month: number;
    day: number;
    reading1: string;
    reading2: string;
    reading3: string;
    reading4: string;
  };
  mcheynePreview?: { c?: number; v: number; t: string }[];
  mcheyneProgress?: null | {
    percent: number;
    completedReadings: number;
    totalReadings: number;
    todayCompleted: number;
  };
  homePerformance?: null | {
    attendanceDays: number;
    weekSubmittedCount: number;
    gratitudeCount: number;
    gratitudeMonth: string;
  };
};

export default function HomePage() {
  const [home, setHome] = useState<HomePayload | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mcheyneBulkSaving, setMcheyneBulkSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const nav = useNavigate();
  const loc = useLocation();
  const { me, loading: authLoading, refreshMe } = useAuth();

  const urgentItems = useMemo(() => home?.urgentTicker ?? [], [home]);
  const urgentEmpty = urgentItems.length === 0;

  const todayCompleted = home?.mcheyneProgress?.todayCompleted ?? 0;
  const totalToday = 4;
  const progressRatio = Math.max(0, Math.min(100, (todayCompleted / totalToday) * 100));
  const performance = home?.homePerformance ?? null;
  const overallPercent = home?.mcheyneProgress?.percent ?? 0;
  const attendancePercent = getAttendancePercent(performance?.attendanceDays ?? 0);
  const weeklyPercent = clampPercent(((performance?.weekSubmittedCount ?? 0) / 7) * 100);
  const gratitudePercent = performance
    ? clampPercent((performance.gratitudeCount / getGratitudeGoalDays(performance.gratitudeMonth)) * 100)
    : 0;

  const readings = useMemo(() => {
    if (!home?.mcheyneToday) return [];
    return [
      home.mcheyneToday.reading1,
      home.mcheyneToday.reading2,
      home.mcheyneToday.reading3,
      home.mcheyneToday.reading4
    ].filter(Boolean);
  }, [home]);

  function goLogin(next = `${loc.pathname}${loc.search}`) {
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function loadHome() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/home');
      if (!res.ok) throw new Error('LOAD_HOME_FAILED');
      const data = (await res.json()) as HomePayload;
      setHome(data);
    } catch {
      setHome({
        urgentTicker: [],
        mcheyneToday: null,
        mcheyneProgress: null
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHome();
  }, []);

  async function openUrgentComposer() {
    if (authLoading) return;

    if (!me) {
      goLogin();
      return;
    }

    await refreshMe();
    setSheetOpen(true);
  }

  async function goTodayReading() {
    if (authLoading) return;

    if (!me) {
      goLogin('/mcheyne-today');
      return;
    }

    await refreshMe();
    nav('/mcheyne-today');
  }

  async function completeTodayAll() {
    if (authLoading) return;

    if (!me) {
      goLogin('/mcheyne-today');
      return;
    }

    await refreshMe();

    setMcheyneBulkSaving(true);
    try {
      const res = await apiFetch('/api/mcheyne/progress/today', {
        method: 'PUT',
        body: JSON.stringify({ done1: 1, done2: 1, done3: 1, done4: 1 })
      });

      if (res.status === 401) {
        goLogin('/mcheyne-today');
        return;
      }

      if (!res.ok) throw new Error('SAVE_FAILED');

      await loadHome();
    } finally {
      setMcheyneBulkSaving(false);
    }
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="DLP" />
        <Card pad style={urgentCard}>
          <div style={urgentCompactRow}>
            <div style={urgentIconWrap} aria-hidden="true">
              <MegaphoneIcon />
            </div>

            <div style={urgentTickerSlot}>
              <UrgentPrayerTicker
                items={urgentItems}
                intervalMs={4600}
                heightPx={40}
                onItemClick={(id) => nav(`/urgent-prayers?highlight=${encodeURIComponent(id)}`)}
              />
            </div>
          </div>
        </Card>

        <Card pad style={heroCard}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={badgeMint}>TODAY READING</div>
              <CardTitle style={heroTitle}>맥체인 성경읽기</CardTitle>
              <CardDesc style={heroDesc}>오늘 읽을 본문과 진행 상태를 한 번에 확인할 수 있어요.</CardDesc>

              {loading ? (
                <div style={helperMuted}>불러오는 중…</div>
              ) : readings.length > 0 ? (
                <ul style={readingList}>
                  {readings.map((reading, idx) => (
                    <li key={`${reading}-${idx}`} style={readingItem}>
                      <span style={bulletIconWrap}>
                        <BookIcon />
                      </span>
                      <span>{reading}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={emptyNote}>오늘 본문을 아직 불러오지 못했습니다.</div>
              )}
            </div>

            <div style={progressBlock}>
              <div
                style={{
                  ...progressRing,
                  background: `conic-gradient(#72d7c7 ${progressRatio}%, rgba(114,215,199,0.18) 0%)`
                }}
              >
                <div style={progressRingInner}>
                  <div style={progressMain}>{todayCompleted}/4</div>
                  <div style={progressLabel}>오늘 진행</div>
                </div>
              </div>

              <div style={progressSub}>
                {home?.mcheyneProgress
                  ? `전체 ${home.mcheyneProgress.completedReadings}/${home.mcheyneProgress.totalReadings}`
                  : '로그인 후 진행률 표시'}
              </div>
            </div>
          </div>

          <div style={heroActions}>
            <Button type="button" variant="primary" size="lg" wide onClick={goTodayReading}>
              오늘 본문 읽기
            </Button>
            <Button type="button" variant="secondary" size="lg" wide onClick={() => nav('/mcheyne-calendar')}>
              캘린더 보기
            </Button>
          </div>

          {me ? (
            <div style={{ marginTop: 10 }}>
              <Button
                type="button"
                variant="ghost"
                size="md"
                wide
                onClick={completeTodayAll}
                disabled={mcheyneBulkSaving}
              >
                {mcheyneBulkSaving ? '저장 중…' : '오늘 4개 원클릭 완료'}
              </Button>
            </div>
          ) : null}
        </Card>

        <Card pad style={statsCard}>
          <div style={statsHead}>
            <div>
              <div style={sectionEyebrow}>PERFORMANCE</div>
              <div style={sectionHeadingSmall}>성과 통계</div>
              <div style={statsDesc}>퍼센트만큼 채워지는 버튼형 게이지로 이번 흐름을 바로 확인하고, 눌러서 상세 화면으로 이동할 수 있어요.</div>
            </div>

            <button type="button" style={statsLinkBtn} onClick={() => (me ? nav('/me') : goLogin('/me'))}>
              자세히
            </button>
          </div>

          {me && performance ? (
            <>
              <div style={statsGrid}>
                <GaugeMetricButton
                  label="누적 출석"
                  value={`${performance.attendanceDays}일`}
                  percent={attendancePercent}
                  hint="365일 목표 기준"
                  tone="mint"
                  onClick={() => nav('/me')}
                />
                <GaugeMetricButton
                  label="이번 주 DLP"
                  value={`${performance.weekSubmittedCount}/7`}
                  percent={weeklyPercent}
                  hint="주간 제출 리듬"
                  tone="peach"
                  onClick={() => nav('/me')}
                />
                <GaugeMetricButton
                  label="이번 달 감사"
                  value={`${performance.gratitudeCount}개`}
                  percent={gratitudePercent}
                  hint={`${formatMonthLabel(performance.gratitudeMonth)} 기록률`}
                  tone="mint"
                  onClick={() => nav('/gratitude')}
                />
                <GaugeMetricButton
                  label="말씀 읽기"
                  value={`${overallPercent}%`}
                  percent={overallPercent}
                  hint={`오늘 ${todayCompleted}/4 완료`}
                  tone="peach"
                  onClick={() => nav('/mcheyne-calendar')}
                />
              </div>

              <div style={statsFootNote}>
                감사일기 집계월 {formatMonthLabel(performance.gratitudeMonth)} · 버튼을 누르면 각 페이지로 바로 이동합니다.
              </div>
            </>
          ) : (
            <div style={statsEmptyBox}>
로그인하면 누적 출석, 이번 주 DLP, 이번 달 감사 기록과 말씀읽기 성과를 홈에서 한눈에 볼 수 있어요.
            </div>
          )}
        </Card>

        <section style={sectionWrap}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>QUICK MENU</div>
              <div style={sectionHeading}>자주 쓰는 기능</div>
            </div>
          </div>

          <div style={quickGrid}>
            <QuickCard
              icon={<QtIcon />}
              tone="mint"
              title="매일성경 QT"
              desc="오늘 QT로 이동"
              onClick={() => nav('/qt')}
            />
            <QuickCard
              icon={<GratitudeIcon />}
              tone="peach"
              title="감사일기"
              desc="한 줄 감사 기록"
              onClick={() => nav('/gratitude')}
            />
            <QuickCard
              icon={<ChecklistIcon />}
              tone="peach"
              title="DLP 체크리스트"
              desc="오늘 항목 점검"
              onClick={() => nav('/dlp')}
            />
            <QuickCard
              icon={<SearchIcon />}
              tone="mint"
              title="성경 검색"
              desc="단어/구절로 찾기"
              onClick={() => nav('/bible-search')}
            />
          </div>
        </section>

        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <WideActionCard
            icon={<ChurchIcon />}
            tone="peach"
            title="교회 채널"
            desc="공지 · 기도 · 댓글을 한곳에서"
            actionLabel="채널 보기"
            onClick={() => nav('/channels')}
          />

          <WideActionCard
            icon={<BibleGameIcon />}
            tone="mint"
            title="바이블 게임"
            desc="랜덤 성경 구절 빈칸 맞히기 · 반응속도 랭킹전"
            actionLabel="입장하기"
            onClick={() => (me ? nav('/bible-game') : goLogin('/bible-game'))}
          />
        </div>

        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <UrgentPrayerComposer
            onUnauthorized={() => goLogin()}
            onDone={async (newId) => {
              setSheetOpen(false);
              await loadHome();
              nav(`/urgent-prayers?highlight=${encodeURIComponent(newId)}`);
            }}
          />
        </BottomSheet>
      </div>
    </div>
  );
}

function QuickCard({
  icon,
  title,
  desc,
  onClick,
  tone
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  tone: 'mint' | 'peach';
}) {
  const iconBg = tone === 'mint' ? 'rgba(114,215,199,0.14)' : 'rgba(243,180,156,0.16)';
  const iconColor = tone === 'mint' ? '#4dbdaa' : '#d88c73';

  return (
    <button type="button" onClick={onClick} style={quickBtn}>
      <Card pad={false} style={quickCard}>
        <div style={quickInner}>
          <div
            style={{
              ...quickIconWrap,
              background: iconBg,
              color: iconColor
            }}
          >
            {icon}
          </div>

          <div style={quickTextWrap}>
            <div style={quickTitle}>{title}</div>
            <div style={quickDesc}>{desc}</div>
          </div>

          <div style={quickArrow}>›</div>
        </div>
      </Card>
    </button>
  );
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-');
  if (!year || !month) return value;
  return `${year}.${month}`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAttendancePercent(days: number) {
  return clampPercent((days / 365) * 100);
}

function getGratitudeGoalDays(monthLabel: string) {
  const [year, month] = monthLabel.split('-').map(Number);
  if (!year || !month) return 31;

  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const isCurrentMonth = now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month;

  if (isCurrentMonth) {
    return now.getUTCDate();
  }

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function GaugeMetricButton({
  label,
  value,
  percent,
  hint,
  tone,
  onClick
}: {
  label: string;
  value: string;
  percent: number;
  hint: string;
  tone: 'mint' | 'peach';
  onClick: () => void;
}) {
  const fill = tone === 'mint' ? 'linear-gradient(90deg, rgba(114,215,199,0.28), rgba(114,215,199,0.14))' : 'linear-gradient(90deg, rgba(243,180,156,0.28), rgba(243,180,156,0.14))';
  const border = tone === 'mint' ? 'rgba(114,215,199,0.26)' : 'rgba(243,180,156,0.26)';
  const badgeBg = tone === 'mint' ? 'rgba(114,215,199,0.18)' : 'rgba(243,180,156,0.18)';
  const badgeColor = tone === 'mint' ? '#2f7f73' : '#9d6550';
  const valueColor = tone === 'mint' ? '#245f56' : '#8d5a47';

  return (
    <button type="button" onClick={onClick} style={{ ...metricButton, border: `1px solid ${border}` }}>
      <div style={metricFillTrack}>
        <div style={{ ...metricFillBar, width: `${clampPercent(percent)}%`, background: fill }} />
      </div>
      <div style={metricContent}>
        <div style={metricTopRow}>
          <div style={metricLabel}>{label}</div>
          <div style={{ ...metricPercentBadge, background: badgeBg, color: badgeColor }}>{clampPercent(percent)}%</div>
        </div>
        <div style={{ ...metricValue, color: valueColor }}>{value}</div>
        <div style={metricHint}>{hint}</div>
      </div>
    </button>
  );
}

function WideActionCard({
  icon,
  title,
  desc,
  actionLabel,
  onClick,
  tone
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  actionLabel: string;
  onClick: () => void;
  tone: 'mint' | 'peach';
}) {
  const iconBg = tone === 'mint' ? 'rgba(114,215,199,0.14)' : 'rgba(243,180,156,0.16)';
  const iconColor = tone === 'mint' ? '#4dbdaa' : '#d88c73';

  return (
    <button type="button" onClick={onClick} style={wideBtn}>
      <Card pad style={wideCard}>
        <div style={wideInner}>
          <div style={wideLeft}>
            <div
              style={{
                ...wideIconWrap,
                background: iconBg,
                color: iconColor
              }}
            >
              {icon}
            </div>

            <div>
              <div style={wideTitle}>{title}</div>
              <div style={wideDesc}>{desc}</div>
            </div>
          </div>

          <div style={wideAction}>{actionLabel}</div>
        </div>
      </Card>
    </button>
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

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h12v16H7a2.5 2.5 0 0 0-2.5 2.5V5.5Z" />
      <path d="M19 19H7a2.5 2.5 0 0 0-2.5 2.5" />
      <path d="M9 7h6" />
    </svg>
  );
}

function QtIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19.5V6.3A2.3 2.3 0 0 1 7.3 4H18v15.5H7.5A2.5 2.5 0 0 0 5 22V19.5Z" />
      <path d="M8.5 7.5h6" />
      <path d="M8.5 11h6" />
      <path d="M19.3 8a3.8 3.8 0 1 0-7.6 0c0 2.8 3.8 5.9 3.8 5.9S19.3 10.8 19.3 8Z" opacity="0.9" />
    </svg>
  );
}

function GratitudeIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v5h5" />
      <path d="M12 16.8s-3.4-1.9-3.4-4.4a2.1 2.1 0 0 1 3.9-1.1 2.1 2.1 0 0 1 3.9 1.1c0 2.5-3.4 4.4-3.4 4.4Z" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M9 3.5h6" />
      <path d="M8.2 9.2l1.5 1.5 2.7-3" />
      <path d="M8.2 14.2l1.5 1.5 2.7-3" />
      <path d="M14.7 9.5h2" />
      <path d="M14.7 14.5h2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="5.8" />
      <path d="m15 15 4.5 4.5" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5V10a1.5 1.5 0 0 1 1.5-1.5H8l7-3v11l-7-3H5.5A1.5 1.5 0 0 1 4 12.5Z" />
      <path d="M15 8.5a4 4 0 0 1 0 7" />
      <path d="M17 6a7 7 0 0 1 0 12" />
    </svg>
  );
}

function ChurchIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4" />
      <path d="M10 5h4" />
      <path d="M6 21V11l6-4 6 4v10" />
      <path d="M4 21h16" />
      <path d="M9.5 21v-4a2.5 2.5 0 0 1 5 0v4" />
    </svg>
  );
}

function BibleGameIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 5.5A2.5 2.5 0 0 1 9.5 3H19v14H9.5A2.5 2.5 0 0 0 7 19.5V5.5Z" />
      <path d="M7 19.5A2.5 2.5 0 0 1 9.5 17H19" />
      <path d="M12 8.2h2.6" />
      <path d="M13.3 6.9v2.6" />
      <circle cx="14.8" cy="12.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="11.4" cy="12.8" r="0.9" fill="currentColor" stroke="none" />
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

const urgentCard: CSSProperties = {
  marginBottom: 10,
  padding: 0,
  borderRadius: 16,
  background: 'linear-gradient(180deg, rgba(255,248,245,0.94), rgba(255,242,236,0.84))',
  border: '1px solid rgba(241,195,170,0.34)',
  boxShadow: '0 6px 16px rgba(204,151,126,0.10)',
  overflow: 'hidden'
};

const urgentCompactRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px'
};

const urgentIconWrap: CSSProperties = {
  width: 30,
  height: 30,
  flex: '0 0 30px',
  borderRadius: 10,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(243,180,156,0.18)',
  border: '1px solid rgba(243,180,156,0.22)',
  color: '#a05f48'
};

const urgentTickerSlot: CSSProperties = {
  minWidth: 0,
  flex: 1
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

const heroTitle: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  marginTop: 6,
  marginBottom: 14,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const helperMuted: CSSProperties = {
  color: '#7a8790',
  fontSize: 14,
  lineHeight: 1.5
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

const readingList: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gap: 10
};

const readingItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: '#33424b',
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.4
};

const bulletIconWrap: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(114,215,199,0.12)',
  color: '#4dbdaa',
  flex: '0 0 auto'
};

const progressBlock: CSSProperties = {
  width: 106,
  flex: '0 0 106px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  paddingTop: 4
};

const progressRing: CSSProperties = {
  width: 92,
  height: 92,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  padding: 7
};

const progressRingInner: CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.90)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)'
};

const progressMain: CSSProperties = {
  color: '#24313a',
  fontSize: 26,
  fontWeight: 800,
  lineHeight: 1
};

const progressLabel: CSSProperties = {
  marginTop: 4,
  color: '#8c979e',
  fontSize: 11,
  fontWeight: 700
};

const progressSub: CSSProperties = {
  color: '#66737b',
  fontSize: 11,
  lineHeight: 1.4,
  textAlign: 'center'
};

const heroActions: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 18
};

const statsCard: CSSProperties = {
  marginTop: 14,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const statsHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const sectionHeadingSmall: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const statsDesc: CSSProperties = {
  marginTop: 6,
  color: '#6b7780',
  fontSize: 13,
  lineHeight: 1.45
};

const statsLinkBtn: CSSProperties = {
  border: 0,
  background: 'rgba(114,215,199,0.14)',
  color: '#2f7f73',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const statsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  marginTop: 14
};

const metricButton: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  minWidth: 0,
  padding: 0,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.74)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.52)',
  textAlign: 'left',
  cursor: 'pointer'
};

const metricFillTrack: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden'
};

const metricFillBar: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 18,
  transition: 'width 0.25s ease'
};

const metricContent: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '14px 12px'
};

const metricTopRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
};

const metricLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#5e6c74'
};

const metricPercentBadge: CSSProperties = {
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const metricValue: CSSProperties = {
  marginTop: 10,
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: 1.1
};

const metricHint: CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  fontWeight: 700,
  color: '#748189',
  lineHeight: 1.4
};

const statsFootNote: CSSProperties = {
  marginTop: 12,
  color: '#718089',
  fontSize: 12,
  fontWeight: 700
};

const statsEmptyBox: CSSProperties = {
  marginTop: 14,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(247,250,251,0.72)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#6d7a83',
  fontSize: 13,
  lineHeight: 1.55
};

const sectionWrap: CSSProperties = {
  marginTop: 14
};

const sectionHeader: CSSProperties = {
  marginBottom: 10,
  padding: '2px 2px 0'
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const sectionHeading: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const quickGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12
};

const quickBtn: CSSProperties = {
  padding: 0,
  border: 0,
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer'
};

const quickCard: CSSProperties = {
  minHeight: 102,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const quickInner: CSSProperties = {
  minHeight: 102,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 16
};

const quickIconWrap: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto'
};

const quickTextWrap: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const quickTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1.35,
  letterSpacing: '-0.02em'
};

const quickDesc: CSSProperties = {
  marginTop: 4,
  color: '#69767e',
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.4
};

const quickArrow: CSSProperties = {
  color: '#96a1a8',
  fontSize: 20,
  fontWeight: 700,
  flex: '0 0 auto'
};

const wideBtn: CSSProperties = {
  width: '100%',
  padding: 0,
  border: 0,
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer'
};

const wideCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const wideInner: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12
};

const wideLeft: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0
};

const wideIconWrap: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto'
};

const wideTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 16,
  fontWeight: 800,
  lineHeight: 1.35,
  letterSpacing: '-0.02em'
};

const wideDesc: CSSProperties = {
  marginTop: 4,
  color: '#69767e',
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.4
};

const wideAction: CSSProperties = {
  color: '#8d7568',
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: 'nowrap'
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

const icon18: CSSProperties = {
  width: 18,
  height: 18
};

const icon22: CSSProperties = {
  width: 22,
  height: 22
};
