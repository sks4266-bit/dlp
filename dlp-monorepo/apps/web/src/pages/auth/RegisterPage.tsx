import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import TopBar from '../../components/layout/TopBar';
import Button from '../../ui/Button';
import { Card, CardTitle, CardDesc } from '../../ui/Card';

export default function RegisterPage() {
  const nav = useNavigate();
  const loc = useLocation();

  const nextUrl = useMemo(() => {
    const qs = new URLSearchParams(loc.search);
    return qs.get('next') || '/';
  }, [loc.search]);

  const { register, login } = useAuth();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [homeChurch, setHomeChurch] = useState('');

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div style={page}>
      <TopBar title="회원가입" backTo="/login" hideAuthActions />

      <main style={wrap}>
        <section style={hero}>
          <div style={heroBadge}>SOFT SANCTUARY</div>
          <h1 style={heroTitle}>차분한 첫 화면에서 신앙 루틴을 시작해요</h1>
          <p style={heroDesc}>
            계정을 만들면 말씀 묵상, DLP, 감사일기, 채널 소식을
            <br />
            같은 톤의 인터페이스에서 자연스럽게 이어서 사용할 수 있어요.
          </p>
        </section>

        <Card pad style={glassCard}>
          <div style={sectionTop}>
            <div>
              <CardTitle style={titleStyle}>새 계정 만들기</CardTitle>
              <CardDesc style={descStyle}>
                필수 정보만 입력하고 바로 로그인까지 진행됩니다.
              </CardDesc>
            </div>
            <div style={miniPill}>가입 후 자동 로그인</div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErr(null);
              setOk(null);
              setLoading(true);

              try {
                await register({
                  name,
                  username,
                  password,
                  phone: phone || undefined,
                  homeChurch: homeChurch || undefined
                });

                await login(username, password);
                setOk('가입 및 로그인이 완료되었습니다.');
                setTimeout(() => nav(nextUrl, { replace: true }), 400);
              } catch (e: any) {
                setErr(e?.message ?? '회원가입에 실패했습니다.');
              } finally {
                setLoading(false);
              }
            }}
            style={form}
          >
            <div style={grid2}>
              <Field label="이름(실명)">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={input}
                  autoComplete="name"
                  placeholder="실명을 입력하세요"
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
                />
              </Field>
            </div>

            <Field label="비밀번호(8자 이상)">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={input}
                type="password"
                autoComplete="new-password"
                placeholder="8자 이상 입력하세요"
              />
            </Field>

            <div style={grid2}>
              <Field label="휴대폰번호(선택)">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={input}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="선택 입력"
                />
              </Field>

              <Field label="출석교회(선택)">
                <input
                  value={homeChurch}
                  onChange={(e) => setHomeChurch(e.target.value)}
                  style={input}
                  placeholder="선택 입력"
                />
              </Field>
            </div>

            {err ? <div style={errorBox}>{err}</div> : null}
            {ok ? <div style={okBox}>{ok}</div> : null}

            <div style={actionBlock}>
              <Button type="submit" variant="primary" size="lg" wide disabled={loading}>
                {loading ? '처리 중…' : '회원가입'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="md"
                wide
                onClick={() => nav(`/login?${new URLSearchParams({ next: nextUrl }).toString()}`)}
                disabled={loading}
              >
                이미 계정이 있어요
              </Button>
            </div>

            <div style={footNote}>
              이미 계정이 있나요?{' '}
              <Link to={`/login?${new URLSearchParams({ next: nextUrl }).toString()}`}>
                로그인
              </Link>
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
  maxWidth: 640,
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
  marginBottom: 18,
  flexWrap: 'wrap'
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
  background: 'rgba(243,180,156,0.16)',
  color: '#9a5d47',
  border: '1px solid rgba(243,180,156,0.26)',
  fontSize: 12,
  fontWeight: 800
};

const form: CSSProperties = {
  display: 'grid',
  gap: 14
};

const grid2: CSSProperties = {
  display: 'grid',
  gap: 14,
  gridTemplateColumns: '1fr 1fr'
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
  outline: 'none'
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

const okBox: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72',
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
