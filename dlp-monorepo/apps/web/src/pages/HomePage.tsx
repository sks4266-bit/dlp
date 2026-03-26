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

const HOME_AD_IMAGE_URL = '/ads/albi-banner.png';
const HOME_AD_TARGET_URL = 'https://albi.kr';

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

          <PromoBannerCard />
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

function PromoBannerCard() {
  return (
    <a href={HOME_AD_TARGET_URL} target="_blank" rel="noreferrer" style={promoLink}>
      <Card pad={false} style={promoCard}>
        <div style={promoBadgeRow}>
          <span style={promoBadge}>AD</span>
          <span style={promoBadgeText}>추천 배너</span>
          <span style={promoCta}>바로가기 ↗</span>
        </div>
        <div style={promoImageFrame}>
          <img src={HOME_AD_IMAGE_URL} alt="알비 ALBI 올인원 취업준비 플랫폼 광고 배너" style={promoImage} loading="lazy" />
        </div>
      </Card>
    </a>
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
    <svg viewBox="0 0 48 48" style={icon18} aria-hidden="true">
      <path d="M7 33.5c0-3 2.6-5.5 5.8-5.5H24v11H12.6c-3.1 0-5.6 2.5-5.6 5.5V33.5Z" fill="#f1ead6" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M41 33.5c0-3-2.6-5.5-5.8-5.5H24v11h11.4c3.1 0 5.6 2.5 5.6 5.5V33.5Z" fill="#ffe4bc" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 14v24" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.5 15.5c2.7-1.6 6-2.5 9.5-2.5 1.6 0 2.9.2 4 .6V28c-1.3-.5-2.6-.8-4-.8-3.6 0-6.9.8-9.5 2.4V15.5Z" fill="#f7f2e3" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M37.5 15.5c-2.7-1.6-6-2.5-9.5-2.5-1.6 0-2.9.2-4 .6V28c1.3-.5 2.6-.8 4-.8 3.6 0 6.9.8 9.5 2.4V15.5Z" fill="#ffd2a7" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 17.5v8" stroke="#2ea89b" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M14.3 21.5h7.4" stroke="#2ea89b" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M30.5 15.5v15.5" stroke="#df8f3f" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M30.5 31l2.6-2.4 2.6 2.4" fill="#df8f3f" stroke="#df8f3f" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QtIcon() {
  return (
    <svg viewBox="0 0 48 48" style={icon22} aria-hidden="true">
      <path d="M7 33c0-3.2 2.8-5.8 6.1-5.8H24v12H12.9C9.7 39.2 7 41.8 7 45V33Z" fill="#f1ead6" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M41 33c0-3.2-2.8-5.8-6.1-5.8H24v12h11.1c3.2 0 5.9 2.6 5.9 5.8V33Z" fill="#ffddb6" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 13.5v25.7" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 15.5c2.8-1.7 6.1-2.6 9.7-2.6 1.2 0 2.3.1 3.3.4v14.2c-1-.3-2.1-.5-3.3-.5-3.7 0-7 .9-9.7 2.7V15.5Z" fill="#f7f1df" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M37 15.5c-2.8-1.7-6.1-2.6-9.7-2.6-1.2 0-2.3.1-3.3.4v14.2c1-.3 2.1-.5 3.3-.5 3.7 0 7 .9 9.7 2.7V15.5Z" fill="#ffc99e" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 18v7.2" stroke="#2ea89b" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M14.5 21.6h7" stroke="#2ea89b" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M31.5 14.8v16.8" stroke="#e19744" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M31.5 31.6l2.7-2.4 2.7 2.4" fill="#e19744" stroke="#e19744" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9.8l-2.5-2.6" stroke="#3f3a34" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M40 9.8l2.5-2.6" stroke="#3f3a34" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GratitudeIcon() {
  return (
    <svg viewBox="0 0 48 48" style={icon22} aria-hidden="true">
      <path d="M8 31.8c0-3 2.4-5.4 5.5-5.4H24v11.5H13.6c-3 0-5.6 2.4-5.6 5.4V31.8Z" fill="#f0ede4" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 31.8c0-3-2.4-5.4-5.5-5.4H24v11.5h10.4c3 0 5.6 2.4 5.6 5.4V31.8Z" fill="#f6f4ea" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 14v24" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.8 16c2.5-1.6 5.8-2.5 9.2-2.5 1.5 0 2.8.1 4 .5v13.6c-1.2-.4-2.5-.7-4-.7-3.5 0-6.7.9-9.2 2.4V16Z" fill="#faf6ee" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M37.2 16c-2.5-1.6-5.8-2.5-9.2-2.5-1.5 0-2.8.1-4 .5v13.6c1.2-.4 2.5-.7 4-.7 3.5 0 6.7.9 9.2 2.4V16Z" fill="#f3f0e7" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 13.2v17.6" stroke="#ef8fa0" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M20.6 17.3h6.8" stroke="#ef8fa0" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M24 8.5c1.4-2.1 4.8-2.1 6 0 .9 1.6.1 3.6-1.4 4.8L24 16.7l-4.6-3.4c-1.5-1.1-2.3-3.2-1.4-4.8 1.2-2.1 4.6-2.1 6 0Z" fill="#f46f6f" stroke="#3f3a34" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 6.5l-1.8-2" stroke="#3f3a34" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M31.5 6.5l1.8-2" stroke="#3f3a34" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 48 48" style={icon22} aria-hidden="true">
      <rect x="10" y="8" width="28" height="32" rx="6" fill="#fff2e2" stroke="#3f3a34" strokeWidth="2" />
      <path d="M18 8.5h12" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" />
      <path d="M16.5 18.5l2.5 2.7 4.6-5.4" stroke="#e19744" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 18.8h6.5" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" />
      <path d="M16.5 27.2l2.5 2.7 4.6-5.4" stroke="#2ea89b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 27.5h6.5" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 12.2c2-1.1 5-1.7 8-1.7 3 0 6 .6 8 1.7" stroke="#d9a36f" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 48 48" style={icon22} aria-hidden="true">
      <path d="M8.5 30.5c0-2.8 2.3-5.1 5.1-5.1h10.2V36H13.8c-2.9 0-5.3 2.3-5.3 5.1V30.5Z" fill="#f0ead7" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M39.5 30.5c0-2.8-2.3-5.1-5.1-5.1H23.8V36h10.1c2.9 0 5.3 2.3 5.3 5.1V30.5Z" fill="#ffdfb7" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23.8 14v22" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.2 16c2.3-1.5 5.2-2.3 8.2-2.3 1.2 0 2.3.1 3.4.4v13.1c-1.1-.4-2.2-.6-3.4-.6-3.1 0-5.9.8-8.2 2.3V16Z" fill="#f8f3e7" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M35.4 16c-2.3-1.5-5.2-2.3-8.2-2.3-1.2 0-2.3.1-3.4.4v13.1c1.1-.4 2.2-.6 3.4-.6 3.1 0 5.9.8 8.2 2.3V16Z" fill="#ffd0a3" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="33.5" cy="15" r="6.5" fill="rgba(114,215,199,0.18)" stroke="#2ea89b" strokeWidth="2.2" />
      <path d="M38.2 19.7l4.1 4.1" stroke="#2ea89b" strokeWidth="2.2" strokeLinecap="round" />
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
    <svg viewBox="0 0 48 48" style={icon22} aria-hidden="true">
      <path d="M24 7v6" stroke="#e19744" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M21 10h6" stroke="#e19744" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M11 39V22l13-9 13 9v17" fill="#f8efe1" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 39h32" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" />
      <path d="M20.5 39v-7.5c0-2 1.6-3.5 3.5-3.5s3.5 1.5 3.5 3.5V39" fill="#fff8ec" stroke="#3f3a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 25h14" stroke="#d7b78e" strokeWidth="1.7" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function BibleGameIcon() {
  return (
    <svg viewBox="0 0 48 48" style={icon22} aria-hidden="true">
      <rect x="9" y="9" width="30" height="30" rx="9" fill="#effbf8" stroke="#3f3a34" strokeWidth="2" />
      <rect x="14" y="14" width="20" height="15" rx="4" fill="#fff1dd" stroke="#3f3a34" strokeWidth="2" />
      <path d="M20 17v7" stroke="#e19744" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16.7 20.5h6.6" stroke="#e19744" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="30.5" cy="19.5" r="1.8" fill="#2ea89b" />
      <circle cx="27.3" cy="23" r="1.8" fill="#ef8fa0" />
      <path d="M18 33.2h4.6" stroke="#3f3a34" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M31.5 33.2h.1" stroke="#3f3a34" strokeWidth="3" strokeLinecap="round" />
      <path d="M27.8 33.2h.1" stroke="#3f3a34" strokeWidth="3" strokeLinecap="round" />
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

const promoLink: CSSProperties = {
  display: 'block',
  textDecoration: 'none'
};

const promoCard: CSSProperties = {
  overflow: 'hidden',
  borderRadius: 22,
  background: 'rgba(255,255,255,0.82)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const promoBadgeRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 14px 0'
};

const promoBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 22,
  padding: '0 8px',
  borderRadius: 999,
  background: 'rgba(93,106,255,0.12)',
  color: '#4752c4',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.06em'
};

const promoBadgeText: CSSProperties = {
  color: '#6f7b84',
  fontSize: 12,
  fontWeight: 700
};

const promoCta: CSSProperties = {
  marginLeft: 'auto',
  color: '#4f5bcc',
  fontSize: 12,
  fontWeight: 800
};

const promoImageFrame: CSSProperties = {
  padding: 12
};

const promoImage: CSSProperties = {
  width: '100%',
  display: 'block',
  borderRadius: 18,
  border: '1px solid rgba(109,120,255,0.14)',
  boxShadow: '0 10px 22px rgba(69,73,149,0.12)'
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
