import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card } from '../ui/Card';

type MeStats = {
  attendanceDays: number;
  week: {
    start: string;
    end: string;
    submittedCount: number;
    days: { date: string; hasDlp: boolean }[];
  };
};

const weekLabels = ['', '', '', '', '', '', ''];

export default function MePage() {
  const nav = useNavigate();
  const { me, logout, refreshMe } = useAuth();

  const [stats, setStats] = useState<MeStats | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editChurch, setEditChurch] = useState('');
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [deletePw, setDeletePw] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const attendancePercent = useMemo(() => clampPercent(((stats?.attendanceDays ?? 0) / 365) * 100), [stats?.attendanceDays]);
  const weekPercent = useMemo(() => clampPercent(((stats?.week.submittedCount ?? 0) / 7) * 100), [stats?.week.submittedCount]);
  const weekDays = stats?.week.days ?? Array.from({ length: 7 }).map((_, i) => ({ date: String(i), hasDlp: false }));

  function goLogin(next = '/me') {
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function loadStats() {
    if (!me) return;

    const res = await apiFetch('/api/me/stats');
    if (res.status === 401) {
      goLogin('/me');
      return;
    }
    if (!res.ok) return;

    setStats(await res.json());
  }

  function handleLogout() {
    logout();
    nav('', { replace: true });
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await apiFetch('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName,
          phone: editPhone || null,
          homeChurch: editChurch || null
        })
      });

      if (res.status === 401) {
        goLogin('/me');
        return;
      }

      if (!res.ok) throw new Error('SAVE_FAILED');
      await refreshMe();
      window.alert('');
    } catch {
      window.alert('');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (!curPw || !newPw) {
      window.alert('');
      return;
    }

    if (newPw !== newPw2) {
      window.alert('');
      return;
    }

    setSavingPw(true);
    try {
      const res = await apiFetch('/api/me/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw })
      });

      if (res.status === 401) {
        window.alert('');
        return;
      }

      if (!res.ok) throw new Error('PW_CHANGE_FAILED');

      window.alert('');
      logout();
      goLogin('/me');
    } catch {
      window.alert('');
    } finally {
      setSavingPw(false);
      setCurPw('');
      setNewPw('');
      setNewPw2('');
    }
  }

  async function deleteAccount() {
    if (!deletePw) {
      window.alert('');
      return;
    }

    const agreed = window.confirm('');
    if (!agreed) return;

    setDeleting(true);
    try {
      const res = await apiFetch('/api/me', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePw })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.alert('');
        return;
      }

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'DELETE_ACCOUNT_FAILED');
      }

      logout();
      window.alert('');
      nav('', { replace: true });
    } catch {
      window.alert('');
    } finally {
      setDeleting(false);
      setDeletePw('');
    }
  }

  useEffect(() => {
    if (!me) return;

    setEditName(me.name ?? '');
    setEditPhone(me.phone ?? '');
    setEditChurch(me.homeChurch ?? '');
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  if (!me) return null;

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="" backTo="" hideAuthActions />

        <Card pad style={heroCard}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={badgeMint}>MY ACCOUNT</div>
              <div style={heroTitle}>{me.name}</div>
              <div style={heroDesc}></div>
            </div>
            <div style={roleChip}>{me.isAdmin ? 'ADMIN' : 'MEMBER'}</div>
          </div>

          <div style={heroPillRow}>
            <span style={heroMintPill}>@{me.username}</span>
            <span style={heroPeachPill}>{me.homeChurch || ''}</span>
          </div>

          <div style={summaryGrid}>
            <SummaryTile label="" value={me.phone ?? ''} tone="mint" />
            <SummaryTile label="" value={`${stats?.attendanceDays ?? 0}`} tone="peach" />
            <SummaryTile label=" DLP" value={stats ? `${stats.week.submittedCount}/7` : ''} tone="mint" />
            <SummaryTile label="" value={me.isAdmin ? '' : ''} tone="peach" />
          </div>

          <div style={heroActions}>
            <Button variant="secondary" size="md" onClick={() => nav('/gratitude')}>{''}</Button>
            <Button variant="ghost" size="md" onClick={handleLogout}>{''}</Button>
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="SUMMARY" title="" desc=" DLP ." />

          <div style={metricGrid}>
            <GaugeMetricCard label="" value={`${stats?.attendanceDays ?? 0}`} percent={attendancePercent} hint="365 " tone="mint" />
            <GaugeMetricCard label=" DLP" value={stats ? `${stats.week.submittedCount}/7` : ''} percent={weekPercent} hint="" tone="peach" />
          </div>

          <div style={weekPanel}>
            <div style={weekPanelTop}>
              <div>
                <div style={panelTitle}></div>
                <div style={panelDesc}>{stats?.week.start ?? ''} ~ {stats?.week.end ?? ''}</div>
              </div>
              <div style={panelChip}>{stats ? `${stats.week.submittedCount}` : '0 '}</div>
            </div>

            <div style={weekLabelRow}>
              {weekLabels.map((label) => (
                <div key={label} style={weekLabelStyle}>
                  {label}
                </div>
              ))}
            </div>

            <div className="weekDots">
              {weekDays.map((dayItem, idx) => (
                <div key={idx} style={weekDotWrapStyle}>
                  <div className={['weekDot', dayItem.hasDlp ? 'weekDotOn' : ''].filter(Boolean).join('')} title={String(dayItem.date)} />
                </div>
              ))}
            </div>

            <div style={weekGuideStyle}> DLP .</div>
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="PROFILE" title="" desc="" />

          <div style={formGrid}>
            <Field label="">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="glassInput" />
            </Field>
            <Field label="">
              <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="glassInput" inputMode="tel" placeholder="010-0000-0000" />
            </Field>
            <Field label="">
              <input value={editChurch} onChange={(e) => setEditChurch(e.target.value)} className="glassInput" placeholder="" />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            <Button variant="primary" wide size="lg" disabled={savingProfile} onClick={saveProfile}>
              {savingProfile ? '' : ''}
            </Button>
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="SECURITY" title="" desc="" />

          <div style={formGrid}>
            <Field label="">
              <input value={curPw} onChange={(e) => setCurPw(e.target.value)} type="password" className="glassInput" />
            </Field>
            <Field label=" (8 )">
              <input value={newPw} onChange={(e) => setNewPw(e.target.value)} type="password" className="glassInput" />
            </Field>
            <Field label="">
              <input value={newPw2} onChange={(e) => setNewPw2(e.target.value)} type="password" className="glassInput" />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            <Button variant="primary" wide size="lg" disabled={savingPw} onClick={changePassword}>
              {savingPw ? '' : ''}
            </Button>
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="DANGER ZONE" title="" desc="" />

          <div style={dangerNoticeStyle}> , , DLP/ .</div>

          <div style={{ marginTop: 14 }}>
            <Field label="">
              <input value={deletePw} onChange={(e) => setDeletePw(e.target.value)} type="password" className="glassInput" placeholder="" />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            <Button variant="danger" wide size="lg" disabled={deleting} onClick={deleteAccount}>
              {deleting ? '' : ''}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div style={sectionHeader}>
      <div style={sectionEyebrow}>{eyebrow}</div>
      <div style={sectionTitle}>{title}</div>
      <div style={sectionDesc}>{desc}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="glassField" style={fieldWrap}>
      <div className="glassFieldLabel">{label}</div>
      {children}
    </label>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: 'mint' | 'peach' }) {
  const bg = tone === 'mint' ? 'rgba(114,215,199,0.12)' : 'rgba(243,180,156,0.14)';
  const border = tone === 'mint' ? 'rgba(114,215,199,0.22)' : 'rgba(243,180,156,0.24)';
  const color = tone === 'mint' ? '#2f7f73' : '#9d6550';

  return (
    <div style={{ ...summaryTile, background: bg, border: `1px solid ${border}` }}>
      <div style={summaryLabel}>{label}</div>
      <div style={{ ...summaryValue, color }}>{value}</div>
    </div>
  );
}

