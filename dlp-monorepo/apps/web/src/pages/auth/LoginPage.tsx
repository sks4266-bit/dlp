import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import TopBar from '../../components/layout/TopBar';

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
    <div>
      <TopBar title="로그인" backTo="/" hideAuthActions />
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
        style={{ display: 'grid', gap: 10 }}
      >
        <Field label="아이디">
          <input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} autoCapitalize="none" />
        </Field>

        <Field label="비밀번호">
          <input value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} type="password" />
        </Field>

        {err && <div style={errorStyle}>{err}</div>}

        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? '로그인 중…' : '로그인'}
        </button>

        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          계정이 없나요? <Link to={registerLink}>회원가입</Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 12,
  border: '1px solid var(--border)',
  padding: '0 12px',
  fontSize: 15
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  height: 46,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--primary-bg)',
  color: 'var(--primary-text)',
  fontWeight: 900,
  fontSize: 15
};

const errorStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  background: 'rgba(255,0,0,0.06)',
  border: '1px solid rgba(255,0,0,0.18)'
};
