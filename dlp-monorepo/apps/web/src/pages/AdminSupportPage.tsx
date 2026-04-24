import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import TopBar from '../components/layout/TopBar';
import PolicySupportHeaderNav from '../components/legal/PolicySupportHeaderNav';
import PolicySupportFooter from '../components/legal/PolicySupportFooter';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card } from '../ui/Card';

type SupportType = 'INQUIRY' | 'BUG' | 'ACCOUNT_DELETE' | 'PRIVACY_DELETE';
type SupportStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

type SupportRow = {
  id: string;
  type: SupportType;
  typeLabel: string;
  title: string;
  message: string;
  contactName: string | null;
  contactEmail: string | null;
  userId: string | null;
  userName: string | null;
  pageUrl: string | null;
  status: SupportStatus;
  statusLabel: string;
  privacyConsent: boolean;
  createdAt: number;
  updatedAt: number;
};

async function safeReadJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function badgeTone(type: SupportType) {
  if (type === 'BUG') return badgePeach;
  if (type === 'ACCOUNT_DELETE') return badgeSky;
  if (type === 'PRIVACY_DELETE') return badgeLavender;
  return badgeMint;
}

export default function AdminSupportPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { me } = useAuth();

  const [rows, setRows] = useState<SupportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | SupportStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | SupportType>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc[row.status] += 1;
        return acc;
      },
      { total: 0, NEW: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 }
    );
  }, [rows]);

  function goLogin() {
    const next = `${loc.pathname}${loc.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (typeFilter !== 'ALL') query.set('type', typeFilter);
      const qs = query.toString();
      const res = await apiFetch(`/api/support/admin${qs ? `?${qs}` : ''}`);

      if (res.status === 401) {
        goLogin();
        return;
      }
      if (res.status === 403) {
        nav('/');
        return;
      }
      if (!res.ok) {
        const data = await safeReadJson(res);
        throw new Error(typeof data?.message === 'string' ? data.message : '문의 접수함을 불러오지 못했습니다.');
      }

      const data = await safeReadJson(res);
      setRows(Array.isArray(data) ? (data as SupportRow[]) : []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : '문의 접수함을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!me) return;
    if (!me.isAdmin) {
      nav('/');
      return;
    }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.isAdmin, statusFilter, typeFilter]);

  async function updateStatus(row: SupportRow, status: SupportStatus) {
    setUpdatingId(row.id);
    setError(null);

    try {
      const res = await apiFetch(`/api/support/admin/${row.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }
      if (res.status === 403) {
        nav('/');
        return;
      }
      if (!res.ok) {
        const data = await safeReadJson(res);
        throw new Error(typeof data?.message === 'string' ? data.message : '상태 변경에 실패했습니다.');
      }

      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (!me || !me.isAdmin) return null;

  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar
          title="문의 접수함"
          backTo="/admin"
          right={
            <Button variant="ghost" onClick={() => void loadAll()} disabled={loading}>
              {loading ? '불러오는 중…' : '새로고침'}
            </Button>
          }
          hideAuthActions
        />
        <PolicySupportHeaderNav variant="admin-support" />

        <Card pad style={heroCard}>
          <div style={eyebrow}>SUPPORT INBOX</div>
          <div style={heroTitle}>문의·버그·탈퇴·개인정보 요청 운영 화면</div>
          <div style={heroDesc}>새 접수 확인, 요청 유형 분류, 처리 상태 변경, 회신 정보 점검을 한 화면에서 할 수 있습니다.</div>
          <div style={chipRow}>
            <CountChip label={`전체 ${counts.total}`} tone="neutral" />
            <CountChip label={`신규 ${counts.NEW}`} tone="mint" />
            <CountChip label={`처리 중 ${counts.IN_PROGRESS}`} tone="sky" />
            <CountChip label={`해결 ${counts.RESOLVED}`} tone="peach" />
            <CountChip label={`종결 ${counts.CLOSED}`} tone="neutral" />
          </div>
        </Card>

        <Card pad style={filterCard}>
          <div style={filterTitle}>상태 필터</div>
          <div style={filterRow}>
            {['ALL', 'NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatusFilter(item as 'ALL' | SupportStatus)}
                style={{
                  ...filterBtn,
                  ...(statusFilter === item ? filterBtnActive : null)
                }}
              >
                {item === 'ALL'
                  ? '전체'
                  : item === 'NEW'
                    ? '신규'
                    : item === 'IN_PROGRESS'
                      ? '처리 중'
                      : item === 'RESOLVED'
                        ? '해결'
                        : '종결'}
              </button>
            ))}
          </div>

          <div style={{ ...filterTitle, marginTop: 16 }}>유형 필터</div>
          <div style={filterRow}>
            {[
              ['ALL', '전체'],
              ['INQUIRY', '일반 문의'],
              ['BUG', '버그'],
              ['ACCOUNT_DELETE', '탈퇴 요청'],
              ['PRIVACY_DELETE', '개인정보 삭제']
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTypeFilter(value as 'ALL' | SupportType)}
                style={{
                  ...filterBtn,
                  ...(typeFilter === value ? filterBtnActive : null)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        {error ? <div style={errorBox}>{error}</div> : null}

        <div style={listWrap}>
          {rows.map((row) => (
            <Card key={row.id} pad style={rowCard}>
              <div style={rowTop}>
                <div style={rowMetaLeft}>
                  <span style={{ ...badge, ...badgeTone(row.type) }}>{row.typeLabel}</span>
                  <span style={statusBadge}>{row.statusLabel}</span>
                </div>
                <div style={timeText}>{formatTime(row.createdAt)}</div>
              </div>

              <div style={rowTitle}>{row.title}</div>
              <div style={rowMessage}>{row.message}</div>

              <div style={infoGrid}>
                <InfoItem label="작성자" value={row.userName ?? row.contactName ?? '익명/미입력'} />
                <InfoItem label="이메일" value={row.contactEmail ?? '-'} />
                <InfoItem label="페이지" value={row.pageUrl ?? '-'} mono />
                <InfoItem label="최근 변경" value={formatTime(row.updatedAt)} />
              </div>

              <div style={actionRow}>
                <Button
                  variant="secondary"
                  onClick={() => void updateStatus(row, 'IN_PROGRESS')}
                  disabled={updatingId === row.id || row.status === 'IN_PROGRESS'}
                >
                  처리 중
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void updateStatus(row, 'RESOLVED')}
                  disabled={updatingId === row.id || row.status === 'RESOLVED'}
                >
                  해결 처리
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void updateStatus(row, 'CLOSED')}
                  disabled={updatingId === row.id || row.status === 'CLOSED'}
                >
                  종결
                </Button>
              </div>
            </Card>
          ))}

          {!loading && rows.length === 0 ? (
            <Card pad style={emptyCard}>
              현재 조건에 맞는 문의 접수 내역이 없습니다.
            </Card>
          ) : null}
        </div>

        <PolicySupportFooter variant="admin-support" />
      </div>
    </div>
  );
}

