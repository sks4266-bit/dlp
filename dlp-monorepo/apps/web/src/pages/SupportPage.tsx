import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import PolicySupportHeaderNav from '../components/legal/PolicySupportHeaderNav';
import PolicySupportFooter from '../components/legal/PolicySupportFooter';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card } from '../ui/Card';

type SupportType = 'INQUIRY' | 'BUG' | 'ACCOUNT_DELETE' | 'PRIVACY_DELETE';

const supportEmail = 'sks4266@gmail.com';

const typeConfig: Record<
  SupportType,
  {
    label: string;
    shortLabel: string;
    titlePlaceholder: string;
    messagePlaceholder: string;
    successMessage: string;
    hint: string;
  }
> = {
  INQUIRY: {
    label: '일반 문의',
    shortLabel: '문의',
    titlePlaceholder: '예: 회원 정보 수정 방법이 궁금합니다',
    messagePlaceholder: '문의 내용을 자세히 적어 주세요. 회신이 필요하면 이름 또는 이메일을 함께 남겨 주세요.',
    successMessage: '문의가 정상적으로 접수되었습니다.',
    hint: '서비스 사용법, 정책 문의, 기록 처리 문의 등을 남길 수 있어요.'
  },
  BUG: {
    label: '버그 리포트',
    shortLabel: '버그',
    titlePlaceholder: '예: 4월 맥체인 불러오기가 안 됩니다',
    messagePlaceholder: '언제, 어느 화면에서, 어떤 기기/브라우저에서, 어떤 문제가 발생했는지 자세히 적어 주세요.',
    successMessage: '버그 리포트가 접수되었습니다. 확인 후 반영하겠습니다.',
    hint: '오류 화면, 재현 순서, 사용 기기 정보를 함께 적으면 처리 속도가 빨라집니다.'
  },
  ACCOUNT_DELETE: {
    label: '계정 탈퇴 요청',
    shortLabel: '탈퇴',
    titlePlaceholder: '예: 계정 탈퇴 및 기록 처리 요청',
    messagePlaceholder: '탈퇴 요청 사유와 함께 본인 확인에 필요한 최소 정보, 남기고 싶은 문의 사항을 적어 주세요.',
    successMessage: '계정 탈퇴 요청이 접수되었습니다. 확인 후 안내드리겠습니다.',
    hint: '로그인 가능한 경우 내정보 페이지에서 직접 탈퇴할 수 있고, 추가 안내가 필요하면 여기에서 요청할 수 있어요.'
  },
  PRIVACY_DELETE: {
    label: '개인정보 삭제 요청',
    shortLabel: '개인정보',
    titlePlaceholder: '예: 개인정보 삭제 및 보관 정보 확인 요청',
    messagePlaceholder: '삭제를 원하는 정보 범위와 요청 사유를 적어 주세요. 필요 시 본인 확인 절차가 진행될 수 있습니다.',
    successMessage: '개인정보 삭제 요청이 접수되었습니다. 확인 후 안내드리겠습니다.',
    hint: '계정 탈퇴와 별도로 개인정보 삭제·처리정지 요청을 남길 수 있어요.'
  }
};