function GaugeMetricCard({
  label,
  value,
  percent,
  hint,
  tone
}: {
  label: string;
  value: string;
  percent: number;
  hint: string;
  tone: 'mint' | 'peach';
}) {
  const fill = tone === 'mint' ? 'linear-gradient(90deg, rgba(114,215,199,0.28), rgba(114,215,199,0.14))' : 'linear-gradient(90deg, rgba(243,180,156,0.28), rgba(243,180,156,0.14))';
  const border = tone === 'mint' ? 'rgba(114,215,199,0.26)' : 'rgba(243,180,156,0.26)';
  const badgeBg = tone === 'mint' ? 'rgba(114,215,199,0.18)' : 'rgba(243,180,156,0.18)';
  const badgeColor = tone === 'mint' ? '#2f7f73' : '#9d6550';
  const valueColor = tone === 'mint' ? '#245f56' : '#8d5a47';

  return (
    <div style={{ ...metricButton, border: `1px solid ${border}` }}>
      <div style={metricFillTrack}>
        <div style={{ ...metricFillBar, width: `${clampPercent(percent)}`, background: fill }} />
      </div>
      <div style={metricContent}>
        <div style={metricTopRow}>
          <div style={metricLabel}>{label}</div>
          <div style={{ ...metricPercentBadge, background: badgeBg, color: badgeColor }}>{clampPercent(percent)}%</div>
        </div>
        <div style={{ ...metricValue, color: valueColor }}>{value}</div>
        <div style={metricHint}>{hint}</div>
      </div>
    </div>
  );
}

