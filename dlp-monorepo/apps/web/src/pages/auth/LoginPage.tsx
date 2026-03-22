import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import TopBar from '../../components/layout/TopBar';
import Button from '../../ui/Button';
import { Card, CardTitle, CardDesc } from '../../ui/Card';

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();

  const nextUrl = useMemo(() => {
    const qs = new URLSearchParams(loc.search);
    return qs.get('next') || '/';
  }, [loc.search]);

  const registerLink = useMemo(() => {
    return `/register?${new URLSearchParams({ next: nextUrl }).toString()}`;
  }, [nextUrl]);

  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div style={page}>
      <TopBar title="로그인" backTo="/" hideAuthActions />

      <main style={wrap}>
        <section style={hero}>
          <div style={heroBadge}>WELCOME BACK</div>
          <h1 style={heroTitle}>은은하고 편안한 흐름으로 다시 시작해요</h1>
          <p style={heroDesc}>
            오늘의 말씀, 맥체인, 감사일기와 채널 소식을
            <br />
            한 화면에서 자연스럽게 이어갈 수 있도록 준비했어요.
          </p>
        </section>

        <Card pad style={glassCard}>
          <div style={sectionTop}>
            <div>
              <CardTitle style={titleStyle}>다시 로그인</CardTitle>
              <CardDesc style={descStyle}>
                아이디와 비밀번호를 입력하면 바로 이어서 이동합니다.
              </CardDesc>
            </div>
            <div style={miniPill}>next 자동 복귀</div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
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
            }}
            style={form}
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

            <div style={actionBlock}>
              <Button type="submit" variant="primary" size="lg" wide disabled={loading}>
                {loading ? '로그인 중…' : '로그인'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="md"
                wide
                onClick={() => nav('/')}
                disabled={loading}
              >
                홈으로 돌아가기
              </Button>
            </div>

            <div style={footNote}>
              계정이 없나요? <Link to={registerLink}>회원가입</Link>
            </div>
          </form>
        </Card>
      </main>
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
  background:
    'radial-gradient(circle at top left, rgba(217,242,231,0.75), transparent 28%), radial-gradient(circle at top right, rgba(247,229,216,0.75), transparent 24%), linear-gradient(180deg, #f8f3ea 0%, #f7f4ef 42%, #f4f7f8 100%)'
};

const wrap: CSSProperties = {
  width: '100%',
  maxWidth: 560,
  margin: '0 auto',
  padding: '10px 16px 40px'
};

const hero: CSSProperties = {
  padding: '18px 4px 18px'
};

const heroBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.7)',
  color: '#5a6a67',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const heroTitle: CSSProperties = {
  margin: '14px 0 8px',
  fontSize: 28,
  lineHeight: 1.18,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  margin: 0,
  color: '#5f6b73',
  fontSize: 14,
  lineHeight: 1.65,
  fontWeight: 500
};

const glassCard: CSSProperties = {
  borderRadius: 28,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 18px 40px rgba(77,90,110,0.10)',
  backdropFilter: 'blur(16px)'
};

const sectionTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  marginBottom: 18
};

const titleStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em'
};

const descStyle: CSSProperties = {
  marginTop: 6,
  color: '#6c7780',
  fontSize: 14,
  lineHeight: 1.6
};

const miniPill: CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  color: '#2b7f72',
  border: '1px solid rgba(114,215,199,0.22)',
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
  fontSize: 13,
  fontWeight: 800,
  color: '#3d4a52'
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

const actionBlock: CSSProperties = {
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
