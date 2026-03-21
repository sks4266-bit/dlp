import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import UrgentPrayerTicker, { type UrgentTickerItem } from '../components/UrgentPrayerTicker';
import { useAuth } from '../auth/AuthContext';
import UrgentPrayerComposer from '../components/urgent/UrgentPrayerComposer';
import TopBar from '../components/layout/TopBar';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

type HomePayload = {
  urgentTicker: UrgentTickerItem[];
  mcheyneToday: null | { month: number; day: number; reading1: string; reading2: string; reading3: string; reading4: string };
  mcheynePreview?: { c?: number; v: number; t: string }[];
  // 로그인 사용자에게만 제공(없으면 null)
  mcheyneProgress?: null | { percent: number; completedReadings: number; totalReadings: number; todayCompleted: number };
};

export default function HomePage() {
  const [home, setHome] = useState<HomePayload | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mcheyneBulkSaving, setMcheyneBulkSaving] = useState(false);

  const nav = useNavigate();
  const { me, loading: authLoading, refreshMe } = useAuth();

  const urgentItems = useMemo(() => home?.urgentTicker ?? [], [home]);
  const urgentEmpty = urgentItems.length === 0;

  async function loadHome() {
    try {
      const res = await apiFetch('/api/home');
      const data = (await res.json()) as HomePayload;
      setHome(data);
    } catch {
      // fallback (개발 편의용)
      setHome({
        urgentTicker: [],
        mcheyneToday: { month: 3, day: 20, reading1: '출애굽기 31장', reading2: '요한복음 10장', reading3: '잠언 7장', reading4: '갈라디아서 6장' }
      });
    }
  }

  useEffect(() => {
    loadHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openUrgentComposer() {
    if (!me && !authLoading) {
      nav('/login');
      return;
    }
    await refreshMe();
    setSheetOpen(true);
  }

  return (
    <div className="home">
      <TopBar title="DLP" />

      <div className="homeStack">
        {/* 긴급기도 */}
        <div className="homeUrgentWrap">
          <UrgentPrayerTicker
            items={urgentItems}
            intervalMs={3000}
            resumeDelayMs={5000}
            heightPx={44}
            onItemClick={(id) => nav(`/urgent-prayers?highlight=${encodeURIComponent(id)}`)}
          />

          {!urgentEmpty ? (
            <Button
              variant="ghost"
              className="homeUrgentTinyCta"
              onClick={openUrgentComposer}
              aria-label="긴급기도 작성"
              title="긴급기도 작성"
            >
              + 작성
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="homeUrgentBigCta"
              onClick={openUrgentComposer}
              aria-label="긴급기도 작성"
              title="긴급기도 작성"
            >
              지금 긴급기도제목이 없습니다 · + 작성하기
            </Button>
          )}
        </div>

        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <UrgentPrayerComposer
            onDone={async (newId) => {
              setSheetOpen(false);
              await loadHome();
              nav(`/urgent-prayers?highlight=${encodeURIComponent(newId)}`);
            }}
          />
        </BottomSheet>

        {/* 맥체인 오늘 */}
        <Card className="homeMcheyneCard">
          <div className="homeMcheyneHeader">
            <div className="homeMcheyneTitleBlock">
              <CardTitle>맥체인 성경읽기 (오늘)</CardTitle>
              <CardDesc>이제 앱에서 바로 본문을 읽을 수 있습니다.</CardDesc>

              {home?.mcheyneProgress ? (
                <div className="homeMcheyneProgressLine">
                  내 진행률(오늘까지): <b className="homeMcheyneProgressStrong">{home.mcheyneProgress.percent}%</b>
                  <span className="homeMcheyneProgressMeta">
                    ({home.mcheyneProgress.completedReadings}/{home.mcheyneProgress.totalReadings})
                  </span>
                  <span className="homeMcheyneProgressMeta">· 오늘 {home.mcheyneProgress.todayCompleted}/4</span>
                </div>
              ) : null}
            </div>

            <div className="homeMcheyneActions">
              <Button variant="secondary" onClick={() => nav('/mcheyne-calendar')}>
                캘린더
              </Button>

              {home?.mcheyneProgress ? (
                <Button
                  variant="ghost"
                  disabled={mcheyneBulkSaving}
                  onClick={async () => {
                    if (!me && !authLoading) {
                      nav('/login');
                      return;
                    }
                    await refreshMe();

                    setMcheyneBulkSaving(true);
                    try {
                      await apiFetch('/api/mcheyne/progress/today', {
                        method: 'PUT',
                        body: JSON.stringify({ done1: 1, done2: 1, done3: 1, done4: 1 })
                      });
                      await loadHome();
                    } finally {
                      setMcheyneBulkSaving(false);
                    }
                  }}
                >
                  {mcheyneBulkSaving ? '저장 중…' : '오늘 4개 원클릭 완료'}
                </Button>
              ) : null}

              <Button
                variant="primary"
                onClick={async () => {
                  if (!me && !authLoading) {
                    nav('/login');
                    return;
                  }
                  await refreshMe();
                  nav('/mcheyne-today');
                }}
              >
                앱에서 본문 보기
              </Button>
            </div>
          </div>

          {home?.mcheynePreview?.length ? (
            <div className="homePreviewBox">
              <div className="homePreviewTitle">오늘 본문 미리보기</div>

              <div className="homePreviewLines">
                {home.mcheynePreview.map((l) => (
                  <div key={l.v} className="homePreviewLine">
                    <b className="homePreviewVerse">{l.v}</b>
                    <span>{l.t}</span>
                  </div>
                ))}
              </div>

              <div className="homePreviewHint">
                미리보기는 앱 내 성경 텍스트에서 일부 절만 표시합니다.
              </div>
            </div>
          ) : null}

          {home?.mcheyneToday ? (
            <ul className="homeReadingsList">
              <li>{home.mcheyneToday.reading1}</li>
              <li>{home.mcheyneToday.reading2}</li>
              <li>{home.mcheyneToday.reading3}</li>
              <li>{home.mcheyneToday.reading4}</li>
            </ul>
          ) : (
            <div className="homeMuted">오늘 본문을 불러오지 못했습니다.</div>
          )}
        </Card>

        {/* 액션 카드들 */}
        <div className="homeActionsGrid">
          <ActionCard title="매일성경 QT" desc="오늘 QT로 이동" onClick={() => nav('/qt')} />
          <ActionCard title="감사일기" desc="한 줄 감사 기록" onClick={() => nav('/me?section=gratitude')} />
          <ActionCard title="DLP" desc="오늘의 체크리스트" onClick={() => nav('/dlp')} />
          <ActionCard title="성경 검색" desc="단어/구절로 찾기" onClick={() => nav('/bible-search')} />
          <ActionCard title="교회 채널" desc="공지/기도/댓글" onClick={() => nav('/channels')} />
        </div>
      </div>
    </div>
  );
}

function ActionCard(props: { title: string; desc: string; onClick: () => void }) {
  return (
    <Card
      pad={false}
      className="homeActionCard"
      role="button"
      tabIndex={0}
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') props.onClick();
      }}
      aria-label={`${props.title}: ${props.desc}`}
    >
      <div className="homeActionCardInner">
        <div className="homeActionCardTitle">{props.title}</div>
        <div className="homeActionCardDesc">{props.desc}</div>
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
