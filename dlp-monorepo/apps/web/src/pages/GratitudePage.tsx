import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function ym(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ymdFromParts(y: number, m: number, day: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type Entry = { id: string; date: string; content: string; createdAt: number };

export default function GratitudePage() {
  const nav = useNavigate();
  const { me, loading: authLoading } = useAuth();

  const [month, setMonth] = useState(ym(kstNow()));
  const [items, setItems] = useState<Entry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDate, setEditorDate] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const map = useMemo(() => {
    const m = new Map<string, Entry>();
    items.forEach((it) => m.set(it.date, it));
    return m;
  }, [items]);

  const { year, mon } = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return { year: y, mon: m };
  }, [month]);

  const firstDow = useMemo(() => {
    const d = new Date(Date.UTC(year, mon - 1, 1));
    return d.getUTCDay();
  }, [year, mon]);

  const daysInMonth = useMemo(() => {
    return new Date(Date.UTC(year, mon, 0)).getUTCDate();
  }, [year, mon]);

  async function load() {
    setErr(null);
    try {
      const res = await apiFetch(`/api/gratitude?month=${encodeURIComponent(month)}`);
      if (res.status === 401) {
        nav('/login');
        return;
      }
      if (!res.ok) throw new Error('LOAD_FAILED');
      setItems(await res.json());
    } catch (e: any) {
      setErr(e?.message ?? '불러오기에 실패했습니다.');
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      nav('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, me, month]);

  function openEditor(date: string) {
    setEditorDate(date);
    setContent(map.get(date)?.content ?? '');
    setEditorOpen(true);
  }

  return (
    <div>
      <TopBar title="감사일기" backTo="/" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={monthInput} />
        <button
          type="button"
          style={ghostBtn}
          onClick={() => {
            const t = ym(kstNow());
            setMonth(t);
          }}
        >
          이번달
        </button>
      </div>

      <div style={{ height: 10 }} />
      {err && <div style={errorBox}>{err}</div>}

      <section style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>달력</div>

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
            const date = ymdFromParts(year, mon, day);
            const has = map.has(date);
            return (
              <button
                key={date}
                type="button"
                onClick={() => openEditor(date)}
                style={{
                  ...cell,
                  background: has ? 'var(--primary-bg)' : 'rgba(0,0,0,0.04)',
                  color: has ? 'var(--primary-text)' : 'rgba(0,0,0,0.85)'
                }}
                aria-label={`${date} 감사일기 ${has ? '작성됨' : '미작성'}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div style={{ height: 10 }} />
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
          날짜를 탭해서 감사일기를 작성/수정하세요.
        </div>
      </section>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>목록</div>
        {items.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>이번 달 기록이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.slice(0, 20).map((it) => (
              <button key={it.id} type="button" style={listRow} onClick={() => openEditor(it.date)}>
                <div style={{ fontWeight: 950 }}>{it.date}</div>
                <div style={{ marginTop: 6, color: 'var(--text)', lineHeight: 1.45 }}>{it.content}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      <BottomSheet open={editorOpen} onClose={() => setEditorOpen(false)}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>감사일기 · {editorDate}</div>
        <div style={{ height: 10 }} />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="예) 오늘도 건강을 지켜주셔서 감사합니다"
          style={textarea}
        />
        <div style={{ height: 10 }} />
        <button
          type="button"
          style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}
          disabled={saving}
          onClick={async () => {
            if (!editorDate) return;
            if (!content.trim()) {
              alert('내용을 입력하세요.');
              return;
            }
            setSaving(true);
            try {
              const res = await apiFetch(`/api/gratitude/${editorDate}`, { method: 'PUT', body: JSON.stringify({ content }) });
              if (!res.ok) throw new Error('SAVE_FAILED');
              await load();
              setEditorOpen(false);
            } catch {
              alert('저장에 실패했습니다.');
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
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
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 46, height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.12)' }} />
        </div>
        {children}
        <div style={{ height: 10 }} />
        <button type="button" onClick={onClose} style={{ ...ghostBtn, width: '100%' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)'
};

const gridHeader: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 6
};

const grid: React.CSSProperties = {
  marginTop: 8,
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 6
};

const cell: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontWeight: 950
};

const listRow: React.CSSProperties = {
  textAlign: 'left',
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)'
};

const textarea: React.CSSProperties = {
  width: '100%',
  minHeight: 120,
  resize: 'vertical',
  padding: 12,
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontSize: 14,
  lineHeight: 1.45
};

const monthInput: React.CSSProperties = {
  height: 40,
  padding: '0 10px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontWeight: 900
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

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,0,0,0.25)',
  background: 'rgba(255,0,0,0.06)',
  marginBottom: 12,
  fontWeight: 900
};
