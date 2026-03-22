import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

type Verse = { c: number; v: number; t: string };

type TodayTextPayload = {
  date: { month: number; day: number };
  plan: { month: number; day: number; reading1: string; reading2: string; reading3: string; reading4: string };
  preview: { c: number; v: number; t: string }[];
  readings: { raw: string; ref: string; verses: Verse[]; text: string }[];
};

type ProgressPayload = {
  today: { month: number; day: number; done1: number; done2: number; done3: number; done4: number };
  todayCompleted: number;
  summary: { totalDays: number; totalReadings: number; completedReadings: number; percent: number };
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
  const [bulkSaving, setBulkSaving] = useState(false);

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
    if (!data) return target ? `맥체인 본문 (${target.month}/${target.day})` : '맥체인 본문';
    return `맥체인 본문 (${data.date.month}/${data.date.day})`;
  }, [data, target]);

  const viewMonth = data?.date.month ?? target?.month ?? null;
  const viewDay = data?.date.day ?? target?.day ?? null;

  const prevDay = useMemo(() => {
    if (!viewMonth || !viewDay) return null;
    return addDaysKst(viewMonth, viewDay, -1);
  }, [viewMonth, viewDay]);

  const nextDay = useMemo(() => {
    if (!viewMonth || !viewDay) return null;
    return addDaysKst(viewMonth, viewDay, +1);
  }, [viewMonth, viewDay]);

  function goLogin() {
    const next = `${loc.pathname}${loc.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function loadProgress() {
    try {
      const url = target
        ? `/api/mcheyne/progress/day?${buildDayQs(target.month, target.day)}`
        : '/api/mcheyne/progress/today';

      const res = await apiFetch(url);
      if (res.status === 401) {
        goLogin();
        return;
      }
      if (res.ok) setProgress(await res.json());
    } catch {
      // ignore
    }
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

  async function saveProgress(
    patch: Partial<{ done1: number; done2: number; done3: number; done4: number }>
  ) {
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
        const j = await res.json();

        setProgress((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            today: j.today ?? prev.today,
            todayCompleted: j.todayCompleted ?? prev.todayCompleted,
            summary: j.summary ?? prev.summary
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
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'LOAD_FAILED');
      }

      setData(await res.json());
      await loadProgress();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.search]);

  if (!data) {
    return (
      <div className="mcReadPage">
        <TopBar title={title} backTo="/" />

        {error ? (
          <Card className="uiErrorBox">
            <CardTitle>불러오기 실패</CardTitle>
            <CardDesc>{error}</CardDesc>
            <div className="mcReadErrorActions">
              <Button variant="secondary" onClick={load}>다시 시도</Button>
              <Button variant="ghost" onClick={() => nav('/mcheyne-calendar')}>캘린더</Button>
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="mcReadLoading">불러오는 중…</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mcReadPage">
      <TopBar title={title} backTo="/" />

      {error ? (
        <Card className="uiErrorBox">
          <CardTitle>불러오기 실패</CardTitle>
          <CardDesc>{error}</CardDesc>
        </Card>
      ) : null}

      <Card className="mcReadHero">
        <div className="mcReadHeroTop">
          <div className="mcReadHeroTitleBlock">
            <CardTitle>{data.date.month}월 {data.date.day}일</CardTitle>
            <CardDesc>{isToday ? '오늘의 본문' : '선택한 날짜의 본문'}</CardDesc>
          </div>

          <div className="mcReadHeroActions">
            <Button
              variant="ghost"
              onClick={() => prevDay && nav(`/mcheyne-today?${buildDayQs(prevDay.month, prevDay.day)}`)}
              disabled={!prevDay}
            >
              ← 이전날
            </Button>

            <Button
              variant="ghost"
              onClick={() => nextDay && nav(`/mcheyne-today?${buildDayQs(nextDay.month, nextDay.day)}`)}
              disabled={!nextDay}
            >
              다음날 →
            </Button>

            <Button variant="secondary" onClick={() => nav('/mcheyne-calendar')}>
              캘린더
            </Button>

            {!isToday ? (
              <Button variant="secondary" onClick={() => nav('/mcheyne-today')}>
                오늘로
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {progress ? (
        <Card className="mcReadProgress">
          <div className="mcReadProgressTop">
            <div className="mcReadProgressTitle">
              <CardTitle>진행률 (오늘까지)</CardTitle>
              <div className="mcReadProgressLine">
                <b>{progress.summary.percent}%</b>
                <span className="mcReadProgressSep">·</span>
                <span>{progress.summary.completedReadings}/{progress.summary.totalReadings} (읽기)</span>
                <span className="mcReadProgressSep">·</span>
                <span>오늘 {progress.todayCompleted}/4</span>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
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
            {bulkSaving ? '저장 중…' : '오늘 4개 본문 전부 완료 (원클릭)'}
          </Button>

          <CardDesc className="mcReadHint">
            원클릭 완료는 “오늘 4개 체크”만 변경합니다.
          </CardDesc>
        </Card>
      ) : (
        <Card className="mcReadProgress">
          <CardTitle>진행률</CardTitle>
          <CardDesc>진행률 데이터를 불러오지 못했습니다.</CardDesc>
          <Button variant="secondary" size="lg" wide onClick={loadProgress}>
            진행률 다시 불러오기
          </Button>
        </Card>
      )}

      <Card className="mcReadPlan">
        <CardTitle>오늘 읽을 본문</CardTitle>
        <ul className="mcReadPlanList">
          <li>{data.plan.reading1}</li>
          <li>{data.plan.reading2}</li>
          <li>{data.plan.reading3}</li>
          <li>{data.plan.reading4}</li>
        </ul>
        <CardDesc>아래에서 각 본문을 펼쳐서 바로 읽을 수 있습니다.</CardDesc>
      </Card>

      <div className="mcReadList">
        {data.readings.map((r, idx) => {
          const open = openIdx === idx;
          const previewLines = r.verses.slice(0, 6);

          const doneKey =
            (idx === 0 ? 'done1' : idx === 1 ? 'done2' : idx === 2 ? 'done3' : 'done4') as keyof ProgressPayload['today'];

          const doneVal = progress?.today?.[doneKey] ?? 0;

          return (
            <Card key={r.ref + idx} className="mcReadItem">
              <div className="mcReadItemHead">
                <div className="mcReadItemTitle">
                  <CardTitle>{r.ref}</CardTitle>
                  <CardDesc>{r.raw}</CardDesc>

                  {progress ? (
                    <label className="mcReadCheck">
                      <input
                        type="checkbox"
                        checked={!!doneVal}
                        onChange={async (e) => {
                         const next = e.target.checked ? 1 : 0;
                         await saveProgress({ [doneKey]: next } as Partial<{
                           done1: number;
                           done2: number;
                           done3: number;
                           done4: number;
                          }>);
                        }}
                      />
                      완료
                    </label>
                  ) : null}
                </div>

                <Button variant="ghost" onClick={() => setOpenIdx(open ? null : idx)}>
                  {open ? '접기' : '펼치기'}
                </Button>
              </div>

              {!open ? (
                <div className="mcReadPreviewBox">
                  {previewLines.map((v) => (
                    <div key={`${v.c}:${v.v}`} className="mcReadPreviewLine">
                      <b className="mcReadVerseNum">{v.v}</b>
                      <span>{v.t}</span>
                    </div>
                  ))}
                  <div className="mcReadPreviewHint">미리보기: 앞부분 일부</div>
                </div>
              ) : (
                <pre className="mcReadTextBox">{r.text}</pre>
              )}

              <Button
                variant="secondary"
                size="lg"
                wide
                onClick={() => nav(`/bible?${new URLSearchParams({ ref: r.raw }).toString()}`)}
              >
                이 본문만 따로 보기
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
