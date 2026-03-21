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

  /**
   * class 기반 유지 위해 높이는 프리셋만 지원
   * - 44(default): urgentTickerH44
   * - 52: urgentTickerH52
   */
  heightPx?: 44 | 52;

  onItemClick?: (id: string) => void;
};

/**
 * [긴급기도 티커 UX]
 * - intervalMs마다 자동 위로 롤링(루프)
 * - 드래그/터치하면 정지
 * - 놓으면 스냅(+다음/이전 전환) 후 resumeDelayMs 뒤 자동 재개
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
  const current = count ? safeItems[index] : null;

  const heightClass = heightPx === 52 ? 'urgentTickerH52' : 'urgentTickerH44';
  const rollClass = [
    'urgentTickerRoll',
    isDragging ? 'isDragging' : '',
    count > 1 ? 'isGrabbable' : ''
  ]
    .filter(Boolean)
    .join(' ');

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

  return (
    <section aria-label="긴급기도제목" className={['urgentTicker', heightClass].join(' ')}>
      <div className="urgentTickerTop">
        <div className="urgentTickerBadge">긴급기도</div>

        <div
          className="urgentTickerViewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {count === 0 ? (
            <div className={['urgentTickerRow', 'isDim'].join(' ')}>
              <span className="urgentTickerEllipsis">현재 긴급기도제목이 없습니다.</span>
            </div>
          ) : (
            <div
              className={rollClass}
              style={{ transform: `translateY(${dragOffset}px)` }}
            >
              <button
                type="button"
                className="urgentTickerBtn"
                onClick={() => current && onItemClick?.(current.id)}
              >
                <div className="urgentTickerRow">
                  <span className="urgentTickerAuthor">{current?.authorName}</span>
                  <span className="urgentTickerDot">·</span>
                  <span className="urgentTickerEllipsis">{current?.content}</span>
                </div>
              </button>

              {/* 다음 줄 미리 렌더 → 드래그 시 자연스러움 */}
              {count > 1 ? (
                <div className={['urgentTickerRow', 'isDim'].join(' ')}>
                  <span className="urgentTickerAuthor">{safeItems[(index + 1) % count]?.authorName}</span>
                  <span className="urgentTickerDot">·</span>
                  <span className="urgentTickerEllipsis">{safeItems[(index + 1) % count]?.content}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="urgentTickerChevron" aria-hidden="true">
          ›
        </div>
      </div>

      <div className="urgentTickerMeta">
        {count > 0 ? `유효 24시간 · ${count}건` : '유효 24시간'}
        {isPaused || isDragging ? ' · 일시정지' : ''}
      </div>
    </section>
  );
}
