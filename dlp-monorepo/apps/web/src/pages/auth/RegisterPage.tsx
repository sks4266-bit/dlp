import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import TopBar from '../../components/layout/TopBar';
import Button from '../../ui/Button';
import { Card } from '../../ui/Card';

export default function RegisterPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { register, login } = useAuth();

  const nextUrl = useMemo(() => {
    const qs = new URLSearchParams(loc.search);
    return qs.get('next') || '/';
  }, [loc.search]);

  const loginLink = useMemo(() => {
    return `/login?${new URLSearchParams({ next: nextUrl }).toString()}`;
  }, [nextUrl]);

  const nextLabel = useMemo(() => {
    if (!nextUrl || nextUrl === '/') return '가입 후 홈으로 이동';
    return `가입 후 ${nextUrl} 로 이동`;
  }, [nextUrl]);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [homeChurch, setHomeChurch] = useState('');

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    username.trim().length > 0 &&
    password.trim().length >= 8 &&
    passwordConfirm.trim().length > 0 &&
    password === passwordConfirm &&
    !loading;

  function validate() {
    if (!name.trim()) return '이름을 입력해 주세요.';
    if (!username.trim()) return '아이디를 입력해 주세요.';
    if (password.trim().length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (!passwordConfirm.trim()) return '비밀번호 확인을 입력해 주세요.';
    if (password !== passwordConfirm) return '비밀번호 확인이 일치하지 않습니다.';
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      setOk(null);
      return;
    }

    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      await register({
        name: name.trim(),
        username: username.trim(),
        password,
        phone: phone.trim() || undefined,
        homeChurch: homeChurch.trim() || undefined
      });

      await login(username.trim(), password);
      setOk('가입 및 로그인이 완료되었습니다.');
      setTimeout(() => {
        nav(nextUrl, { replace: true });
      }, 350);
    } catch (e: any) {
      setErr(e?.message ?? '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="회원가입" backTo="/login" hideAuthActions />

        <section style={hero}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={badgePeach}>NEW ACCOUNT</div>
              <h1 style={heroTitle}>같은 톤의 흐름으로 처음 시작해요</h1>
              <p style={heroDesc}>
                계정을 만들면 말씀 묵상, QT, 맥체인, 감사일기와 채널 기능을
                <br />
                한 흐름 안에서 자연스럽게 이어서 사용할 수 있어요.
              </p>
            </div>

            <div style={heroIconWrap} aria-hidden="true">
              <SparkUserIcon />
            </div>
          </div>

          <div style={metaRow}>
            <MetaChip icon={<ArrowMiniIcon />} text={nextLabel} />
          </div>
        </section>

        <Card pad style={formCard}>
          <div style={cardHead}>
            <div>
              <div style={sectionEyebrow}>SIGN UP</div>
              <div style={cardTitle}>새 계정 만들기</div>
              <div style={cardDesc}>
                필수 정보만 입력하면 바로 가입되고,
                자동 로그인 후 요청한 화면으로 이동합니다.
              </div>
            </div>

            <div style={peachPill}>자동 로그인</div>
          </div>

          <form
            style={form}
            onSubmit={async (e) => {
              e.preventDefault();
              await submit();
            }}
          >
            <Field label="이름(실명)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={input}
                autoComplete="name"
                placeholder="실명을 입력하세요"
                disabled={loading}
                autoFocus
              />
            </Field>

            <Field label="아이디">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={input}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                placeholder="아이디를 입력하세요"
                disabled={loading}
              />
            </Field>

            <Field label="비밀번호(8자 이상)">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={input}
                type="password"
                autoComplete="new-password"
                placeholder="8자 이상 입력하세요"
                disabled={loading}
              />
            </Field>

            <Field label="비밀번호 확인">
              <input
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                style={input}
                type="password"
                autoComplete="new-password"
                placeholder="비밀번호를 다시 입력하세요"
                disabled={loading}
              />
            </Field>

            <Field label="휴대폰번호(선택)">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={input}
                inputMode="tel"
                autoComplete="tel"
                placeholder="선택 입력"
                disabled={loading}
              />
            </Field>

            <Field label="출석교회(선택)">
              <input
                value={homeChurch}
                onChange={(e) => setHomeChurch(e.target.value)}
                style={input}
                autoComplete="organization"
                placeholder="선택 입력"
                disabled={loading}
              />
            </Field>

            {err ? <MessageBox tone="error" text={err} /> : null}
            {ok ? <MessageBox tone="success" text={ok} /> : null}

            <div style={helperPanel}>
              <div style={helperTitle}>가입 안내</div>
              <div style={helperText}>
                필수 입력은 이름, 아이디, 비밀번호입니다.
                휴대폰번호와 출석교회는 필요할 때만 입력해도 됩니다.
              </div>
            </div>

            <div style={actions}>
              <Button type="submit" variant="primary" size="lg" wide disabled={!canSubmit}>
                {loading ? '가입 처리 중…' : '회원가입'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="lg"
                wide
                onClick={() => nav(loginLink)}
                disabled={loading}
              >
                이미 계정이 있어요
              </Button>
            </div>

            <div style={dividerWrap}>
              <div style={dividerLine} />
              <span style={dividerText}>또는</span>
              <div style={dividerLine} />
            </div>

            <Link to={loginLink} style={loginCardLink}>
              <div style={loginCard}>
                <div style={loginCopy}>
                  <div style={loginTitle}>로그인으로 이동</div>
                  <div style={loginDesc}>이미 계정이 있다면 바로 로그인해서 이어서 사용하세요.</div>
                </div>
                <div style={loginArrow}>›</div>
              </div>
            </Link>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={field}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </label>
  );
}

function MessageBox({
  tone,
  text
}: {
  tone: 'error' | 'success';
  text: string;
}) {
  const isSuccess = tone === 'success';

  return (
    <div
      style={{
        ...messageBox,
        background: isSuccess ? 'rgba(231, 249, 244, 0.88)' : 'rgba(255,243,240,0.92)',
        borderColor: isSuccess ? 'rgba(114,215,199,0.30)' : 'rgba(235,138,127,0.24)',
        color: isSuccess ? '#2d7d6e' : '#9a4a4a'
      }}
    >
      {text}
    </div>
  );
}

function MetaChip({
  icon,
  text
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <div style={metaChip}>
      <span style={metaChipIcon}>{icon}</span>
      <span style={metaChipText}>{text}</span>
    </div>
  );
}

function SparkUserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={icon24}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="m18.8 5.4.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4.4-1.2Z" />
    </svg>
  );
}

function ArrowMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={icon14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
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

const hero: CSSProperties = {
  padding: '8px 4px 14px'
};

const heroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14
};

const heroCopy: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const badgePeach: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.24)',
  color: '#a05f48',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10
};

const heroTitle: CSSProperties = {
  margin: 0,
  color: '#24313a',
  fontSize: 28,
  lineHeight: 1.2,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  margin: '8px 0 0',
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const heroIconWrap: CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  background: 'rgba(243,180,156,0.14)',
  color: '#d38b72',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.48)'
};

const metaRow: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 12
};

const metaChip: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 38,
  padding: '0 12px',
  borderRadius: 14,
  background: 'rgba(247,250,251,0.78)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#5f6c74'
};

const metaChipIcon: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#7a8a93',
  flex: '0 0 auto'
};

const metaChipText: CSSProperties = {
  minWidth: 0,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.45
};

const formCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)'
};

const cardHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 16
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const cardTitle: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 24,
  lineHeight: 1.2,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const cardDesc: CSSProperties = {
  marginTop: 6,
  color: '#69767e',
  fontSize: 14,
  lineHeight: 1.55
};

const peachPill: CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.24)',
  color: '#a05f48',
  fontSize: 12,
  fontWeight: 800
};

const form: CSSProperties = {
  display: 'grid',
  gap: 14
};

const field: CSSProperties = {
  display: 'grid',
  gap: 8
};

const fieldLabel: CSSProperties = {
  color: '#3d4a52',
  fontSize: 13,
  fontWeight: 800
};

const input: CSSProperties = {
  width: '100%',
  height: 52,
  borderRadius: 18,
  border: '1px solid rgba(202,212,220,0.9)',
  background: 'rgba(255,255,255,0.82)',
  padding: '0 16px',
  fontSize: 15,
  color: '#24313a',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)'
};

const messageBox: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  border: '1px solid transparent',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.5
};

const helperPanel: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(247,250,251,0.76)',
  border: '1px solid rgba(224,231,236,0.84)'
};

const helperTitle: CSSProperties = {
  color: '#3d4a53',
  fontSize: 13,
  fontWeight: 800
};

const helperText: CSSProperties = {
  marginTop: 6,
  color: '#6d7a83',
  fontSize: 13,
  lineHeight: 1.6
};

const actions: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 2
};

const dividerWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 2
};

const dividerLine: CSSProperties = {
  height: 1,
  flex: 1,
  background: 'rgba(188,199,206,0.62)'
};

const dividerText: CSSProperties = {
  color: '#8a969e',
  fontSize: 12,
  fontWeight: 800
};

const loginCardLink: CSSProperties = {
  textDecoration: 'none'
};

const loginCard: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 72,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.56)',
  border: '1px solid rgba(255,255,255,0.62)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.46)'
};

const loginCopy: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const loginTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1.35
};

const loginDesc: CSSProperties = {
  marginTop: 4,
  color: '#69767e',
  fontSize: 13,
  lineHeight: 1.45
};

const loginArrow: CSSProperties = {
  color: '#96a1a8',
  fontSize: 20,
  fontWeight: 700,
  flex: '0 0 auto'
};

const icon24: CSSProperties = {
  width: 24,
  height: 24
};

const icon14: CSSProperties = {
  width: 14,
  height: 14
};
