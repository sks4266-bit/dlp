import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';

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

  function goLogin() {
    nav(`/login?${new URLSearchParams({ next: '/qt' }).toString()}`);
  }

  async function load() {
    const res = await apiFetch(`/api/dlp/${date}`);
    if (res.status === 401) {
      goLogin();
      return;
    }
    if (!res.ok) throw new Error('LOAD_FAILED');
    setDlp(await res.json());
  }

  useEffect(() => {
    load().catch(() => {
      alert('불러오기에 실패했습니다.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div>
      <TopBar title="QT" backTo="/" />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <label style={{ fontWeight: 900, fontSize: 13, color: 'var(--text)' }}>날짜</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ height: 40, padding: '0 10px', borderRadius: 12, border: '1px solid var(--border)' }}
        />
        <button type="button" style={ghostBtn} onClick={() => setDate(kstToday())}>
          오늘
        </button>
      </div>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ fontWeight: 950 }}>오늘 QT 읽기</div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
          매일성경 사이트로 이동합니다.
        </div>
        <div style={{ height: 10 }} />
        <button type="button" style={primaryBtn} onClick={() => (window.location.href = 'https://sum.su.or.kr:8888/bible/today')}>
          QT 본문 열기
        </button>
      </section>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ fontWeight: 950 }}>QT 적용 한 줄 (DLP와 연동)</div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
          여기서 작성한 내용은 <b>DLP</b>의 “QT 적용”과 동일하게 저장됩니다.
        </div>
        <div style={{ height: 10 }} />
        <textarea
          value={dlp?.qtApply ?? ''}
          onChange={(e) => setDlp((prev) => (prev ? { ...prev, qtApply: e.target.value } : prev))}
          placeholder="예) 오늘은 안식의 의미를 기억하며 예배 시간을 지키겠다"
          style={textarea}
        />
        <div style={{ height: 10 }} />
        <button
          type="button"
          style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}
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
        </button>

        <div style={{ height: 10 }} />
        <button type="button" style={ghostBtnWide} onClick={() => nav('/dlp')}>
          DLP로 이동
        </button>
      </section>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)'
};

const textarea: React.CSSProperties = {
  width: '100%',
  minHeight: 110,
  resize: 'vertical',
  padding: 12,
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontSize: 14,
  lineHeight: 1.45
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  height: 46,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--primary-bg)',
  color: 'var(--primary-text)',
  fontWeight: 950,
  fontSize: 15
};

const ghostBtn: React.CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontWeight: 900,
  fontSize: 13
};

const ghostBtnWide: React.CSSProperties = {
  width: '100%',
  height: 44,
  padding: '0 12px',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontWeight: 950
};