function CountChip({ label, tone }: { label: string; tone: 'mint' | 'peach' | 'sky' | 'neutral' }) {
  const toneStyle =
    tone === 'mint'
      ? { background: 'rgba(114,215,199,0.12)', color: '#2b7b70', borderColor: 'rgba(114,215,199,0.22)' }
      : tone === 'peach'
        ? { background: 'rgba(243,200,181,0.16)', color: '#9a664f', borderColor: 'rgba(243,200,181,0.28)' }
        : tone === 'sky'
          ? { background: 'rgba(179,225,246,0.18)', color: '#50799a', borderColor: 'rgba(179,225,246,0.28)' }
          : { background: 'rgba(255,255,255,0.72)', color: '#53646d', borderColor: 'rgba(255,255,255,0.56)' };

  return <span style={{ ...countChip, ...toneStyle }}>{label}</span>;
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={infoItem}>
      <div style={infoLabel}>{label}</div>
      <div style={{ ...infoValue, ...(mono ? monoValue : null) }}>{value}</div>
    </div>
  );
}

const heroCard: CSSProperties = {
  marginBottom: 12,
  borderRadius: 24
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#6a8fc9'
};

const heroTitle: CSSProperties = {
  marginTop: 10,
  fontSize: 27,
  lineHeight: 1.18,
  fontWeight: 800,
  color: '#24313a'
};

