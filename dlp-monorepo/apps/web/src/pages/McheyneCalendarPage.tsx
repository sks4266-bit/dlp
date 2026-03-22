import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

type PlanDay = {
  month: number;
  day: number;
  reading1: string;
  reading2: string;
  reading3: string;
  reading4: string;
};

type MonthPlanPayload = {
  month: number;
  days: PlanDay[];
};

type MonthProgressItem = {
  day: number;
  done1: number;
  done2: number;
  done3: number;
  done4: number;
  doneCount: number;
};

type MonthProgressPayload = {
  month: number;
  items: MonthProgressItem[];
};

type DayPatch = Partial<{
  done1: number;
  done2: number;
  done3: number;
  done4: number;
}>;

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function Toast({ msg, kind }: { msg: string; kind: 'ok' | 'warn' }) {
  return (
    <div style={toastWrap}>
      <div
        style={{
          ...toastBox,
          ...(kind === 'ok' ? toastOk : toastWarn)
        }}
      >
        {msg}
      </div>
    </div>
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

        <div style={{ height: 10 }} />

        <Button type="button" variant="secondary" size="lg" wide onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}

function Dots({ done }: { done: number }) {
  return (
    <div style={dotsWrap} aria-label={`완료 ${done}/4`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          style={{
            ...dot,
            ...(i < done ? dotOn : null)
          }}
        />
      ))}
    </div>
  );
}

