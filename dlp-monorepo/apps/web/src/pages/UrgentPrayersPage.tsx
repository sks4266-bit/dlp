import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { UrgentTickerItem } from '../components/UrgentPrayerTicker';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import UrgentPrayerComposer from '../components/urgent/UrgentPrayerComposer';
import TopBar from '../components/layout/TopBar';

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

  function goLogin() {
    const next = `${location.pathname}${location.search}`;
    navigate(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/urgent-prayers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message ?? '불러오기에 실패했습니다.');
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
        { backgroundColor: 'rgba(255, 0, 0, 0.18)' },
        { backgroundColor: 'rgba(255, 0, 0, 0.06)' },
        { backgroundColor: 'transparent' }
      ],
      { duration: 1200, easing: 'ease-out' }
    );
  }, [highlightId, items.length]);

  return (
    <div>
      <TopBar
        title="긴급기도제목"
        backTo="/"
        right={
          <button
            type="button"
            style={ghostBtn}
            onClick={async () => {
              if (authLoading) return;
              if (!me) {
                goLogin();
                return;
              }
              await refreshMe();
              setSheetOpen(true);
            }}
          >
            + 작성
          </button>
        }
      />

      <p style={{ marginTop: 8, marginBottom: 14, color: 'var(--muted)', fontSize: 13, lineHeight: 1.4 }}>
        모든 교회가 함께 보는 공통 게시판입니다. 글은 <b>24시간</b> 동안 노출되며, 삭제는 운영진(ADMIN)만 가능합니다.
      </p>

      {loading && <Skeleton />}
      {error && <ErrorBox message={error} />}

      {!loading && !error && items.length === 0 && (
        <div style={{ padding: 14, borderRadius: 14, border: '1px dashed rgba(0,0,0,0.2)', color: 'var(--muted)' }}>
          현재 긴급기도제목이 없습니다.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => (
          <div
            key={it.id}
            ref={(el) => {
              rowRefs.current[it.id] = el;
            }}
            style={{
              padding: 14,
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'var(--card)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontWeight: 900 }}>{it.authorName}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatTime(it.createdAt)}</div>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  style={dangerBtn}
                  onClick={async () => {
                    const ok = confirm('이 긴급기도제목을 삭제할까요? (운영진 전용)');
                    if (!ok) return;

                    const reason = prompt('삭제 사유를 입력하세요(필수, 최대 120자)');
                    if (!reason) return;

                    const res = await apiFetch(`/api/admin/urgent-prayers/${it.id}/delete`, {
                      method: 'POST',
                      body: JSON.stringify({ reason })
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
                      alert('삭제 실패: 권한 또는 로그인 상태를 확인하세요.');
                      return;
                    }

                    await reload();
                  }}
                >
                  삭제
                </button>
              )}
            </div>

            <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5, color: 'var(--text)' }}>{it.content}</div>
          </div>
        ))}
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <UrgentPrayerComposer
          onDone={async (newId) => {
            setSheetOpen(false);
            await reload();
            navigate(`/urgent-prayers?highlight=${encodeURIComponent(newId)}`);
          }}
        />
      </BottomSheet>

      <div style={{ height: 16 }} />

      <button
        type="button"
        style={{ ...ghostBtn, width: '100%' }}
        onClick={() => {
          if (!me) {
            goLogin();
            return;
          }
          navigate('/urgent-prayers/new');
        }}
      >
        전체화면으로 작성하기
      </button>
    </div>
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
      <div onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 46, height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.12)' }} />
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

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 86,
            borderRadius: 14,
            background: 'linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.03), rgba(0,0,0,0.06))',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.1s infinite'
          }}
        />
      ))}
      <style>
        {`@keyframes shimmer { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }`}
      </style>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 14, border: '1px solid rgba(255,0,0,0.25)', background: 'rgba(255,0,0,0.06)' }}>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>불러오기 오류</div>
      <div style={{ color: 'rgba(0,0,0,0.7)', fontSize: 13 }}>{message}</div>
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const ghostBtn: React.CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontWeight: 900
};

const dangerBtn: React.CSSProperties = {
  border: '1px solid rgba(255,0,0,0.18)',
  background: 'rgba(255,0,0,0.06)',
  color: 'rgb(180,0,0)',
  fontWeight: 900,
  borderRadius: 10,
  padding: '6px 10px'
};

const sheetStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  borderRadius: 18,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  padding: 14,
  boxShadow: '0 12px 32px rgba(0,0,0,0.18)'
};
