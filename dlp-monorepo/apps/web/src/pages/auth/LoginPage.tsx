import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import TopBar from '../../components/layout/TopBar';
import Button from '../../ui/Button';
import { Card } from '../../ui/Card';

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { login } = useAuth();

  const nextUrl = useMemo(() => {
    const qs = new URLSearchParams(loc.search);
    return qs.get('next') || '/';
  }, [loc.search]);

  const registerLink = useMemo(() => {
    return `/register?${new URLSearchParams({ next: nextUrl }).toString()}`;
  }, [nextUrl]);

  const nextLabel = useMemo(() => {
    if (!nextUrl || nextUrl === '/') return '로그인 후 홈으로 이동';
    return `로그인 후 ${nextUrl} 로 이동`;
  }, [nextUrl]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length > 0 && password.trim().length > 0 && !loading;

  async function submit() {
    if (!canSubmit) return;

    setErr(null);
    setLoading(true);

    try {
      await login(username.trim(), password);
      nav(nextUrl, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="로그인" backTo="/" hideAuthActions />

        <section style={hero}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={badgeMint}>WELCOME BACK</div>
              <h1 style={heroTitle}>같은 톤으로, 바로 이어서 들어가요</h1>
              <p style={heroDesc}>
                오늘의 말씀, QT, 맥체인, 감사일기와 채널 기능을
                <br />
                같은 결의 화면에서 자연스럽게 이어서 사용할 수 있어요.
              </p>
            </div>

            <div style={heroIconWrap} aria-hidden="true">
              <LockHeartIcon />
            </div>
          </div>

          <div style={metaRow}>
            <MetaChip icon={<ArrowMiniIcon />} text={nextLabel} />
          </div>
        </section>

        <Card pad style={formCard}>
          <div style={cardHead}>
            <div>
              <div style={sectionEyebrow}>SIGN IN</div>
              <div style={cardTitle}>다시 로그인</div>
              <div style={cardDesc}>
                아이디와 비밀번호를 입력하면
                원래 보던 화면으로 바로 돌아갑니다.
              </div>
            </div>

            <div style={mintPill}>자동 복귀</div>
          </div>

          <form
            style={form}
            onSubmit={async (e) => {
              e.preventDefault();
              await submit();
            }}
          >
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
                autoFocus
              />
            </Field>

            <Field label="비밀번호">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={input}
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
                disabled={loading}
              />
            </Field>

            {err ? <ErrorBox message={err} /> : null}

            <div style={helperPanel}>
              <div style={helperTitle}>안내</div>
              <div style={helperText}>
                로그인 후에는 요청한 페이지로 자동 이동합니다.
                계정이 아직 없다면 아래에서 회원가입으로 바로 이어갈 수 있어요.
              </div>
            </div>

            <div style={actions}>
              <Button type="submit" variant="primary" size="lg" wide disabled={!canSubmit}>
                {loading ? '로그인 중…' : '로그인'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="lg"
                wide
                onClick={() => nav('/')}
                disabled={loading}
              >
                홈으로 돌아가기
              </Button>
            </div>

            <div style={dividerWrap}>
              <div style={dividerLine} />
              <span style={dividerText}>또는</span>
              <div style={dividerLine} />
            </div>

            <Link to={registerLink} style={registerCardLink}>
              <div style={registerCard}>
                <div style={registerCopy}>
                  <div style={registerTitle}>회원가입</div>
                  <div style={registerDesc}>처음이라면 계정을 만들고 같은 흐름으로 시작해 보세요.</div>
                </div>
                <div style={registerArrow}>›</div>
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

function ErrorBox({ message }: { message: string }) {
  return <div style={errorBox}>{message}</div>;
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

function LockHeartIcon() {
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
      <rect x="5" y="10" width="14" height="10" rx="3" />
      <path d="M8 10V8a4 4 0 1 1 8 0v2" />
      <path d="M12 17.2s-2.4-1.3-2.4-3.1a1.5 1.5 0 0 1 2.8-.7 1.5 1.5 0 0 1 2.8.7c0 1.8-2.4 3.1-2.4 3.1Z" />
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
  background: 'rgba(114,215,199,0.12)',
  color: '#4dbdaa',
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

const mintPill: CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72',
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

const errorBox: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(255,243,240,0.92)',
  border: '1px solid rgba(235,138,127,0.24)',
  color: '#9a4a4a',
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

const registerCardLink: CSSProperties = {
  textDecoration: 'none'
};

const registerCard: CSSProperties = {
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

const registerCopy: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const registerTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1.35
};

const registerDesc: CSSProperties = {
  marginTop: 4,
  color: '#69767e',
  fontSize: 13,
  lineHeight: 1.45
};

const registerArrow: CSSProperties = {
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
