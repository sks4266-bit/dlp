import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

type Verse = { c: number; v: number; t: string };

type TodayTextPayload = {
  date: { month: number; day: number };
  plan: {
    month: number;
    day: number;
    reading1: string;
    reading2: string;
    reading3: string;
    reading4: string;
  };
  preview: { c: number; v: number; t: string }[];
  readings: { raw: string; ref: string; verses: Verse[]; text: string }[];
};

type ProgressPayload = {
  today: {
    month: number;
    day: number;
    done1: number;
    done2: number;
    done3: number;
    done4: number;
  };
  todayCompleted: number;
  summary: {
    totalDays: number;
    totalReadings: number;
    completedReadings: number;
    percent: number;
  };
};

type DonePatch = {
  done1: number;
  done2: number;
  done3: number;
  done4: number;
};

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function buildDayQs(month: number, day: number) {
  return new URLSearchParams({ month: String(month), day: String(day) }).toString();
}

function addDaysKst(month: number, day: number, delta: number) {
  const now = kstNow();
  const y = now.getUTCFullYear();
  const base = new Date(Date.UTC(y, month - 1, day));
  base.setUTCDate(base.getUTCDate() + delta);
  return { month: base.getUTCMonth() + 1, day: base.getUTCDate() };
}

export default function McCheyneReadingPage() {
  const [data, setData] = useState<TodayTextPayload | null>(null);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [progressLoading, setProgressLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof DonePatch | null>(null);

  const nav = useNavigate();
  const loc = useLocation();

  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const monthParam = Number(qs.get('month') ?? 0);
  const dayParam = Number(qs.get('day') ?? 0);

  const target = useMemo(() => {
    if (!Number.isFinite(monthParam) || !Number.isFinite(dayParam)) return null;
    if (monthParam < 1 || monthParam > 12) return null;
    if (dayParam < 1 || dayParam > 31) return null;
    return { month: monthParam, day: dayParam };
  }, [monthParam, dayParam]);

  const isToday = useMemo(() => {
    if (!target) return true;
    const now = kstNow();
    const m = now.getUTCMonth() + 1;
    const d = now.getUTCDate();
    return target.month === m && target.day === d;
  }, [target]);

  const title = useMemo(() => {
    if (!data) return target ? `맥체인 (${target.month}/${target.day})` : '맥체인 오늘';
    return `맥체인 (${data.date.month}/${data.date.day})`;
  }, [data, target]);

  const viewMonth = data?.date.month ?? target?.month ?? null;
  const viewDay = data?.date.day ?? target?.day ?? null;

  const prevDay = useMemo(() => {
    if (!viewMonth || !viewDay) return null;
    return addDaysKst(viewMonth, viewDay, -1);
  }, [viewMonth, viewDay]);

  const nextDay = useMemo(() => {
    if (!viewMonth || !viewDay) return null;
    return addDaysKst(viewMonth, viewDay, 1);
  }, [viewMonth, viewDay]);

  const todayCompleted = progress?.todayCompleted ?? 0;
  const progressRatio = Math.max(0, Math.min(100, (todayCompleted / 4) * 100));

  const readingPlan = useMemo(() => {
    if (!data?.plan) return [];
    return [data.plan.reading1, data.plan.reading2, data.plan.reading3, data.plan.reading4].filter(Boolean);
  }, [data]);

  function goLogin() {
    const next = `${loc.pathname}${loc.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function readErrorMessage(res: Response) {
    const contentType = res.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (typeof data === 'string') return data;
        if (data?.message) return String(data.message);
        if (data?.error) return String(data.error);
        return `HTTP ${res.status}`;
      }

      const text = await res.text();
      return text?.trim() || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  async function loadProgress() {
    setProgressLoading(true);

    try {
      const url = target
        ? `/api/mcheyne/progress/day?${buildDayQs(target.month, target.day)}`
        : '/api/mcheyne/progress/today';

      const res = await apiFetch(url);

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      const json = (await res.json()) as ProgressPayload;
      setProgress(json);
    } catch (e: any) {
      setProgress(null);
      setError((prev) => prev ?? `진행률을 불러오지 못했습니다: ${String(e?.message ?? e)}`);
    } finally {
      setProgressLoading(false);
    }
  }

  async function saveProgress(patch: Partial<DonePatch>) {
    const prevProgress = progress;
    setError(null);

    setProgress((prev) => {
      if (!prev) return prev;

      const nextToday = {
        ...prev.today,
        ...(patch.done1 !== undefined ? { done1: patch.done1 ? 1 : 0 } : {}),
        ...(patch.done2 !== undefined ? { done2: patch.done2 ? 1 : 0 } : {}),
        ...(patch.done3 !== undefined ? { done3: patch.done3 ? 1 : 0 } : {}),
        ...(patch.done4 !== undefined ? { done4: patch.done4 ? 1 : 0 } : {})
      };

      const nextTodayCompleted =
        (nextToday.done1 ?? 0) +
        (nextToday.done2 ?? 0) +
        (nextToday.done3 ?? 0) +
        (nextToday.done4 ?? 0);

      return {
        ...prev,
        today: nextToday,
        todayCompleted: nextTodayCompleted
      };
    });

    try {
      const putUrl = target
        ? `/api/mcheyne/progress/day?${buildDayQs(target.month, target.day)}`
        : '/api/mcheyne/progress/today';

      const res = await apiFetch(putUrl, {
        method: 'PUT',
        body: JSON.stringify(patch)
      });

      if (res.status === 401) {
        setProgress(prevProgress);
        goLogin();
        return false;
      }

      if (!res.ok) {
        const msg = await readErrorMessage(res);
        setProgress(prevProgress);
        setError(`진행 저장 실패: ${msg}`);
        return false;
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();

        setProgress((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            today: json.today ?? prev.today,
            todayCompleted: json.todayCompleted ?? prev.todayCompleted,
            summary: json.summary ?? prev.summary
          };
        });
      } else {
        await loadProgress();
      }

      return true;
    } catch (e: any) {
      setProgress(prevProgress);
      setError(`진행 저장 실패: ${String(e?.message ?? e)}`);
      return false;
    }
  }

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const url = target
        ? `/api/mcheyne/day-text?${buildDayQs(target.month, target.day)}`
        : '/api/mcheyne/today-text';

      const res = await apiFetch(url);

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      const json = (await res.json()) as TodayTextPayload;
      setData(json);
      await loadProgress();
    } catch (e: any) {
      setData(null);
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.search]);

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title={title} backTo="/" />

        {error ? <ErrorBox message={error} onRetry={load} /> : null}

        {loading ? (
          <Skeleton />
        ) : !data ? (
          <Card pad style={emptyCard}>
            <div style={emptyTitle}>본문을 불러오지 못했습니다.</div>
            <div style={emptyDesc}>잠시 후 다시 시도하거나 캘린더에서 날짜를 다시 선택해 주세요.</div>
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <Button type="button" variant="secondary" size="lg" wide onClick={load}>
                다시 시도
              </Button>
              <Button type="button" variant="ghost" size="lg" wide onClick={() => nav('/mcheyne-calendar')}>
                캘린더로 이동
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card pad style={heroCard}>
              <div style={heroTop}>
                <div style={heroCopy}>
                  <div style={badgeMint}>TODAY READING</div>
                  <CardTitle style={heroTitle}>
                    {data.date.month}월 {data.date.day}일 맥체인
                  </CardTitle>
                  <CardDesc style={heroDesc}>
                    ''
                  </CardDesc>

                  {readingPlan.length > 0 ? (
                    <ul style={readingList}>
                      {readingPlan.map((reading, idx) => (
                        <li key={`${reading}-${idx}`} style={readingItem}>
                          <span style={bulletIconWrap}>
                            <BookIcon />
                          </span>
                          <span>{reading}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={emptyNote}></div>
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
                    {progress?.summary
                      ? `전체 ${progress.summary.completedReadings}/${progress.summary.totalReadings}`
                      : progressLoading
                        ? '불러오는 중…'
                        : '진행률 없음'}
                  </div>
                </div>
              </div>

              <div style={navActions}>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  wide
                  onClick={() =>
                    prevDay && nav(`/mcheyne-today?${buildDayQs(prevDay.month, prevDay.day)}`)
                  }
                  disabled={!prevDay}
                >
                  ← 이전날
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  wide
                  onClick={() =>
                    nextDay && nav(`/mcheyne-today?${buildDayQs(nextDay.month, nextDay.day)}`)
                  }
                  disabled={!nextDay}
                >
                  다음날 →
                </Button>
              </div>

              <div style={heroActions}>
                <Button type="button" variant="primary" size="lg" wide onClick={() => nav('/mcheyne-calendar')}>
                  캘린더 보기
                </Button>

                {!isToday ? (
                  <Button type="button" variant="secondary" size="lg" wide onClick={() => nav('/mcheyne-today')}>
                    오늘로 돌아가기
                  </Button>
                ) : null}
              </div>
            </Card>

            <div style={{ height: 14 }} />

            <Card pad style={progressCard}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionEyebrow}>PROGRESS</div>
                  <div style={sectionHeading}>오늘 진행 체크</div>
                </div>
                <div style={summaryText}>
                  {progress?.summary ? (
                    <>
                      <b>{progress.summary.percent}%</b>
                      <span style={summaryDot}>·</span>
                      <span>{progress.summary.completedReadings}/{progress.summary.totalReadings}</span>
                    </>
                  ) : progressLoading ? (
                    '불러오는 중…'
                  ) : (
                    '진행률 없음'
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="md"
                wide
                disabled={bulkSaving}
                onClick={async () => {
                  setBulkSaving(true);
                  try {
                    await saveProgress({ done1: 1, done2: 1, done3: 1, done4: 1 });
                  } finally {
                    setBulkSaving(false);
                  }
                }}
              >
                {bulkSaving ? '저장 중…' : '오늘 4개 원클릭 완료'}
              </Button>

              <div style={sectionHint}></div>
            </Card>

            <div style={{ height: 14 }} />

            <Card pad style={planCard}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionEyebrow}>READING PLAN</div>
                  <div style={sectionHeading}>오늘 읽을 본문</div>
                </div>
              </div>

              <div style={planList}>
                {readingPlan.map((reading, idx) => (
                  <div key={`${reading}-${idx}`} style={planItem}>
                    <span style={planIndex}>{idx + 1}</span>
                    <span style={planText}>{reading}</span>
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ height: 14 }} />

            <div style={cardsStack}>
              {data.readings.map((reading, idx) => {
                const open = openIdx === idx;
                const previewLines = reading.verses.slice(0, 6);

                const doneKey =
                  (idx === 0 ? 'done1' : idx === 1 ? 'done2' : idx === 2 ? 'done3' : 'done4') as keyof DonePatch;

                const doneVal = progress?.today?.[doneKey] ?? 0;
                const savingThis = savingKey === doneKey;

                return (
                  <Card key={`${reading.ref}-${idx}`} pad style={readingCard}>
                    <div style={readingHead}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={readingRef}>{reading.ref}</div>
                        <div style={readingRaw}>{reading.raw}</div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={() => setOpenIdx(open ? null : idx)}
                      >
                        {open ? '접기' : '펼치기'}
                      </Button>
                    </div>

                    <label style={{ ...checkPill, ...(doneVal ? checkPillOn : null) }}>
                      <input
                        type="checkbox"
                        checked={!!doneVal}
                        disabled={savingThis || bulkSaving}
                        onChange={async (e) => {
                          const next = e.target.checked ? 1 : 0;
                          setSavingKey(doneKey);
                          try {
                            await saveProgress({ [doneKey]: next } as Partial<DonePatch>);
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                      />
                      <span>{savingThis ? '저장 중…' : '읽음 완료 체크'}</span>
                    </label>

                    {!open ? (
                      <div style={previewBox}>
                        {previewLines.map((v) => (
                          <div key={`${reading.ref}-${v.c}-${v.v}`} style={previewLine}>
                            <b style={verseNum}>{v.v}</b>
                            <span>{v.t}</span>
                          </div>
                        ))}
                        <div style={previewHint}></div>
                      </div>
                    ) : (
                      <pre style={textBox}>{reading.text}</pre>
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      wide
                      onClick={() => nav(`/bible?${new URLSearchParams({ ref: reading.raw }).toString()}`)}
                    >
                      이 본문만 따로 보기
                    </Button>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={skeletonStack}>
      <div style={{ ...skeletonBlock, height: 220 }} />
      <div style={{ ...skeletonBlock, height: 132 }} />
      <div style={{ ...skeletonBlock, height: 120 }} />
      <div style={{ ...skeletonBlock, height: 180 }} />
      <style>
        {`
          @keyframes mcheyneShimmer {
            0% { background-position: 0% 0; }
            100% { background-position: 200% 0; }
          }
        `}
      </style>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card pad style={errorCard}>
      <div style={errorTitle}>불러오기 오류</div>
      <div style={errorText}>{message}</div>
      <div style={{ marginTop: 12 }}>
        <Button type="button" variant="secondary" size="md" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    </Card>
  );
}

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: 18, height: 18 }}
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

const emptyNote: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(247,250,251,0.72)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#6d7a83',
  fontSize: 14,
  lineHeight: 1.55
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

const navActions: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 18
};

const heroActions: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 10
};

const progressCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 10px 24px rgba(77,90,110,0.075)'
};

const planCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 10px 24px rgba(77,90,110,0.075)'
};

const sectionHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 12
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

const summaryText: CSSProperties = {
  color: '#66737b',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.45
};

const summaryDot: CSSProperties = {
  margin: '0 6px'
};

const sectionHint: CSSProperties = {
  marginTop: 10,
  color: '#7a8790',
  fontSize: 12,
  lineHeight: 1.5
};

const planList: CSSProperties = {
  display: 'grid',
  gap: 10
};

const planItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(247,250,251,0.72)',
  border: '1px solid rgba(224,231,236,0.9)'
};

const planIndex: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(114,215,199,0.12)',
  color: '#2b7f72',
  fontSize: 12,
  fontWeight: 800,
  flex: '0 0 auto'
};

const planText: CSSProperties = {
  color: '#33424b',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.45
};

const cardsStack: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12
};

const readingCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 10px 24px rgba(77,90,110,0.075)'
};

const readingHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const readingRef: CSSProperties = {
  color: '#24313a',
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: 1.2
};

const readingRaw: CSSProperties = {
  marginTop: 6,
  color: '#6c7880',
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.5
};

const checkPill: CSSProperties = {
  marginTop: 12,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.52)',
  background: 'rgba(255,255,255,0.42)',
  color: '#33424b',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer'
};

const checkPillOn: CSSProperties = {
  background: 'rgba(128,221,206,0.22)',
  borderColor: 'rgba(114,215,199,0.36)',
  color: '#2b7f72'
};

const previewBox: CSSProperties = {
  marginTop: 14,
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(247,250,251,0.74)',
  border: '1px solid rgba(224,231,236,0.86)'
};

const previewLine: CSSProperties = {
  display: 'flex',
  gap: 8,
  color: '#33424b',
  fontSize: 14,
  lineHeight: 1.6,
  marginBottom: 6
};

const verseNum: CSSProperties = {
  minWidth: 18,
  color: '#2b7f72'
};

const previewHint: CSSProperties = {
  marginTop: 8,
  color: '#7b8790',
  fontSize: 12,
  fontWeight: 700
};

const textBox: CSSProperties = {
  marginTop: 14,
  padding: '16px 16px',
  borderRadius: 18,
  background: 'rgba(247,250,251,0.74)',
  border: '1px solid rgba(224,231,236,0.86)',
  color: '#33424b',
  fontSize: 14,
  lineHeight: 1.75,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'inherit'
};

const skeletonStack: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12
};

const skeletonBlock: CSSProperties = {
  borderRadius: 22,
  background: 'linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.025), rgba(0,0,0,0.06))',
  backgroundSize: '200% 100%',
  animation: 'mcheyneShimmer 1.2s infinite linear'
};

const errorCard: CSSProperties = {
  marginBottom: 14,
  borderRadius: 22,
  background: 'rgba(255,245,245,0.72)',
  border: '1px solid rgba(235,138,127,0.32)',
  boxShadow: '0 10px 24px rgba(185,85,85,0.08)'
};

const errorTitle: CSSProperties = {
  color: '#9d4343',
  fontSize: 15,
  fontWeight: 800
};

const errorText: CSSProperties = {
  marginTop: 6,
  color: 'rgba(80, 45, 45, 0.82)',
  fontSize: 13,
  lineHeight: 1.5
};

const emptyCard: CSSProperties = {
  borderRadius: 24,
  textAlign: 'center',
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const emptyTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const emptyDesc: CSSProperties = {
  marginTop: 8,
  color: '#69767e',
  fontSize: 14,
  lineHeight: 1.55
};
