import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

type PlanDay = { month: number; day: number; reading1: string; reading2: string; reading3: string; reading4: string };
type MonthPlanPayload = { month: number; days: PlanDay[] };
type MonthProgressPayload = {
  month: number;
  items: { day: number; done1: number; done2: number; done3: number; done4: number; doneCount: number }[];
};

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function Toast({ msg, kind }: { msg: string; kind: 'ok' | 'warn' }) {
  return (
    <div className="uiToastWrap">
      <div className={['uiToast', kind === 'ok' ? 'uiToastOk' : 'uiToastWarn'].join(' ')}>{msg}</div>
    </div>
  );
}

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: any }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="uiSheetBackdrop">
      <div onClick={(e) => e.stopPropagation()} className="uiSheet">
        <div className="uiSheetHandleWrap">
          <div className="uiSheetHandle" />
        </div>
        {children}
        <div className="stack10" />
        <Button variant="secondary" wide onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}

function Dots({ done }: { done: number }) {
  return (
    <div className="calendarDots" aria-label={`완료 ${done}/4`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} className={['calendarDot', i < done ? 'calendarDotOn' : ''].filter(Boolean).join(' ')} />
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
  const [error, setError] = useState<string | null>(null);

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
    const m = new Map<number, { day: number; done1: number; done2: number; done3: number; done4: number; doneCount: number }>();
    (prog?.items ?? []).forEach((it) => m.set(it.day, it));
    return m;
  }, [prog]);

  const planMap = useMemo(() => {
    const m = new Map<number, PlanDay>();
    (plan?.days ?? []).forEach((d) => m.set(d.day, d));
    return m;
  }, [plan]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDay, setSheetDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<null | { msg: string; kind: 'ok' | 'warn' }>(null);
  const toastTimerRef = useRef<any>(null);
  const pendingOpenDayRef = useRef<number | null>(null);

  const isAuthed = !!me;

  function showToast(msg: string, kind: 'ok' | 'warn' = 'ok', ms = 1400) {
    setToast({ msg, kind });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }

  async function readErrorMessage(res: Response) {
    const contentType = res.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        const j = await res.json();
        return j?.message || j?.error || `HTTP ${res.status}`;
      }

      const text = await res.text();
      if (text) return text.slice(0, 200);
      return `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
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
    setError(null);

    try {
      const a = await apiFetch(`/api/mcheyne/month?month=${month}`);
      if (!a.ok) {
        const msg = await readErrorMessage(a);
        throw new Error(msg || 'PLAN_LOAD_FAILED');
      }
      setPlan(await a.json());

      if (pendingOpenDayRef.current && pendingOpenDayRef.current >= 1) {
        const d = pendingOpenDayRef.current;
        pendingOpenDayRef.current = null;
        setSheetDay(d);
        setSheetOpen(true);
      }

      const b = await apiFetch(`/api/mcheyne/progress/month?month=${month}`);
      if (b.status === 401) {
        setProg(null);
        return;
      }

      if (!b.ok) {
        const msg = await readErrorMessage(b);
        throw new Error(msg || 'PROGRESS_LOAD_FAILED');
      }

      setProg(await b.json());
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const selPlan = sheetDay ? planMap.get(sheetDay) : null;
  const selDone = sheetDay ? (progMap.get(sheetDay) ?? 0) : 0;
  const selRow = sheetDay ? progRowMap.get(sheetDay) : null;

  async function setDayDone(
    day: number,
    patch: Partial<{ done1: number; done2: number; done3: number; done4: number }>
  ): Promise<boolean> {
    if (authLoading) return false;
    if (!isAuthed) return false;

    const prevProgSnapshot = prog;

    setProg((prev) => {
      if (!prev) return prev;

      const nextItems = (prev.items ?? []).slice();
      const idx = nextItems.findIndex((x) => x.day === day);

      const base =
        idx >= 0
          ? nextItems[idx]
          : { day, done1: 0, done2: 0, done3: 0, done4: 0, doneCount: 0 };

      const nextRow = {
        ...base,
        ...(patch.done1 !== undefined ? { done1: patch.done1 ? 1 : 0 } : {}),
        ...(patch.done2 !== undefined ? { done2: patch.done2 ? 1 : 0 } : {}),
        ...(patch.done3 !== undefined ? { done3: patch.done3 ? 1 : 0 } : {}),
        ...(patch.done4 !== undefined ? { done4: patch.done4 ? 1 : 0 } : {})
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
          const doneCount =
            (t.done1 ?? 0) + (t.done2 ?? 0) + (t.done3 ?? 0) + (t.done4 ?? 0);

          setProg((prev) => {
            if (!prev) return prev;

            const nextItems = (prev.items ?? []).slice();
            const idx = nextItems.findIndex((x) => x.day === day);

            const nextRow = {
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
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="맥체인 캘린더" backTo="/mcheyne-today" />

        {toast ? <Toast msg={toast.msg} kind={toast.kind} /> : null}
        {error ? <div className="uiErrorBox">오류: {error}</div> : null}

        <Card className="glassHeroCard">
          <div className="sectionHeadRow">
            <div>
              <CardTitle>{month}월 읽기표</CardTitle>
              <CardDesc>도트는 완료 개수(0~4), 로그인 시 진행률이 함께 표시됩니다.</CardDesc>
            </div>

            <div className="toolbarRow">
              <Button variant="ghost" onClick={goPrevMonth}>←</Button>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="glassInput glassInputSelect">
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}월
                  </option>
                ))}
              </select>
              <Button variant="ghost" onClick={goNextMonth}>→</Button>
              <Button variant="secondary" onClick={() => goToday(true)}>오늘</Button>
            </div>
          </div>
        </Card>

        <div className="stack12" />

        <Card>
          <div className="miniWeekHeader">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="mcheyneMonthGrid">
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const done = prog ? (progMap.get(day) ?? 0) : 0;
              const hasPlan = planMap.has(day);
              const isTodayCell = month === today.month && day === today.day;

              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    'mcheyneDayCard',
                    !hasPlan ? 'mcheyneDayCardDim' : '',
                    isTodayCell ? 'mcheyneDayCardToday' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    setSheetDay(day);
                    setSheetOpen(true);
                  }}
                >
                  <div className="mcheyneDayTop">
                    <span>{day}</span>
                    {isTodayCell ? <span className="mcheyneTodayChip">오늘</span> : null}
                  </div>

                  {prog ? <Dots done={done} /> : <div className="mcheyneNeedLoginText">로그인 후 진행률</div>}
                </button>
              );
            })}
          </div>

          <div className="stack10" />
          <div className="sectionMiniMeta">
            {prog ? `이번 달 진행률이 색과 도트로 표시됩니다.` : `로그인하면 체크와 진행률 표시를 사용할 수 있어요.`}
          </div>
        </Card>

        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          {sheetDay ? (
            <div>
              <div className="sectionHeadRow">
                <div>
                  <div className="sheetTitle">{month}월 {sheetDay}일</div>
                  <div className="sectionMiniMeta">완료: {selDone}/4</div>
                </div>

                <Button variant="secondary" onClick={() => openDayReading(month, sheetDay)}>
                  이 날 본문 읽기
                </Button>
              </div>

              <div className="stack12" />

              {selPlan ? (
                <>
                  <Card>
                    <CardTitle>오늘 읽을 본문</CardTitle>
                    <div className="stack8" />
                    <ul className="sheetReadingList">
                      <li>{selPlan.reading1}</li>
                      <li>{selPlan.reading2}</li>
                      <li>{selPlan.reading3}</li>
                      <li>{selPlan.reading4}</li>
                    </ul>
                  </Card>

                  <div className="stack12" />

                  <Card>
                    <CardTitle>본문 바로 열기</CardTitle>
                    <CardDesc>각 본문을 성경 화면으로 바로 이동합니다.</CardDesc>

                    <div className="stack10" />

                    <div className="glassList">
                      {[selPlan.reading1, selPlan.reading2, selPlan.reading3, selPlan.reading4].map((raw, idx) => (
                        <Button
                          key={idx}
                          variant="ghost"
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

                    <div className="stack10" />

                    {isAuthed ? (
                      <Button
                        variant="primary"
                        wide
                        disabled={saving}
                        onClick={() => bulkCompleteDay(sheetDay)}
                      >
                        {saving ? '저장 중…' : '일괄 완료 (4개 모두 읽음)'}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        wide
                        onClick={() => goLogin(buildReadingNext(month, sheetDay))}
                      >
                        일괄 완료 (로그인 필요)
                      </Button>
                    )}
                  </Card>

                  <div className="stack12" />

                  {isAuthed ? (
                    <Card>
                      <CardTitle>체크</CardTitle>
                      <CardDesc>체크는 즉시 저장되며 오류 시 자동으로 되돌립니다.</CardDesc>

                      <div className="stack10" />

                      <div className="checkPillWrap">
                        {([1, 2, 3, 4] as const).map((i) => {
                          const k =
                            (i === 1 ? 'done1' : i === 2 ? 'done2' : i === 3 ? 'done3' : 'done4') as
                              | 'done1'
                              | 'done2'
                              | 'done3'
                              | 'done4';

                          const checked = (selRow as any)?.[k] ? true : false;

                          return (
                            <label key={i} className={['checkPill', checked ? 'checkPillOn' : ''].join(' ')}>
                              <input
                                type="checkbox"
                                disabled={saving}
                                checked={checked}
                                onChange={(e) => setDayDone(sheetDay, { [k]: e.target.checked ? 1 : 0 } as any)}
                              />
                              <span>{i}번</span>
                            </label>
                          );
                        })}
                      </div>
                    </Card>
                  ) : (
                    <Card>
                      <CardTitle>체크</CardTitle>
                      <CardDesc>체크와 진행률은 로그인 후 사용할 수 있습니다.</CardDesc>

                      <div className="stack10" />

                      <div className="checkPillWrap">
                        {([1, 2, 3, 4] as const).map((i) => (
                          <button
                            key={i}
                            type="button"
                            className="checkPill checkPillGhost"
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
                <div className="glassEmpty">읽기표 데이터가 없습니다.</div>
              )}

              <div className="stack12" />
              <Button variant="ghost" wide onClick={() => nav('/mcheyne-today')}>
                오늘 페이지로 돌아가기
              </Button>
            </div>
          ) : null}
        </BottomSheet>
      </div>
    </div>
  );
}
