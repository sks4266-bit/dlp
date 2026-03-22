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

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      await login(username, password);
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
          <div style={eyebrow}>WELCOME BACK</div>
          <h1 style={heroTitle}>차분한 흐름으로 다시 이어가요</h1>
          <p style={heroDesc}>
            오늘의 말씀, 맥체인, 감사일기와 채널 소식을
            <br />
            같은 톤의 화면에서 자연스럽게 이어서 볼 수 있어요.
          </p>
        </section>

        <Card pad style={formCard}>
          <div style={cardHead}>
            <div>
              <div style={cardTitle}>다시 로그인</div>
              <div style={cardDesc}>아이디와 비밀번호를 입력하면 바로 이어서 이동합니다.</div>
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
              />
            </Field>

            {err ? <div style={errorBox}>{err}</div> : null}

            <div style={actions}>
              <Button type="submit" variant="primary" size="lg" wide disabled={loading}>
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

            <div style={footNote}>
              계정이 없나요?{' '}
              <Link to={registerLink} style={footLink}>
                회원가입
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={field}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </label>
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

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.54)',
  border: '1px solid rgba(255,255,255,0.62)',
  color: '#7b847f',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const heroTitle: CSSProperties = {
  margin: '12px 0 8px',
  color: '#24313a',
  fontSize: 28,
  lineHeight: 1.2,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  margin: 0,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const formCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)'
};

const cardHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 16
};

const cardTitle: CSSProperties = {
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
  background: 'rgba(255,112,112,0.10)',
  border: '1px solid rgba(255,112,112,0.22)',
  color: '#9a4a4a',
  fontSize: 14,
  fontWeight: 700
};

const actions: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 4
};

const footNote: CSSProperties = {
  textAlign: 'center',
  color: '#6c7780',
  fontSize: 13,
  paddingTop: 2
};

const footLink: CSSProperties = {
  color: '#2b7f72',
  fontWeight: 800,
  textDecoration: 'none'
};
