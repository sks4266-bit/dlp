import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

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
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="내정보" backTo="/" hideAuthActions />

        <Card className="glassHeroCard">
          <div className="profileHero">
            <div>
              <div style={eyebrowStyle}>MY ACCOUNT</div>
              <CardTitle>{me.name}</CardTitle>
              <CardDesc>@{me.username} · 개인 정보와 신앙 생활 흐름을 여기서 정리할 수 있어요.</CardDesc>
            </div>

            <div className="profileRoleChip">{me.isAdmin ? 'ADMIN' : '일반 사용자'}</div>
          </div>

          <div className="stack12" />

          <div className="profileMetaGrid">
            <MetaBox label="휴대폰" value={me.phone ?? '-'} />
            <MetaBox label="출석교회" value={me.homeChurch ?? '-'} />
          </div>

          <div className="stack12" />

          <div style={heroPillRowStyle}>
            <span style={heroMintPillStyle}>누적 출석 {stats?.attendanceDays ?? 0}일</span>
            <span style={heroPeachPillStyle}>이번 주 DLP {stats?.week.submittedCount ?? 0}/7</span>
          </div>
        </Card>

        <div className="stack12" />

        <Card>
          <CardTitle>신앙 생활 요약</CardTitle>
          <CardDesc>홈 성과 통계와 같은 기준으로 누적 출석과 이번 주 DLP 제출 흐름을 보여줍니다.</CardDesc>

          <div className="stack12" />

          <div className="glassStatGrid">
            <StatCard label="누적 출석일" value={String(stats?.attendanceDays ?? '-')} helper="전체 누적 기록" />
            <StatCard label="이번 주 제출" value={stats ? `${stats.week.submittedCount}/7` : '-'} helper="주간 DLP 기준" />
          </div>

          <div className="stack12" />

          <div style={summaryPanelStyle}>
            <div className="sectionMiniTitle">
              이번 주 제출 현황 ({stats?.week.start ?? '—'} ~ {stats?.week.end ?? '—'})
            </div>

            <div className="stack8" />

            <div style={weekLabelRowStyle}>
              {weekLabels.map((label) => (
                <div key={label} style={weekLabelStyle}>
                  {label}
                </div>
              ))}
            </div>

            <div className="weekDots">
              {(stats?.week.days ?? Array.from({ length: 7 }).map((_, i) => ({ date: String(i), hasDlp: false }))).map((dayItem, idx) => (
                <div key={idx} style={weekDotWrapStyle}>
                  <div
                    title={String(dayItem.date)}
                    className={['weekDot', dayItem.hasDlp ? 'weekDotOn' : ''].filter(Boolean).join(' ')}
                  />
                </div>
              ))}
            </div>

            <div style={weekGuideStyle}>색이 채워진 날은 해당 날짜에 DLP가 제출된 날입니다.</div>
          </div>
        </Card>

        <div className="stack12" />

        <Card>
          <CardTitle>바로가기</CardTitle>
          <CardDesc>자주 쓰는 계정 기능을 여기서 빠르게 실행할 수 있어요.</CardDesc>

          <div className="stack12" />

          <div style={actionGridStyle}>
            <Button variant="secondary" size="lg" wide onClick={() => nav('/gratitude')}>
              감사일기 페이지 열기
            </Button>
            <Button variant="ghost" size="lg" wide onClick={handleLogout}>
              로그아웃
            </Button>
          </div>
        </Card>

        <div className="stack12" />

        <Card>
          <CardTitle>내정보 수정</CardTitle>
          <CardDesc>이름, 연락처, 출석교회를 최신 상태로 유지해 주세요.</CardDesc>

          <div className="stack12" />

          <Field label="이름(실명)">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="glassInput" />
          </Field>

          <div className="stack10" />

          <Field label="휴대폰">
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="glassInput"
              inputMode="tel"
              placeholder="010-0000-0000"
            />
          </Field>

          <div className="stack10" />

          <Field label="출석교회">
            <input
              value={editChurch}
              onChange={(e) => setEditChurch(e.target.value)}
              className="glassInput"
              placeholder="출석교회 이름"
            />
          </Field>

          <div className="stack12" />

          <Button variant="primary" wide size="lg" disabled={savingProfile} onClick={saveProfile}>
            {savingProfile ? '저장 중…' : '내정보 저장'}
          </Button>
        </Card>

        <div className="stack12" />

        <Card>
          <CardTitle>비밀번호 변경</CardTitle>
          <CardDesc>변경 후 기존 로그인 세션은 모두 만료됩니다.</CardDesc>

          <div className="stack12" />

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

        <div className="stack12" />

        <Card>
          <CardTitle>회원탈퇴</CardTitle>
          <CardDesc>계정과 개인 기록이 삭제됩니다. 탈퇴 전 현재 비밀번호를 입력해 주세요.</CardDesc>

          <div className="stack12" />

          <div style={dangerNoticeStyle}>
            탈퇴 후에는 내정보, 감사일기, DLP/맥체인 진행 기록이 함께 삭제되며 복구할 수 없습니다.
          </div>

          <div className="stack12" />

          <Field label="현재 비밀번호 확인">
            <input
              value={deletePw}
              onChange={(e) => setDeletePw(e.target.value)}
              type="password"
              className="glassInput"
              placeholder="회원탈퇴 확인용 비밀번호"
            />
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
    <div className="glassMetaBox">
      <div className="glassMetaLabel">{label}</div>
      <div className="glassMetaValue">{value}</div>
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="glassStatCard">
      <div className="glassStatLabel">{label}</div>
      <div className="glassStatValue">{value}</div>
      <div style={statHelperStyle}>{helper}</div>
    </div>
  );
}

const eyebrowStyle: CSSProperties = {
  marginBottom: 8,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#82a39a'
};

const summaryPanelStyle: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(248,250,251,0.72)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const weekLabelRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8,
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

const actionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10
};

const heroPillRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap'
};

const heroMintPillStyle: CSSProperties = {
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

const heroPeachPillStyle: CSSProperties = {
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

const statHelperStyle: CSSProperties = {
  marginTop: 6,
  color: '#7b8790',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.4
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
