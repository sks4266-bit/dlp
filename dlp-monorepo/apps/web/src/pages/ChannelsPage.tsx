import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

type Channel = { id: string; name: string; description: string | null; inviteCode: string; createdAt: number; score?: number };

export default function ChannelsPage() {
  const nav = useNavigate();
  const { me, loading: authLoading } = useAuth();

  const [reco, setReco] = useState<Channel[]>([]);
  const [all, setAll] = useState<Channel[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  async function load() {
    setErr(null);
    try {
      const r1 = await apiFetch('/api/channels/recommended');
      const r2 = await apiFetch('/api/channels');
      if (!r1.ok || !r2.ok) throw new Error('LOAD_FAILED');
      setReco(await r1.json());
      setAll(await r2.json());
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
  }, [authLoading, me]);

  return (
    <div>
      <TopBar
        title="교회 채널"
        backTo="/"
        right={
          <button type="button" style={ghostBtn} onClick={() => setCreateOpen(true)}>
            + 채널 생성
          </button>
        }
      />

      {err && <div style={errorBox}>{err}</div>}

      <section style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>추천 채널</div>
        {reco.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>추천할 채널이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reco.slice(0, 10).map((c) => (
              <button key={c.id} type="button" style={row} onClick={() => nav(`/channels/${c.id}`)}>
                <div style={{ fontWeight: 950 }}>{c.name}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>{c.description ?? '설명 없음'}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>전체 채널</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {all.slice(0, 20).map((c) => (
            <button key={c.id} type="button" style={row} onClick={() => nav(`/channels/${c.id}`)}>
              <div style={{ fontWeight: 950 }}>{c.name}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>{c.description ?? '설명 없음'}</div>
            </button>
          ))}
        </div>
      </section>

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>채널 생성</div>
        <div style={{ height: 10 }} />
        <label style={field}>
          <div style={label}>채널 이름</div>
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="예) 00교회 청년부" />
        </label>
        <div style={{ height: 10 }} />
        <label style={field}>
          <div style={label}>설명(선택)</div>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} style={input} placeholder="예) 주보/공지/기도제목 공유" />
        </label>
        <div style={{ height: 12 }} />
        <button
          type="button"
          style={primaryBtn}
          onClick={async () => {
            if (name.trim().length < 2) {
              alert('채널 이름을 2자 이상 입력하세요.');
              return;
            }
            const res = await apiFetch('/api/channels', {
              method: 'POST',
              body: JSON.stringify({ name: name.trim(), description: desc.trim() || null })
            });
            if (!res.ok) {
              alert('생성 실패');
              return;
            }
            const data = await res.json();
            setCreateOpen(false);
            setName('');
            setDesc('');
            await load();
            nav(`/channels/${data.id}`);
          }}
        >
          생성
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

const row: React.CSSProperties = {
  textAlign: 'left',
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)'
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

const field: React.CSSProperties = { display: 'grid', gap: 6 };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 900 };
const input: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 12,
  border: '1px solid var(--border)',
  padding: '0 12px',
  fontSize: 15
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,0,0,0.25)',
  background: 'rgba(255,0,0,0.06)',
  marginBottom: 12,
  fontWeight: 900
};
