import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';

type PlanDay = { month: number; day: number; reading1: string; reading2: string; reading3: string; reading4: string };

type MonthPlanPayload = { month: number; days: PlanDay[] };

type MonthProgressPayload = {
  month: number;
  items: { day: number; done1: number; done2: number; done3: number; done4: number; doneCount: number }[];
};

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

export default function McheyneCalendarPage() {
  const nav = useNavigate();

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

  const [flashAt, setFlashAt] = useState(0);
  const flashTimerRef = useRef<any>(null);

  const [pulseDay, setPulseDay] = useState<number | null>(null);
  const pulseTimerRef = useRef<any>(null);

  const isAuthed = prog !== null;

  const pendingOpenDayRef = useRef<number | null>(null);

  function modMonth(m: number) {
    // 1..12
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

  function openDayReading(m: number, d: number) {
    const next = `/mcheyne-today?${new URLSearchParams({ month: String(m), day: String(d) }).toString()}`;
    if (!isAuthed) {
      showToast('이 기능은 로그인 후 사용할 수 있어요', 'warn');
      // 토스트가 보이도록 아주 짧게 지연 후 이동
      setTimeout(() => {
        nav(`/login?${new URLSearchParams({ next }).toString()}`);
      }, 150);
      return;
    }
    nav(next);
  }

  async function load() {
    setError(null);
    try {
      const a = await apiFetch(`/api/mcheyne/month?month=${month}`);
      const aj = await a.json();
      if (!a.ok) throw new Error(aj?.message || aj?.error || 'PLAN_LOAD_FAILED');
      setPlan(aj);
      if (pendingOpenDayRef.current && pendingOpenDayRef.current >= 1) {
        const d = pendingOpenDayRef.current;
        pendingOpenDayRef.current = null;
        setSheetDay(d);
        setSheetOpen(true);
      }

      const b = await apiFetch(`/api/mcheyne/progress/month?month=${month}`);
      if (b.status === 401) {
        // progress requires login; plan can still be shown
        setProg(null);
        return;
      }
      const bj = await b.json();
      if (!b.ok) throw new Error(bj?.message || bj?.error || 'PROGRESS_LOAD_FAILED');
      setProg(bj);
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

  function showToast(msg: string, kind: 'ok' | 'warn' = 'ok', ms = 1400) {
    setToast({ msg, kind });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }

  function flashCheckboxes() {
    setFlashAt(Date.now());
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashAt(0), 650);
  }

  function pulseCell(day: number) {
    setPulseDay(day);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulseDay(null), 250);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  async function setDayDone(day: number, patch: Partial<{ done1: number; done2: number; done3: number; done4: number }>): Promise<boolean> {
    if (!isAuthed) return false;

    // optimistic update 실패 시 롤백용 스냅샷
    const prevProgSnapshot = prog;

    // optimistic update → 체크박스 즉시 반영
    setProg((prev) => {
      if (!prev) return prev;
      const nextItems = (prev.items ?? []).slice();
      const idx = nextItems.findIndex((x) => x.day === day);
      const base = (idx >= 0 ? nextItems[idx] : { day, done1: 0, done2: 0, done3: 0, done4: 0, doneCount: 0 }) as any;
      const nextRow = { ...base, ...patch } as any;
      nextRow.doneCount = (nextRow.done1 ?? 0) + (nextRow.done2 ?? 0) + (nextRow.done3 ?? 0) + (nextRow.done4 ?? 0);
      if (idx >= 0) nextItems[idx] = nextRow;
      else nextItems.push(nextRow);
      nextItems.sort((a, b) => a.day - b.day);
      return { ...prev, items: nextItems };
    });

    setSaving(true);
    try {
      const url = `/api/mcheyne/progress/day?${new URLSearchParams({ month: String(month), day: String(day) }).toString()}`;
      const res = await apiFetch(url, { method: 'PUT', body: JSON.stringify(patch) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || j?.error || 'SAVE_FAILED');

      const today = j?.today as any;
      const doneCount = (today?.done1 ?? 0) + (today?.done2 ?? 0) + (today?.done3 ?? 0) + (today?.done4 ?? 0);

      // server truth로 한 번 더 정렬/동기화
      setProg((prev) => {
        if (!prev) return prev;
        const nextItems = (prev.items ?? []).slice();
        const idx = nextItems.findIndex((x) => x.day === day);
        const nextRow = { day, done1: today.done1 ?? 0, done2: today.done2 ?? 0, done3: today.done3 ?? 0, done4: today.done4 ?? 0, doneCount };
        if (idx >= 0) nextItems[idx] = nextRow as any;
        else nextItems.push(nextRow as any);
        nextItems.sort((a, b) => a.day - b.day);
        return { ...prev, items: nextItems };
      });

      return true;
    } catch {
      // 실패 시 optimistic update 롤백
      if (prevProgSnapshot) setProg(prevProgSnapshot);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function bulkCompleteDay(day: number) {
    if (!isAuthed) return;

    flashCheckboxes();

    const ok = await setDayDone(day, { done1: 1, done2: 1, done3: 1, done4: 1 });
    if (ok) {
      // 성공 시: 바텀시트를 자동으로 닫고(캘린더로 복귀) 셀 색상은 prog optimistic update로 즉시 반영됨
      setSheetOpen(false);
      pulseCell(day);
      showToast('일괄 완료했어요', 'ok');
    } else {
      // 실패 시: 시트 유지(재시도 가능)
      showToast('저장 실패/다시 제한됨', 'warn');
    }
  }

  return (
    <div>
      <TopBar title="맥체인 캘린더" backTo="/mcheyne-today" />

      {toast ? (
        <div style={toastWrap}>
          <div style={{ ...toastBox, ...(toast.kind === 'ok' ? toastOk : toastWarn) }}>{toast.msg}</div>
        </div>
      ) : null}

      {error ? <div style={errorBox}>오류: {error}</div> : null}

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 950 }}>월 선택</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
              셀 색: 그날 4개 본문 중 완료 개수(로그인 시 표시)
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" style={tinyNavBtn} onClick={goPrevMonth} aria-label="이전 달">
              ←
            </button>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={select}>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}월
                </option>
              ))}
            </select>
            <button type="button" style={tinyNavBtn} onClick={goNextMonth} aria-label="다음 달">
              →
            </button>

            <button type="button" style={tinyNavBtn} onClick={() => goToday(true)}>
              오늘
            </button>
          </div>
        </div>
      </section>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={gridHeader}>
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <div key={d} style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)' }}>
              {d}
            </div>
          ))}
        </div>

        <div style={grid}>
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={'e' + i} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const done = prog ? (progMap.get(day) ?? 0) : null;
            const hasPlan = planMap.has(day);

            const bg = done === null ? 'var(--soft)' : done === 0 ? 'var(--soft)' : done === 4 ? 'var(--primary-bg)' : 'var(--mid)';
            const fg = done === 4 ? 'var(--primary-text)' : 'var(--text)';
            const isTodayCell = month === today.month && day === today.day;

            return (
              <div
                key={day}
                role="button"
                tabIndex={0}
                style={{
                  ...cell,
                  background: bg,
                  color: fg,
                  opacity: hasPlan ? 1 : 0.5,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
                  ...(pulseDay === day
                    ? {
                        transform: 'scale(1.015)',
                        boxShadow: '0 0 0 2px rgba(0, 200, 120, 0.14), 0 8px 14px rgba(0,0,0,0.08)',
                        borderColor: 'rgba(0, 200, 120, 0.22)'
                      }
                    : null),
                  ...(isTodayCell
                    ? {
                        border: '2px solid rgba(255, 230, 0, 0.55)',
                        boxShadow: '0 10px 18px rgba(255, 230, 0, 0.10)'
                      }
                    : null)
                }}
                onClick={() => {
                  setSheetDay(day);
                  setSheetOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSheetDay(day);
                    setSheetOpen(true);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{day}</span>
                  {isTodayCell ? <span style={todayPill}>오늘</span> : null}
                </div>

                {done !== null ? <div style={{ fontSize: 11, fontWeight: 900, marginTop: 2 }}>{done}/4</div> : null}

                {isTodayCell ? (
                  <button
                    type="button"
                    style={todayShortcutBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDayReading(month, day);
                    }}
                    aria-label="오늘 본문 바로가기"
                  >
                    바로가기
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        {sheetDay ? (
          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}> {month}월 {sheetDay}일</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>완료: {selDone}/4</div>

            <div style={{ height: 10 }} />

            {selPlan ? (
              <>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: 'var(--text)' }}>
                  <li>{selPlan.reading1}</li>
                  <li>{selPlan.reading2}</li>
                  <li>{selPlan.reading3}</li>
                  <li>{selPlan.reading4}</li>
                </ul>

                <div style={{ height: 12 }} />

                <div style={{ fontWeight: 950, fontSize: 13 }}>본문 바로 열기</div>
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                  {[selPlan.reading1, selPlan.reading2, selPlan.reading3, selPlan.reading4].map((raw, idx) => (
                    <button
                      key={idx}
                      type="button"
                      style={ghostBtnWide}
                      onClick={() => {
                        const qs = new URLSearchParams({ ref: raw }).toString();
                        nav(`/bible?${qs}`);
                      }}
                    >
                      {idx + 1}번 바로 열기 · {raw}
                    </button>
                  ))}
                </div>

                <div style={{ height: 10 }} />

                {isAuthed ? (
                  <button
                    type="button"
                    style={{ ...ghostBtnWide, opacity: saving ? 0.7 : 1 }}
                    disabled={saving}
                    onClick={() => bulkCompleteDay(sheetDay)}
                  >
                    {saving ? '저장 중…' : '일괄 완료 (4개 모두 읽음)'}
                  </button>
                ) : (
                  <button
                    type="button"
                    style={ghostBtnWide}
                    onClick={() => {
                      const next = `/mcheyne-today?${new URLSearchParams({ month: String(month), day: String(sheetDay) }).toString()}`;
                      nav(`/login?${new URLSearchParams({ next }).toString()}`);
                    }}
                  >
                    일괄 완료 (로그인 필요)
                  </button>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--muted)' }}>읽기표 데이터가 없습니다.</div>
            )}

            {isAuthed ? (
              <>
                <div style={{ height: 12 }} />

                <div style={{ fontWeight: 950, fontSize: 13 }}>체크</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {([1, 2, 3, 4] as const).map((i) => {
                    const k = 
                     (i === 1 ? 'done1' : i === 2 ? 'done2' : i === 3 ? 'done3' : 'done4') as
                      | 'done1'
                      | 'done2'
                      | 'done3'
                      | 'done4';
                    const checked = (selRow as any)?.[k] ? true : false;
                    return (
                      <label
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontWeight: 900,
                          padding: '4px 8px',
                          borderRadius: 12,
                          transition: 'transform 160ms ease, background 240ms ease',
                          transform: flashAt ? 'scale(1.06)' : 'scale(1)',
                          background: flashAt ? 'rgba(0, 200, 120, 0.12)' : 'transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={saving}
                          checked={checked}
                          onChange={(e) => setDayDone(sheetDay, { [k]: e.target.checked ? 1 : 0 } as any)}
                        />
                        {i}번
                      </label>
                    );
                  })}
                </div>

                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                  체크는 로그인 사용자에게만 저장됩니다.
                </div>
              </>
            ) : (
              <>
                <div style={{ height: 12 }} />

                <div style={{ fontWeight: 950, fontSize: 13 }}>체크</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {([1, 2, 3, 4] as const).map((i) => (
                    <label key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 900, opacity: 0.8 }}>
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => showToast('체크/진행률은 로그인 후 사용할 수 있어요', 'warn')}
                      />
                      {i}번
                    </label>
                  ))}
                </div>

                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>체크/진행률은 로그인 후 사용할 수 있습니다.</div>
              </>
            )}

            <div style={{ height: 12 }} />

            <button type="button" style={ghostBtnWide} onClick={() => openDayReading(month, sheetDay)}>
              이 날 본문 읽기
            </button>

            <div style={{ height: 10 }} />

            <button type="button" style={ghostBtnWide} onClick={() => nav('/mcheyne-today')}>
              오늘 페이지로 돌아가기
            </button>
          </div>
        ) : null}
      </BottomSheet>
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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 18,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          padding: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          color: 'var(--text)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 46, height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.12)' }} />
        </div>
        {children}
        <div style={{ height: 10 }} />
        <button type="button" onClick={onClose} style={{ ...ghostBtnWide, width: '100%' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

const card: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)'
};

