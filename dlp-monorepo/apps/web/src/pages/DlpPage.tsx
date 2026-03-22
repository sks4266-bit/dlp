import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

function kstToday() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type DlpPayload = {
  date: string;
  bibleChapters: number;
  prayerMinutes: number;
  evangelismCount: number;
  qtApply: string;
};

export default function DlpPage() {
  const nav = useNavigate();
  const { refreshMe, logout } = useAuth();

  const [date, setDate] = useState(kstToday());
  const [data, setData] = useState<DlpPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const title = useMemo(() => `DLP 체크리스트`, []);

  function goLogin() {
    nav(`/login?${new URLSearchParams({ next: '/dlp' }).toString()}`);
  }

  async function load() {
    setErr(null);
    try {
      const res = await apiFetch(`/api/dlp/${date}`);
      if (res.status === 401) {
        goLogin();
        return;
      }
      if (!res.ok) throw new Error('LOAD_FAILED');
      setData(await res.json());
    } catch (e: any) {
      setErr(e?.message ?? '불러오기에 실패했습니다.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar
          title={title}
          backTo="/"
          right={
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                nav('/');
              }}
            >
              로그아웃
            </Button>
          }
        />

        <Card className="glassHeroCard">
          <div className="sectionHeadRow">
            <div>
              <CardTitle>{date.slice(5)} 체크리스트</CardTitle>
              <CardDesc>오늘의 읽기, 기도, 전도, QT 적용을 한 번에 기록합니다.</CardDesc>
            </div>

            <div className="toolbarRow">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="glassInput glassInputDate" />
              <Button variant="secondary" onClick={() => setDate(kstToday())}>
                오늘
              </Button>
            </div>
          </div>
        </Card>

        <div className="stack12" />
        {err ? <div className="uiErrorBox">{err}</div> : null}

        {!data ? (
          <div className="glassSkeletonStack">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glassSkeletonBlock" />
            ))}
          </div>
        ) : (
          <>
            <Card>
              <CardTitle>성경 읽기</CardTitle>
              <CardDesc>오늘 읽은 장 수를 기록해 주세요.</CardDesc>

              <div className="stack12" />
              <NumberRow value={data.bibleChapters} onChange={(v) => setData({ ...data, bibleChapters: v })} min={0} max={50} step={1} />
            </Card>

            <div className="stack12" />

            <Card>
              <CardTitle>기도 시간</CardTitle>
              <CardDesc>오늘 기도한 시간을 분 단위로 기록합니다.</CardDesc>

              <div className="stack12" />
              <NumberRow value={data.prayerMinutes} onChange={(v) => setData({ ...data, prayerMinutes: v })} min={0} max={600} step={5} suffix="분" />
            </Card>

            <div className="stack12" />

            <Card>
              <CardTitle>전도 / 권유</CardTitle>
              <CardDesc>오늘 복음을 전했거나 교회로 초대한 인원 수입니다.</CardDesc>

              <div className="stack12" />
              <NumberRow value={data.evangelismCount} onChange={(v) => setData({ ...data, evangelismCount: v })} min={0} max={50} step={1} suffix="명" />
            </Card>

            <div className="stack12" />

            <Card>
              <CardTitle>QT 적용</CardTitle>
              <CardDesc>오늘 말씀을 삶에 어떻게 적용할지 한 줄로 적어보세요.</CardDesc>

              <div className="stack12" />
              <textarea
                value={data.qtApply}
                onChange={(e) => setData({ ...data, qtApply: e.target.value })}
                placeholder="예) 오늘은 안식의 의미를 기억하며 예배 시간을 먼저 지키겠다"
                className="glassTextarea"
              />
            </Card>

            <div className="stack12" />

            <Button
              variant="primary"
              wide
              size="lg"
              disabled={saving}
              onClick={async () => {
                if (!data) return;
                setSaving(true);
                setErr(null);

                try {
                  const res = await apiFetch(`/api/dlp/${date}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                      bibleChapters: data.bibleChapters,
                      prayerMinutes: data.prayerMinutes,
                      evangelismCount: data.evangelismCount,
                      qtApply: data.qtApply
                    })
                  });

                  if (res.status === 401) {
                    goLogin();
                    return;
                  }

                  if (!res.ok) throw new Error('SAVE_FAILED');

                  await refreshMe();
                  alert('저장되었습니다.');
                  nav('/me');
                } catch (e: any) {
                  setErr(e?.message ?? '저장에 실패했습니다.');
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? '저장 중…' : '저장'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function NumberRow({
  value,
  onChange,
  min,
  max,
  step,
  suffix
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  return (
    <div className="numberRow">
      <Button variant="ghost" className="numberStepBtn" onClick={() => onChange(Math.max(min, value - step))}>
        −
      </Button>

      <div className="numberDisplay">
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value || 0);
            onChange(Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)));
          }}
          className="numberDisplayInput"
        />
        {suffix ? <span className="numberSuffix">{suffix}</span> : null}
      </div>

      <Button variant="ghost" className="numberStepBtn" onClick={() => onChange(Math.min(max, value + step))}>
        +
      </Button>
    </div>
  );
}