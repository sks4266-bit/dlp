import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
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

export default function QtPage() {
  const nav = useNavigate();

  const [date, setDate] = useState(kstToday());
  const [dlp, setDlp] = useState<DlpPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function goLogin() {
    nav(`/login?${new URLSearchParams({ next: '/qt' }).toString()}`);
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
      setDlp(await res.json());
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
        <TopBar title="매일성경 QT" backTo="/" />

        <Card className="glassHeroCard">
          <div className="sectionHeadRow">
            <div>
              <CardTitle>오늘 QT</CardTitle>
              <CardDesc>QT 본문을 열고, 적용 한 줄을 함께 저장하세요.</CardDesc>
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

        <Card>
          <CardTitle>오늘 QT 읽기</CardTitle>
          <CardDesc>매일성경 사이트로 이동해 오늘 본문을 읽습니다.</CardDesc>

          <div className="stack12" />

          <Button
            variant="primary"
            wide
            size="lg"
            onClick={() => window.open('https://sum.su.or.kr:8888/bible/today', '_blank', 'noopener,noreferrer')}
          >
            QT 본문 열기
          </Button>
        </Card>

        <div className="stack12" />

        <Card>
          <CardTitle>QT 적용 한 줄</CardTitle>
          <CardDesc>여기서 작성한 내용은 DLP의 “QT 적용”과 동일하게 저장됩니다.</CardDesc>

          <div className="stack12" />

          <textarea
            value={dlp?.qtApply ?? ''}
            onChange={(e) => setDlp((prev) => (prev ? { ...prev, qtApply: e.target.value } : prev))}
            placeholder="예) 오늘은 안식의 의미를 기억하며 예배 시간을 먼저 지키겠다"
            className="glassTextarea"
          />

          <div className="stack12" />

          <Button
            variant="primary"
            wide
            size="lg"
            disabled={saving}
            onClick={async () => {
              if (!dlp) return;

              setSaving(true);
              try {
                const res = await apiFetch(`/api/dlp/${date}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                    bibleChapters: dlp.bibleChapters,
                    prayerMinutes: dlp.prayerMinutes,
                    evangelismCount: dlp.evangelismCount,
                    qtApply: dlp.qtApply
                  })
                });

                if (res.status === 401) {
                  goLogin();
                  return;
                }

                if (!res.ok) throw new Error('SAVE_FAILED');
                alert('저장되었습니다.');
              } catch {
                alert('저장에 실패했습니다.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? '저장 중…' : '저장'}
          </Button>

          <div className="stack10" />

          <Button variant="secondary" wide onClick={() => nav('/dlp')}>
            DLP로 이동
          </Button>
        </Card>
      </div>
    </div>
  );
}