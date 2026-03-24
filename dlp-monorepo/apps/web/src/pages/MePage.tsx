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

const weekLabels = ['월', '화', '수', '목', '금', '토', '일'];

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
  const weekPercent = useMemo(() => clampPercent((((stats?.week.submittedCount ?? 0) || 0) / 7) * 100), [stats?.week.submittedCount]);

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

  async function handleLogout() {
    logout();
    nav('/', { replace: true });
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
      window.alert('내정보가 저장되었습니다.');
    } catch {
      window.alert('저장에 실패했습니다.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (!curPw || !newPw) {
      window.alert('비밀번호를 입력하세요.');
      return;
    }

    if (newPw !== newPw2) {
      window.alert('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setSavingPw(true);
    try {
      const res = await apiFetch('/api/me/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw })
      });

      if (res.status === 401) {
        window.alert('현재 비밀번호가 올바르지 않습니다.');
        return;
      }

      if (!res.ok) throw new Error('PW_CHANGE_FAILED');

      window.alert('비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
      logout();
      goLogin('/me');
    } catch {
      window.alert('비밀번호 변경에 실패했습니다.');
    } finally {
      setSavingPw(false);
      setCurPw('');
      setNewPw('');
      setNewPw2('');
    }
  }

  async function deleteAccount() {
    if (!deletePw) {
      window.alert('회원탈퇴를 위해 비밀번호를 입력하세요.');
      return;
    }

    const agreed = window.confirm('정말 회원탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
    if (!agreed) return;

    setDeleting(true);
    try {
      const res = await apiFetch('/api/me', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePw })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.alert('비밀번호가 올바르지 않습니다.');
        return;
      }

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'DELETE_ACCOUNT_FAILED');
      }

      logout();
      window.alert('회원탈퇴가 완료되었습니다.');
      nav('/', { replace: true });
    } catch {
      window.alert('회원탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.');
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
        <TopBar title="내정보" backTo="/" hideAuthActions />

        <Card pad style={heroCard}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={badgeMint}>MY ACCOUNT</div>
              <div style={heroTitle}>{me.name}</div>
              <div style={heroDesc}>홈 카드 기준 폭과 간격으로 다시 맞추고, 너무 크게 보이던 내정보 화면을 더 작고 차분하게 정리했습니다.</div>
            </div>
            <div style={roleChip}>{me.isAdmin ? 'ADMIN' : '사용자'}</div>
          </div>

          <div style={heroPillRow}>
            <span style={heroMintPill}>@{me.username}</span>
            <span style={heroPeachPill}>{me.homeChurch || '출석교회 미등록'}</span>
          </div>

          <div style={metaGrid}>
            <MetaBox label="휴대폰" value={me.phone ?? '-'} />
            <MetaBox label="누적 출석" value={`${stats?.attendanceDays ?? 0}일`} />
            <MetaBox label="이번 주 DLP" value={stats ? `${stats.week.submittedCount}/7` : '-'} />
            <MetaBox label="역할" value={me.isAdmin ? '관리자' : '일반 사용자'} />
          </div>

          <div style={actionGrid}>
            <Button variant="secondary" size="md" onClick={() => nav('/gratitude')}>
              감사일기 보기
            </Button>
            <Button variant="ghost" size="md" onClick={handleLogout}>
              로그아웃
            </Button>
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="SUMMARY" title="신앙 생활 요약" desc="홈 성과 버튼과 같은 게이지 톤으로 출석과 주간 DLP 흐름을 보여줍니다." />

          <div style={metricGrid}>
            <GaugeMetricCard label="누적 출석" value={`${stats?.attendanceDays ?? 0}일`} percent={attendancePercent} hint="365일 기준" tone="mint" />
            <GaugeMetricCard label="이번 주 DLP" value={stats ? `${stats.week.submittedCount}/7` : '-'} percent={weekPercent} hint="주간 제출 리듬" tone="peach" />
          </div>

          <div style={weekPanel}>
            <div style={panelTitle}>이번 주 제출 현황</div>
            <div style={panelDesc}>
              {stats?.week.start ?? '—'} ~ {stats?.week.end ?? '—'}
            </div>

            <div style={weekLabelRow}>
              {weekLabels.map((label) => (
                <div key={label} style={weekLabelStyle}>
                  {label}
                </div>
              ))}
            </div>

            <div className="weekDots">
              {(stats?.week.days ?? Array.from({ length: 7 }).map((_, i) => ({ date: String(i), hasDlp: false }))).map((dayItem, idx) => (
                <div key={idx} style={weekDotWrapStyle}>
                  <div className={['weekDot', dayItem.hasDlp ? 'weekDotOn' : ''].filter(Boolean).join(' ')} title={String(dayItem.date)} />
                </div>
              ))}
            </div>

            <div style={weekGuideStyle}>색이 채워진 날은 해당 날짜에 DLP가 제출된 날입니다.</div>
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="PROFILE" title="내정보 수정" desc="입력창과 버튼도 홈 기준 높이로 줄여 과하게 커 보이지 않도록 맞췄습니다." />

          <Field label="이름(실명)">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="glassInput" />
          </Field>
          <div className="stack10" />
          <Field label="휴대폰">
            <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="glassInput" inputMode="tel" placeholder="010-0000-0000" />
          </Field>
          <div className="stack10" />
          <Field label="출석교회">
            <input value={editChurch} onChange={(e) => setEditChurch(e.target.value)} className="glassInput" placeholder="출석교회 이름" />
          </Field>
          <div className="stack12" />
          <Button variant="primary" wide size="lg" disabled={savingProfile} onClick={saveProfile}>
            {savingProfile ? '저장 중…' : '내정보 저장'}
          </Button>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="SECURITY" title="비밀번호 변경" desc="큰 블록 대신 홈 시트 밀도와 비슷한 간결한 구성으로 정리했습니다." />

          <Field label="현재 비밀번호">
            <input value={curPw} onChange={(e) => setCurPw(e.target.value)} type="password" className="glassInput" />
          </Field>
          <div className="stack10" />
          <Field label="새 비밀번호(8자 이상)">
            <input value={newPw} onChange={(e) => setNewPw(e.target.value)} type="password" className="glassInput" />
          </Field>
          <div className="stack10" />
          <Field label="새 비밀번호 확인">
            <input value={newPw2} onChange={(e) => setNewPw2(e.target.value)} type="password" className="glassInput" />
          </Field>
          <div className="stack12" />
          <Button variant="primary" wide size="lg" disabled={savingPw} onClick={changePassword}>
            {savingPw ? '변경 중…' : '비밀번호 변경'}
          </Button>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="DANGER ZONE" title="회원탈퇴" desc="과한 크기 대신 홈 카드 밀도로 경고와 입력만 담아 정리했습니다." />

          <div style={dangerNoticeStyle}>탈퇴 후에는 내정보, 감사일기, DLP/맥체인 진행 기록이 함께 삭제되며 복구할 수 없습니다.</div>
          <div className="stack12" />
          <Field label="현재 비밀번호 확인">
            <input value={deletePw} onChange={(e) => setDeletePw(e.target.value)} type="password" className="glassInput" placeholder="회원탈퇴 확인용 비밀번호" />
          </Field>
          <div className="stack12" />
          <Button variant="danger" wide size="lg" disabled={deleting} onClick={deleteAccount}>
            {deleting ? '탈퇴 처리 중…' : '회원탈퇴'}
          </Button>
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
    <label className="glassField">
      <div className="glassFieldLabel">{label}</div>
      {children}
    </label>
  );
}

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaBox}>
      <div style={metaLabel}>{label}</div>
      <div style={metaValue}>{value}</div>
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
        <div style={{ ...metricFillBar, width: `${clampPercent(percent)}%`, background: fill }} />
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
  background: 'rgba(255,255,255,0.58)',
  border: '1px solid rgba(255,255,255,0.6)',
  color: '#5d6b73',
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
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800
};

const heroPeachPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.24)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800
};

const metaGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const metaBox: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.52)',
  border: '1px solid rgba(255,255,255,0.56)'
};

const metaLabel: CSSProperties = {
  color: '#7a8790',
  fontSize: 12,
  fontWeight: 700
};

const metaValue: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1.35
};

const actionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
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
  color: '#24313a',
  letterSpacing: '-0.02em'
};

const sectionDesc: CSSProperties = {
  marginTop: 6,
  color: '#6b7780',
  fontSize: 14,
  lineHeight: 1.6
};

const metricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10
};

const metricButton: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  minHeight: 110,
  borderRadius: 20,
  background: 'rgba(255,255,255,0.62)',
  textAlign: 'left',
  padding: 0
};

const metricFillTrack: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden'
};

const metricFillBar: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '0%'
};

const metricContent: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '14px 14px 12px'
};

const metricTopRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
};

const metricLabel: CSSProperties = {
  color: '#68757e',
  fontSize: 12,
  fontWeight: 800
};

const metricPercentBadge: CSSProperties = {
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const metricValue: CSSProperties = {
  marginTop: 10,
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.05,
  letterSpacing: '-0.02em'
};

const metricHint: CSSProperties = {
  marginTop: 8,
  color: '#6f7c85',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.45
};

const weekPanel: CSSProperties = {
  marginTop: 12,
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(248,250,251,0.72)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const panelTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 15,
  fontWeight: 800
};

const panelDesc: CSSProperties = {
  marginTop: 6,
  color: '#7a8790',
  fontSize: 12,
  fontWeight: 700
};

const weekLabelRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8,
  marginTop: 12,
  marginBottom: 8
};

const weekLabelStyle: CSSProperties = {
  textAlign: 'center',
  color: '#8a959d',
  fontSize: 11,
  fontWeight: 700
};

const weekDotWrapStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center'
};

const weekGuideStyle: CSSProperties = {
  marginTop: 10,
  color: '#7a878f',
  fontSize: 12,
  lineHeight: 1.45
};

const dangerNoticeStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(255, 241, 239, 0.82)',
  border: '1px solid rgba(235, 138, 127, 0.22)',
  color: '#9d5d57',
  fontSize: 13,
  lineHeight: 1.55
};
