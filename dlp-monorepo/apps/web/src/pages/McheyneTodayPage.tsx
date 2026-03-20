import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';

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

export default function McheyneTodayPage() {
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

  async function loadProgress() {
    try {
      const url = target
        ? `/api/mcheyne/progress/day?${new URLSearchParams({ month: String(target.month), day: String(target.day) }).toString()}`
        : '/api/mcheyne/progress/today';
      const res = await apiFetch(url);
      if (res.status === 401) return;
      if (res.ok) setProgress(await res.json());
    } catch {
      // ignore
    }
  }

  async function load() {
    setError(null);
    try {
      const url = target
        ? `/api/mcheyne/day-text?${new URLSearchParams({ month: String(target.month), day: String(target.day) }).toString()}`
        : '/api/mcheyne/today-text';
      const res = await apiFetch(url);
      if (res.status === 401) {
        nav('/login');
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

  const title = useMemo(() => {
    if (!data) return target ? `맥체인 본문 (${target.month}/${target.day})` : '맥체인 본문';
    return `맥체인 본문 (${data.date.month}/${data.date.day})`;
  }, [data, target]);

  if (!data) {
    return (
      <div>
        <TopBar title={title} backTo="/" />
        {error ? <div style={errorBox}>불러오기 실패: {error}</div> : null}
        <div style={{ color: 'var(--muted)' }}>불러오는 중…</div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={title} backTo="/" />

      {error ? <div style={errorBox}>불러오기 실패: {error}</div> : null}

      {/* 진행률 */}
      {progress ? (
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 16 }}>진행률 (오늘까지)</div>
              <div style={{ marginTop: 8, lineHeight: 1.6, color: 'var(--text)' }}>
                <div>
                  <b>{progress.summary.percent}%</b> · {progress.summary.completedReadings}/{progress.summary.totalReadings} (읽기)
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>오늘 완료: {progress.todayCompleted}/4</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" style={ghostBtn} onClick={() => nav('/mcheyne-calendar')}>
                캘린더
              </button>
              {!isToday ? (
                <button type="button" style={ghostBtn} onClick={() => nav('/mcheyne-today')}>
                  오늘로
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ height: 10 }} />

          <button
            type="button"
            style={{ ...primaryBtn, opacity: bulkSaving ? 0.7 : 1 }}
            disabled={bulkSaving}
            onClick={async () => {
              setBulkSaving(true);
              try {
                const putUrl = target
                  ? `/api/mcheyne/progress/day?${new URLSearchParams({ month: String(target.month), day: String(target.day) }).toString()}`
                  : '/api/mcheyne/progress/today';
                await apiFetch(putUrl, {
                  method: 'PUT',
                  body: JSON.stringify({ done1: 1, done2: 1, done3: 1, done4: 1 })
                });
                await loadProgress();
              } finally {
                setBulkSaving(false);
              }
            }}
          >
            {bulkSaving ? '저장 중…' : '오늘 4개 본문 전부 완료 (원클릭)'}
          </button>

          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
            원클릭 완료는 “오늘 4개 체크”만 변경합니다.
          </div>
        </section>
      ) : (
        <section style={card}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>진행률</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>진행률/체크 기능은 로그인 후 사용할 수 있습니다.</div>
          <div style={{ height: 10 }} />
          <button type="button" style={ghostBtnWide} onClick={() => nav('/mcheyne-calendar')}>
            캘린더 보기
          </button>
        </section>
      )}

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>오늘 읽을 본문</div>
        <div style={{ marginTop: 8, lineHeight: 1.65, color: 'var(--text)' }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>{data.plan.reading1}</li>
            <li>{data.plan.reading2}</li>
            <li>{data.plan.reading3}</li>
            <li>{data.plan.reading4}</li>
          </ul>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>아래에서 각 본문을 펼쳐서 바로 읽을 수 있습니다.</div>
      </section>

      <div style={{ height: 12 }} />

      {data.readings.map((r, idx) => {
        const open = openIdx === idx;
        const previewLines = r.verses.slice(0, 6);

        const doneKey = (idx === 0 ? 'done1' : idx === 1 ? 'done2' : idx === 2 ? 'done3' : 'done4') as keyof ProgressPayload['today'];
        const doneVal = progress?.today?.[doneKey] ?? 0;

        return (
          <section key={r.ref + idx} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 950 }}>{r.ref}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{r.raw}</div>

                {progress ? (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, fontWeight: 900 }}>
                    <input
                      type="checkbox"
                      checked={!!doneVal}
                      onChange={async (e) => {
                        const next = e.target.checked ? 1 : 0;

                        // optimistic update
                        setProgress((prev) => {
                          if (!prev) return prev;
                          const nextToday = { ...prev.today, [doneKey]: next } as ProgressPayload['today'];
                          const nextTodayCompleted = nextToday.done1 + nextToday.done2 + nextToday.done3 + nextToday.done4;
                          return { ...prev, today: nextToday, todayCompleted: nextTodayCompleted };
                        });

                        const putUrl = target
                          ? `/api/mcheyne/progress/day?${new URLSearchParams({ month: String(target.month), day: String(target.day) }).toString()}`
                          : '/api/mcheyne/progress/today';
                        await apiFetch(putUrl, {
                          method: 'PUT',
                          body: JSON.stringify({ [doneKey]: next })
                        });
                        await loadProgress();
                      }}
                    />
                    완료
                  </label>
                ) : null}
              </div>

              <button type="button" style={ghostBtn} onClick={() => setOpenIdx(open ? null : idx)}>
                {open ? '접기' : '펼치기'}
              </button>
            </div>

            <div style={{ height: 10 }} />

            {!open ? (
              <div style={previewBox}>
                {previewLines.map((v) => (
                  <div key={`${v.c}:${v.v}`} style={{ lineHeight: 1.55 }}>
                    <b style={{ marginRight: 6 }}>{v.v}</b>
                    {v.t}
                  </div>
                ))}
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>미리보기: 앞부분 일부</div>
              </div>
            ) : (
              <pre style={textBox}>{r.text}</pre>
            )}

            <div style={{ height: 10 }} />

            <button
              type="button"
              style={ghostBtnWide}
              onClick={() => {
                const qs = new URLSearchParams({ ref: r.raw }).toString();
                nav(`/bible?${qs}`);
              }}
            >
              이 본문만 따로 보기
            </button>
          </section>
        );
      })}
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)'
};

const previewBox: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--soft)',
  fontSize: 13,
  color: 'var(--text)'
};

const textBox: React.CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  fontSize: 13,
  lineHeight: 1.55,
  color: 'var(--text)',
  padding: 12,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--soft)',
  maxHeight: 520,
  overflow: 'auto'
};

const ghostBtn: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 900
};

const ghostBtnWide: React.CSSProperties = {
  width: '100%',
  height: 40,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 900
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--primary-bg)',
  color: 'var(--primary-text)',
  fontWeight: 950
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--danger-border)',
  background: 'var(--danger-bg)',
  color: 'var(--danger-text)',
  fontWeight: 900,
  marginBottom: 12
};
