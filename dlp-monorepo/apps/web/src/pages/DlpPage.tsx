import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { useAuth } from '../auth/AuthContext';
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

export default function DlpPage() {
  const nav = useNavigate();
  const { refreshMe, logout } = useAuth();

  const [date, setDate] = useState(kstToday());
  const [data, setData] = useState<DlpPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const title = useMemo(() => `DLP (${date.slice(5)})`, [date]);

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
    <div>
      <TopBar
        title={title}
        backTo="/"
        right={
          <button
            type="button"
            style={ghostBtn}
            onClick={() => {
              logout();
              nav('/');
            }}
          >
            로그아웃
          </button>
        }
      />

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

      {err && <div style={errorBox}>{err}</div>}

      {!data ? (
        <Skeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title="성경 읽기(장)" desc="오늘 읽은 장 수">
            <NumberRow value={data.bibleChapters} onChange={(v) => setData({ ...data, bibleChapters: v })} min={0} max={50} step={1} />
          </Card>

          <Card title="기도(분)" desc="오늘 기도 시간">
            <NumberRow value={data.prayerMinutes} onChange={(v) => setData({ ...data, prayerMinutes: v })} min={0} max={600} step={5} />
          </Card>

          <Card title="전도(명)" desc="오늘 전도/권유한 인원 수">
            <NumberRow value={data.evangelismCount} onChange={(v) => setData({ ...data, evangelismCount: v })} min={0} max={50} step={1} />
          </Card>

          <Card title="QT 적용" desc="오늘 말씀을 삶에 어떻게 적용할지 한 줄">
            <textarea
              value={data.qtApply}
              onChange={(e) => setData({ ...data, qtApply: e.target.value })}
              placeholder="예) 오늘은 안식의 의미를 기억하며, 예배 시간을 지키겠다"
              style={{
                width: '100%',
                minHeight: 92,
                resize: 'vertical',
                padding: 12,
                borderRadius: 12,
                border: '1px solid var(--border)',
                fontSize: 14,
                lineHeight: 1.4
              }}
            />
          </Card>

          <button
            type="button"
            disabled={saving}
            style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}
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
          </button>
        </div>
      )}
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: any }) {
  return (
    <section style={card}>
      <div style={{ fontWeight: 950 }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
      <div style={{ height: 10 }} />
      {children}
    </section>
  );
}

function NumberRow({
  value,
  onChange,
  min,
  max,
  step
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" style={stepBtn} onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value || 0);
          onChange(Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)));
        }}
        style={numInput}
      />
      <button type="button" style={stepBtn} onClick={() => onChange(Math.min(max, value + step))}>
        +
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 110,
            borderRadius: 14,
            background: 'linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.03), rgba(0,0,0,0.06))',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.1s infinite'
          }}
        />
      ))}
      <style>
        {`@keyframes shimmer { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }`}
      </style>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)'
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

const stepBtn: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontSize: 18,
  fontWeight: 950
};

const numInput: React.CSSProperties = {
  flex: 1,
  height: 44,
  borderRadius: 14,
  border: '1px solid var(--border)',
  padding: '0 12px',
  fontSize: 16,
  fontWeight: 950,
  textAlign: 'center'
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,0,0,0.25)',
  background: 'rgba(255,0,0,0.06)',
  marginBottom: 12,
  fontWeight: 900
};