const select: CSSProperties = {
  height: 40,
  padding: '0 10px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 900
};

const gridHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 6
};

const grid: CSSProperties = {
  marginTop: 8,
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 6
};

const cell: CSSProperties = {
  height: 56,
  borderRadius: 14,
  border: '1px solid var(--border)',
  fontWeight: 950,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column'
};

const ghostBtnWide: CSSProperties = {
  width: '100%',
  height: 44,
  padding: '0 12px',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 950
};

const tinyNavBtn: CSSProperties = {
  height: 40,
  padding: '0 10px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 950
};

const todayPill: CSSProperties = {
  fontSize: 11,
  fontWeight: 950,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'rgba(255, 230, 0, 0.20)',
  border: '1px solid rgba(255, 230, 0, 0.35)',
  color: 'var(--text)'
};

const todayShortcutBtn: CSSProperties = {
  marginTop: 6,
  height: 22,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(255, 230, 0, 0.45)',
  background: 'rgba(255, 230, 0, 0.18)',
  color: 'var(--text)',
  fontSize: 11,
  fontWeight: 950,
  cursor: 'pointer'
};

const toastWrap: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 18,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 2000
};

const toastBox: CSSProperties = {
  maxWidth: 520,
  margin: '0 12px',
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 950,
  boxShadow: '0 12px 30px rgba(0,0,0,0.18)'
};

const toastOk: CSSProperties = {
  border: '1px solid rgba(0, 200, 120, 0.35)',
  background: 'rgba(0, 200, 120, 0.14)'
};

const toastWarn: CSSProperties = {
  border: '1px solid rgba(255, 160, 0, 0.35)',
  background: 'rgba(255, 160, 0, 0.14)'
};

const errorBox: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--danger-border)',
  background: 'var(--danger-bg)',
  color: 'var(--danger-text)',
  fontWeight: 900,
  marginBottom: 12
};