function isEmailLike(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SupportPage() {
  const nav = useNavigate();
  const { me } = useAuth();

  const [type, setType] = useState<SupportType>('INQUIRY');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [contactName, setContactName] = useState(me?.name ?? '');
  const [contactEmail, setContactEmail] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = typeConfig[type];
  const emailValid = isEmailLike(contactEmail);
  const needsReplyChannel = !me && (type === 'ACCOUNT_DELETE' || type === 'PRIVACY_DELETE');

  const helperText = useMemo(() => {
    if (type === 'ACCOUNT_DELETE') {
      return me
        ? '현재 로그인 중이면 내정보 페이지에서 즉시 회원탈퇴할 수 있고, 별도 기록 처리 문의는 여기에서 남길 수 있습니다.'
        : '로그인하지 않은 탈퇴 요청은 본인 확인을 위해 회신 가능한 이메일 입력이 필요합니다.';
    }
    if (type === 'PRIVACY_DELETE') {
      return '개인정보 삭제 요청은 접수 후 본인 확인 및 법령상 보관 필요 여부를 검토한 뒤 처리됩니다.';
    }
    if (type === 'BUG') {
      return '가능하면 오류가 난 페이지, 시간, 기기/브라우저, 재현 순서를 함께 적어 주세요.';
    }
    return '서비스 문의, 계정/기록 관련 문의, 정책 문의를 남길 수 있습니다.';
  }, [me, type]);

  const canSubmit =
    title.trim().length >= 2 &&
    message.trim().length >= 10 &&
    privacyConsent &&
    emailValid &&
    (!needsReplyChannel || contactEmail.trim().length > 0) &&
    !loading;

  async function submit() {
    if (!canSubmit) return;

    setLoading(true);
    setNotice(null);
    setError(null);

    try {
      const res = await apiFetch('/api/support', {
        method: 'POST',
        body: JSON.stringify({
          type,
          title: title.trim(),
          message: message.trim(),
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '/support',
          privacyConsent
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          typeof data?.message === 'string'
            ? data.message
            : typeof data?.error === 'string'
              ? data.error
              : '문의 접수에 실패했습니다.'
        );
      }

      setNotice(active.successMessage);
      setTitle('');
      setMessage('');
      setContactEmail('');
      setPrivacyConsent(false);
      if (!me) setContactName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '문의 접수에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="문의 / 요청 접수" backTo="/" hideAuthActions />
        <PolicySupportHeaderNav variant="support" />

        <Card pad style={heroCard}>
          <div style={eyebrow}>SUPPORT DESK</div>
          <div style={heroTitle}>문의, 버그 리포트, 탈퇴 요청, 개인정보 삭제 요청을 한 곳에서 접수할 수 있어요</div>
          <div style={heroDesc}>
            회원 여부와 관계없이 접수할 수 있습니다. 회신이 필요한 경우 이름 또는 이메일을 남겨 주세요.
            개인정보/계정 요청은 확인 절차 후 처리됩니다.
          </div>
          <div style={heroChips}>
            <Link to="/terms" style={linkChip}>이용약관</Link>
            <Link to="/privacy" style={linkChip}>개인정보 처리방침</Link>
            <a href={`mailto:${supportEmail}`} style={linkChip}>{supportEmail}</a>
            {me ? (
              <button type="button" style={linkButton} onClick={() => nav('/me')}>
                내정보 / 탈퇴
              </button>
            ) : null}
            {me?.isAdmin ? (
              <button type="button" style={linkButton} onClick={() => nav('/admin/support')}>
                관리자 접수함
              </button>
            ) : null}
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <div style={sectionTitle}>접수 유형</div>
          <div style={typeGrid}>
            {(Object.keys(typeConfig) as SupportType[]).map((item) => {
              const config = typeConfig[item];
              const activeType = item === type;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setType(item)}
                  style={{
                    ...typeCard,
                    ...(activeType ? typeCardActive : null)
                  }}
                >
                  <div style={typeCardTitle}>{config.label}</div>
                  <div style={typeCardDesc}>{config.hint}</div>
                </button>
              );
            })}
          </div>

          <div style={guideBox}>
            <div style={guideTitle}>{active.label} 안내</div>
            <div style={guideText}>{helperText}</div>
          </div>

          <div style={formStack}>
            <label style={field}>
              <span style={fieldLabel}>제목</span>
              <input
                className="glassInput"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={active.titlePlaceholder}
                maxLength={120}
              />
            </label>

            <label style={field}>
              <span style={fieldLabel}>내용</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={active.messagePlaceholder}
                maxLength={5000}
                style={textarea}
              />
            </label>

            <div style={grid2}>
              <label style={field}>
                <span style={fieldLabel}>이름(선택)</span>
                <input
                  className="glassInput"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="회신 또는 본인 확인이 필요할 때만 입력"
                  maxLength={40}
                />
              </label>

              <label style={field}>
                <span style={fieldLabel}>이메일{needsReplyChannel ? '(필수)' : '(선택)'}</span>
                <input
                  className="glassInput"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="name@example.com"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={120}
                />
              </label>
            </div>

            {!emailValid ? <div style={errorBox}>이메일 형식이 올바르지 않습니다.</div> : null}

            <label style={consentBox}>
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                style={checkbox}
              />
              <span style={consentText}>
                문의/버그 처리 및 요청 확인 목적의 개인정보 수집·이용에 동의합니다. 자세한 내용은{' '}
                <Link to="/privacy" style={textLink}>개인정보 처리방침</Link>
                에서 확인할 수 있습니다.
              </span>
            </label>

            <div style={tipBox}>
              <div style={tipTitle}>빠른 처리 팁</div>
              <ul style={tipList}>
                <li>버그 리포트는 발생 화면과 재현 순서를 적어 주세요.</li>
                <li>계정 탈퇴 요청은 로그인 가능 여부와 원하는 처리 방향을 함께 적어 주세요.</li>
                <li>개인정보 삭제 요청은 삭제를 원하는 항목 범위를 구체적으로 적어 주세요.</li>
              </ul>
            </div>

            {notice ? <div style={okBox}>{notice}</div> : null}
            {error ? <div style={errorBox}>{error}</div> : null}

            <div style={actionRow}>
              <Button variant="primary" size="lg" wide disabled={!canSubmit} onClick={() => void submit()}>
                {loading ? '접수 중…' : `${active.shortLabel} 보내기`}
              </Button>
            </div>
          </div>
        </Card>

        <PolicySupportFooter variant="support" />
      </div>
    </div>
  );
}

const heroCard: CSSProperties = {
  marginBottom: 14,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(247,252,255,0.76))'
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
  lineHeight: 1.2,
  fontWeight: 800,
  color: '#24313a'
};

const heroDesc: CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  lineHeight: 1.7,
  color: '#61717a'
};