const page: CSSProperties = {
  minHeight: '100dvh',
  padding: '12px 14px 30px',
  background: 'transparent'
};

const pageInner: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  margin: '0 auto'
};

const heroCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)',
  marginBottom: 12
};

const heroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap'
};

const heroCopy: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const badgeMint: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10
};

const heroTitle: CSSProperties = {
  fontSize: 27,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em',
  lineHeight: 1.18
};

const heroDesc: CSSProperties = {
  marginTop: 8,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const roleChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.68)',
  border: '1px solid rgba(221,230,235,0.94)',
  color: '#58656e',
  fontSize: 12,
  fontWeight: 800
};

const heroPillRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 14
};

const heroMintPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800
};

const heroPeachPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800
};

const summaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  marginTop: 14
};

const summaryTile: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.46)'
};

const summaryLabel: CSSProperties = {
  color: '#74818a',
  fontSize: 12,
  fontWeight: 800
};

const summaryValue: CSSProperties = {
  marginTop: 8,
  fontSize: 18,
  fontWeight: 800,
  color: '#24313a',
  lineHeight: 1.25,
  wordBreak: 'break-word'
};

const heroActions: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  marginTop: 14
};

const sectionCard: CSSProperties = {
  marginBottom: 12,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const sectionHeader: CSSProperties = {
  padding: '2px 2px 12px'
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const sectionTitle: CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 800,
  color: '#24313a'
};

const sectionDesc: CSSProperties = {
  marginTop: 6,
  color: '#6b7780',
  fontSize: 14,
  lineHeight: 1.6
};

const metricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10
};

const metricButton: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,251,252,0.74))',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  minHeight: 112
};

const metricFillTrack: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  borderRadius: 20
};

const metricFillBar: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  borderRadius: 20
};

const metricContent: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '16px 15px 14px'
};

const metricTopRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
};

const metricLabel: CSSProperties = {
  color: '#65727b',
  fontSize: 12,
  fontWeight: 800
};

const metricPercentBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800
};

const metricValue: CSSProperties = {
  marginTop: 12,
  fontSize: 26,
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: '-0.02em'
};

const metricHint: CSSProperties = {
  marginTop: 10,
  color: '#738089',
  fontSize: 12,
  lineHeight: 1.45
};

const weekPanel: CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(248,251,252,0.74))',
  border: '1px solid rgba(255,255,255,0.62)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.46)'
};

const weekPanelTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap'
};

const panelTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 16,
  fontWeight: 800
};

const panelDesc: CSSProperties = {
  marginTop: 4,
  color: '#728089',
  fontSize: 12,
  lineHeight: 1.5
};

const panelChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800
};

const weekLabelRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8,
  marginTop: 12
};

const weekLabelStyle: CSSProperties = {
  textAlign: 'center',
  color: '#7a8790',
  fontSize: 12,
  fontWeight: 800
};

const weekDotWrapStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center'
};

const weekGuideStyle: CSSProperties = {
  marginTop: 10,
  color: '#738089',
  fontSize: 12,
  lineHeight: 1.5
};

const formGrid: CSSProperties = {
  display: 'grid',
  gap: 12
};

const fieldWrap: CSSProperties = {
  margin: 0
};

const dangerNoticeStyle: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(255, 238, 235, 0.74)',
  border: '1px solid rgba(228, 143, 132, 0.22)',
  color: '#9a4d46',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.6
};
