import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import TopBar from '../components/layout/TopBar';

type AdminStats = {
  urgentPrayers: {
    total: number;
    active: number;
    deleted: number;
    expired: number;
    createdLast24h: number;
  };
};

type AdminUrgent = {
  id: string;
  authorUserId: string;
  authorName: string;
  content: string;
  createdAt: number;
  expiresAt: number;
  deletedAt: number | null;
  deletedByAdminId: string | null;
  deletedByAdminName: string | null;
  deletedReason: string | null;
};

export default function AdminPage() {
  const nav = useNavigate();
  const { me, loading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [rows, setRows] = useState<AdminUrgent[]>([]);
  const [includeExpired, setIncludeExpired] = useState(true);
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function loadAll() {
    setErr(null);
    try {
      const s = await apiFetch('/api/admin/stats');
      if (!s.ok) throw new Error('stats load failed');
      setStats(await s.json());

      const q = `?includeExpired=${includeExpired ? '1' : '0'}&includeDeleted=${includeDeleted ? '1' : '0'}`;
      const r = await apiFetch('/api/admin/urgent-prayers' + q);
      if (!r.ok) throw new Error('list load failed');
      setRows(await r.json());
    } catch (e: any) {
      setErr(e?.message ?? '관리자 데이터 로드 실패');
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!me) {
      nav('/login');
      return;
    }
    if (!me.isAdmin) {
      nav('/');
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, me, includeExpired, includeDeleted]);

  return (
    <div>
      <TopBar
        title="ADMIN 대시보드"
        backTo="/"
        right={
          <button type="button" style={ghostBtn} onClick={loadAll}>
            새로고침
          </button>
        }
      />

      <div style={{ height: 12 }} />

      {err && <div style={errorBox}>{err}</div>}

      <section style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>긴급기도 통계</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat label="전체" value={stats?.urgentPrayers.total ?? '-'} />
          <Stat label="활성(24h)" value={stats?.urgentPrayers.active ?? '-'} />
          <Stat label="삭제" value={stats?.urgentPrayers.deleted ?? '-'} />
          <Stat label="만료" value={stats?.urgentPrayers.expired ?? '-'} />
          <Stat label="최근 24h 생성" value={stats?.urgentPrayers.createdLast24h ?? '-'} />
        </div>
      </section>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ fontWeight: 900 }}>긴급기도 전체 관리</div>

        <div style={{ height: 10 }} />

        <label style={toggleRow}>
          <input type="checkbox" checked={includeExpired} onChange={(e) => setIncludeExpired(e.target.checked)} />
          만료 포함
        </label>
        <label style={toggleRow}>
          <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
          삭제 포함
        </label>

        <div style={{ height: 12 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ padding: 12, borderRadius: 14, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{r.authorName}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>{formatTime(r.createdAt)} · 만료 {formatTime(r.expiresAt)}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 12, color: r.deletedAt ? 'rgb(180,0,0)' : 'rgba(0,0,0,0.55)', fontWeight: 900 }}>
                    {r.deletedAt ? '삭제됨' : r.expiresAt < Date.now() ? '만료됨' : '활성'}
                  </div>

                  {!r.deletedAt && (
                    <button
                      type="button"
                      style={dangerBtn}
                      onClick={async () => {
                        const ok = confirm('이 긴급기도제목을 삭제할까요? (운영진 전용)');
                        if (!ok) return;
                        const reason = prompt('삭제 사유를 입력하세요(필수, 최대 120자)');
                        if (!reason) return;
                        const res = await apiFetch(`/api/admin/urgent-prayers/${r.id}/delete`, { method: 'POST', body: JSON.stringify({ reason }) });
                        if (!res.ok) {
                          alert('삭제 실패: 권한/로그인 상태를 확인하세요.');
                          return;
                        }
                        await loadAll();
                      }}
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 8, lineHeight: 1.5 }}>{r.content}</div>

              {r.deletedAt && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', fontWeight: 800 }}>
                  삭제 로그: {r.deletedByAdminName ?? r.deletedByAdminId ?? '-'} · {formatTime(r.deletedAt)}
                  {r.deletedReason ? ` · 사유: ${r.deletedReason}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ padding: 10, borderRadius: 14, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const card: React.CSSProperties = {
  padding: 14,
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

const dangerBtn: React.CSSProperties = {
  height: 30,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(255,0,0,0.18)',
  background: 'rgba(255,0,0,0.08)',
  color: 'rgb(180,0,0)',
  fontWeight: 900,
  fontSize: 12
};

const toggleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: 'var(--text)',
  fontWeight: 800,
  marginTop: 6
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,0,0,0.25)',
  background: 'rgba(255,0,0,0.06)',
  marginBottom: 12,
  fontWeight: 900
};
