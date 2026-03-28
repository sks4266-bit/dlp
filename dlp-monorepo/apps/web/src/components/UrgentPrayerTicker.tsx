import { useEffect, useMemo, useState } from 'react';

export type UrgentTickerItem = {
  id: string;
  authorName: string;
  content: string;
  createdAt: number;
  expiresAt: number;
};

type Props = {
  items: UrgentTickerItem[];
  intervalMs?: number;
  resumeDelayMs?: number;
  heightPx?: 40 | 44 | 52;
  onItemClick?: (id: string) => void;
};

export default function UrgentPrayerTicker({
  items,
  intervalMs = 5200,
  resumeDelayMs,
  heightPx = 40,
  onItemClick
}: Props) {
  void resumeDelayMs;
  const safeItems = useMemo(() => (Array.isArray(items) ? items.filter((item) => !!item?.content?.trim()) : []), [items]);
  const count = safeItems.length;
  const [index, setIndex] = useState(0);

  const current = count > 0 ? safeItems[index % count] : null;
  const currentText = current?.content?.trim() || '현재 긴급기도가 없습니다.';
  const shouldAnimate = currentText.length > 16;
  const marqueeDurationSec = Math.min(14, Math.max(7.5, currentText.length * 0.22));
  const effectiveInterval = Math.max(intervalMs, Math.round(marqueeDurationSec * 1000) + 700);
  const heightClass = heightPx === 52 ? 'urgentTickerH52' : heightPx === 44 ? 'urgentTickerH44' : 'urgentTickerH40';

  useEffect(() => {
    if (count <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % count);
    }, effectiveInterval);
    return () => window.clearInterval(timer);
  }, [count, effectiveInterval]);

  useEffect(() => {
    if (count === 0) {
      setIndex(0);
      return;
    }
    setIndex((prev) => prev % count);
  }, [count]);

  return (
    <section aria-label="긴급기도제목" className={['urgentTicker', heightClass].join(' ')}>
      <button
        type="button"
        className="urgentTickerBtn urgentTickerBtnCompact"
        onClick={() => current && onItemClick?.(current.id)}
        disabled={!current}
      >
        <div className="urgentTickerViewport">
          <div
            key={current ? `${current.id}-${index}` : 'urgent-empty'}
            className={['urgentTickerMarqueeTrack', shouldAnimate ? 'isAnimated' : ''].filter(Boolean).join(' ')}
            style={{ animationDuration: `${marqueeDurationSec}s` }}
          >
            <span className={['urgentTickerContent', current ? '' : 'isDim'].filter(Boolean).join(' ')}>{currentText}</span>
            {current && shouldAnimate ? (
              <>
                <span className="urgentTickerGap">&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;</span>
                <span className="urgentTickerContent" aria-hidden="true">
                  {currentText}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </button>
    </section>
  );
}
