import { useEffect, useMemo, useState } from 'react';
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
};

export default function HomePage() {
  const [home, setHome] = useState<HomePayload | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mcheyneBulkSaving, setMcheyneBulkSaving] = useState(false);
  const [dismissUrgent, setDismissUrgent] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();
  const { me, loading: authLoading, refreshMe } = useAuth();

  const urgentItems = useMemo(() => home?.urgentTicker ?? [], [home]);
  const urgentEmpty = urgentItems.length === 0;
  const todayCompleted = home?.mcheyneProgress?.todayCompleted ?? 0;
  const progressRatio = Math.max(0, Math.min(100, (todayCompleted / 4) * 100));

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
    try {
      const res = await apiFetch('/api/home');
      const data = (await res.json()) as HomePayload;
      setHome(data);
    } catch {
      setHome({
        urgentTicker: [],
        mcheyneToday: {
          month: 3,
          day: 20,
          reading1: '출애굽기 31장',
          reading2: '요한복음 10장',
          reading3: '잠언 7장',
          reading4: '갈라디아서 6장'
        },
        mcheyneProgress: {
          percent: 0,
          completedReadings: 0,
          totalReadings: 0,
          todayCompleted: 0
        }
      });
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

      if (!res.ok) {
        throw new Error('SAVE_FAILED');
      }

      await loadHome();
    } finally {
      setMcheyneBulkSaving(false);
    }
  }

  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="DLP" />

        {!dismissUrgent ? (
          <Card className="homeUrgentBanner">
            <div className="homeUrgentBannerHead">
              <div className="homeUrgentBadge">긴급기도</div>
              <button
                type="button"
                className="homeUrgentClose"
                aria-label="긴급기도 배너 닫기"
                onClick={() => setDismissUrgent(true)}
              >
                ×
              </button>
            </div>

            {urgentEmpty ? (
              <>
                <div className="homeUrgentTitle">현재 등록된 긴급기도가 없습니다.</div>
                <div className="homeUrgentMetaRow">
                  <span className="homeUrgentMeta">유효 24시간</span>
                  <button type="button" className="homeUrgentAction" onClick={openUrgentComposer}>
                    + 작성하기
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="homeUrgentTitle">지금 함께 기도해야 할 제목이 있습니다.</div>
                <div className="homeUrgentTickerWrap">
                  <UrgentPrayerTicker
                    items={urgentItems}
                    intervalMs={3000}
                    resumeDelayMs={5000}
                    heightPx={44}
                    onItemClick={(id) => nav(`/urgent-prayers?highlight=${encodeURIComponent(id)}`)}
                  />
                </div>
                <div className="homeUrgentMetaRow">
                  <span className="homeUrgentMeta">유효 24시간</span>
                  <button
                    type="button"
                    className="homeUrgentAction"
                    onClick={() => nav('/urgent-prayers')}
                  >
                    전체 보기
                  </button>
                </div>
              </>
            )}
          </Card>
        ) : null}

        <Card className="homeHeroCard">
          <div className="homeHeroTop">
            <div className="homeHeroCopy">
              <CardTitle className="homeHeroTitle">맥체인 성경읽기 (오늘)</CardTitle>
              <CardDesc className="homeHeroDesc">이제 앱에서 바로 본문을 읽을 수 있습니다.</CardDesc>

              <ul className="homeReadingList">
                {readings.length > 0 ? (
                  readings.map((reading, idx) => (
                    <li key={`${reading}-${idx}`} className="homeReadingItem">
                      <BookIcon />
                      <span>{reading}</span>
                    </li>
                  ))
                ) : (
                  <li className="homeReadingEmpty">오늘 본문을 불러오지 못했습니다.</li>
                )}
              </ul>
            </div>

            <div className="homeProgressBlock">
              <div
                className="homeProgressRing"
                style={{
                  background: `conic-gradient(var(--mint-500) ${progressRatio}%, rgba(114, 215, 199, 0.18) 0%)`
                }}
              >
                <div className="homeProgressRingInner">
                  <div className="homeProgressMain">{todayCompleted}/4</div>
                  <div className="homeProgressLabel">오늘 진행</div>
                </div>
              </div>

              {home?.mcheyneProgress ? (
                <div className="homeProgressSub">
                  전체 {home.mcheyneProgress.completedReadings}/{home.mcheyneProgress.totalReadings}
                </div>
              ) : (
                <div className="homeProgressSub">로그인 후 진행률 표시</div>
              )}
            </div>
          </div>

          <div className="homeHeroActions">
            <Button variant="primary" size="lg" className="homeHeroPrimaryBtn" onClick={goTodayReading}>
              오늘 본문 읽기
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="homeHeroSecondaryBtn"
              onClick={() => nav('/mcheyne-calendar')}
            >
              캘린더
            </Button>
          </div>

          {me ? (
            <div className="homeHeroBottomAction">
              <Button
                variant="ghost"
                onClick={completeTodayAll}
                disabled={mcheyneBulkSaving}
                className="homeMiniProgressBtn"
              >
                {mcheyneBulkSaving ? '저장 중…' : '오늘 4개 원클릭 완료'}
              </Button>
            </div>
          ) : null}
        </Card>

        <div className="homeQuickGrid">
          <QuickCard
            tone="mint"
            icon={<QtIcon />}
            title="매일성경 QT"
            desc="오늘 QT로 이동"
            onClick={() => nav('/qt')}
          />
          <QuickCard
            tone="peach"
            icon={<GratitudeIcon />}
            title="감사일기"
            desc="한 줄 감사 기록"
            onClick={() => nav('/me?section=gratitude')}
          />
          <QuickCard
            tone="peach"
            icon={<ChecklistIcon />}
            title="DLP 체크리스트"
            desc="오늘의 체크리스트"
            onClick={() => nav('/dlp')}
          />
          <QuickCard
            tone="mint"
            icon={<SearchIcon />}
            title="성경 검색"
            desc="단어/구절로 찾기"
            onClick={() => nav('/bible-search')}
          />
        </div>

        <QuickWideCard
          tone="peach"
          icon={<ChurchIcon />}
          title="교회 채널"
          desc="공지/기도/댓글"
          onClick={() => nav('/channels')}
        />

        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <UrgentPrayerComposer
            onUnauthorized={() => goLogin()}
            onDone={async (newId) => {
              setSheetOpen(false);
              setDismissUrgent(false);
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
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  tone: 'mint' | 'peach';
}) {
  return (
    <Card
      pad={false}
      className={`homeQuickCard homeQuickCard-${tone}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      aria-label={`${title}: ${desc}`}
    >
      <div className="homeQuickCardInner">
        <div className="homeQuickIconWrap">{icon}</div>
        <div className="homeQuickText">
          <div className="homeQuickTitle">{title}</div>
          <div className="homeQuickDesc">{desc}</div>
        </div>
      </div>
    </Card>
  );
}

function QuickWideCard({
  icon,
  title,
  desc,
  onClick,
  tone
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  tone: 'mint' | 'peach';
}) {
  return (
    <Card
      pad={false}
      className={`homeQuickWideCard homeQuickCard-${tone}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      aria-label={`${title}: ${desc}`}
    >
      <div className="homeQuickCardInner">
        <div className="homeQuickIconWrap">{icon}</div>
        <div className="homeQuickText">
          <div className="homeQuickTitle">{title}</div>
          <div className="homeQuickDesc">{desc}</div>
        </div>
      </div>
    </Card>
  );
}

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: any }) {
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="uiSheetBackdrop" onClick={onClose}>
      <div className="uiSheet" onClick={(e) => e.stopPropagation()}>
        <div className="uiSheetHandleWrap">
          <div className="uiSheetHandle" />
        </div>

        {children}

        <div className="homeSheetFooter">
          <Button variant="secondary" wide size="lg" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="homeInlineIcon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h12v16H7a2.5 2.5 0 0 0-2.5 2.5V5.5Z" />
      <path d="M19 19H7a2.5 2.5 0 0 0-2.5 2.5" />
      <path d="M9 7h6" />
    </svg>
  );
}

function QtIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="homeQuickIconSvg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 19.5V6.3A2.3 2.3 0 0 1 7.3 4H18v15.5H7.5A2.5 2.5 0 0 0 5 22V19.5Z" />
      <path d="M8.5 7.5h6" />
      <path d="M8.5 11h6" />
      <path d="M19.5 8a4 4 0 1 0-8 0c0 3 4 6.2 4 6.2S19.5 11 19.5 8Z" opacity="0.85" />
    </svg>
  );
}

function GratitudeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="homeQuickIconSvg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v5h5" />
      <path d="M12 16.8s-3.4-1.9-3.4-4.4a2.1 2.1 0 0 1 3.9-1.1 2.1 2.1 0 0 1 3.9 1.1c0 2.5-3.4 4.4-3.4 4.4Z" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="homeQuickIconSvg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M9 3.5h6" />
      <path d="M8.3 9.3l1.4 1.4 2.6-2.8" />
      <path d="M8.3 14.3l1.4 1.4 2.6-2.8" />
      <path d="M14.5 9.5h2.2" />
      <path d="M14.5 14.5h2.2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="homeQuickIconSvg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10.5" cy="10.5" r="5.8" />
      <path d="m15 15 4.5 4.5" />
      <path d="M3.8 20V7.8A2.8 2.8 0 0 1 6.6 5h10.2" opacity="0.55" />
    </svg>
  );
}

function ChurchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="homeQuickIconSvg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v4" />
      <path d="M10 5h4" />
      <path d="M6 21V11l6-4 6 4v10" />
      <path d="M4 21h16" />
      <path d="M9.5 21v-4a2.5 2.5 0 0 1 5 0v4" />
      <path d="M7.5 12.5h0" />
      <path d="M16.5 12.5h0" />
    </svg>
  );
}