export default function McheyneCalendarPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { me, loading: authLoading } = useAuth();

  const today = useMemo(() => {
    const now = kstNow();
    return { month: now.getUTCMonth() + 1, day: now.getUTCDate() };
  }, []);

  const [month, setMonth] = useState(() => today.month);
  const [plan, setPlan] = useState<MonthPlanPayload | null>(null);
  const [prog, setProg] = useState<MonthProgressPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDay, setSheetDay] = useState<number | null>(null);

  const [toast, setToast] = useState<null | { msg: string; kind: 'ok' | 'warn' }>(null);
  const toastTimerRef = useRef<number | null>(null);
  const pendingOpenDayRef = useRef<number | null>(null);

  const isAuthed = !!me;

  const daysInMonth = useMemo(() => {
    const y = kstNow().getUTCFullYear();
    return new Date(Date.UTC(y, month, 0)).getUTCDate();
  }, [month]);

  const firstDow = useMemo(() => {
    const y = kstNow().getUTCFullYear();
    const d = new Date(Date.UTC(y, month - 1, 1));
    return d.getUTCDay();
  }, [month]);

  const progMap = useMemo(() => {
    const m = new Map<number, number>();
    (prog?.items ?? []).forEach((it) => m.set(it.day, it.doneCount));
    return m;
  }, [prog]);

  const progRowMap = useMemo(() => {
    const m = new Map<number, MonthProgressItem>();
    (prog?.items ?? []).forEach((it) => m.set(it.day, it));
    return m;
  }, [prog]);

  const planMap = useMemo(() => {
    const m = new Map<number, PlanDay>();
    (plan?.days ?? []).forEach((d) => m.set(d.day, d));
    return m;
  }, [plan]);

  const totalPlanReadings = (plan?.days?.length ?? 0) * 4;
  const completedReadings = useMemo(
    () => (prog?.items ?? []).reduce((sum, item) => sum + (item.doneCount ?? 0), 0),
    [prog]
  );
  const completedDays = useMemo(
    () => (prog?.items ?? []).filter((item) => (item.doneCount ?? 0) >= 4).length,
    [prog]
  );

  const monthPercent = totalPlanReadings > 0 ? Math.round((completedReadings / totalPlanReadings) * 100) : 0;

  const selPlan = sheetDay ? planMap.get(sheetDay) : null;
  const selDone = sheetDay ? progMap.get(sheetDay) ?? 0 : 0;
  const selRow = sheetDay ? progRowMap.get(sheetDay) : null;

  function showToast(msg: string, kind: 'ok' | 'warn' = 'ok', ms = 1400) {
    setToast({ msg, kind });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), ms);
  }

  async function readErrorMessage(res: Response) {
    const contentType = res.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        const j = await res.json();
        return j?.message || j?.error || `HTTP ${res.status}`;
      }

      const text = await res.text();
      return text?.slice(0, 200) || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  function goLogin(next = `${loc.pathname}${loc.search}`) {
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  function modMonth(m: number) {
    return ((m - 1 + 12) % 12) + 1;
  }

  function goPrevMonth() {
    setMonth((m) => modMonth(m - 1));
    setSheetOpen(false);
  }

  function goNextMonth() {
    setMonth((m) => modMonth(m + 1));
    setSheetOpen(false);
  }

  function goToday(openSheet = true) {
    if (today.month === month) {
      if (openSheet) {
        setSheetDay(today.day);
        setSheetOpen(true);
      }
      return;
    }

    if (openSheet) pendingOpenDayRef.current = today.day;
    setMonth(today.month);
  }

  function buildReadingNext(m: number, d: number) {
    return `/mcheyne-today?${new URLSearchParams({ month: String(m), day: String(d) }).toString()}`;
  }

  function openDayReading(m: number, d: number) {
    const next = buildReadingNext(m, d);

    if (authLoading) return;

    if (!isAuthed) {
      goLogin(next);
      return;
    }

    nav(next);
  }

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const planRes = await apiFetch(`/api/mcheyne/month?month=${month}`);
      if (!planRes.ok) {
        throw new Error(await readErrorMessage(planRes));
      }
      const planJson = (await planRes.json()) as MonthPlanPayload;
      setPlan(planJson);

      if (pendingOpenDayRef.current && pendingOpenDayRef.current >= 1) {
        const d = pendingOpenDayRef.current;
        pendingOpenDayRef.current = null;
        setSheetDay(d);
        setSheetOpen(true);
      }

      const progRes = await apiFetch(`/api/mcheyne/progress/month?month=${month}`);

      if (progRes.status === 401) {
        setProg(null);
      } else if (!progRes.ok) {
        throw new Error(await readErrorMessage(progRes));
      } else {
        const progJson = (await progRes.json()) as MonthProgressPayload;
        setProg(progJson);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function setDayDone(day: number, patch: DayPatch): Promise<boolean> {
    if (authLoading) return false;
    if (!isAuthed) return false;

    const prevProgSnapshot = prog;

    setProg((prev) => {
      if (!prev) return prev;

      const nextItems = [...(prev.items ?? [])];
      const idx = nextItems.findIndex((x) => x.day === day);

      const base: MonthProgressItem =
        idx >= 0
          ? nextItems[idx]
          : { day, done1: 0, done2: 0, done3: 0, done4: 0, doneCount: 0 };

      const nextRow: MonthProgressItem = {
        ...base,
        ...(patch.done1 !== undefined ? { done1: patch.done1 ? 1 : 0 } : {}),
        ...(patch.done2 !== undefined ? { done2: patch.done2 ? 1 : 0 } : {}),
        ...(patch.done3 !== undefined ? { done3: patch.done3 ? 1 : 0 } : {}),
        ...(patch.done4 !== undefined ? { done4: patch.done4 ? 1 : 0 } : {}),
        doneCount: 0
      };

      nextRow.doneCount =
        (nextRow.done1 ?? 0) +
        (nextRow.done2 ?? 0) +
        (nextRow.done3 ?? 0) +
        (nextRow.done4 ?? 0);

      if (idx >= 0) nextItems[idx] = nextRow;
      else nextItems.push(nextRow);

      nextItems.sort((a, b) => a.day - b.day);

      return { ...prev, items: nextItems };
    });

    setSaving(true);

    try {
      const next = buildReadingNext(month, day);
      const url = `/api/mcheyne/progress/day?${new URLSearchParams({
        month: String(month),
        day: String(day)
      }).toString()}`;

      const res = await apiFetch(url, {
        method: 'PUT',
        body: JSON.stringify(patch)
      });

      if (res.status === 401) {
        if (prevProgSnapshot) setProg(prevProgSnapshot);
        goLogin(next);
        return false;
      }

      if (!res.ok) {
        const msg = await readErrorMessage(res);
        if (prevProgSnapshot) setProg(prevProgSnapshot);
        showToast(`저장 실패: ${msg}`, 'warn', 1800);
        return false;
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const j = await res.json().catch(() => null);
        const t = j?.today as
          | { day: number; done1: number; done2: number; done3: number; done4: number }
          | undefined;

        if (t) {
          const doneCount = (t.done1 ?? 0) + (t.done2 ?? 0) + (t.done3 ?? 0) + (t.done4 ?? 0);

          setProg((prev) => {
            if (!prev) return prev;

            const nextItems = [...(prev.items ?? [])];
            const idx = nextItems.findIndex((x) => x.day === day);

            const nextRow: MonthProgressItem = {
              day,
              done1: t.done1 ?? 0,
              done2: t.done2 ?? 0,
              done3: t.done3 ?? 0,
              done4: t.done4 ?? 0,
              doneCount
            };

            if (idx >= 0) nextItems[idx] = nextRow;
            else nextItems.push(nextRow);

            nextItems.sort((a, b) => a.day - b.day);
            return { ...prev, items: nextItems };
          });
        }
      }

      return true;
    } catch (e: any) {
      if (prevProgSnapshot) setProg(prevProgSnapshot);
      showToast(`저장 실패: ${String(e?.message ?? e)}`, 'warn', 1800);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function bulkCompleteDay(day: number) {
    if (authLoading) return;
    if (!isAuthed) return;

    const ok = await setDayDone(day, { done1: 1, done2: 1, done3: 1, done4: 1 });

    if (ok) {
      setSheetOpen(false);
      showToast('일괄 완료했어요', 'ok');
    }
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="맥체인 캘린더" backTo="/mcheyne-today" />

        {toast ? <Toast msg={toast.msg} kind={toast.kind} /> : null}
        {error ? <ErrorBox message={error} onRetry={load} /> : null}

        {loading ? (
          <Skeleton />
        ) : (
          <>
            <Card pad style={heroCard}>
              <div style={heroTop}>
                <div style={heroCopy}>
                  <div style={badgeMint}>MCHEYNE CALENDAR</div>
                  <CardTitle style={heroTitle}>{month}월 읽기표</CardTitle>
                  <CardDesc style={heroDesc}>
                    월별 읽기표와 진행 상태를 한눈에 볼 수 있어요. 로그인하면 각 날짜별 체크와 일괄 완료를 바로 저장할 수 있습니다.
                  </CardDesc>
                </div>

                <div style={progressBlock}>
                  <div
                    style={{
                      ...progressRing,
                      background: `conic-gradient(#72d7c7 ${monthPercent}%, rgba(114,215,199,0.18) 0%)`
                    }}
                  >
                    <div style={progressRingInner}>
                      <div style={progressMain}>{monthPercent}%</div>
                      <div style={progressLabel}>월 진행</div>
                    </div>
                  </div>

                  <div style={progressSub}>
                    {prog ? `완료일 ${completedDays}/${plan?.days.length ?? 0}` : '로그인 후 진행률 표시'}
                  </div>
                </div>
              </div>

              <div style={toolbarRow}>
                <Button type="button" variant="ghost" size="md" onClick={goPrevMonth}>
                  ←
                </Button>

                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  style={monthSelect}
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}월
                    </option>
                  ))}
                </select>

                <Button type="button" variant="ghost" size="md" onClick={goNextMonth}>
                  →
                </Button>

                <Button type="button" variant="secondary" size="md" onClick={() => goToday(true)}>
                  오늘
                </Button>
              </div>
            </Card>

            <div style={{ height: 14 }} />

            <Card pad style={calendarCard}>
              <div style={weekHeader}>
                {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                  <div key={d} style={weekHeaderCell}>
                    {d}
                  </div>
                ))}
              </div>

              <div style={monthGrid}>
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const done = prog ? progMap.get(day) ?? 0 : 0;
                  const hasPlan = planMap.has(day);
                  const isTodayCell = month === today.month && day === today.day;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setSheetDay(day);
                        setSheetOpen(true);
                      }}
                      style={{
                        ...dayCard,
                        ...(!hasPlan ? dayCardDim : {}),
                        ...(isTodayCell ? dayCardToday : {})
                      }}
                    >
                      <div style={dayTop}>
                        <span style={dayNum}>{day}</span>
                        {isTodayCell ? <span style={todayChip}>오늘</span> : null}
                      </div>

                      {prog ? (
                        <Dots done={done} />
                      ) : (
                        <div style={loginHintMini}>로그인 후 진행률</div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={calendarMeta}>
                {prog
                  ? '도트는 해당 날짜의 완료 개수(0~4)를 의미합니다.'
                  : '로그인하면 날짜별 체크와 진행률을 사용할 수 있어요.'}
              </div>
            </Card>
          </>
        )}

        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          {sheetDay ? (
            <div>
              <div style={sheetHead}>
                <div>
                  <div style={sheetTitle}>
                    {month}월 {sheetDay}일
                  </div>
                  <div style={sheetMeta}>완료 {selDone}/4</div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => openDayReading(month, sheetDay)}
                >
                  이 날 본문 읽기
                </Button>
              </div>

              <div style={{ height: 12 }} />

              {selPlan ? (
                <>
                  <Card pad style={sheetCard}>
                    <div style={sectionEyebrow}>READING PLAN</div>
                    <div style={sectionHeading}>오늘 읽을 본문</div>

                    <div style={{ height: 10 }} />

                    <div style={planList}>
                      {[selPlan.reading1, selPlan.reading2, selPlan.reading3, selPlan.reading4].map((raw, idx) => (
                        <div key={`${raw}-${idx}`} style={planItem}>
                          <span style={planIndex}>{idx + 1}</span>
                          <span style={planText}>{raw}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <div style={{ height: 12 }} />

                  <Card pad style={sheetCard}>
                    <div style={sectionEyebrow}>QUICK OPEN</div>
                    <div style={sectionHeading}>본문 바로 열기</div>
                    <div style={sectionHint}>각 본문을 성경 화면으로 바로 이동합니다.</div>

                    <div style={{ height: 10 }} />

                    <div style={sheetButtonStack}>
                      {[selPlan.reading1, selPlan.reading2, selPlan.reading3, selPlan.reading4].map((raw, idx) => (
                        <Button
                          key={`${idx}-${raw}`}
                          type="button"
                          variant="ghost"
                          size="md"
                          wide
                          onClick={() => {
                            const qs = new URLSearchParams({ ref: raw }).toString();
                            nav(`/bible?${qs}`);
                          }}
                        >
                          {idx + 1}번 바로 열기 · {raw}
                        </Button>
                      ))}
                    </div>

                    <div style={{ height: 10 }} />

                    {isAuthed ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        wide
                        disabled={saving}
                        onClick={() => bulkCompleteDay(sheetDay)}
                      >
                        {saving ? '저장 중…' : '일괄 완료 (4개 모두 읽음)'}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        wide
                        onClick={() => goLogin(buildReadingNext(month, sheetDay))}
                      >
                        일괄 완료 (로그인 필요)
                      </Button>
                    )}
                  </Card>

                  <div style={{ height: 12 }} />

                  {isAuthed ? (
                    <Card pad style={sheetCard}>
                      <div style={sectionEyebrow}>CHECK</div>
                      <div style={sectionHeading}>읽음 체크</div>
                      <div style={sectionHint}>체크는 즉시 저장되며 실패 시 자동으로 되돌립니다.</div>

                      <div style={{ height: 10 }} />

                      <div style={checkPillWrap}>
                        {([1, 2, 3, 4] as const).map((i) => {
                          const key =
                            (i === 1 ? 'done1' : i === 2 ? 'done2' : i === 3 ? 'done3' : 'done4') as
                              | 'done1'
                              | 'done2'
                              | 'done3'
                              | 'done4';

                          const checked = selRow ? !!selRow[key] : false;

                          return (
                            <label
                              key={i}
                              style={{
                                ...checkPill,
                                ...(checked ? checkPillOn : {})
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={saving}
                                onChange={(e) =>
                                  setDayDone(sheetDay, { [key]: e.target.checked ? 1 : 0 } as DayPatch)
                                }
                              />
                              <span>{i}번</span>
                            </label>
                          );
                        })}
                      </div>
                    </Card>
                  ) : (
                    <Card pad style={sheetCard}>
                      <div style={sectionEyebrow}>CHECK</div>
                      <div style={sectionHeading}>읽음 체크</div>
                      <div style={sectionHint}>체크와 진행률은 로그인 후 사용할 수 있습니다.</div>

                      <div style={{ height: 10 }} />

                      <div style={checkPillWrap}>
                        {([1, 2, 3, 4] as const).map((i) => (
                          <button
                            key={i}
                            type="button"
                            style={checkPillGhost}
                            onClick={() => goLogin(buildReadingNext(month, sheetDay))}
                          >
                            {i}번
                          </button>
                        ))}
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <div style={emptyNote}>읽기표 데이터가 없습니다.</div>
              )}

              <div style={{ height: 12 }} />

              <Button type="button" variant="ghost" size="lg" wide onClick={() => nav('/mcheyne-today')}>
                오늘 페이지로 돌아가기
              </Button>
            </div>
          ) : null}
        </BottomSheet>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={skeletonStack}>
      <div style={{ ...skeletonBlock, height: 220 }} />
      <div style={{ ...skeletonBlock, height: 360 }} />
      <style>
        {`
          @keyframes mcheyneCalendarShimmer {
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
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
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
  fontSize: 24,
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

const toolbarRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 18
};

const monthSelect: CSSProperties = {
  flex: 1,
  minWidth: 110,
  minHeight: 42,
  padding: '0 12px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.52)',
  background: 'rgba(255,255,255,0.52)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
  color: '#33424b',
  fontSize: 14,
  fontWeight: 700
};

const calendarCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 10px 24px rgba(77,90,110,0.075)'
};

const weekHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 6
};

const weekHeaderCell: CSSProperties = {
  color: '#637079',
  fontSize: 12,
  fontWeight: 800,
  textAlign: 'center'
};

const monthGrid: CSSProperties = {
  marginTop: 10,
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8
};

const dayCard: CSSProperties = {
  minHeight: 82,
  padding: '10px 8px',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.52)',
  background: 'rgba(255,255,255,0.42)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.38)',
  cursor: 'pointer',
  textAlign: 'left'
};

const dayCardDim: CSSProperties = {
  opacity: 0.65
};

const dayCardToday: CSSProperties = {
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42), 0 10px 22px rgba(77,189,170,0.12)',
  borderColor: 'rgba(114,215,199,0.38)'
};

const dayTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 4
};

const dayNum: CSSProperties = {
  color: '#223038',
  fontSize: 14,
  fontWeight: 800
};

const todayChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 20,
  padding: '0 7px',
  borderRadius: 999,
  background: 'rgba(128,221,206,0.24)',
  color: '#4dbdaa',
  fontSize: 10,
  fontWeight: 800
};

const dotsWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginTop: 14
};

const dot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: 'rgba(114,215,199,0.18)'
};

const dotOn: CSSProperties = {
  background: '#72d7c7',
  boxShadow: '0 0 0 3px rgba(114,215,199,0.14)'
};

const loginHintMini: CSSProperties = {
  marginTop: 14,
  color: '#8d989f',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.3
};

const calendarMeta: CSSProperties = {
  marginTop: 10,
  color: '#637079',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.45
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

const sheetHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const sheetTitle: CSSProperties = {
  color: '#223038',
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '-0.03em'
};

const sheetMeta: CSSProperties = {
  marginTop: 6,
  color: '#637079',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.45
};

const sheetCard: CSSProperties = {
  borderRadius: 20,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 10px 24px rgba(77,90,110,0.06)'
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

const sectionHint: CSSProperties = {
  marginTop: 6,
  color: '#637079',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.45
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

const sheetButtonStack: CSSProperties = {
  display: 'grid',
  gap: 10
};

const checkPillWrap: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap'
};

const checkPill: CSSProperties = {
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
  color: '#4dbdaa'
};

const checkPillGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
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

const toastWrap: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 24,
  transform: 'translateX(-50%)',
  zIndex: 1200,
  width: 'calc(100% - 32px)',
  maxWidth: 430
};

const toastBox: CSSProperties = {
  minHeight: 44,
  borderRadius: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 14px',
  fontSize: 13,
  fontWeight: 800,
  boxShadow: '0 12px 28px rgba(77,90,110,0.14)',
  backdropFilter: 'blur(12px)'
};

const toastOk: CSSProperties = {
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(114,215,199,0.28)',
  color: '#2b7f72'
};

const toastWarn: CSSProperties = {
  background: 'rgba(255,245,245,0.88)',
  border: '1px solid rgba(235,138,127,0.28)',
  color: '#9d4343'
};

const emptyNote: CSSProperties = {
  padding: '16px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.42)',
  border: '1px dashed rgba(255,255,255,0.55)',
  color: '#637079',
  fontSize: 14,
  textAlign: 'center'
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
  animation: 'mcheyneCalendarShimmer 1.2s infinite linear'
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
  color: 'rgba(80,45,45,0.82)',
  fontSize: 13,
  lineHeight: 1.5
};