const heroChips: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 14
};

const linkChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.82)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#43545d',
  fontSize: 12,
  fontWeight: 800,
  textDecoration: 'none'
};

const linkButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.12)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7b70',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer'
};

const sectionCard: CSSProperties = {
  borderRadius: 22
};

const sectionTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#24313a'
};

const typeGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  marginTop: 12
};

const typeCard: CSSProperties = {
  padding: '14px 14px 15px',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.55)',
  background: 'rgba(255,255,255,0.74)',
  textAlign: 'left',
  cursor: 'pointer'
};

const typeCardActive: CSSProperties = {
  border: '1px solid rgba(114,215,199,0.28)',
  background: 'linear-gradient(180deg, rgba(240,255,251,0.96), rgba(233,250,246,0.88))',
  boxShadow: '0 8px 20px rgba(112, 170, 156, 0.12)'
};

const typeCardTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: '#24313a'
};

const typeCardDesc: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 1.6,
  color: '#61717a'
};

const guideBox: CSSProperties = {
  marginTop: 14,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(247,252,255,0.78)',
  border: '1px solid rgba(195, 220, 236, 0.5)'
};

const guideTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: '#4f739d'
};

const guideText: CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.7,
  color: '#566671'
};

const formStack: CSSProperties = {
  display: 'grid',
  gap: 14,
  marginTop: 16
};

const field: CSSProperties = {
  display: 'grid',
  gap: 8
};

const fieldLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#42535c'
};

const textarea: CSSProperties = {
  width: '100%',
  minHeight: 180,
  resize: 'vertical',
  border: '1px solid rgba(255,255,255,0.58)',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.82)',
  padding: '14px 16px',
  outline: 'none',
  color: '#24313a',
  lineHeight: 1.6,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)'
};

const grid2: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12
};

const consentBox: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.62)',
  border: '1px solid rgba(255,255,255,0.48)'
};

const checkbox: CSSProperties = {
  marginTop: 2
};

const consentText: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: '#566671'
};

const textLink: CSSProperties = {
  color: '#547bb0',
  fontWeight: 800,
  textDecoration: 'none'
};

const tipBox: CSSProperties = {
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(255,249,240,0.74)',
  border: '1px solid rgba(244,217,181,0.45)'
};

const tipTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: '#9a664f'
};

const tipList: CSSProperties = {
  margin: '8px 0 0',
  paddingLeft: 18,
  color: '#6a5d56',
  fontSize: 13,
  lineHeight: 1.7
};

const okBox: CSSProperties = {
  padding: '13px 14px',
  borderRadius: 16,
  background: 'rgba(236,252,247,0.92)',
  color: '#27695f',
  border: '1px solid rgba(114,215,199,0.25)',
  fontSize: 14,
  fontWeight: 700
};

const errorBox: CSSProperties = {
  padding: '13px 14px',
  borderRadius: 16,
  background: 'rgba(255,240,240,0.92)',
  color: '#a14d4d',
  border: '1px solid rgba(241,180,180,0.32)',
  fontSize: 14,
  fontWeight: 700
};

const actionRow: CSSProperties = {
  marginTop: 4
};