const heroDesc: CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  lineHeight: 1.68,
  color: '#61717a'
};

const chipRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 14
};

const countChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid transparent',
  fontSize: 12,
  fontWeight: 800
};

const filterCard: CSSProperties = {
  marginBottom: 12,
  borderRadius: 22
};

const filterTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: '#24313a'
};

const filterRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10
};

const filterBtn: CSSProperties = {
  minHeight: 36,
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.55)',
  background: 'rgba(255,255,255,0.74)',
  color: '#4b5b64',
  fontSize: 13,
  fontWeight: 800,
  padding: '0 12px',
  cursor: 'pointer'
};

const filterBtnActive: CSSProperties = {
  border: '1px solid rgba(114,215,199,0.28)',
  background: 'linear-gradient(180deg, rgba(240,255,251,0.96), rgba(233,250,246,0.88))',
  color: '#2c7d72'
};

const errorBox: CSSProperties = {
  marginBottom: 12,
  padding: '13px 14px',
  borderRadius: 16,
  background: 'rgba(255,240,240,0.92)',
  color: '#a14d4d',
  border: '1px solid rgba(241,180,180,0.32)',
  fontSize: 14,
  fontWeight: 700
};

const listWrap: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginBottom: 20
};

const rowCard: CSSProperties = {
  borderRadius: 22
};

const rowTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap'
};

const rowMetaLeft: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};

const badge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  border: '1px solid transparent'
};

const badgeMint: CSSProperties = {
  background: 'rgba(114,215,199,0.12)',
  color: '#2b7b70',
  borderColor: 'rgba(114,215,199,0.22)'
};

const badgePeach: CSSProperties = {
  background: 'rgba(243,200,181,0.16)',
  color: '#9a664f',
  borderColor: 'rgba(243,200,181,0.28)'
};

const badgeSky: CSSProperties = {
  background: 'rgba(179,225,246,0.18)',
  color: '#50799a',
  borderColor: 'rgba(179,225,246,0.28)'
};

const badgeLavender: CSSProperties = {
  background: 'rgba(220,210,255,0.22)',
  color: '#6b62a1',
  borderColor: 'rgba(196,184,243,0.32)'
};

const statusBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: 'rgba(255,255,255,0.72)',
  color: '#55656e',
  border: '1px solid rgba(255,255,255,0.56)'
};

const timeText: CSSProperties = {
  fontSize: 12,
  color: '#73828b',
  fontWeight: 700
};

const rowTitle: CSSProperties = {
  marginTop: 12,
  fontSize: 19,
  lineHeight: 1.35,
  fontWeight: 800,
  color: '#24313a'
};

const rowMessage: CSSProperties = {
  marginTop: 10,
  whiteSpace: 'pre-wrap',
  fontSize: 14,
  lineHeight: 1.75,
  color: '#53636c'
};

const infoGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  marginTop: 14
};

const infoItem: CSSProperties = {
  padding: '12px 13px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.66)',
  border: '1px solid rgba(255,255,255,0.5)'
};

const infoLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.06em',
  color: '#87a0a8'
};

const infoValue: CSSProperties = {
  marginTop: 7,
  fontSize: 13,
  lineHeight: 1.65,
  color: '#44545d',
  wordBreak: 'break-word'
};

const monoValue: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12
};

const actionRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 14
};

const emptyCard: CSSProperties = {
  borderRadius: 22,
  textAlign: 'center',
  fontSize: 14,
  color: '#66767f'
};
