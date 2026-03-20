import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import UrgentPrayerTicker, { type UrgentTickerItem } from '../components/UrgentPrayerTicker';
import { useAuth } from '../auth/AuthContext';
import UrgentPrayerComposer from '../components/urgent/UrgentPrayerComposer';
import TopBar from '../components/layout/TopBar';

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

  return (
    <div>
      <TopBar title="DLP" />

      {/* 긴급기도 영역 */}
      <div style={{ position: 'relative' }}>
        <UrgentPrayerTicker
          items={urgentItems}
          intervalMs={3000}
          resumeDelayMs={5000}
          heightPx={44}
          onItemClick={(id) => nav(`/urgent-prayers?highlight=${encodeURIComponent(id)}`)}
        />

        {!urgentEmpty ? (
          // 기존: 작은 +작성 버튼
          <button
            type="button"
            onClick={async () => {
              if (!me && !authLoading) {
                nav('/login');
                return;
              }
              await refreshMe();
              setSheetOpen(true);
            }}
            style={tinyCta}
            aria-label="긴급기도 작성"
          >
            + 작성
          </button>
        ) : (
          // 개선: 0개일 때는 더 크게 강조(+살짝 펄스)
          <>
          <button
            type="button"
            onClick={async () => {
              if (!me && !authLoading) {
                nav('/login');
                return;
              }
              await refreshMe();
              setSheetOpen(true);
            }}
            style={bigCta}
            aria-label="긴급기도 작성"
          >
            지금 긴급기도제목이 없습니다 · + 작성하기
          </button>
          <style>{`@keyframes urgentPulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }`}</style>
          </>
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

      <div style={{ height: 16 }} />

      {/* 맥체인 오늘 본문 */}
      <section style={cardSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>맥체인 성경읽기 (오늘)</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>이제 앱에서 바로 본문을 읽을 수 있습니다.</div>
            {home?.mcheyneProgress ? (
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>
                내 진행률(오늘까지): <b style={{ color: 'var(--text)' }}>{home.mcheyneProgress.percent}%</b>
                <span style={{ marginLeft: 6 }}>
                  ({home.mcheyneProgress.completedReadings}/{home.mcheyneProgress.totalReadings})
                </span>
                <span style={{ marginLeft: 6 }}>· 오늘 {home.mcheyneProgress.todayCompleted}/4</span>
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" style={ghostBtn} onClick={() => nav('/mcheyne-calendar')}>
              캘린더
            </button>

            {home?.mcheyneProgress ? (
              <button
                type="button"
                style={{ ...ghostBtn, opacity: mcheyneBulkSaving ? 0.7 : 1 }}
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
              </button>
            ) : null}

            <button
              type="button"
              style={ghostBtn}
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
            </button>
          </div>
        </div>

        <div style={{ height: 10 }} />

        {home?.mcheynePreview?.length ? (
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--soft)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>오늘 본문 미리보기</div>
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: 'var(--text)' }}>
              {home.mcheynePreview.map((l) => (
                <div key={l.v}>
                  <b style={{ marginRight: 6 }}>{l.v}</b>{l.t}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>미리보기는 앱 내 성경 텍스트에서 일부 절만 표시합니다.</div>
          </div>
        ) : null}

        {home?.mcheyneToday ? (
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text)', lineHeight: 1.7 }}>
            <li>{home.mcheyneToday.reading1}</li>
            <li>{home.mcheyneToday.reading2}</li>
            <li>{home.mcheyneToday.reading3}</li>
            <li>{home.mcheyneToday.reading4}</li>
          </ul>
        ) : (
          <div style={{ color: 'var(--muted)' }}>오늘 본문을 불러오지 못했습니다.</div>
        )}
      </section>

      <div style={{ height: 12 }} />

      {/* 홈 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <ActionCard title="매일성경 QT" desc="오늘 QT로 이동" onClick={() => nav('/qt')} />
        <ActionCard title="감사일기" desc="한 줄 감사 기록" onClick={() => nav('/me?section=gratitude')} />
        <ActionCard title="DLP" desc="오늘의 체크리스트" onClick={() => nav('/dlp')} />
        <ActionCard title="성경 검색" desc="단어/구절로 찾기" onClick={() => nav('/bible-search')} />
        <ActionCard title="교회 채널" desc="공지/기도/댓글" onClick={() => nav('/channels')} />
      </div>
    </div>
  );
}

function ActionCard(props: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      style={{
        width: '100%',
        textAlign: 'left',
        padding: 14,
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'var(--card)',
        color: 'var(--text)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.03)'
      }}
      onClick={props.onClick}
    >
      <div style={{ fontWeight: 900 }}>{props.title}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{props.desc}</div>
    </button>
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
          color: 'var(--text)',
          padding: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 46, height: 5, borderRadius: 999, background: 'var(--border)' }} />
        </div>
        {children}
        <div style={{ height: 10 }} />
        <button type="button" onClick={onClose} style={{ ...ghostBtn, width: '100%' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 900
};

const tinyCta: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 12,
  height: 28,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(255,0,0,0.18)',
  background: 'rgba(255,0,0,0.08)',
  color: 'rgb(180,0,0)',
  fontWeight: 900,
  fontSize: 12
};

const bigCta: React.CSSProperties = {
  position: 'absolute',
  left: 12,
  right: 12,
  bottom: 10,
  height: 44,
  borderRadius: 16,
  border: '1px solid rgba(255,0,0,0.28)',
  background: 'rgba(255,0,0,0.12)',
  color: 'rgb(150,0,0)',
  fontWeight: 900,
  fontSize: 13,
  animation: 'urgentPulse 1.6s ease-in-out infinite'
};

const cardSection: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)'
};
