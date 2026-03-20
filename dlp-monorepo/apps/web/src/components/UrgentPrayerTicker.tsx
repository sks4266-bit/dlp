import { useEffect, useMemo, useRef, useState } from 'react';

export type UrgentTickerItem = {
  id: string;
  authorName: string;
  content: string;
  createdAt: number;
  expiresAt: number;
};

type Props = {
  items: UrgentTickerItem[];
  intervalMs?: number; // default 3000
  resumeDelayMs?: number; // default 5000
  heightPx?: number; // default 44
  onItemClick?: (id: string) => void;
};

/**
 * [긴급기도 티커 UX]
 * - 3초마다 자동으로 위로 롤링(루프)
 * - 사용자가 드래그/터치하면 즉시 정지
 * - 놓으면 스냅(+다음/이전 전환) 후 5초 뒤 자동 재개
 */
export default function UrgentPrayerTicker({
  items,
  intervalMs = 3000,
  resumeDelayMs = 5000,
  heightPx = 44,
  onItemClick
}: Props) {
  const safeItems = useMemo(() => (items?.length ? items : []), [items]);
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);

  const count = safeItems.length;

  useEffect(() => {
    if (count <= 1) return;
    if (isPaused || isDragging) return;

    const t = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % count);
    }, intervalMs);

    return () => window.clearInterval(t);
  }, [count, intervalMs, isPaused, isDragging]);

  useEffect(() => {
    if (count === 0) setIndex(0);
    else setIndex((prev) => prev % count);
  }, [count]);

  function scheduleResume() {
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => setIsPaused(false), resumeDelayMs);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (count <= 1) return;
    setIsPaused(true);
    setIsDragging(true);
    startYRef.current = e.clientY;
    setDragOffset(0);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging) return;
    if (startYRef.current == null) return;

    const delta = e.clientY - startYRef.current;
    const clamped = Math.max(-heightPx * 1.2, Math.min(heightPx * 1.2, delta));
    setDragOffset(clamped);
  }

  function onPointerUp() {
    if (!isDragging) return;

    const threshold = heightPx * 0.28;
    const delta = dragOffset;

    setIsDragging(false);
    startYRef.current = null;

    if (Math.abs(delta) > threshold) {
      if (delta < 0) setIndex((prev) => (prev + 1) % count); // 위로 드래그 → 다음
      else setIndex((prev) => (prev - 1 + count) % count); // 아래로 드래그 → 이전
    }

    setDragOffset(0);
    scheduleResume();
  }

  const current = count ? safeItems[index] : null;

  return (
    <section
      aria-label="긴급기도제목"
      style={{
        borderRadius: 14,
        border: '1px solid rgba(255,0,0,0.18)',
        background: 'rgba(255,0,0,0.04)',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <Badge />

        <div
          style={{ position: 'relative', height: heightPx, flex: 1, overflow: 'hidden', touchAction: 'pan-y' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {count === 0 ? (
            <TickerRow heightPx={heightPx} dim>
              현재 긴급기도제목이 없습니다.
            </TickerRow>
          ) : (
            <div
              style={{
                transform: `translateY(${dragOffset}px)`,
                transition: isDragging ? 'none' : 'transform 180ms ease',
                willChange: 'transform',
                cursor: count > 1 ? 'grab' : 'default'
              }}
            >
              <button
                type="button"
                onClick={() => current && onItemClick?.(current.id)}
                style={{
                  appearance: 'none',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  margin: 0,
                  width: '100%',
                  textAlign: 'left'
                }}
              >
                <TickerRow heightPx={heightPx}>
                  <span style={{ fontWeight: 900 }}>{current?.authorName}</span>
                  <span style={{ margin: '0 8px', color: 'var(--muted)' }}>·</span>
                  <span style={{ color: 'var(--text)' }}>{current?.content}</span>
                </TickerRow>
              </button>

              {/* 다음 줄 미리 렌더 → 드래그 시 자연스러움 */}
              {count > 1 && (
                <TickerRow heightPx={heightPx} dim>
                  <span style={{ fontWeight: 900 }}>{safeItems[(index + 1) % count]?.authorName}</span>
                  <span style={{ margin: '0 8px', color: 'var(--muted)' }}>·</span>
                  <span>{safeItems[(index + 1) % count]?.content}</span>
                </TickerRow>
              )}
            </div>
          )}
        </div>

        <Chevron />
      </div>

      <div style={{ fontSize: 11, padding: '0 12px 10px', color: 'var(--muted)' }}>
        {count > 0 ? `유효 24시간 · ${count}건` : '유효 24시간'}
        {isPaused || isDragging ? ' · 일시정지' : ''}
      </div>
    </section>
  );
}

function Badge() {
  return (
    <div
      style={{
        minWidth: 56,
        height: 24,
        borderRadius: 999,
        background: 'rgba(255,0,0,0.12)',
        color: 'rgb(180,0,0)',
        fontSize: 12,
        fontWeight: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      긴급기도
    </div>
  );
}

function Chevron() {
  return (
    <div style={{ color: 'var(--muted)', fontSize: 18, fontWeight: 900, userSelect: 'none' }}>›</div>
  );
}

function TickerRow({ heightPx, children, dim }: { heightPx: number; children: any; dim?: boolean }) {
  return (
    <div
      style={{
        height: heightPx,
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontSize: 14,
        color: dim ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.92)'
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
    </div>
  );
}
