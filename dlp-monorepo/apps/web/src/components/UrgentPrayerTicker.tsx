import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

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
  heightPx?: 44 | 52;
  onItemClick?: (id: string) => void;
};

const TRANSITION_MS = 280;

export default function UrgentPrayerTicker({
  items,
  intervalMs = 3000,
  resumeDelayMs = 5000,
  heightPx = 44,
  onItemClick
}: Props) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [isAnimating, setIsAnimating] = useState(false);
  const [animDirection, setAnimDirection] = useState<1 | -1>(1);
  const [animOffset, setAnimOffset] = useState(0);
  const [animTransitionOn, setAnimTransitionOn] = useState(false);

  const startYRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);

  const count = safeItems.length;

  const currentIndex = count ? ((index % count) + count) % count : 0;
  const nextIndex = count ? (currentIndex + 1) % count : 0;
  const prevIndex = count ? (currentIndex - 1 + count) % count : 0;

  const current = count ? safeItems[currentIndex] : null;
  const next = count ? safeItems[nextIndex] : null;
  const prev = count ? safeItems[prevIndex] : null;

  useEffect(() => {
    if (count === 0) {
      setIndex(0);
      return;
    }

    setIndex((prevValue) => {
      const normalized = ((prevValue % count) + count) % count;
      return normalized;
    });
  }, [count]);

  useEffect(() => {
    if (count <= 1) return;
    if (isPaused || isDragging || isAnimating) return;

    const timer = window.setInterval(() => {
      animateStep(1);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [count, intervalMs, isPaused, isDragging, isAnimating, currentIndex]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    };
  }, []);

  function clearResumeTimer() {
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }

  function clearFinishTimer() {
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }

  function scheduleResume() {
    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      setIsPaused(false);
    }, resumeDelayMs);
  }

  function animateStep(direction: 1 | -1, startOffset?: number) {
    if (count <= 1) return;
    if (isAnimating) return;

    clearFinishTimer();

    setIsAnimating(true);
    setAnimDirection(direction);
    setAnimTransitionOn(false);

    const initialOffset =
      typeof startOffset === 'number'
        ? startOffset
        : direction === 1
          ? 0
          : -heightPx;

    const targetOffset = direction === 1 ? -heightPx : 0;

    setAnimOffset(initialOffset);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimTransitionOn(true);
        setAnimOffset(targetOffset);
      });
    });

    finishTimerRef.current = window.setTimeout(() => {
      setIndex((prevValue) => {
        if (count <= 0) return 0;
        return direction === 1
          ? (prevValue + 1) % count
          : (prevValue - 1 + count) % count;
      });

      setIsAnimating(false);
      setAnimTransitionOn(false);
      setAnimOffset(0);
      setDragOffset(0);
    }, TRANSITION_MS + 24);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (count <= 1 || isAnimating) return;

    clearResumeTimer();
    setIsPaused(true);
    setIsDragging(true);
    startYRef.current = e.clientY;
    setDragOffset(0);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    if (startYRef.current == null) return;

    const delta = e.clientY - startYRef.current;
    const clamped = Math.max(-heightPx, Math.min(heightPx, delta));
    setDragOffset(clamped);
  }

  function onPointerUp() {
    if (!isDragging) return;

    const threshold = heightPx * 0.28;
    const delta = dragOffset;

    setIsDragging(false);
    startYRef.current = null;

    if (Math.abs(delta) > threshold && count > 1) {
      if (delta < 0) {
        animateStep(1, Math.max(-heightPx, Math.min(0, delta)));
      } else {
        animateStep(-1, Math.max(-heightPx, Math.min(0, -heightPx + delta)));
      }
    } else {
      setDragOffset(0);
    }

    scheduleResume();
  }

  function handleClick() {
    if (!current || isDragging || isAnimating) return;
    onItemClick?.(current.id);
  }

  const trackRows =
    count === 0
      ? []
      : isAnimating
        ? animDirection === 1
          ? [current, next]
          : [prev, current]
        : isDragging
          ? dragOffset < 0
            ? [current, next]
            : [prev, current]
          : [current, next];

  const translateY =
    count === 0
      ? 0
      : isAnimating
        ? animOffset
        : isDragging
          ? dragOffset < 0
            ? dragOffset
            : -heightPx + dragOffset
          : 0;

  const itemCountText = count > 0 ? `유효 24시간 · ${count}건` : '유효 24시간';
  const pauseText = isPaused || isDragging ? ' · 일시정지' : '';

  return (
    <section
      aria-label="긴급기도 티커"
      className={[
        'urgentTickerMegaphone',
        heightPx === 52 ? 'isTall' : 'isNormal',
        isPaused || isDragging ? 'isPaused' : '',
        count > 0 ? 'hasItems' : 'isEmpty'
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <style>
        {`
          .urgentTickerMegaphone {
            position: relative;
            width: 100%;
            padding: 11px 12px 9px;
            border-radius: 17px;
            background:
              linear-gradient(180deg, rgba(255,248,244,0.95), rgba(255,243,238,0.84));
            border: 1px solid rgba(243,180,156,0.24);
            box-shadow:
              0 8px 20px rgba(204,151,126,0.11),
              inset 0 1px 0 rgba(255,255,255,0.40);
            overflow: hidden;
          }

          .urgentTickerMegaphone::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 18% 20%, rgba(255,255,255,0.46), transparent 32%),
              linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.14) 32%, transparent 58%);
            pointer-events: none;
          }

          .urgentTickerHeader {
            position: relative;
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .urgentTickerLead {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            flex: 0 0 auto;
          }

          .urgentTickerHorn {
            position: relative;
            width: 32px;
            height: 32px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.56);
            border: 1px solid rgba(255,255,255,0.58);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.46);
            color: #c77859;
          }

          .urgentTickerHornSvg {
            width: 18px;
            height: 18px;
            position: relative;
            z-index: 2;
          }

          .urgentTickerWaves {
            position: absolute;
            inset: 0;
            pointer-events: none;
          }

          .urgentTickerWave {
            position: absolute;
            right: -1px;
            top: 50%;
            width: 11px;
            height: 11px;
            border-radius: 999px;
            border: 2px solid rgba(232, 138, 101, 0.34);
            transform: translateY(-50%) scale(0.55);
            opacity: 0;
            animation: urgentTickerWavePulse 1.8s ease-out infinite;
          }

          .urgentTickerWave.wave2 {
            animation-delay: 0.42s;
          }

          .urgentTickerWave.wave3 {
            animation-delay: 0.84s;
          }

          .urgentTickerMegaphone.isPaused .urgentTickerWave,
          .urgentTickerMegaphone.isPaused .urgentTickerAlertDot {
            animation-play-state: paused;
          }

          .urgentTickerBadge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 26px;
            padding: 0 10px;
            border-radius: 999px;
            background: rgba(243,180,156,0.14);
            border: 1px solid rgba(243,180,156,0.20);
            color: #a05f48;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: -0.01em;
            white-space: nowrap;
          }

          .urgentTickerAlertDot {
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: #e37b54;
            box-shadow: 0 0 0 rgba(227,123,84,0.42);
            animation: urgentTickerAlertBlink 1.5s ease-in-out infinite;
          }

          .urgentTickerBody {
            min-width: 0;
            flex: 1;
          }

          .urgentTickerViewport {
            position: relative;
            min-width: 0;
            overflow: hidden;
            border-radius: 14px;
            background: rgba(255,255,255,0.54);
            border: 1px solid rgba(255,255,255,0.50);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.44);
            touch-action: pan-x;
            user-select: none;
            -webkit-user-select: none;
          }

          .urgentTickerTap {
            width: 100%;
            height: 100%;
            padding: 0;
            border: 0;
            background: transparent;
            text-align: left;
            cursor: pointer;
            color: inherit;
          }

          .urgentTickerTap:disabled {
            cursor: default;
          }

          .urgentTickerTrack {
            will-change: transform;
          }

          .urgentTickerTrack.withTransition {
            transition: transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
          }

          .urgentTickerRow {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            padding: 0 13px;
          }

          .urgentTickerMegaphone.isNormal .urgentTickerRow {
            height: 44px;
          }

          .urgentTickerMegaphone.isTall .urgentTickerRow {
            height: 52px;
          }

          .urgentTickerRow.isGhost {
            opacity: 0.58;
          }

          .urgentTickerAuthor {
            color: #2b7f72;
            font-size: 12px;
            font-weight: 800;
            flex: 0 0 auto;
            max-width: 78px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .urgentTickerDot {
            color: rgba(130, 108, 98, 0.64);
            flex: 0 0 auto;
            font-weight: 900;
          }

          .urgentTickerText {
            min-width: 0;
            color: #5d5350;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.4;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .urgentTickerText.isEmptyText {
            color: #907972;
            font-weight: 700;
          }

          .urgentTickerChevron {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            color: #b98a78;
            font-size: 18px;
            font-weight: 900;
            flex: 0 0 auto;
          }

          .urgentTickerMeta {
            position: relative;
            margin-top: 7px;
            color: #9a7f74;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.3;
          }

          .urgentTickerMetaStrong {
            color: #8d6c61;
          }

          @keyframes urgentTickerWavePulse {
            0% {
              opacity: 0;
              transform: translateY(-50%) scale(0.55);
            }
            18% {
              opacity: 0.42;
            }
            100% {
              opacity: 0;
              transform: translateY(-50%) scale(1.75);
            }
          }

          @keyframes urgentTickerAlertBlink {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(227,123,84,0.36);
            }
            45% {
              transform: scale(1.06);
              box-shadow: 0 0 0 6px rgba(227,123,84,0.00);
            }
          }
        `}
      </style>

      <div className="urgentTickerHeader">
        <div className="urgentTickerLead">
          <div className="urgentTickerHorn" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              className="urgentTickerHornSvg"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 13.5v-3l10-4v11l-10-4Z" />
              <path d="M14 9.5h2.5a2.5 2.5 0 0 1 0 5H14" />
              <path d="M7 15.2 8.1 19a1.6 1.6 0 0 0 1.54 1.15h.36" />
            </svg>

            <div className="urgentTickerWaves">
              <span className="urgentTickerWave wave1" />
              <span className="urgentTickerWave wave2" />
              <span className="urgentTickerWave wave3" />
            </div>
          </div>

          <div className="urgentTickerBadge">
            <span className="urgentTickerAlertDot" />
            긴급기도
          </div>
        </div>

        <div className="urgentTickerBody">
          <div
            className="urgentTickerViewport"
            style={{ height: heightPx }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <button
              type="button"
              className="urgentTickerTap"
              onClick={handleClick}
              disabled={!current}
              aria-label={current ? `${current.authorName}의 긴급기도 보기` : '긴급기도 없음'}
            >
              {count === 0 ? (
                <div className="urgentTickerRow" style={{ height: heightPx }}>
                  <span className="urgentTickerText isEmptyText">현재 긴급기도 제목이 없습니다.</span>
                </div>
              ) : (
                <div
                  className={[
                    'urgentTickerTrack',
                    animTransitionOn ? 'withTransition' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ transform: `translateY(${translateY}px)` }}
                >
                  {(trackRows[0] || current) ? (
                    <div className="urgentTickerRow" style={{ height: heightPx }}>
                      <span className="urgentTickerAuthor">{trackRows[0]?.authorName}</span>
                      <span className="urgentTickerDot">·</span>
                      <span className="urgentTickerText">{trackRows[0]?.content}</span>
                    </div>
                  ) : null}

                  {count > 1 && (trackRows[1] || next) ? (
                    <div className="urgentTickerRow isGhost" style={{ height: heightPx }}>
                      <span className="urgentTickerAuthor">{trackRows[1]?.authorName}</span>
                      <span className="urgentTickerDot">·</span>
                      <span className="urgentTickerText">{trackRows[1]?.content}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </button>
          </div>

          <div className="urgentTickerMeta">
            <span className="urgentTickerMetaStrong">{itemCountText}</span>
            {pauseText}
          </div>
        </div>

        <div className="urgentTickerChevron" aria-hidden="true">
          ›
        </div>
      </div>
    </section>
  );
}
